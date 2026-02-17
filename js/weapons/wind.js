window.WB = window.WB || {};

// Wind (Gale Blade): Fastest rotating melee weapon with pushback on hit.
// Scaling: RPM increases per hit.
// Super (Crystal Shards: Cutter+Cutter → Super Cutter): Owner becomes a spinning
// tornado vortex — pulls enemies in AND shreds them with super-fast rotation!
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

        // Super (Cyclone): stronger vortex pull + wind shred damage
        if (this.superActive && WB.Game && WB.Game.balls) {
            const vortexRadius = this.owner.radius + 120;
            for (const target of WB.Game.balls) {
                if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                const dx = this.owner.x - target.x;
                const dy = this.owner.y - target.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < vortexRadius && dist > 0) {
                    // Strong pull toward center
                    const pull = 0.6;
                    target.vx += (dx / dist) * pull;
                    target.vy += (dy / dist) * pull;
                    // Also spin them around the vortex
                    const perpX = -dy / dist;
                    const perpY = dx / dist;
                    target.vx += perpX * 0.3;
                    target.vy += perpY * 0.3;
                }
            }
            // Shred damage to anything very close (in the eye of the storm)
            if (this.windTimer % 25 === 0) {
                const shredRadius = this.owner.radius + 35;
                for (const target of WB.Game.balls) {
                    if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                    const dx = target.x - this.owner.x;
                    const dy = target.y - this.owner.y;
                    if (Math.sqrt(dx * dx + dy * dy) < shredRadius) {
                        target.takeDamage(2);
                        if (WB.GLEffects) {
                            WB.GLEffects.spawnDamageNumber(target.x, target.y, 2, '#AADDCC');
                        }
                    }
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
        // Crystal Shards: Cutter+Cutter → CYCLONE!
        // Become a spinning vortex — insane rotation + stronger pull + contact shred
        this.rotationSpeed *= 3;
        this.currentDamage += 4;
        this.reach += 15; // wider sweep
        // Initial cyclone burst — blast everything outward then pull in
        if (WB.Game && WB.Game.balls) {
            for (const target of WB.Game.balls) {
                if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                const dx = target.x - this.owner.x;
                const dy = target.y - this.owner.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                target.vx += (dx / dist) * 6;
                target.vy += (dy / dist) * 6;
                target.takeDamage(4);
            }
        }
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 20, '#AADDCC');
        }
        WB.Renderer.triggerShake(8);
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
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

WB.WeaponRegistry.register('wind', WindWeapon, 'elemental');
