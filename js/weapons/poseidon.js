window.WB = window.WB || {};

// Poseidon — Trident: Melee spinning trident with knockback on hit.
// Scaling: Knockback force and damage increase per hit.
// Super: Spawns PoseidonFlood arena modifier — rising water that slows enemies.
//        Post-super, each hit makes the flood rise higher.
class PoseidonWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'poseidon',
            baseDamage: 9,              // more damage — trident is the heaviest melee
            rotationSpeed: 0.085,       // slightly faster
            reach: 90,                  // longest melee reach in pantheon
            scalingName: 'Tidal',
            superThreshold: 8,
        });
        // Poseidon is the tankiest melee god
        this.owner.hp = Math.round(WB.Config.BALL_MAX_HP * 1.2);  // 120 HP
        this.owner.maxHp = this.owner.hp;
        this.owner.mass *= 1.1;       // heavier — harder to push around
        this.knockback = 4.5;
        this.flood = null; // Reference to our flood modifier
        this.scalingStat.value = this.knockback.toFixed(1);
    }

    applyScaling() {
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.8);  // better scaling
        this.knockback = Math.min(8, 4.5 + this.hitCount * 0.35); // starts from base 4.5
        this.scalingStat.value = this.knockback.toFixed(1);
    }

    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);

        // Knockback — tidal push away from Poseidon
        const dx = target.x - this.owner.x;
        const dy = target.y - this.owner.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        target.vx += (dx / d) * this.knockback;
        target.vy += (dy / d) * this.knockback;

        // Tidal slow — waterlogged enemies move slower
        if (target.debuffs) {
            target.debuffs.slowFactor = Math.min(target.debuffs.slowFactor || 1, 0.3);  // very strong slow
            target.debuffs.slowTimer = Math.max(target.debuffs.slowTimer || 0, 120);  // 2 sec (was 1.5)
        }

        // After super, each hit raises the flood
        if (this.flood) {
            this.flood.rise();
        }

        // Hit effects
        this._onHitEffects(target, this.currentDamage, '#008080');

        // Water splash particles
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.emit(target.x, target.y, 6, '#00AAAA');
        }
    }

    activateSuper() {
        this.rotationSpeed *= 1.5;
        this.currentDamage += 3;
        this.knockback += 3;

        // Spawn the flood!
        this.flood = new WB.PoseidonFlood(this.owner);
        WB.ArenaModifiers.add(this.flood);

        // Tidal wave burst — push all enemies away
        if (WB.Game && WB.Game.balls) {
            for (const target of WB.Game.balls) {
                if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                const dx = target.x - this.owner.x;
                const dy = target.y - this.owner.y;
                const d = Math.sqrt(dx * dx + dy * dy) || 1;
                target.vx += (dx / d) * 8;
                target.vy += (dy / d) * 8;
                target.takeDamage(5);
                if (WB.GLEffects) {
                    WB.GLEffects.spawnDamageNumber(target.x, target.y, 5, '#008080');
                }
            }
        }

        // Visual burst
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 30, '#008080');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 20, '#00AAAA');
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
            B.fillCircleGlow(0, 0, this.reach, '#008080', 15);
        }

        // Trident shaft
        B.fillRect(r - 2, -3, this.reach - r - 8, 6, '#2E8B8B');

        // Trident head — three prongs
        const headX = this.reach - 14;
        const prongLen = 18;

        // Center prong
        B.fillRect(headX, -2.5, prongLen + 4, 5, '#00CED1');
        // Center prong tip
        B.fillTriangle(headX + prongLen + 4, -3, headX + prongLen + 4, 3, headX + prongLen + 10, 0, '#00CED1');

        // Top prong
        B.line(headX + 2, -2, headX + 4, -10, '#00CED1', 4);
        B.line(headX + 4, -10, headX + prongLen, -10, '#00CED1', 3);
        B.fillTriangle(headX + prongLen, -12, headX + prongLen, -8, headX + prongLen + 6, -10, '#00CED1');

        // Bottom prong
        B.line(headX + 2, 2, headX + 4, 10, '#00CED1', 4);
        B.line(headX + 4, 10, headX + prongLen, 10, '#00CED1', 3);
        B.fillTriangle(headX + prongLen, 8, headX + prongLen, 12, headX + prongLen + 6, 10, '#00CED1');

        // Shaft decorative band
        B.fillRect(r + 8, -5, 4, 10, '#006666');

        B.popTransform();

        // Water aura during super
        if (this.superActive) {
            const pulse = Math.sin(Date.now() * 0.006) * 3;
            B.setAlpha(0.1);
            B.strokeCircle(this.owner.x, this.owner.y, r + 10 + pulse, '#00AAAA', 2);
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('poseidon', PoseidonWeapon, 'pantheon');
