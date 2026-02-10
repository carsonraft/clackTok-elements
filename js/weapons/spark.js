window.WB = window.WB || {};

// Spark (Volt Whip): Melee weapon with chain lightning that jumps to a 2nd target.
// Scaling: Chain count increases. Super: Tesla Field damage aura.
class SparkWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'spark',
            baseDamage: 3,
            rotationSpeed: 0.06,
            reach: 65,
            scalingName: 'Chains',
            superThreshold: 10,
        });
        this.chainCount = 1;
        this.chainRange = 120;
        this.teslaTimer = 0;
        this.scalingStat.value = this.chainCount;
    }

    update() {
        super.update();
        this.teslaTimer++;

        // Super: Tesla Field — periodic AOE damage
        if (this.superActive && WB.Game && WB.Game.balls) {
            if (this.teslaTimer % 30 === 0) {
                const auraRadius = this.owner.radius + 70;
                for (const target of WB.Game.balls) {
                    if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                    const dx = target.x - this.owner.x;
                    const dy = target.y - this.owner.y;
                    if (Math.sqrt(dx * dx + dy * dy) < auraRadius) {
                        target.takeDamage(2);
                        if (WB.GLEffects) {
                            WB.GLEffects.spawnDamageNumber(target.x, target.y, 2, '#FFE333');
                        }
                        if (WB.Game.particles) {
                            WB.Game.particles.emit(target.x, target.y, 4, '#FFE333');
                        }
                    }
                }
            }
        }
    }

    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);
        this._onHitEffects(target, this.currentDamage, '#FFE333');

        // Chain lightning — find nearby enemies and zap them
        this._chainLightning(target);
    }

    _chainLightning(firstTarget) {
        if (!WB.Game || !WB.Game.balls) return;
        let lastTarget = firstTarget;
        let chainsLeft = this.chainCount;
        const hit = new Set([this.owner, firstTarget]);

        while (chainsLeft > 0) {
            let closest = null;
            let closestDist = this.chainRange;
            for (const target of WB.Game.balls) {
                if (hit.has(target) || !target.isAlive || target.side === this.owner.side) continue;
                const dx = target.x - lastTarget.x;
                const dy = target.y - lastTarget.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < closestDist) {
                    closestDist = dist;
                    closest = target;
                }
            }
            if (!closest) break;
            const chainDmg = Math.max(1, Math.floor(this.currentDamage * 0.6));
            closest.takeDamage(chainDmg);
            hit.add(closest);
            if (WB.GLEffects) {
                WB.GLEffects.spawnDamageNumber(closest.x, closest.y, chainDmg, '#FFE333');
            }
            if (WB.Game.particles) {
                WB.Game.particles.emit(closest.x, closest.y, 4, '#FFE333');
            }
            lastTarget = closest;
            chainsLeft--;
        }
    }

    applyScaling() {
        this.chainCount = 1 + Math.floor(this.hitCount / 3);
        if (this.chainCount > 5) this.chainCount = 5;
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.4);
        this.scalingStat.value = this.chainCount;
    }

    activateSuper() {
        this.currentDamage += 3;
        this.chainCount += 2;
        this.rotationSpeed *= 1.4;
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
            B.fillCircleGlow(0, 0, this.reach, '#FFE333', 12);
        }

        // Electric whip — jagged lightning line segments
        const segs = 6;
        const segLen = (this.reach - r) / segs;
        let prevX = r;
        let prevY = 0;
        for (let i = 1; i <= segs; i++) {
            const nx = r + segLen * i;
            const jitter = i < segs ? (Math.sin(this.teslaTimer * 0.3 + i * 2) * 6) : 0;
            const ny = jitter;
            B.line(prevX, prevY, nx, ny, '#FFE333', 3);
            // Glow line
            B.setAlpha(0.3);
            B.line(prevX, prevY, nx, ny, '#FFFF88', 5);
            B.restoreAlpha();
            prevX = nx;
            prevY = ny;
        }

        // Spark tip
        B.fillCircle(this.reach, 0, 4, '#FFE333');
        B.setAlpha(0.3);
        B.fillCircle(this.reach, 0, 7, '#FFFF88');
        B.restoreAlpha();

        B.popTransform();

        // Super: Tesla field ring
        if (this.superActive) {
            const pulse = 0.12 + Math.sin(this.teslaTimer * 0.1) * 0.06;
            B.setAlpha(pulse);
            B.strokeCircle(this.owner.x, this.owner.y, r + 70, '#FFE333', 1.5);
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('spark', SparkWeapon);
