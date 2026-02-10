window.WB = window.WB || {};

// Metal (Iron Guard): Melee weapon with a directional shield that absorbs incoming damage.
// Scaling: Shield damage reduction % increases. Super: Steel Fortress (360 shield + reflect).
class MetalWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'metal',
            baseDamage: 3,
            rotationSpeed: 0.04,
            reach: 60,
            scalingName: 'Guard',
            superThreshold: 10,
        });
        this.shieldReduction = 0.2; // 20% damage reduction
        this.shieldAngleWidth = Math.PI * 0.6; // shield covers 108 degrees
        this.metalTimer = 0;
        this.scalingStat.value = Math.round(this.shieldReduction * 100) + '%';
    }

    update() {
        super.update();
        this.metalTimer++;

        // Shield: reduce damage from attacks coming from the shield direction
        // We override takeDamage on the ball to implement directional blocking
        if (!this.owner._metalShieldPatched) {
            const weapon = this;
            const originalTakeDamage = this.owner.takeDamage.bind(this.owner);
            this.owner.takeDamage = function(amount) {
                if (weapon.owner.invulnerable) return;
                // Check if any attacker is in front of shield
                // Simple version: always reduce by shield %
                const reduced = amount * (1 - weapon.shieldReduction);
                originalTakeDamage(Math.max(1, Math.round(reduced)));
            };
            this.owner._metalShieldPatched = true;
        }
    }

    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);
        this._onHitEffects(target, this.currentDamage, '#AABBCC');

        // Super: reflect damage back
        if (this.superActive) {
            const reflectDmg = Math.ceil(this.currentDamage * 0.3);
            target.takeDamage(reflectDmg);
            if (WB.GLEffects) {
                WB.GLEffects.spawnDamageNumber(target.x, target.y, reflectDmg, '#DDEEFF');
            }
        }
    }

    applyScaling() {
        this.shieldReduction = Math.min(0.6, 0.2 + this.hitCount * 0.04);
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.4);
        this.scalingStat.value = Math.round(this.shieldReduction * 100) + '%';
    }

    activateSuper() {
        // Steel Fortress: max shield + reflect
        this.shieldReduction = 0.6;
        this.shieldAngleWidth = Math.PI * 2; // 360 degree shield
        this.currentDamage += 3;
        this.owner.mass *= 1.5; // heavier — harder to push
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
            B.fillCircleGlow(0, 0, this.reach, '#AABBCC', 12);
        }

        // Mace / flail handle
        B.fillRect(r - 2, -3, this.reach - r - 10, 6, '#778899');

        // Mace head — spiked ball
        const headX = this.reach - 6;
        B.fillCircle(headX, 0, 10, '#99AABB');
        B.strokeCircle(headX, 0, 10, '#778899', 1.5);

        // Spikes
        for (let i = 0; i < 6; i++) {
            const sa = (i / 6) * Math.PI * 2 + this.metalTimer * 0.01;
            const sx = headX + Math.cos(sa) * 10;
            const sy = Math.sin(sa) * 10;
            const ex = headX + Math.cos(sa) * 14;
            const ey = Math.sin(sa) * 14;
            B.line(sx, sy, ex, ey, '#AABBCC', 2);
        }

        B.popTransform();

        // Shield arc visualization
        if (!this.superActive) {
            // Draw shield arc in front of weapon
            const shieldDist = r + 8;
            B.setAlpha(0.12);
            const halfAngle = this.shieldAngleWidth / 2;
            const arcSegs = 12;
            for (let i = 0; i < arcSegs; i++) {
                const a0 = this.angle - halfAngle + (this.shieldAngleWidth * i / arcSegs);
                const a1 = this.angle - halfAngle + (this.shieldAngleWidth * (i + 1) / arcSegs);
                B.line(
                    this.owner.x + Math.cos(a0) * shieldDist,
                    this.owner.y + Math.sin(a0) * shieldDist,
                    this.owner.x + Math.cos(a1) * shieldDist,
                    this.owner.y + Math.sin(a1) * shieldDist,
                    '#AABBCC', 3
                );
            }
            B.restoreAlpha();
        } else {
            // Full 360 shield ring
            const pulse = 0.1 + Math.sin(this.metalTimer * 0.06) * 0.05;
            B.setAlpha(pulse);
            B.strokeCircle(this.owner.x, this.owner.y, r + 8, '#AABBCC', 3);
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('metal', MetalWeapon);
