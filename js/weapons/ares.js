window.WB = window.WB || {};

// Ares — War Blade: Slow heavy melee weapon that speeds up as the ball takes damage.
// Scaling: Damage and rotation speed increase per hit.
// Super (Berserker): Drops weapon entirely, becomes body-contact brawler.
//   Contact damage is massive, gains HP regen, and gets bonus speed.
class AresWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'ares',
            baseDamage: 7,            // restored to 7 — keeping super at 9 is enough nerf
            rotationSpeed: 0.035,     // faster base rotation (was 0.025)
            reach: 88,                // longer reach (was 85)
            scalingName: 'Rage',
            superThreshold: 9,        // tuned from 8 — slightly harder super
        });
        this.rage = 0;
        this.berserk = false;
        this.contactCooldown = 0;
        this.regenTimer = 0;
        this.scalingStat.value = this.rage;
    }

    update() {
        if (this.berserk) {
            // Berserker mode — no weapon, body slam
            if (this.contactCooldown > 0) this.contactCooldown--;

            // HP regen (2 HP every 1.5 sec — berserker heals fast)
            this.regenTimer++;
            if (this.regenTimer >= 90) {   // was 120
                this.regenTimer = 0;
                if (this.owner.hp < this.owner.maxHp) {
                    this.owner.hp = Math.min(this.owner.maxHp, this.owner.hp + 2); // was 1
                }
            }

            // Rage visual pulsing
            this.angle += 0.02; // slow spin for visual
        } else {
            // Normal weapon mode
            // Track damage taken → increase rotation speed
            const hpLost = this.owner.maxHp - this.owner.hp;
            this.rage = Math.floor(hpLost / 5);
            const rageSpeedBonus = Math.min(0.05, this.rage * 0.006); // better rage scaling
            this.rotationSpeed = 0.035 + rageSpeedBonus + this.hitCount * 0.003; // faster spin

            const dir = (this.owner.debuffs && this.owner.debuffs.weaponReversed > 0) ? -1 : 1;
            this.angle += this.rotationSpeed * dir;
            if (this.cooldown > 0) this.cooldown--;

            this.scalingStat.value = this.rage;
        }
    }

    canHit() {
        if (this.berserk) return this.contactCooldown <= 0;
        return this.cooldown <= 0;
    }

    onHit(target) {
        const dmg = this.berserk ? this.currentDamage + this.rage * 2 : this.currentDamage;
        target.takeDamage(dmg);
        this.hitCount++;

        if (this.berserk) {
            this.contactCooldown = WB.Config.WEAPON_HIT_COOLDOWN;
            // Berserker knockback
            const dx = target.x - this.owner.x;
            const dy = target.y - this.owner.y;
            const d = Math.sqrt(dx * dx + dy * dy) || 1;
            target.vx += (dx / d) * 7;
            target.vy += (dy / d) * 7;
        } else {
            this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        }

        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);

        // Hit effects — blood red
        this._onHitEffects(target, dmg, '#DC143C');

        // Blood particles
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.emit(target.x, target.y, 6, '#8B0000');
        }
    }

    applyScaling() {
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.6); // better scaling
        this.scalingStat.value = this.rage;
    }

    activateSuper() {
        // BERSERKER MODE — drop weapon, become body slammer!
        this.berserk = true;
        this.reach = 0;       // No melee weapon
        this.canParry = false;
        this.currentDamage += 7;      // bigger damage boost (was +5)

        // Enlarge — Ares gets BIGGER
        this.owner.radius = Math.round(WB.Config.BALL_RADIUS * 1.25); // larger (was 1.2)
        this.owner.mass *= 1.6;       // heavier (was 1.5)

        // Speed boost + HP restore
        this.owner.maxSpeed = WB.Config.BALL_MAX_SPEED * 1.4; // faster (was 1.3)
        this.owner.hp = Math.min(this.owner.hp + 15, this.owner.maxHp); // partial heal on berserk

        // Berserker burst — push all enemies
        if (WB.Game && WB.Game.balls) {
            for (const target of WB.Game.balls) {
                if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                const dx = target.x - this.owner.x;
                const dy = target.y - this.owner.y;
                const d = Math.sqrt(dx * dx + dy * dy) || 1;
                target.vx += (dx / d) * 6;
                target.vy += (dy / d) * 6;
                target.takeDamage(4);
                if (WB.GLEffects) {
                    WB.GLEffects.spawnDamageNumber(target.x, target.y, 4, '#DC143C');
                }
            }
        }

        // Visual burst — blood red explosion
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 30, '#DC143C');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 20, '#8B0000');
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        if (this.berserk) {
            // Berserker mode — rage aura, no weapon
            const pulse = Math.sin(Date.now() * 0.01) * 0.06;

            // Red rage glow
            B.setAlpha(0.15 + pulse);
            B.fillCircle(this.owner.x, this.owner.y, r + 8, '#DC143C');
            B.restoreAlpha();

            // Spiky rage ring
            B.setAlpha(0.25 + pulse);
            B.strokeCircle(this.owner.x, this.owner.y, r + 5, '#8B0000', 2);
            B.restoreAlpha();

            // Rage sparks
            if (Date.now() % 100 < 30) {
                const sparkAngle = Math.random() * Math.PI * 2;
                B.setAlpha(0.4);
                B.fillCircle(
                    this.owner.x + Math.cos(sparkAngle) * (r + 4),
                    this.owner.y + Math.sin(sparkAngle) * (r + 4),
                    2, '#FF4444'
                );
                B.restoreAlpha();
            }
        } else {
            B.pushTransform(this.owner.x, this.owner.y, this.angle);

            if (this.superActive) {
                B.fillCircleGlow(0, 0, this.reach, '#DC143C', 15);
            }

            // War blade — heavy dark red sword
            // Handle
            B.fillRect(r - 2, -5, 14, 10, '#4A2020');

            // Cross-guard — crimson
            B.fillRect(r + 11, -14, 6, 28, '#8B0000');

            // Heavy blade
            B.fillPolygon([
                [r + 17, -10],
                [this.reach - 5, -6],
                [this.reach + 3, 0],
                [this.reach - 5, 6],
                [r + 17, 10]
            ], '#B22222');
            B.strokePolygon([
                [r + 17, -10],
                [this.reach - 5, -6],
                [this.reach + 3, 0],
                [this.reach - 5, 6],
                [r + 17, 10]
            ], '#8B0000', 1.5);

            // Blood edge highlight
            B.line(r + 19, 0, this.reach - 6, 0, 'rgba(255,100,100,0.4)', 1);

            // Rage indicator — blade glows redder with more rage
            if (this.rage > 0) {
                const rageAlpha = Math.min(0.3, this.rage * 0.06);
                B.setAlpha(rageAlpha);
                B.fillPolygon([
                    [r + 17, -8],
                    [this.reach - 6, -4],
                    [this.reach + 1, 0],
                    [this.reach - 6, 4],
                    [r + 17, 8]
                ], '#FF0000');
                B.restoreAlpha();
            }

            B.popTransform();
        }
    }
}

WB.WeaponRegistry.register('ares', AresWeapon, 'pantheon');
