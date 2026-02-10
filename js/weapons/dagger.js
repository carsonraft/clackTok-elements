window.WB = window.WB || {};

// Dagger: Rotation speed increases every hit. Super: reach multiplied by 4.
class DaggerWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'dagger',
            baseDamage: 2,
            rotationSpeed: 0.08,
            reach: 62,
            scalingName: 'Atk Speed',
            superThreshold: 10,
        });
        this.baseRotationSpeed = 0.08;
        this.scalingStat.value = Math.round(this.rotationSpeed * 1000);
    }

    applyScaling() {
        this.rotationSpeed = this.baseRotationSpeed + this.hitCount * 0.008;
        this.scalingStat.value = Math.round(this.rotationSpeed * 1000);
    }

    activateSuper() {
        this.reach = this.baseReach * 3;
        this.currentDamage = this.baseDamage + 2;
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
            B.fillCircleGlow(0, 0, this.reach, '#7BCC70', 15);
        }

        // Short handle
        B.fillRect(r - 2, -3.5, 10, 7, '#6B4226');

        // Small crossguard
        B.fillRect(r + 7, -8, 4, 16, '#B8860B');

        // Dagger blade (shorter but wide) - triangle
        B.fillTriangle(r + 11, -6, this.reach + 2, 0, r + 11, 6, '#C8C8C8');
        B.strokePolygon([
            [r + 11, -6],
            [this.reach + 2, 0],
            [r + 11, 6]
        ], '#999999', 1.2);

        B.popTransform();
    }
}

WB.WeaponRegistry.register('dagger', DaggerWeapon);
