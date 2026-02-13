window.WB = window.WB || {};

// Sword: Damage increases by 1 every hit. Super: rotates twice as fast.
class SwordWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'sword',
            baseDamage: 3,
            rotationSpeed: 0.06,
            reach: 80,
            scalingName: 'Damage',
            superThreshold: 10,
        });
        this.scalingStat.value = this.baseDamage;
    }

    applyScaling() {
        this.currentDamage = this.baseDamage + this.hitCount;
        this.scalingStat.value = this.currentDamage;
    }

    activateSuper() {
        this.rotationSpeed *= 2;
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
            // Glow effect for super mode
            B.fillCircleGlow(0, 0, this.reach, '#FF6464', 15);
        }

        // Handle (brown)
        B.fillRect(r - 2, -4, 12, 8, '#8B5E3C');

        // Crossguard (gold)
        B.fillRect(r + 9, -11, 5, 22, '#DAA520');

        // Blade (silver) - polygon for the tapered shape
        B.fillPolygon([
            [r + 14, -7],
            [this.reach - 3, -3],
            [this.reach + 4, 0],
            [this.reach - 3, 3],
            [r + 14, 7]
        ], '#D0D0D0');
        B.strokePolygon([
            [r + 14, -7],
            [this.reach - 3, -3],
            [this.reach + 4, 0],
            [this.reach - 3, 3],
            [r + 14, 7]
        ], '#999999', 1.5);

        // Blade center line highlight
        B.line(r + 16, 0, this.reach - 4, 0, 'rgba(255,255,255,0.6)', 1);

        B.popTransform();
    }
}

WB.WeaponRegistry.register('sword', SwordWeapon, 'classic');
