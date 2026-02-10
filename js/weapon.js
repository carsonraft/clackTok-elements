window.WB = window.WB || {};

WB.Weapon = class {
    constructor(owner, config) {
        this.owner = owner;
        this.type = config.type;
        this.angle = WB.random() * Math.PI * 2;
        this.rotationSpeed = config.rotationSpeed || 0.05;
        this.baseDamage = config.baseDamage || 3;
        this.currentDamage = this.baseDamage;
        this.reach = config.reach || 40;
        this.baseReach = this.reach;
        this.hitCount = 0;
        this.cooldown = 0;
        this.superActive = false;
        this.superThreshold = config.superThreshold || WB.Config.SUPER_THRESHOLD;
        this.scalingStat = { name: config.scalingName || 'Damage', value: this.baseDamage };
        this.canParry = config.canParry !== false;
        this.unparryable = false;
        this.isRanged = config.isRanged || false;
    }

    // Weapon tip position
    getTipX() { return this.owner.x + Math.cos(this.angle) * this.reach; }
    getTipY() { return this.owner.y + Math.sin(this.angle) * this.reach; }

    // Mid-point along weapon (for wider collision on some weapons)
    getMidX() { return this.owner.x + Math.cos(this.angle) * this.reach * 0.6; }
    getMidY() { return this.owner.y + Math.sin(this.angle) * this.reach * 0.6; }

    update() {
        this.angle += this.rotationSpeed;
        if (this.cooldown > 0) this.cooldown--;
    }

    canHit() {
        return this.cooldown <= 0;
    }

    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);

        // All fancy effects via reusable helper
        this._onHitEffects(target, this.currentDamage, this.owner.color);
    }

    // Reusable hit effects — call from custom onHit() in subclasses
    // so they get combo tracking, particles, screen deformation, etc.
    _onHitEffects(target, dmg, color, comboOverride) {
        // Track combo + escalating clack burst
        if (WB.GLEffects) {
            WB.GLEffects.incrementCombo(this.owner.side);
            const combo = comboOverride !== undefined ? comboOverride : WB.GLEffects.getCombo(this.owner.side);
            if (combo >= 2) {
                WB.Audio.comboClack(combo);
            }

            // Particle count scales with combo — MORE particles
            const particleCount = 10 + Math.min(combo * 3, 24);
            if (WB.Game && WB.Game.particles) {
                WB.Game.particles.emit(target.x, target.y, particleCount, color);
            }

            const impactSize = 35 + dmg * 4 + combo * 4;
            WB.GLEffects.spawnImpact(target.x, target.y, color, impactSize);
            WB.GLEffects.spawnDamageNumber(target.x, target.y, dmg, color);

            // Arena pulse on EVERY hit — lower threshold
            if (dmg >= 3 || combo >= 2) {
                WB.GLEffects.triggerArenaPulse(color);
            }
            // Hit stop on moderate hits
            if (dmg >= 4 || combo >= 3) {
                WB.GLEffects.triggerHitStop(2 + Math.min(Math.floor(combo / 2), 4));
            }
            // Clash sparks earlier
            if (combo >= 3) {
                WB.GLEffects.spawnClashSparks(target.x, target.y, combo * 2, color);
            }
            // Screen deformation — lower thresholds, stronger effects
            if (dmg >= 2 || combo >= 2) {
                WB.GLEffects.triggerChromatic(0.15 + combo * 0.06);
            }
            if (dmg >= 4 || combo >= 4) {
                WB.GLEffects.triggerShockwave(target.x, target.y, 0.12 + combo * 0.04);
            }
            if (combo >= 6) {
                WB.GLEffects.triggerBarrel(0.08 + combo * 0.025);
            }
        }
    }

    applyScaling() {
        // Override in subclass
    }

    checkSuper() {
        if (!this.superActive && this.hitCount >= this.superThreshold) {
            this.superActive = true;
            this.activateSuper();
            WB.Audio.superActivate();
            if (WB.Game && WB.Game._excitement) {
                WB.Game._excitement.recordSuper();
            }
            if (WB.Game && WB.Game.particles) {
                WB.Game.particles.explode(this.owner.x, this.owner.y, 35, this.owner.color);
                WB.Game.particles.spark(this.owner.x, this.owner.y, 20);
            }
            // ULTRA super activation effects — cranked to 11
            WB.Renderer.triggerShake(18);
            if (WB.GLEffects) {
                WB.GLEffects.triggerSuperFlash(this.owner.color);
                WB.GLEffects.spawnImpact(this.owner.x, this.owner.y, this.owner.color, 100);
                WB.GLEffects.triggerArenaPulse(this.owner.color);
                WB.GLEffects.triggerHitStop(7);
                // EXTREME screen deformation on super activation
                WB.GLEffects.triggerShockwave(this.owner.x, this.owner.y, 0.8);
                WB.GLEffects.triggerChromatic(1.0);
                WB.GLEffects.triggerBarrel(0.5);
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

// Registry for creating weapons by type
WB.WeaponRegistry = {
    _map: {},

    register(type, ctor) {
        this._map[type] = ctor;
    },

    create(type, owner) {
        const Ctor = this._map[type];
        if (!Ctor) throw new Error('Unknown weapon type: ' + type);
        return new Ctor(owner);
    },

    getTypes() {
        return Object.keys(this._map);
    }
};
