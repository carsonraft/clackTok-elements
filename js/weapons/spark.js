window.WB = window.WB || {};

// Spark (Volt Whip): Melee weapon with chain lightning that jumps to a 2nd target.
// Scaling: Chain count increases.
// Super (Crystal Shards: Spark+Spark → Area Spark): Owner radiates an expanding
// electricity field that grows while stationary and shrinks while moving!
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
        this.sparkFieldRadius = 0; // for Area Spark super
        this.sparkFieldMax = 130;
        this.scalingStat.value = this.chainCount;
    }

    update() {
        super.update();
        this.teslaTimer++;

        // Super (Area Spark): electricity field grows when still, shrinks when moving
        if (this.superActive) {
            const speed = Math.sqrt(this.owner.vx * this.owner.vx + this.owner.vy * this.owner.vy);
            if (speed < 2) {
                // Growing — Kirby plants and the field expands!
                this.sparkFieldRadius = Math.min(this.sparkFieldMax, this.sparkFieldRadius + 1.5);
            } else {
                // Shrinking while moving
                this.sparkFieldRadius = Math.max(30, this.sparkFieldRadius - 2);
            }
            // Damage everything inside the field every 20 frames
            if (this.teslaTimer % 20 === 0 && WB.Game && WB.Game.balls) {
                const fieldR = this.owner.radius + this.sparkFieldRadius;
                for (const target of WB.Game.balls) {
                    if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                    const dx = target.x - this.owner.x;
                    const dy = target.y - this.owner.y;
                    if (Math.sqrt(dx * dx + dy * dy) < fieldR) {
                        target.takeDamage(3);
                        if (WB.GLEffects) {
                            WB.GLEffects.spawnDamageNumber(target.x, target.y, 3, '#FFE333');
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
        // Crystal Shards: Spark+Spark → AREA SPARK!
        // Expanding electricity field — grows when stationary, shrinks when moving
        this.currentDamage += 3;
        this.chainCount += 2;
        this.rotationSpeed *= 1.3;
        this.sparkFieldRadius = 50; // start with a decent field
        // Initial zap burst — damage everyone nearby
        if (WB.Game && WB.Game.balls) {
            for (const target of WB.Game.balls) {
                if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                const dx = target.x - this.owner.x;
                const dy = target.y - this.owner.y;
                if (Math.sqrt(dx * dx + dy * dy) < 120) {
                    target.takeDamage(5);
                    if (WB.Game.particles) {
                        WB.Game.particles.explode(target.x, target.y, 12, '#FFE333');
                    }
                }
            }
        }
        if (WB.GLEffects) {
            WB.GLEffects.triggerChromatic(0.1);
        }
        WB.Renderer.triggerShake(6);
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
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

        // Super: Area Spark expanding/contracting field
        if (this.superActive && this.sparkFieldRadius > 5) {
            const fieldR = r + this.sparkFieldRadius;
            // Crackling field with animated arcs
            const pulse = 0.1 + Math.sin(this.teslaTimer * 0.08) * 0.05;
            B.setAlpha(pulse);
            B.fillCircle(this.owner.x, this.owner.y, fieldR, '#FFE333');
            B.restoreAlpha();
            B.setAlpha(pulse * 1.5);
            B.strokeCircle(this.owner.x, this.owner.y, fieldR, '#FFFF88', 2);
            B.restoreAlpha();
            // Random lightning arcs at the field boundary
            if (this.teslaTimer % 3 === 0) {
                B.setAlpha(0.4);
                const arcAngle = Math.random() * Math.PI * 2;
                const arcX = this.owner.x + Math.cos(arcAngle) * fieldR;
                const arcY = this.owner.y + Math.sin(arcAngle) * fieldR;
                const jitter = (Math.random() - 0.5) * 20;
                B.line(
                    this.owner.x + Math.cos(arcAngle) * (fieldR * 0.5),
                    this.owner.y + Math.sin(arcAngle) * (fieldR * 0.5),
                    arcX + jitter, arcY + jitter,
                    '#FFFF44', 2
                );
                B.restoreAlpha();
            }
        }
    }
}

WB.WeaponRegistry.register('spark', SparkWeapon, 'elemental');
