window.WB = window.WB || {};

WB.Weapon = class {
    constructor(owner, config) {
        this.owner = owner;
        this.type = config.type;
        this.angle = WB.random() * Math.PI * 2;
        this.rotationSpeed = config.rotationSpeed || 0.05;
        this.baseDamage = config.baseDamage || 3;
        this.currentDamage = this.baseDamage;
        this.reach = config.reach != null ? config.reach : 40;
        this.baseReach = this.reach;
        this.hitCount = 0;
        this.totalDamageDealt = 0;
        this.cooldown = 0;
        this.superActive = false;
        this.superThreshold = config.superThreshold || WB.Config.SUPER_THRESHOLD;
        this.scalingStat = { name: config.scalingName || 'Damage', value: this.baseDamage };
        this.canParry = config.canParry !== false;
        this.unparryable = false;
        this.isRanged = config.isRanged || false;
        this._deflectReverse = 0; // frames of reversed spin from parry/deflection

        // Apply weapon stat overrides from sprite editor (localStorage)
        if (WB._weaponStatConfig && WB._weaponStatConfig[this.type]) {
            var ov = WB._weaponStatConfig[this.type];
            if (ov.baseDamage != null) { this.baseDamage = ov.baseDamage; this.currentDamage = ov.baseDamage; }
            if (ov.reach != null) { this.reach = ov.reach; this.baseReach = ov.reach; }
            if (ov.rotationSpeed != null) this.rotationSpeed = ov.rotationSpeed;
        }
    }

    // Weapon tip position
    getTipX() { return this.owner.x + Math.cos(this.angle) * this.reach; }
    getTipY() { return this.owner.y + Math.sin(this.angle) * this.reach; }

    // Mid-point along weapon (for wider collision on some weapons)
    getMidX() { return this.owner.x + Math.cos(this.angle) * this.reach * 0.6; }
    getMidY() { return this.owner.y + Math.sin(this.angle) * this.reach * 0.6; }

    // Rotation direction: reversed by Dionysus madness OR parry deflection
    getDir() {
        const madness = this.owner.debuffs && this.owner.debuffs.weaponReversed > 0;
        const deflected = this._deflectReverse > 0;
        // XOR: if both are active they cancel out (double-negative = forward)
        return (madness !== deflected) ? -1 : 1;
    }

    update() {
        if (this._deflectReverse > 0) this._deflectReverse--;
        this.angle += this.rotationSpeed * this.getDir();
        if (this.cooldown > 0) this.cooldown--;
    }

    canHit() {
        return this.cooldown <= 0;
    }

    onHit(target) {
        this.totalDamageDealt += this.currentDamage;
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);

        // All fancy effects via reusable helper
        this._onHitEffects(target, this.currentDamage, this.owner.color);
    }

    // Reusable hit effects — minimal for normal hits, escalates on high combos
    _onHitEffects(target, dmg, color, comboOverride) {
        if (!WB.GLEffects) return;

        // Track combo
        WB.GLEffects.incrementCombo(this.owner.side);
        const combo = comboOverride !== undefined ? comboOverride : WB.GLEffects.getCombo(this.owner.side);
        if (combo >= 2) {
            WB.Audio.comboClack(combo);
        }

        // Always: damage number + small impact ring
        WB.GLEffects.spawnDamageNumber(target.x, target.y, dmg, color);
        WB.GLEffects.spawnImpact(target.x, target.y, color, 20 + dmg * 2);

        // Small particle burst
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.emit(target.x, target.y, 3 + Math.min(combo, 5), color);
        }

        // Only high combos get extra effects
        if (combo >= 5) {
            WB.GLEffects.triggerHitStop(2);
            WB.GLEffects.spawnClashSparks(target.x, target.y, combo, color);
        }
        if (combo >= 8) {
            WB.GLEffects.triggerChromatic(0.1);
            WB.GLEffects.triggerArenaPulse(color);
        }
    }

    applyScaling() {
        // Override in subclass
    }

    checkSuper() {
        if (!WB.Config.SUPERS_ENABLED) return;
        if (!this.superActive && this.hitCount >= this.superThreshold) {
            this.superActive = true;
            this.activateSuper();
            WB.Audio.superActivate();
            if (WB.Game && WB.Game._excitement) {
                WB.Game._excitement.recordSuper();
            }
            if (WB.Game && WB.Game.particles) {
                WB.Game.particles.explode(this.owner.x, this.owner.y, 15, this.owner.color);
                WB.Game.particles.spark(this.owner.x, this.owner.y, 8);
            }
            WB.Renderer.triggerShake(8);
            if (WB.GLEffects) {
                WB.GLEffects.triggerSuperFlash(this.owner.color);
                WB.GLEffects.spawnImpact(this.owner.x, this.owner.y, this.owner.color, 50);
                WB.GLEffects.triggerArenaPulse(this.owner.color);
                WB.GLEffects.triggerHitStop(4);
                WB.GLEffects.triggerShockwave(this.owner.x, this.owner.y, 0.2);
                WB.GLEffects.triggerChromatic(0.25);
            }
        }
    }

    activateSuper() {
        // Override in subclass
    }

    getScalingDisplay() {
        return `${this.scalingStat.name}: ${this.scalingStat.value}`;
    }

    draw() {
        // Override in subclass
    }

    // Draw super glow effect around weapon (WebGL version)
    drawSuperGlow() {
        if (!this.superActive) return;
        // Glow is now handled per-weapon via GLBatch.fillCircleGlow
    }
};

// Registry for creating weapons by type, with pack/season support
WB.WeaponRegistry = {
    _map: {},
    _packs: {},        // packId → { types: [] }
    _activePack: null,

    register(type, ctor, pack) {
        this._map[type] = ctor;
        if (pack) {
            if (!this._packs[pack]) this._packs[pack] = { types: [] };
            this._packs[pack].types.push(type);
        }
    },

    create(type, owner) {
        const Ctor = this._map[type];
        if (!Ctor) throw new Error('Unknown weapon type: ' + type);
        return new Ctor(owner);
    },

    // Get all types, optionally filtered by pack
    getTypes(pack) {
        if (pack) return this._packs[pack] ? this._packs[pack].types : [];
        return Object.keys(this._map);
    },

    getPacks() {
        return Object.keys(this._packs);
    },

    setActivePack(pack) {
        this._activePack = pack || null;
    },

    getActivePack() {
        return this._activePack;
    },

    // Get types for the currently active pack (or all if none selected)
    getActiveTypes() {
        if (this._activePack) return this.getTypes(this._activePack);
        return this.getTypes();
    }
};
