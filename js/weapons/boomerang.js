window.WB = window.WB || {};

// Boomerang: Throws a boomerang that returns. Damage +2 per hit. Super: throws twice as fast.
class BoomerangWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'boomerang',
            baseDamage: 3,
            rotationSpeed: 0.04,
            reach: 50,
            scalingName: 'Dmg',
            superThreshold: 10,
            isRanged: true,
        });
        this.throwDamage = 3;
        this.throwTimer = 0;
        this.throwRate = 100;
        this.activeBoomerang = null;
        this.scalingStat.value = this.throwDamage;
    }

    update() {
        super.update();
        this.throwTimer++;

        // Update active boomerang (return arc)
        if (this.activeBoomerang) {
            const b = this.activeBoomerang;
            b.age++;
            // Boomerang follows a curved arc then returns
            const progress = b.age / b.totalLife;
            if (progress >= 1) {
                this.activeBoomerang = null;
            } else {
                // Arc trajectory: outward, then curve back
                const arcAngle = b.startAngle + Math.PI * 2 * progress;
                const dist = Math.sin(progress * Math.PI) * b.maxDist;
                b.x = this.owner.x + Math.cos(arcAngle) * dist;
                b.y = this.owner.y + Math.sin(arcAngle) * dist;
                b.spinAngle += 0.3;

                // Check hit on opponents
                if (b.canHit && WB.Game && WB.Game.balls) {
                    for (const target of WB.Game.balls) {
                        if (target === this.owner || !target.isAlive) continue;
                        if (WB.Physics.circleCircle(b.x, b.y, 8, target.x, target.y, target.radius)) {
                            target.takeDamage(this.throwDamage);
                            this.hitCount++;
                            this.applyScaling();
                            this.checkSuper();
                            WB.Audio.weaponHit(this.hitCount, this.type);
                            b.canHit = false; // Only hit once per throw
                            if (WB.Game._excitement) WB.Game._excitement.recordHit();
                            if (WB.Game.particles) {
                                WB.Game.particles.emit(target.x, target.y, 10, this.owner.color);
                            }
                            WB.Renderer.triggerShake(4);
                            break;
                        }
                    }
                }
            }
        }

        // Throw new boomerang
        if (!this.activeBoomerang && this.throwTimer >= this.throwRate) {
            this.throwBoomerang();
            this.throwTimer = 0;
        }
    }

    throwBoomerang() {
        this.activeBoomerang = {
            x: this.owner.x,
            y: this.owner.y,
            startAngle: this.angle,
            maxDist: 120 + this.hitCount * 5,
            age: 0,
            totalLife: 90,
            spinAngle: 0,
            canHit: true,
        };
        WB.Audio.projectileFire();
    }

    applyScaling() {
        this.throwDamage = 3 + this.hitCount * 2;
        this.scalingStat.value = this.throwDamage;
    }

    activateSuper() {
        this.throwRate = Math.max(40, Math.floor(this.throwRate / 2));
    }

    onHit(target) {
        // No melee
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
            B.fillCircleGlow(r + 15, 0, 16, '#C5C500', 12);
        }

        // Draw a small boomerang shape at rest position
        if (!this.activeBoomerang) {
            B.pushTranslate(r + 15, 0);
            this._drawBoomerangShape(14);
            B.popTransform();
        }

        B.popTransform();

        // Draw active boomerang in world space
        if (this.activeBoomerang) {
            const b = this.activeBoomerang;
            B.pushTransform(b.x, b.y, b.spinAngle);

            if (this.superActive) {
                B.fillCircleGlow(0, 0, 18, '#C5C500', 10);
            }

            this._drawBoomerangShape(16);
            B.popTransform();
        }
    }

    _drawBoomerangShape(size) {
        const B = WB.GLBatch;
        // V-shaped boomerang using quadratic bezier fills and strokes
        // Four quadratic segments forming a diamond/V shape
        B.fillQuadratic(0, -size * 0.3, size, -size * 0.8, size * 0.8, 0, '#B8860B');
        B.fillQuadratic(size * 0.8, 0, size, size * 0.8, 0, size * 0.3, '#B8860B');
        B.fillQuadratic(0, size * 0.3, -size, size * 0.8, -size * 0.8, 0, '#B8860B');
        B.fillQuadratic(-size * 0.8, 0, -size, -size * 0.8, 0, -size * 0.3, '#B8860B');
        // Fill center
        B.fillPolygon([
            [0, -size * 0.3],
            [size * 0.8, 0],
            [0, size * 0.3],
            [-size * 0.8, 0]
        ], '#B8860B');

        // Outline strokes
        B.drawQuadratic(0, -size * 0.3, size, -size * 0.8, size * 0.8, 0, '#8B6914', 2);
        B.drawQuadratic(size * 0.8, 0, size, size * 0.8, 0, size * 0.3, '#8B6914', 2);
        B.drawQuadratic(0, size * 0.3, -size, size * 0.8, -size * 0.8, 0, '#8B6914', 2);
        B.drawQuadratic(-size * 0.8, 0, -size, -size * 0.8, 0, -size * 0.3, '#8B6914', 2);
    }
}

WB.WeaponRegistry.register('boomerang', BoomerangWeapon);
