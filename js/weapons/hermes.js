window.WB = window.WB || {};

// Hermes — Winged Sandal: Speed demon body-contact weapon.
// Contact damage scales with velocity. Higher base max speed.
// Scaling: Max speed increases per hit.
// Super: Trailing afterimage hitbox + reduced gravity for floaty juggles.
class HermesWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'hermes',
            baseDamage: 4,            // restored to 4 — needs the base damage to compete
            rotationSpeed: 0,
            reach: 0,
            scalingName: 'Speed',
            superThreshold: 10,       // back to 10 — was too easy at 8
            canParry: false,
        });
        this.contactCooldown = 0;
        this.contactCooldownTime = 38;  // fine-tuned (35 too fast, 40 too slow)
        this.contactAura = 3;          // pulled back from 4 (was 2 originally)

        // Hermes is FAST but fragile
        this.owner.maxSpeed = WB.Config.BALL_MAX_SPEED * 1.25; // pulled back from 1.35
        this.owner.mass *= 0.82;
        this.owner.hp = Math.round(WB.Config.BALL_MAX_HP * 0.92); // 92 HP — slightly more survivable
        this.owner.maxHp = this.owner.hp;

        // Afterimage system (post-super)
        this.afterimages = [];
        this.afterimageDamage = 1;
        this.afterimageCooldown = 0;
        this.dashTimer = 0;

        this.scalingStat.value = this.owner.maxSpeed.toFixed(1);
    }

    update() {
        if (this.contactCooldown > 0) this.contactCooldown--;
        this.dashTimer++;

        // Periodic speed bursts — Hermes randomly dashes
        if (this.dashTimer % 75 === 0) {  // between 60 and 90
            const speed = this.owner.getSpeed();
            if (speed < this.owner.maxSpeed * 0.5) {
                // Give a nudge to keep moving
                const angle = WB.random() * Math.PI * 2;
                this.owner.vx += Math.cos(angle) * 4;
                this.owner.vy += Math.sin(angle) * 4;
            }
        }

        // Super: afterimage trail
        if (this.superActive) {
            // Store afterimage every 4 frames
            if (this.dashTimer % 4 === 0) {
                this.afterimages.push({
                    x: this.owner.x,
                    y: this.owner.y,
                    life: 20,
                    cooldown: 0,
                });
                if (this.afterimages.length > 6) this.afterimages.shift();
            }

            // Update afterimages and check for hits
            if (this.afterimageCooldown > 0) this.afterimageCooldown--;
            for (let i = this.afterimages.length - 1; i >= 0; i--) {
                const ai = this.afterimages[i];
                ai.life--;
                if (ai.cooldown > 0) ai.cooldown--;
                if (ai.life <= 0) {
                    this.afterimages.splice(i, 1);
                    continue;
                }

                // Afterimage collision
                if (ai.cooldown <= 0 && WB.Game && WB.Game.balls) {
                    for (const target of WB.Game.balls) {
                        if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                        if (WB.Physics.circleCircle(ai.x, ai.y, this.owner.radius * 0.8, target.x, target.y, target.radius)) {
                            target.takeDamage(this.afterimageDamage);
                            ai.cooldown = 15;
                            if (WB.GLEffects) {
                                WB.GLEffects.spawnDamageNumber(target.x, target.y, this.afterimageDamage, '#87CEEB');
                            }
                            if (WB.Game.particles) {
                                WB.Game.particles.emit(ai.x, ai.y, 3, '#87CEEB');
                            }
                            break;
                        }
                    }
                }
            }
        }
    }

    canHit() {
        return this.contactCooldown <= 0;
    }

    onHit(target) {
        // Damage scales with velocity!
        const speed = this.owner.getSpeed();
        const speedBonus = Math.floor(speed * 0.3);  // balanced speed scaling
        const dmg = this.currentDamage + speedBonus;

        target.takeDamage(dmg);
        this.hitCount++;
        this.contactCooldown = this.contactCooldownTime;  // longer cooldown than normal weapons
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);

        // Knockback proportional to speed
        const dx = target.x - this.owner.x;
        const dy = target.y - this.owner.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const kb = 2 + speed * 0.3;  // less knockback
        target.vx += (dx / d) * kb;
        target.vy += (dy / d) * kb;

        // Hit effects
        this._onHitEffects(target, dmg, '#87CEEB');

        // Wind particles
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.emit(target.x, target.y, 5, '#B0E0E6');
        }
    }

    applyScaling() {
        this.owner.maxSpeed = WB.Config.BALL_MAX_SPEED * Math.min(1.55, 1.25 + this.hitCount * 0.035);
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.3);
        this.afterimageDamage = 1 + Math.floor(this.hitCount * 0.12);
        this.scalingStat.value = this.owner.maxSpeed.toFixed(1);
    }

    activateSuper() {
        this.currentDamage += 3;

        // Speed boost (nerfed from 1.6)
        this.owner.maxSpeed = WB.Config.BALL_MAX_SPEED * 1.4;

        // Reduced gravity — floaty juggles
        this.owner.gravityMultiplier = 0.65;  // less extreme float

        // Lighter for even bouncier movement
        this.owner.mass *= 0.7;  // less extreme mass reduction

        // Launch Hermes at high speed
        const angle = WB.random() * Math.PI * 2;
        this.owner.vx += Math.cos(angle) * 10;
        this.owner.vy += Math.sin(angle) * 10;

        // Visual burst — wind burst
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 25, '#87CEEB');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 15, '#B0E0E6');
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        // Draw afterimages (behind ball)
        for (const ai of this.afterimages) {
            const alpha = (ai.life / 20) * 0.25;
            B.setAlpha(alpha);
            B.fillCircle(ai.x, ai.y, r * 0.8, '#87CEEB');
            B.restoreAlpha();
        }

        // Winged sandal visual — small wings on the ball
        const wingAngle = this.dashTimer * 0.12;
        const wingFlap = Math.sin(wingAngle) * 5;

        // Left wing
        B.setAlpha(0.6);
        B.fillTriangle(
            this.owner.x - r - 2, this.owner.y,
            this.owner.x - r - 12, this.owner.y - 8 + wingFlap,
            this.owner.x - r - 10, this.owner.y + 3,
            '#B0E0E6'
        );
        B.fillTriangle(
            this.owner.x - r - 2, this.owner.y,
            this.owner.x - r - 14, this.owner.y - 4 + wingFlap,
            this.owner.x - r - 8, this.owner.y + 5,
            '#87CEEB'
        );

        // Right wing
        B.fillTriangle(
            this.owner.x + r + 2, this.owner.y,
            this.owner.x + r + 12, this.owner.y - 8 - wingFlap,
            this.owner.x + r + 10, this.owner.y + 3,
            '#B0E0E6'
        );
        B.fillTriangle(
            this.owner.x + r + 2, this.owner.y,
            this.owner.x + r + 14, this.owner.y - 4 - wingFlap,
            this.owner.x + r + 8, this.owner.y + 5,
            '#87CEEB'
        );
        B.restoreAlpha();

        // Speed aura during super
        if (this.superActive) {
            const pulse = Math.sin(Date.now() * 0.012) * 3;
            B.setAlpha(0.1);
            B.strokeCircle(this.owner.x, this.owner.y, r + 10 + pulse, '#87CEEB', 2);
            B.restoreAlpha();
        }

        // Speed lines visual (directional streaks when moving fast)
        const speed = this.owner.getSpeed();
        if (speed > 5) {
            const lineAlpha = Math.min(0.3, (speed - 5) * 0.05);
            B.setAlpha(lineAlpha);
            const moveAngle = Math.atan2(-this.owner.vy, -this.owner.vx);
            for (let i = 0; i < 3; i++) {
                const offset = (i - 1) * 0.3;
                const lx = this.owner.x + Math.cos(moveAngle + offset) * (r + 5);
                const ly = this.owner.y + Math.sin(moveAngle + offset) * (r + 5);
                const lx2 = lx + Math.cos(moveAngle) * (5 + speed);
                const ly2 = ly + Math.sin(moveAngle) * (5 + speed);
                B.line(lx, ly, lx2, ly2, '#87CEEB', 1.5);
            }
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('hermes', HermesWeapon, 'pantheon');
