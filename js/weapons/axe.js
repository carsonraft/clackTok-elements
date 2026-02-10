window.WB = window.WB || {};

// Axe: Crit chance increases 2% per hit. Crit damage = crit percentage.
class AxeWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'axe',
            baseDamage: 4,
            rotationSpeed: 0.045,
            reach: 72,
            scalingName: 'Crit %',
            superThreshold: 12,
        });
        this.critChance = 5; // starts at 5%
        this.scalingStat.value = this.critChance;
        this.lastHitWasCrit = false;
    }

    onHit(target) {
        this.lastHitWasCrit = false;
        let dmg = this.currentDamage;

        // Roll for crit
        if (WB.random() * 100 < this.critChance) {
            // Crit damage = base + crit percentage as bonus
            dmg = this.currentDamage + this.critChance * 0.5;
            this.lastHitWasCrit = true;

            // Big screen shake on crit
            WB.Renderer.triggerShake(8 + dmg * 0.3);

            // Crit particles - gold burst
            if (WB.Game && WB.Game.particles) {
                WB.Game.particles.emit(target.x, target.y, 15, '#FFD700', { speed: 6, life: 30 });
            }
        }

        target.takeDamage(dmg);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.lastHitWasCrit ? this.hitCount + 10 : this.hitCount, this.type);

        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.emit(target.x, target.y, 8, this.owner.color);
        }
    }

    applyScaling() {
        this.critChance = 5 + this.hitCount * 2;
        this.scalingStat.value = this.critChance;
    }

    activateSuper() {
        // Guaranteed crits for a burst, then permanent +20% crit
        this.critChance += 20;
        this.currentDamage += 2;
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
            const headX = this.reach - 16;
            B.fillCircleGlow(headX + 10, -10, 20, '#CF1301', 15);
        }

        // Wooden handle with grain
        B.fillRect(r - 2, -3, this.reach - r - 10, 6, '#5C3317');
        // Handle highlight stripe
        B.fillRect(r - 2, -1, this.reach - r - 10, 2, '#7B4A2A');

        // Axe head attachment collar (metal band)
        const headX = this.reach - 16;
        B.fillRect(headX - 3, -5, 6, 10, '#666');

        // Axe blade — crescent shape using quadratic bezier fills
        // Blade sweep: from attachment up and around
        B.fillQuadratic(headX - 4, -4, headX + 6, -24, headX + 20, -18, '#A8A8A8');
        B.fillQuadratic(headX + 20, -18, headX + 24, -8, headX + 16, 0, '#A8A8A8');
        B.fillQuadratic(headX + 16, 0, headX + 8, -4, headX - 4, -4, '#A8A8A8');
        // Fill the interior of the blade with a triangle
        B.fillTriangle(headX - 4, -4, headX + 20, -18, headX + 16, 0, '#A8A8A8');

        // Blade outline strokes
        B.drawQuadratic(headX - 4, -4, headX + 6, -24, headX + 20, -18, '#777', 1);
        B.drawQuadratic(headX + 20, -18, headX + 24, -8, headX + 16, 0, '#777', 1);
        B.drawQuadratic(headX + 16, 0, headX + 8, -4, headX - 4, -4, '#777', 1);

        // Bright cutting edge highlight
        B.drawQuadratic(headX + 20, -17, headX + 24, -8, headX + 16, 1, '#DDD', 1.5);

        // Small back spike / beard (bottom side, smaller)
        B.fillTriangle(headX - 2, 4, headX + 8, 10, headX + 6, 4, '#999');
        B.strokePolygon([
            [headX - 2, 4],
            [headX + 8, 10],
            [headX + 6, 4]
        ], '#777', 1);

        // Crit flash indicator
        if (this.lastHitWasCrit && this.cooldown > WB.Config.WEAPON_HIT_COOLDOWN - 5) {
            B.setAlpha(0.5);
            B.fillCircle(headX + 10, -6, 22, '#FFD700');
            B.restoreAlpha();
        }

        B.popTransform();
    }
}

WB.WeaponRegistry.register('axe', AxeWeapon);
