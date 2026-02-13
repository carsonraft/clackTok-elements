window.WB = window.WB || {};

// Crystal (Crystal Cage): Orbiting crystal shards (like sawblade).
// Scaling: Shard count increases. Super: Crystal Storm (launch all shards as piercing projectiles).
class CrystalWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'crystal',
            baseDamage: 2,
            rotationSpeed: 0.04,
            reach: 50,
            scalingName: 'Shards',
            superThreshold: 8,
        });
        this.shardCount = 2;
        this.orbitAngle = 0;
        this.orbitSpeed = 0.04;
        this.orbitRadius = 50;
        this.shardSpinAngle = 0;
        this.shardCooldowns = [0, 0];
        this.shimmerTimer = 0;
        this.scalingStat.value = this.shardCount;
    }

    update() {
        this.orbitAngle += this.orbitSpeed;
        this.shardSpinAngle += 0.12;
        this.shimmerTimer++;

        for (let i = 0; i < this.shardCooldowns.length; i++) {
            if (this.shardCooldowns[i] > 0) this.shardCooldowns[i]--;
        }

        // Check each shard against opponents
        if (WB.Game && WB.Game.balls) {
            for (let i = 0; i < this.shardCount; i++) {
                if (this.shardCooldowns[i] > 0) continue;
                const pos = this._getShardPos(i);

                for (const target of WB.Game.balls) {
                    if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                    if (WB.Physics.circleCircle(pos.x, pos.y, 8, target.x, target.y, target.radius)) {
                        target.takeDamage(this.currentDamage);
                        this.hitCount++;
                        this.shardCooldowns[i] = WB.Config.WEAPON_HIT_COOLDOWN;
                        this.applyScaling();
                        this.checkSuper();
                        WB.Audio.weaponHit(this.hitCount, this.type);
                        if (WB.Game._excitement) WB.Game._excitement.recordHit();
                        WB.Renderer.triggerShake(3);
                        if (WB.Game.particles) {
                            WB.Game.particles.emit(pos.x, pos.y, 6, '#CC66FF');
                        }
                        break;
                    }
                }
            }
        }
    }

    _getShardPos(index) {
        const angleOffset = (index / this.shardCount) * Math.PI * 2;
        const angle = this.orbitAngle + angleOffset;
        return {
            x: this.owner.x + Math.cos(angle) * this.orbitRadius,
            y: this.owner.y + Math.sin(angle) * this.orbitRadius,
        };
    }

    canHit() { return false; } // Shards handle their own collision

    applyScaling() {
        this.shardCount = 2 + Math.floor(this.hitCount / 2);
        if (this.shardCount > 10) this.shardCount = 10;
        while (this.shardCooldowns.length < this.shardCount) {
            this.shardCooldowns.push(0);
        }
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.3);
        this.scalingStat.value = this.shardCount;
    }

    activateSuper() {
        // Crystal Shards: Cutter+Cutter inspired → CRYSTAL BARRAGE!
        // Launch ALL current shards + spawn tons of new ones that fire outward
        // First launch existing shards
        if (WB.Game && WB.Game.projectiles) {
            const totalShards = this.shardCount + 8; // existing + 8 bonus
            for (let i = 0; i < totalShards; i++) {
                const a = (i / totalShards) * Math.PI * 2;
                const spawnDist = i < this.shardCount ? this.orbitRadius : this.owner.radius;
                WB.Game.projectiles.push(new WB.Projectile({
                    x: this.owner.x + Math.cos(a) * spawnDist,
                    y: this.owner.y + Math.sin(a) * spawnDist,
                    vx: Math.cos(a) * 7,
                    vy: Math.sin(a) * 7,
                    damage: this.currentDamage + 4,
                    owner: this.owner,
                    ownerWeapon: this,
                    radius: 6,
                    lifespan: 150,
                    bounces: 3,
                    color: '#CC66FF',
                    piercing: true,
                }));
            }
        }
        this.shardCount += 4;
        this.orbitSpeed *= 1.8;
        this.orbitRadius += 10;
        this.currentDamage += 3;
        // Refill cooldown array
        while (this.shardCooldowns.length < this.shardCount) {
            this.shardCooldowns.push(0);
        }
        WB.Renderer.triggerShake(8);
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 25, '#CC66FF');
        }
    }

    getTipX() { return this._getShardPos(0).x; }
    getTipY() { return this._getShardPos(0).y; }

    draw() {
        const B = WB.GLBatch;

        if (this.superActive) {
            B.strokeCircleGlow(this.owner.x, this.owner.y, this.orbitRadius, '#CC66FF', 1, 10);
        }

        // Orbit path
        B.setAlpha(0.12);
        B.strokeCircle(this.owner.x, this.owner.y, this.orbitRadius, '#CC66FF', 1);
        B.restoreAlpha();

        // Draw each shard
        for (let i = 0; i < this.shardCount; i++) {
            const pos = this._getShardPos(i);
            this._drawShard(pos.x, pos.y);
        }
    }

    _drawShard(x, y) {
        const B = WB.GLBatch;
        B.pushTransform(x, y, this.shardSpinAngle);

        // Crystal shard — diamond shape
        B.fillPolygon([
            [0, -8],
            [5, 0],
            [0, 8],
            [-5, 0]
        ], '#CC66FF');
        B.strokePolygon([
            [0, -8],
            [5, 0],
            [0, 8],
            [-5, 0]
        ], '#9944CC', 1);

        // Inner facet
        B.setAlpha(0.4);
        B.fillPolygon([
            [0, -4],
            [2, 0],
            [0, 4],
            [-2, 0]
        ], '#EECCFF');
        B.restoreAlpha();

        B.popTransform();
    }
}

WB.WeaponRegistry.register('crystal', CrystalWeapon, 'elemental');
