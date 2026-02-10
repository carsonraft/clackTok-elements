window.WB = window.WB || {};

// Wind (Gale Blade): Fastest rotating melee weapon with pushback on hit.
// Scaling: RPM increases per hit. Super: Tornado vortex that pulls enemies in.
class WindWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'wind',
            baseDamage: 2,
            rotationSpeed: 0.09,
            reach: 55,
            scalingName: 'RPM',
            superThreshold: 10,
        });
        this.windTimer = 0;
        this.scalingStat.value = Math.round(this.rotationSpeed * 1000);
    }

    update() {
        super.update();
        this.windTimer++;

        // Super: Tornado vortex — pulls enemies toward owner
        if (this.superActive && WB.Game && WB.Game.balls) {
            const vortexRadius = this.owner.radius + 100;
            for (const target of WB.Game.balls) {
                if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                const dx = this.owner.x - target.x;
                const dy = this.owner.y - target.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < vortexRadius && dist > 0) {
                    const pull = 0.3;
                    target.vx += (dx / dist) * pull;
                    target.vy += (dy / dist) * pull;
                }
            }
        }
    }

    onHit(target) {
        target.takeDamage(this.currentDamage);

        // Pushback — wind sends target flying away
        const dx = target.x - this.owner.x;
        const dy = target.y - this.owner.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const pushForce = 3;
        target.vx += (dx / dist) * pushForce;
        target.vy += (dy / dist) * pushForce;

        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);
        this._onHitEffects(target, this.currentDamage, '#AADDCC');

        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.emit(target.x, target.y, 8, '#AADDCC');
        }
    }

    applyScaling() {
        this.rotationSpeed = 0.09 + this.hitCount * 0.006;
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.3);
        this.scalingStat.value = Math.round(this.rotationSpeed * 1000);
    }

    activateSuper() {
        this.rotationSpeed *= 2;
        this.currentDamage += 2;
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
            B.fillCircleGlow(0, 0, this.reach, '#AADDCC', 12);
        }

        // Wind blade — thin curved sweep
        B.fillPolygon([
            [r - 2, -3],
            [this.reach * 0.5, -6],
            [this.reach + 2, -1],
            [this.reach + 2, 1],
            [this.reach * 0.5, 6],
            [r - 2, 3]
        ], 'rgba(170,221,204,0.7)');
        B.strokePolygon([
            [r - 2, -3],
            [this.reach * 0.5, -6],
            [this.reach + 2, -1],
            [this.reach + 2, 1],
            [this.reach * 0.5, 6],
            [r - 2, 3]
        ], '#88CCBB', 1);

        // Air streak highlights
        B.setAlpha(0.4);
        B.line(r + 5, -2, this.reach - 5, -1, '#DDEEDD', 1.5);
        B.line(r + 8, 1, this.reach - 8, 2, '#DDEEDD', 1);
        B.restoreAlpha();

        B.popTransform();

        // Wind swirl particles
        if (this.windTimer % 6 === 0) {
            B.setAlpha(0.2);
            const wa = this.windTimer * 0.08;
            const wd = r + 10 + Math.sin(this.windTimer * 0.03) * 8;
            B.fillCircle(
                this.owner.x + Math.cos(wa) * wd,
                this.owner.y + Math.sin(wa) * wd,
                2, '#AADDCC'
            );
            B.restoreAlpha();
        }

        // Super: vortex ring
        if (this.superActive) {
            const pulse = 0.1 + Math.sin(this.windTimer * 0.06) * 0.05;
            B.setAlpha(pulse);
            B.strokeCircle(this.owner.x, this.owner.y, r + 100, '#AADDCC', 1.5);
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('wind', WindWeapon);
