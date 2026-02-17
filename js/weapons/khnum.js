window.WB = window.WB || {};

// Khnum — Ram God / Potter: Body contact weapon. Ball grows in size and mass per hit.
// Each hit: +3% diameter, +5% mass. Damage scales with mass. Knockback scales with mass.
// Knockback RECEIVED inversely scales with mass.
// Super (12 hits): Growth rate doubles (+6% diameter, +10% mass per hit).
// Pure physics consequences — bigger ball is easier to hit things AND get hit.
class KhnumWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'khnum',
            baseDamage: 1,
            rotationSpeed: 0,
            reach: 0,
            scalingName: 'Mass',
            superThreshold: 12,
            canParry: false,
        });
        this.contactCooldown = 0;
        this.contactCooldownTime = 35;
        this.contactAura = 2;
        this.growthDiameter = 0.015; // +1.5% per hit
        this.growthMass = 0.025;     // +2.5% per hit
        this.baseRadius = this.owner.radius;
        this.baseMass = this.owner.mass;
        this.visualTimer = 0;
        this.scalingStat.value = '1.0x';
    }

    update() {
        if (this.contactCooldown > 0) this.contactCooldown--;
        this.visualTimer++;
    }

    canHit() {
        return this.contactCooldown <= 0;
    }

    onHit(target) {
        // Damage scales with current mass
        const massMult = this.owner.mass / this.baseMass;
        const dmg = this.currentDamage * massMult;

        target.takeDamage(dmg);
        this.hitCount++;
        this.contactCooldown = this.contactCooldownTime;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);

        // Knockback scales with mass
        const dx = target.x - this.owner.x;
        const dy = target.y - this.owner.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const kb = 3 * massMult;
        target.vx += (dx / d) * kb;
        target.vy += (dy / d) * kb;

        this._onHitEffects(target, dmg, '#CD853F');

        // Stone/clay particles
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.emit(target.x, target.y, 5, '#CD853F');
            WB.Game.particles.emit(target.x, target.y, 3, '#8B7355');
        }
    }

    applyScaling() {
        // Grow the ball
        const diamGrowth = this.superActive ? this.growthDiameter * 2 : this.growthDiameter;
        const massGrowth = this.superActive ? this.growthMass * 2 : this.growthMass;

        this.owner.radius = Math.round(this.baseRadius * (1 + this.hitCount * diamGrowth));
        this.owner.mass = this.baseMass * (1 + this.hitCount * massGrowth);

        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.2);
        const massMult = this.owner.mass / this.baseMass;
        this.scalingStat.value = massMult.toFixed(1) + 'x';
    }

    activateSuper() {
        // Growth rate doubles (applied in applyScaling via superActive flag)
        // Recalculate with doubled rates
        this.applyScaling();

        // Stone burst
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 20, '#CD853F');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 12, '#8B7355');
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        // Stone/clay texture overlay — darker ring pattern
        const massMult = this.owner.mass / this.baseMass;

        // Inner stone rings (visible as ball grows)
        if (massMult > 1.1) {
            const rings = Math.min(4, Math.floor((massMult - 1) * 5));
            for (let i = 0; i < rings; i++) {
                const ringR = r * (0.3 + i * 0.15);
                B.setAlpha(0.08);
                B.strokeCircle(this.owner.x, this.owner.y, ringR, '#8B6914', 1.5);
                B.restoreAlpha();
            }
        }

        // Ram horns — two curved arcs on the sides, with dark outlines
        const hornSize = Math.min(r * 0.6, 12 + massMult * 3);
        // Dark outline behind horns for contrast
        B.setAlpha(0.85);
        B.drawQuadratic(
            this.owner.x - r * 0.7, this.owner.y - r * 0.3,
            this.owner.x - r - hornSize, this.owner.y - hornSize * 0.8,
            this.owner.x - r * 0.5, this.owner.y - r * 0.8,
            '#3D2200', 5
        );
        B.drawQuadratic(
            this.owner.x + r * 0.7, this.owner.y - r * 0.3,
            this.owner.x + r + hornSize, this.owner.y - hornSize * 0.8,
            this.owner.x + r * 0.5, this.owner.y - r * 0.8,
            '#3D2200', 5
        );
        // Main horns — thicker
        B.drawQuadratic(
            this.owner.x - r * 0.7, this.owner.y - r * 0.3,
            this.owner.x - r - hornSize, this.owner.y - hornSize * 0.8,
            this.owner.x - r * 0.5, this.owner.y - r * 0.8,
            '#B8860B', 3.5
        );
        B.drawQuadratic(
            this.owner.x + r * 0.7, this.owner.y - r * 0.3,
            this.owner.x + r + hornSize, this.owner.y - hornSize * 0.8,
            this.owner.x + r * 0.5, this.owner.y - r * 0.8,
            '#B8860B', 3.5
        );
        B.restoreAlpha();

        // Super: stone density overlay
        if (this.superActive) {
            const pulse = Math.sin(this.visualTimer * 0.05) * 0.03;
            B.setAlpha(0.1 + pulse);
            B.fillCircle(this.owner.x, this.owner.y, r + 2, '#5C4033');
            B.restoreAlpha();

            B.setAlpha(0.15 + pulse);
            B.strokeCircle(this.owner.x, this.owner.y, r + 3, '#B8860B', 2);
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('khnum', KhnumWeapon, 'egyptian');
