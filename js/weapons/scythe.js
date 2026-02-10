window.WB = window.WB || {};

// Scythe: Poison DOT increases by 1 every hit.
class ScytheWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'scythe',
            baseDamage: 2,
            rotationSpeed: 0.05,
            reach: 78,
            scalingName: 'Poison',
            superThreshold: 8,
        });
        this.poisonLevel = 1;
        this.scalingStat.value = this.poisonLevel;
    }

    onHit(target) {
        target.takeDamage(this.currentDamage);
        target.poisonStacks += this.poisonLevel;
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.emit(target.x, target.y, 10, '#00CC44');
        }
    }

    applyScaling() {
        this.poisonLevel = 1 + this.hitCount;
        this.scalingStat.value = this.poisonLevel;
    }

    activateSuper() {
        this.rotationSpeed *= 1.5;
        this.currentDamage += 2;
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
            B.fillCircleGlow(this.reach - 10, -14, 22, '#9B59B6', 15);
        }

        // Long wooden handle
        B.line(r - 2, 0, this.reach - 4, 0, '#4A2810', 4);
        // Handle highlight
        B.line(r - 2, -1, this.reach - 4, -1, '#6B3A1F', 2);

        // Scythe blade — sweeping curved blade
        const bx = this.reach - 6;

        // Blade body: built from bezier/quadratic fills
        // Spine: attachment to upper curve
        B.fillQuadratic(bx - 2, -3, bx + 10, -6, bx + 8, -16, '#B0B0B0');
        // Main blade arc (outer)
        B.fillBezier(bx + 8, -16, bx + 4, -30, bx - 16, -36, bx - 30, -28, '#B0B0B0');
        // Tip to inner edge return
        B.line(bx - 30, -28, bx - 32, -24, '#B0B0B0', 2);
        // Inner edge curves back
        B.fillBezier(bx - 32, -24, bx - 14, -28, bx + 2, -18, bx + 4, -10, '#B0B0B0');
        B.fillQuadratic(bx + 4, -10, bx + 2, -4, bx - 2, -3, '#B0B0B0');
        // Fill interior with triangles to close the blade shape
        B.fillTriangle(bx - 2, -3, bx + 8, -16, bx + 4, -10, '#B0B0B0');
        B.fillTriangle(bx + 8, -16, bx - 30, -28, bx + 4, -10, '#B0B0B0');
        B.fillTriangle(bx - 30, -28, bx - 32, -24, bx + 4, -10, '#B0B0B0');

        // Blade outline strokes
        B.drawQuadratic(bx - 2, -3, bx + 10, -6, bx + 8, -16, '#888', 1);
        B.drawBezier(bx + 8, -16, bx + 4, -30, bx - 16, -36, bx - 30, -28, '#888', 1);
        B.line(bx - 30, -28, bx - 32, -24, '#888', 1);
        B.drawBezier(bx - 32, -24, bx - 14, -28, bx + 2, -18, bx + 4, -10, '#888', 1);
        B.drawQuadratic(bx + 4, -10, bx + 2, -4, bx - 2, -3, '#888', 1);

        // Sharp inner edge highlight (the cutting edge)
        B.drawBezier(bx - 31, -26, bx - 14, -29, bx + 2, -18, bx + 4, -10, '#E0E0E0', 1.5);

        // Subtle purple poison tint on blade (overlay at low alpha)
        B.setAlpha(0.15);
        B.fillTriangle(bx - 2, -3, bx + 8, -16, bx + 4, -10, '#9B59B6');
        B.fillTriangle(bx + 8, -16, bx - 30, -28, bx + 4, -10, '#9B59B6');
        B.fillTriangle(bx - 30, -28, bx - 32, -24, bx + 4, -10, '#9B59B6');
        B.restoreAlpha();

        // Super: mirror blade on opposite side
        if (this.superActive) {
            // Mirror blade fills (y-flipped)
            B.fillQuadratic(bx - 2, 3, bx + 10, 6, bx + 8, 16, '#B0B0B0');
            B.fillBezier(bx + 8, 16, bx + 4, 30, bx - 16, 36, bx - 30, 28, '#B0B0B0');
            B.line(bx - 30, 28, bx - 32, 24, '#B0B0B0', 2);
            B.fillBezier(bx - 32, 24, bx - 14, 28, bx + 2, 18, bx + 4, 10, '#B0B0B0');
            B.fillQuadratic(bx + 4, 10, bx + 2, 4, bx - 2, 3, '#B0B0B0');
            B.fillTriangle(bx - 2, 3, bx + 8, 16, bx + 4, 10, '#B0B0B0');
            B.fillTriangle(bx + 8, 16, bx - 30, 28, bx + 4, 10, '#B0B0B0');
            B.fillTriangle(bx - 30, 28, bx - 32, 24, bx + 4, 10, '#B0B0B0');

            // Mirror blade outline strokes
            B.drawQuadratic(bx - 2, 3, bx + 10, 6, bx + 8, 16, '#888', 1);
            B.drawBezier(bx + 8, 16, bx + 4, 30, bx - 16, 36, bx - 30, 28, '#888', 1);
            B.line(bx - 30, 28, bx - 32, 24, '#888', 1);
            B.drawBezier(bx - 32, 24, bx - 14, 28, bx + 2, 18, bx + 4, 10, '#888', 1);
            B.drawQuadratic(bx + 4, 10, bx + 2, 4, bx - 2, 3, '#888', 1);

            // Mirror cutting edge highlight
            B.drawBezier(bx - 31, 26, bx - 14, 29, bx + 2, 18, bx + 4, 10, '#E0E0E0', 1.5);
        }

        B.popTransform();
    }
}

WB.WeaponRegistry.register('scythe', ScytheWeapon);
