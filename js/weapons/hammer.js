window.WB = window.WB || {};

// Hammer: Max rotation speed increases per hit. Super: unparryable + max speed always.
class HammerWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'hammer',
            baseDamage: 5,
            rotationSpeed: 0.03,
            reach: 78,
            scalingName: 'Max RPM',
            superThreshold: 10,
        });
        this.maxRotationSpeed = 0.07;
        this.baseMaxRotation = 0.07;
        this.scalingStat.value = Math.round(this.maxRotationSpeed * 1000);
        this.currentSpeed = 0.03;
        this.accelerating = true;
    }

    update() {
        if (this._deflectReverse > 0) this._deflectReverse--;
        if (this.accelerating) {
            this.currentSpeed += 0.0012;
            if (this.currentSpeed >= this.maxRotationSpeed) {
                this.accelerating = false;
            }
        } else {
            this.currentSpeed -= 0.0008;
            if (this.currentSpeed <= 0.018) {
                this.accelerating = true;
            }
        }
        this.rotationSpeed = this.currentSpeed;
        this.angle += this.rotationSpeed * this.getDir();
        if (this.cooldown > 0) this.cooldown--;
    }

    applyScaling() {
        this.maxRotationSpeed = this.baseMaxRotation + this.hitCount * 0.005;
        this.scalingStat.value = Math.round(this.maxRotationSpeed * 1000);
    }

    activateSuper() {
        this.unparryable = true;
        this.currentSpeed = this.maxRotationSpeed;
        this.currentDamage += 3;
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
        }

        // Long handle
        B.fillRect(r - 2, -4, this.reach - r - 12, 8, '#7B4B2A');

        // Hammer head (large block)
        const headX = this.reach - 18;
        B.fillRect(headX, -15, 22, 30, '#888888');
        B.strokeRect(headX, -15, 22, 30, '#666666', 2);

        // Hammer face highlight
        B.fillRect(headX + 16, -13, 5, 26, '#AAAAAA');

        // Metal band where head meets handle
        B.fillRect(headX - 2, -6, 4, 12, '#666666');

        B.popTransform();
    }
}

WB.WeaponRegistry.register('hammer', HammerWeapon, 'classic');
