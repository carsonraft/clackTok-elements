window.WB = window.WB || {};

// Spear: Length and damage increase per hit.
class SpearWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'spear',
            baseDamage: 3,
            rotationSpeed: 0.045,
            reach: 95,
            scalingName: 'Length',
            superThreshold: 12,
        });
        this.scalingStat.value = this.reach;
    }

    applyScaling() {
        this.reach = this.baseReach + this.hitCount * 4;
        this.currentDamage = this.baseDamage + this.hitCount * 0.5;
        this.scalingStat.value = Math.round(this.reach);
    }

    activateSuper() {
        this.rotationSpeed *= 1.5;
        this.currentDamage += 3;
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
            B.fillCircleGlow(0, 0, this.reach, '#6BB5E0', 15);
        }

        // Long shaft
        B.line(r - 2, 0, this.reach - 12, 0, '#8B6914', 5);

        // Spearhead (elongated triangle)
        B.fillTriangle(this.reach - 14, -7, this.reach + 5, 0, this.reach - 14, 7, '#B8B8B8');
        B.strokePolygon([
            [this.reach - 14, -7],
            [this.reach + 5, 0],
            [this.reach - 14, 7]
        ], '#999999', 1.5);

        // Binding wrap
        B.fillRect(this.reach - 17, -4.5, 5, 9, '#A0522D');

        B.popTransform();
    }
}

WB.WeaponRegistry.register('spear', SpearWeapon);
