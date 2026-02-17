window.WB = window.WB || {};

// Horus — Falcon Dive: Body contact weapon. Damage scales with downward velocity.
// Faster descent = more damage. Horizontal impacts at 50% scaling.
// Scaling: Each hit reduces personal gravity by 5% (floats higher, longer dives).
// Each hit also increases base damage by +0.3.
// Super (10 hits): At apex of each ascent, hovers for 0.3s (velocity zeroes out).
// On next downward impact, shockwave radiates outward (AoE ring, 1.5x ball diameter).
class HorusWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'horus',
            baseDamage: 1,
            rotationSpeed: 0,
            reach: 0,
            scalingName: 'Gravity',
            superThreshold: 14,
            canParry: false,
        });
        this.contactCooldown = 0;
        this.contactCooldownTime = 60;
        this.contactAura = 2;
        this.hoverTimer = 0;
        this.isHovering = false;
        this._wasGoingUp = false; // track velocity direction for apex detection
        this.visualTimer = 0;
        this.diveImpactReady = false; // true after a hover ends, triggers shockwave
        this.scalingStat.value = (this.owner.gravityMultiplier * 100).toFixed(0) + '%';
    }

    update() {
        if (this.contactCooldown > 0) this.contactCooldown--;
        this.visualTimer++;

        // Super: Apex hover detection
        if (this.superActive) {
            const goingUp = this.owner.vy < -0.5;
            const goingDown = this.owner.vy > 0.5;
            const nearApex = !goingUp && !goingDown && this._wasGoingUp;

            if (nearApex && !this.isHovering) {
                // Start hover
                this.isHovering = true;
                this.hoverTimer = 18; // 0.3 seconds
                this.owner.vx *= 0.3; // dampen horizontal too
                this.owner.vy = 0;
            }

            if (this.isHovering) {
                this.hoverTimer--;
                this.owner.vy = 0; // zero gravity during hover
                this.owner.vx *= 0.95; // slow drift
                if (this.hoverTimer <= 0) {
                    this.isHovering = false;
                    this.diveImpactReady = true;
                }
            }

            this._wasGoingUp = goingUp;
        }
    }

    canHit() {
        return this.contactCooldown <= 0;
    }

    onHit(target) {
        // Damage scales with velocity — vertical at full, horizontal at 50%
        const vertSpeed = Math.abs(this.owner.vy);
        const horizSpeed = Math.abs(this.owner.vx);
        const speedBonus = vertSpeed * 0.3 + horizSpeed * 0.15;
        const dmg = this.currentDamage + speedBonus;

        target.takeDamage(dmg);
        this.hitCount++;
        this.contactCooldown = this.contactCooldownTime;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);

        // Knockback
        const dx = target.x - this.owner.x;
        const dy = target.y - this.owner.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const kb = 3 + speedBonus * 0.3;
        target.vx += (dx / d) * kb;
        target.vy += (dy / d) * kb;

        this._onHitEffects(target, dmg, '#4169E1');

        // Falcon feather particles
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.emit(target.x, target.y, 4, '#4169E1');
            WB.Game.particles.emit(target.x, target.y, 3, '#DAA520');
        }

        // Super: Shockwave on dive impact
        if (this.diveImpactReady && this.superActive) {
            this.diveImpactReady = false;
            const shockRadius = this.owner.radius * 1.5;
            const shockDmg = dmg * 0.5;

            // Damage all enemies in shockwave radius
            if (WB.Game && WB.Game.balls) {
                for (const t of WB.Game.balls) {
                    if (t === this.owner || t === target || !t.isAlive || t.side === this.owner.side) continue;
                    const tdx = t.x - this.owner.x;
                    const tdy = t.y - this.owner.y;
                    const tdist = Math.sqrt(tdx * tdx + tdy * tdy);
                    if (tdist < shockRadius + t.radius) {
                        t.takeDamage(shockDmg);
                        if (WB.GLEffects) {
                            WB.GLEffects.spawnDamageNumber(t.x, t.y, shockDmg, '#DAA520');
                        }
                    }
                }
            }

            // Shockwave visual
            if (WB.GLEffects) {
                WB.GLEffects.spawnImpact(this.owner.x, this.owner.y, '#DAA520', shockRadius);
                WB.GLEffects.triggerShockwave(this.owner.x, this.owner.y, 0.15);
            }
            if (WB.Game && WB.Game.particles) {
                WB.Game.particles.explode(this.owner.x, this.owner.y, 12, '#DAA520');
            }
            WB.Renderer.triggerShake(6);
        }
    }

    applyScaling() {
        // Reduce personal gravity by 5% per hit
        this.owner.gravityMultiplier = Math.max(0.3, 1 - this.hitCount * 0.03);
        this.currentDamage = this.baseDamage + this.hitCount * 0.2;
        this.scalingStat.value = (this.owner.gravityMultiplier * 100).toFixed(0) + '%';
    }

    activateSuper() {
        // Hover begins (handled in update)
        // Golden flash burst
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 20, '#4169E1');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 12, '#DAA520');
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;
        const speed = this.owner.getSpeed();

        // Falcon wings — spread based on velocity
        const wingSpread = Math.min(1, speed / 10);
        const wingLen = 10 + wingSpread * 12;
        const wingFlap = Math.sin(this.visualTimer * 0.15) * (this.isHovering ? 8 : 3);

        B.setAlpha(0.7 + wingSpread * 0.25);
        // Left wing
        B.fillTriangle(
            this.owner.x - r * 0.5, this.owner.y,
            this.owner.x - r - wingLen, this.owner.y - 6 + wingFlap,
            this.owner.x - r - wingLen * 0.6, this.owner.y + 4,
            '#4169E1'
        );
        B.fillTriangle(
            this.owner.x - r * 0.5, this.owner.y + 2,
            this.owner.x - r - wingLen * 0.8, this.owner.y - 3 + wingFlap,
            this.owner.x - r - wingLen * 0.4, this.owner.y + 6,
            '#6495ED'
        );
        // Right wing
        B.fillTriangle(
            this.owner.x + r * 0.5, this.owner.y,
            this.owner.x + r + wingLen, this.owner.y - 6 - wingFlap,
            this.owner.x + r + wingLen * 0.6, this.owner.y + 4,
            '#4169E1'
        );
        B.fillTriangle(
            this.owner.x + r * 0.5, this.owner.y + 2,
            this.owner.x + r + wingLen * 0.8, this.owner.y - 3 - wingFlap,
            this.owner.x + r + wingLen * 0.4, this.owner.y + 6,
            '#6495ED'
        );
        B.restoreAlpha();

        // Wing edge outlines for definition
        B.setAlpha(0.35);
        B.line(this.owner.x - r * 0.5, this.owner.y, this.owner.x - r - wingLen, this.owner.y - 6 + wingFlap, '#1A1A6B', 1.5);
        B.line(this.owner.x - r - wingLen, this.owner.y - 6 + wingFlap, this.owner.x - r - wingLen * 0.6, this.owner.y + 4, '#1A1A6B', 1.5);
        B.line(this.owner.x + r * 0.5, this.owner.y, this.owner.x + r + wingLen, this.owner.y - 6 - wingFlap, '#1A1A6B', 1.5);
        B.line(this.owner.x + r + wingLen, this.owner.y - 6 - wingFlap, this.owner.x + r + wingLen * 0.6, this.owner.y + 4, '#1A1A6B', 1.5);
        B.restoreAlpha();

        // Eye of Horus mark — bigger
        B.setAlpha(0.6);
        B.fillCircle(this.owner.x + 5, this.owner.y - 3, 4, '#DAA520');
        B.restoreAlpha();

        // Hover visual — golden glow when hovering
        if (this.isHovering) {
            const hoverPulse = Math.sin(this.visualTimer * 0.2) * 0.1;
            B.setAlpha(0.2 + hoverPulse);
            B.fillCircle(this.owner.x, this.owner.y, r + 8, '#DAA520');
            B.restoreAlpha();
        }

        // Dive trail when moving fast downward
        if (this.owner.vy > 5) {
            const trailAlpha = Math.min(0.3, (this.owner.vy - 5) * 0.04);
            B.setAlpha(trailAlpha);
            B.line(
                this.owner.x, this.owner.y - r,
                this.owner.x, this.owner.y - r - this.owner.vy * 2,
                '#DAA520', 2
            );
            B.restoreAlpha();
        }

        // Super indicator
        if (this.superActive) {
            const pulse = Math.sin(this.visualTimer * 0.06) * 0.04;
            B.setAlpha(0.1 + pulse);
            B.strokeCircle(this.owner.x, this.owner.y, r + 10, '#DAA520', 2);
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('horus', HorusWeapon, 'egyptian');
