window.WB = window.WB || {};

// Artemis — Moon Bow: Fires homing silver arrows that gently curve toward enemies.
// Scaling: Arrow count and homing strength increase per hit.
// Super: Spent arrows become an orbiting ring of moon shards around Artemis.
class ArtemisWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'artemis',
            baseDamage: 3,            // nerfed from 4 — homing makes every arrow count
            rotationSpeed: 0.035,
            reach: 60,
            scalingName: 'Arrows',
            superThreshold: 12,       // harder to reach super (was 10)
            isRanged: true,
        });
        this.arrowCount = 2;
        this.homingStrength = 0.045;  // precise balance between 0.04 (too weak) and 0.05 (too strong)
        this.fireTimer = 0;
        this.fireRate = 52;           // split difference (was 50→too strong, 55→too weak)

        // Orbiting shards (post-super)
        this.shards = [];
        this.shardOrbitAngle = 0;
        this.shardOrbitRadius = 50;
        this.shardOrbitSpeed = 0.06;
        this.shardDamage = 2;
        this.shardCooldowns = [];

        this.scalingStat.value = this.arrowCount;
    }

    update() {
        super.update();
        this.fireTimer++;
        if (this.fireTimer >= this.fireRate) {
            this.fireArrows();
            this.fireTimer = 0;
        }

        // Update orbiting shards
        if (this.shards.length > 0) {
            this.shardOrbitAngle += this.shardOrbitSpeed;

            // Shard cooldowns
            for (let i = 0; i < this.shardCooldowns.length; i++) {
                if (this.shardCooldowns[i] > 0) this.shardCooldowns[i]--;
            }

            // Check shard collisions with enemies
            if (WB.Game && WB.Game.balls) {
                for (let s = 0; s < this.shards.length; s++) {
                    if (this.shardCooldowns[s] > 0) continue;
                    const pos = this._getShardPos(s);
                    for (const target of WB.Game.balls) {
                        if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                        if (WB.Physics.circleCircle(pos.x, pos.y, 6, target.x, target.y, target.radius)) {
                            target.takeDamage(this.shardDamage);
                            this.shardCooldowns[s] = 30;
                            this.hitCount++;
                            this.applyScaling();
                            this.checkSuper();
                            WB.Audio.weaponHit(this.hitCount, this.type);
                            this._onHitEffects(target, this.shardDamage, '#228B22');
                            if (WB.Game._excitement) WB.Game._excitement.recordHit();
                            break;
                        }
                    }
                }
            }
        }
    }

    _getShardPos(index) {
        const offset = (index / this.shards.length) * Math.PI * 2;
        const angle = this.shardOrbitAngle + offset;
        return {
            x: this.owner.x + Math.cos(angle) * this.shardOrbitRadius,
            y: this.owner.y + Math.sin(angle) * this.shardOrbitRadius,
        };
    }

    fireArrows() {
        if (!WB.Game || !WB.Game.projectiles) return;
        const spreadAngle = 0.15;
        const startAngle = this.angle - (this.arrowCount - 1) * spreadAngle / 2;
        const arrowSpeed = 5;  // reverted to 5 — 5.5 too strong with homing in small arena

        for (let i = 0; i < this.arrowCount; i++) {
            const a = startAngle + i * spreadAngle;
            WB.Game.projectiles.push(new WB.Projectile({
                x: this.getTipX(),
                y: this.getTipY(),
                vx: Math.cos(a) * arrowSpeed,
                vy: Math.sin(a) * arrowSpeed,
                damage: this.currentDamage,
                owner: this.owner,
                ownerWeapon: this,
                radius: 3,
                lifespan: 90,          // balanced lifespan (85 too short, 100 too long)
                bounces: 0,            // no bounces — small arena makes bounces OP
                color: '#C0C0C0',
                shape: 'arrow',
                homing: this.homingStrength,
            }));
        }
        WB.Audio.projectileFire();
    }

    applyScaling() {
        this.arrowCount = 2 + Math.floor(this.hitCount / 4);     // slower scaling (was /3)
        this.homingStrength = Math.min(0.09, 0.045 + this.hitCount * 0.005); // balanced homing scaling
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.25); // less dmg scaling
        this.shardDamage = 2 + Math.floor(this.hitCount * 0.15);
        this.scalingStat.value = this.arrowCount;
    }

    activateSuper() {
        this.currentDamage += 2;         // nerfed from +3
        this.fireRate = Math.max(35, this.fireRate - 10);  // less fire rate boost
        this.homingStrength = Math.min(0.12, this.homingStrength + 0.03); // less homing boost

        // Spawn orbiting moon shards
        const shardCount = 4;  // nerfed from 6
        for (let i = 0; i < shardCount; i++) {
            this.shards.push({ active: true });
            this.shardCooldowns.push(0);
        }

        // Visual burst — silver moonlight
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 20, '#C0C0C0');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 15, '#228B22');
        }
    }

    onHit(target) {
        // No melee damage; projectiles and shards handle hits
    }

    // Override tip for weapon wall bounce — use orbit if shards exist
    getTipX() {
        if (this.shards.length > 0) {
            return this._getShardPos(0).x;
        }
        return this.owner.x + Math.cos(this.angle) * this.reach;
    }
    getTipY() {
        if (this.shards.length > 0) {
            return this._getShardPos(0).y;
        }
        return this.owner.y + Math.sin(this.angle) * this.reach;
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
            B.fillCircleGlow(r + 12, 0, 20, '#228B22', 12);
        }

        // Bow body — dark wood with green tint
        const arcR = 20;
        const bowCenter = r + 12;
        const arcStart = -Math.PI * 0.45;
        const arcEnd = Math.PI * 0.45;
        const arcSegs = 12;
        for (let i = 0; i < arcSegs; i++) {
            const a0 = arcStart + (arcEnd - arcStart) * (i / arcSegs);
            const a1 = arcStart + (arcEnd - arcStart) * ((i + 1) / arcSegs);
            B.line(
                bowCenter + Math.cos(a0) * arcR, Math.sin(a0) * arcR,
                bowCenter + Math.cos(a1) * arcR, Math.sin(a1) * arcR,
                '#2E5E2E', 4
            );
        }

        // Silver bowstring
        const stringTopX = bowCenter + Math.cos(-Math.PI * 0.45) * arcR;
        const stringTopY = Math.sin(-Math.PI * 0.45) * arcR;
        const stringBotX = bowCenter + Math.cos(Math.PI * 0.45) * arcR;
        const stringBotY = Math.sin(Math.PI * 0.45) * arcR;
        B.line(stringTopX, stringTopY, bowCenter - 8, 0, '#C0C0C0', 1.5);
        B.line(bowCenter - 8, 0, stringBotX, stringBotY, '#C0C0C0', 1.5);

        // Arrow nocked
        B.line(bowCenter - 8, 0, this.reach + 4, 0, '#8B7355', 2);

        // Silver arrowhead (crescent moon shape)
        B.fillTriangle(this.reach + 6, 0, this.reach, -4, this.reach, 4, '#C0C0C0');

        // Moon fletching
        B.fillTriangle(bowCenter - 5, 0, bowCenter - 12, -3, bowCenter - 12, 3, '#228B22');

        B.popTransform();

        // Draw orbiting shards
        if (this.shards.length > 0) {
            // Orbit path
            B.setAlpha(0.06);
            B.strokeCircle(this.owner.x, this.owner.y, this.shardOrbitRadius, '#C0C0C0', 1);
            B.restoreAlpha();

            for (let s = 0; s < this.shards.length; s++) {
                const pos = this._getShardPos(s);

                // Shard trail
                const trailAngle = this.shardOrbitAngle + (s / this.shards.length) * Math.PI * 2 - 0.3;
                const trailX = this.owner.x + Math.cos(trailAngle) * this.shardOrbitRadius;
                const trailY = this.owner.y + Math.sin(trailAngle) * this.shardOrbitRadius;
                B.setAlpha(0.15);
                B.fillCircle(trailX, trailY, 4, '#C0C0C0');
                B.restoreAlpha();

                // Shard body — crescent moon shape
                B.fillCircle(pos.x, pos.y, 6, '#E0E0D0');
                B.strokeCircle(pos.x, pos.y, 6, '#999', 1);
                // Crescent shadow
                B.setAlpha(0.3);
                B.fillCircle(pos.x + 2, pos.y, 5, '#228B22');
                B.restoreAlpha();
            }
        }
    }
}

WB.WeaponRegistry.register('artemis', ArtemisWeapon, 'pantheon');
