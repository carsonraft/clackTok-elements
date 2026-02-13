window.WB = window.WB || {};

// Ice (Frostbite): Melee weapon that slows targets on hit.
// Scaling: Slow duration increases per hit.
// Super (Crystal Shards: Ice+Ice → Giant Snowball): Owner grows into a giant snowball
// that rolls around freezing and crushing everything it touches!
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
        // Crystal Shards: Ice+Ice → GIANT SNOWBALL!
        // Owner grows huge and rolls around freezing + crushing everything
        this.owner.radius = Math.round(WB.Config.BALL_RADIUS * 1.8);
        this.owner.mass *= 2.5;
        this.owner.hp = Math.min(this.owner.hp + 20, this.owner.maxHp + 20);
        this.owner.maxHp += 20;
        this.currentDamage += 4;
        this.slowFactor = 0.15; // near-total freeze on hit
        this.rotationSpeed *= 1.3;
        // Flash freeze burst on activation
        if (WB.Game && WB.Game.balls) {
            for (const target of WB.Game.balls) {
                if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                target.vx *= 0.1;
                target.vy *= 0.1;
                target.takeDamage(5);
                if (WB.Game.particles) {
                    WB.Game.particles.explode(target.x, target.y, 18, '#AAEEFF');
                }
            }
        }
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 25, '#DDEEFF');
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
            // Giant Snowball glow — icy frost aura
            B.fillCircleGlow(0, 0, this.reach + 10, '#88DDFF', 20);
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

        // Super: Snowball frost texture over the enlarged ball
        if (this.superActive) {
            B.setAlpha(0.2);
            B.fillCircle(this.owner.x - r * 0.3, this.owner.y - r * 0.2, r * 0.35, '#CCEEFF');
            B.fillCircle(this.owner.x + r * 0.35, this.owner.y + r * 0.15, r * 0.3, '#BBDDFF');
            B.restoreAlpha();
            // Ice crystals embedded in snowball
            B.setAlpha(0.35);
            B.line(this.owner.x - r * 0.4, this.owner.y, this.owner.x + r * 0.1, this.owner.y - r * 0.3, '#AAEEFF', 1.5);
            B.line(this.owner.x + r * 0.2, this.owner.y - r * 0.1, this.owner.x + r * 0.1, this.owner.y + r * 0.3, '#AAEEFF', 1);
            B.restoreAlpha();
            // Frost sparkles
            if (this.shimmerTimer % 5 === 0) {
                B.setAlpha(0.4);
                const sa = this.shimmerTimer * 0.07;
                B.fillCircle(
                    this.owner.x + Math.cos(sa) * r * 0.6,
                    this.owner.y + Math.sin(sa) * r * 0.6,
                    2, '#FFFFFF'
                );
                B.restoreAlpha();
            }
        }
    }
}

WB.WeaponRegistry.register('ice', IceWeapon, 'elemental');
