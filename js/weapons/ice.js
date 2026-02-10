window.WB = window.WB || {};

// Ice (Frostbite): Melee weapon that slows targets on hit.
// Scaling: Slow duration increases per hit. Super: Flash Freeze (full freeze 120 frames).
class IceWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'ice',
            baseDamage: 3,
            rotationSpeed: 0.05,
            reach: 75,
            scalingName: 'Slow',
            superThreshold: 10,
        });
        this.slowDuration = 60; // frames
        this.slowFactor = 0.7;  // 30% speed reduction
        this.shimmerTimer = 0;
        this.scalingStat.value = (this.slowDuration / 60).toFixed(1) + 's';
    }

    update() {
        super.update();
        this.shimmerTimer++;
    }

    onHit(target) {
        target.takeDamage(this.currentDamage);

        // Apply slow — temporarily reduce target velocity
        target.vx *= this.slowFactor;
        target.vy *= this.slowFactor;

        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);
        this._onHitEffects(target, this.currentDamage, '#66CCFF');

        // Frost particles
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.emit(target.x, target.y, 8, '#AAEEFF');
        }
    }

    applyScaling() {
        this.slowDuration = 60 + this.hitCount * 15;
        this.slowFactor = Math.max(0.3, 0.7 - this.hitCount * 0.03);
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.5);
        this.scalingStat.value = (this.slowDuration / 60).toFixed(1) + 's';
    }

    activateSuper() {
        // Flash Freeze: halt all enemies completely
        if (WB.Game && WB.Game.balls) {
            for (const target of WB.Game.balls) {
                if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                target.vx = 0;
                target.vy = 0;
                target.takeDamage(5);
                if (WB.Game.particles) {
                    WB.Game.particles.explode(target.x, target.y, 15, '#AAEEFF');
                }
            }
        }
        this.currentDamage += 3;
        this.rotationSpeed *= 1.5;
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
            B.fillCircleGlow(0, 0, this.reach, '#66CCFF', 15);
        }

        // Ice crystal blade — jagged icicle shape
        B.fillPolygon([
            [r - 2, -5],
            [r + 10, -7],
            [this.reach + 4, 0],
            [r + 10, 7],
            [r - 2, 5]
        ], '#88DDFF');
        B.strokePolygon([
            [r - 2, -5],
            [r + 10, -7],
            [this.reach + 4, 0],
            [r + 10, 7],
            [r - 2, 5]
        ], '#44AADD', 1.5);

        // Inner frost highlight
        B.setAlpha(0.4);
        B.line(r + 5, 0, this.reach - 5, 0, '#DDEEFF', 2);
        B.restoreAlpha();

        // Handle (crystal grip)
        B.fillRect(r - 6, -3, 8, 6, '#5599BB');

        // Frost shards at tip
        B.line(this.reach, 0, this.reach + 6, -4, '#AAEEFF', 1);
        B.line(this.reach, 0, this.reach + 6, 4, '#AAEEFF', 1);

        B.popTransform();

        // Shimmer particles around blade
        if (this.shimmerTimer % 8 === 0) {
            B.setAlpha(0.3);
            const sx = this.owner.x + Math.cos(this.angle) * (r + 20) + (Math.random() - 0.5) * 10;
            const sy = this.owner.y + Math.sin(this.angle) * (r + 20) + (Math.random() - 0.5) * 10;
            B.fillCircle(sx, sy, 2, '#DDEEFF');
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('ice', IceWeapon);
