window.WB = window.WB || {};

// Majin Buu: Fat pink blob. Absorbs damage to heal, belly slam contact attacks.
// Scaling: Regen rate increases per hit. Super: Candy Beam — marks enemy, takes 2x damage.
class BuuWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'buu',
            baseDamage: 3,
            rotationSpeed: 0,
            reach: 0,
            scalingName: 'Regen',
            superThreshold: 9,
            canParry: false,
        });
        // Buu is fat and bouncy
        this.owner.radius = WB.Config.BALL_RADIUS * 1.3;
        this.owner.mass = (this.owner.radius / WB.Config.BALL_RADIUS) * WB.Config.BALL_MASS * 0.8; // lighter than he looks
        this.owner.hp = 120;
        this.owner.maxHp = 120;

        this.contactCooldown = 0;
        this.contactAura = 8;
        this.regenRate = 0.3;       // HP/frame when absorbing
        this.regenTimer = 0;
        this.absorbFlash = 0;       // visual flash when absorbing damage
        this.wobbleTimer = 0;
        this.candyBeamActive = false;
        this.candyTarget = null;    // marked enemy takes 2x damage
        this.scalingStat.value = this.regenRate.toFixed(1);
    }

    update() {
        if (this.contactCooldown > 0) this.contactCooldown--;
        this.wobbleTimer++;
        this.regenTimer++;
        if (this.absorbFlash > 0) this.absorbFlash--;

        // Passive regen — heals slowly over time
        if (this.regenTimer % 30 === 0 && this.owner.hp < this.owner.maxHp) {
            this.owner.hp = Math.min(this.owner.maxHp, this.owner.hp + this.regenRate);
        }

        // Buu is extra bouncy
        const speed = this.owner.getSpeed();
        if (speed < 2) {
            this.owner.vx += (WB.random() - 0.5) * 0.8;
            this.owner.vy += (WB.random() - 0.5) * 0.8;
        }
    }

    canHit() {
        return this.contactCooldown <= 0;
    }

    onHit(target) {
        let dmg = this.currentDamage;
        // Candy beam doubles damage
        if (this.candyBeamActive && this.candyTarget === target) {
            dmg *= 2;
        }
        target.takeDamage(dmg);
        this.hitCount++;
        this.contactCooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);

        // Absorb: heal on hit
        const healAmount = 2 + this.hitCount * 0.5;
        this.owner.hp = Math.min(this.owner.maxHp, this.owner.hp + healAmount);
        this.absorbFlash = 12;

        // Bouncy knockback — Buu bounces enemies away AND bounces himself
        const dx = target.x - this.owner.x;
        const dy = target.y - this.owner.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        target.vx += (dx / d) * 5;
        target.vy += (dy / d) * 5;
        this.owner.vx -= (dx / d) * 2;
        this.owner.vy -= (dy / d) * 2;

        // Heal particles flowing into Buu
        if (WB.Game && WB.Game.particles) {
            for (let i = 0; i < 5; i++) {
                WB.Game.particles.emit(
                    this.owner.x + (target.x - this.owner.x) * Math.random(),
                    this.owner.y + (target.y - this.owner.y) * Math.random(),
                    1, '#88FF88'
                );
            }
        }
        WB.Renderer.triggerShake(5 + dmg * 0.3);

        // Full combo tracking + screen deformation + particle effects
        this._onHitEffects(target, dmg, '#FF69B4');
    }

    applyScaling() {
        this.regenRate = 0.3 + this.hitCount * 0.2;
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.4);
        this.scalingStat.value = this.regenRate.toFixed(1);
    }

    activateSuper() {
        // CANDY BEAM! Mark the nearest enemy — they take 2x damage
        this.candyBeamActive = true;
        if (WB.Game && WB.Game.balls) {
            const enemy = WB.Game.balls.find(b => b !== this.owner && b.isAlive && b.side !== this.owner.side);
            if (enemy) {
                this.candyTarget = enemy;
                // Visual: fire a candy beam projectile
                if (WB.Game.projectiles) {
                    const dx = enemy.x - this.owner.x;
                    const dy = enemy.y - this.owner.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    const speed = 9;
                    WB.Game.projectiles.push(new WB.Projectile({
                        x: this.owner.x + (dx / dist) * (this.owner.radius + 5),
                        y: this.owner.y + (dy / dist) * (this.owner.radius + 5),
                        vx: (dx / dist) * speed,
                        vy: (dy / dist) * speed,
                        damage: 10,
                        owner: this.owner,
                        ownerWeapon: this,
                        radius: 7,
                        lifespan: 60,
                        bounces: 0,
                        color: '#FF69B4',
                        piercing: true,
                    }));
                }
            }
        }
        // Permanent buffs
        this.currentDamage += 3;
        this.regenRate += 1;
        this.owner.hp = Math.min(this.owner.maxHp, this.owner.hp + 20);

        WB.Renderer.triggerShake(12);
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 30, '#FF69B4');
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;
        const ox = this.owner.x;
        const oy = this.owner.y;

        // Wobble animation — Buu is jiggly
        const wobble = Math.sin(this.wobbleTimer * 0.08) * 0.05;
        const wobbleX = 1 + wobble;
        const wobbleY = 1 - wobble;

        // Super: pink energy aura
        if (this.superActive) {
            const pulse = 1 + Math.sin(this.wobbleTimer * 0.06) * 0.12;
            B.fillCircleGlow(ox, oy, r * pulse + 12, '#FF69B4', 25);
            B.setAlpha(0.35);
            B.strokeCircle(ox, oy, r + 10 * pulse, '#FF88CC', 2.5);
            B.restoreAlpha();
        }

        // Absorb flash (green glow when healing)
        if (this.absorbFlash > 0) {
            const flashAlpha = this.absorbFlash / 12;
            B.setAlpha(flashAlpha * 0.3);
            B.fillCircle(ox, oy, r + 6, '#88FF88');
            B.restoreAlpha();
        }

        // Belly (slightly offset blob for fat look)
        B.setAlpha(0.3);
        B.fillCircle(ox, oy + r * 0.15 * wobbleY, r * 0.5 * wobbleX, '#FFAACC');
        B.restoreAlpha();

        // Cape/vest collar hints
        B.setAlpha(0.5);
        B.fillArc(ox, oy - r * 0.3, r * 0.6, Math.PI, 0, '#8B008B');
        B.restoreAlpha();

        // Head antenna (Buu's iconic blob on top)
        const antennaWobble = Math.sin(this.wobbleTimer * 0.1 + 1) * 5;
        B.setAlpha(0.8);
        // Antenna stem
        B.line(ox, oy - r * 0.7, ox + antennaWobble, oy - r * 1.2, '#FF88CC', 3);
        // Antenna tip blob
        B.fillCircle(ox + antennaWobble, oy - r * 1.2, 5, '#FF88CC');
        B.restoreAlpha();

        // Eyes
        B.fillCircle(ox - r * 0.22, oy - r * 0.12, r * 0.1, '#FFF');
        B.fillCircle(ox + r * 0.22, oy - r * 0.12, r * 0.1, '#FFF');
        B.fillCircle(ox - r * 0.22, oy - r * 0.12, r * 0.05, '#111');
        B.fillCircle(ox + r * 0.22, oy - r * 0.12, r * 0.05, '#111');

        // Mouth (big grin)
        B.setAlpha(0.7);
        B.fillArc(ox, oy + r * 0.05, r * 0.3, 0, Math.PI, '#CC3366');
        B.restoreAlpha();

        // Steam puffs from head when angry (super mode)
        if (this.superActive) {
            const steamTime = this.wobbleTimer * 0.15;
            for (let i = 0; i < 2; i++) {
                const sa = steamTime + i * Math.PI;
                const sx = ox + Math.cos(sa) * r * 0.3;
                const sy = oy - r * 0.8 - Math.abs(Math.sin(sa * 2)) * 8;
                B.setAlpha(0.2 + Math.sin(sa) * 0.1);
                B.fillCircle(sx, sy, 4 + Math.sin(sa * 3) * 2, '#FFF');
                B.restoreAlpha();
            }
        }

        // Candy beam marker on target
        if (this.candyBeamActive && this.candyTarget && this.candyTarget.isAlive) {
            const t = this.candyTarget;
            const markerPulse = 0.3 + Math.sin(this.wobbleTimer * 0.1) * 0.15;
            B.setAlpha(markerPulse);
            B.strokeCircle(t.x, t.y, t.radius + 8, '#FF69B4', 2);
            // Candy icon (small circle above target)
            B.fillCircle(t.x, t.y - t.radius - 12, 4, '#FF69B4');
            B.fillCircle(t.x - 3, t.y - t.radius - 12, 3, '#FFB6C1');
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('buu', BuuWeapon);
