window.WB = window.WB || {};

// Magma (Lava Flow): Body-contact weapon that leaves lava pools while moving.
// Scaling: Pool tick damage increases. Super: Volcanic Eruption (8 pools in a ring).
class MagmaWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'magma',
            baseDamage: 3,
            rotationSpeed: 0,
            reach: 0,
            scalingName: 'Heat',
            superThreshold: 10,
            canParry: false,
        });
        this.contactCooldown = 0;
        this.pools = [];
        this.maxPools = 6;
        this.poolTimer = 0;
        this.poolDamage = 1;
        this.poolLifespan = 300; // 5 seconds
        this.magmaTimer = 0;
        this.scalingStat.value = this.poolDamage;
    }

    update() {
        if (this.contactCooldown > 0) this.contactCooldown--;
        this.magmaTimer++;
        this.poolTimer++;

        // Drop lava pools as ball moves (every 60 frames, or 30 in super)
        const dropRate = this.superActive ? 30 : 60;
        if (this.poolTimer >= dropRate) {
            this.poolTimer = 0;
            const speed = Math.sqrt(this.owner.vx * this.owner.vx + this.owner.vy * this.owner.vy);
            if (speed > 1.5) {
                this._dropPool(this.owner.x, this.owner.y);
            }
        }

        // Update pools — damage enemies standing in them
        for (let i = this.pools.length - 1; i >= 0; i--) {
            const pool = this.pools[i];
            pool.life--;
            if (pool.life <= 0) {
                this.pools.splice(i, 1);
                continue;
            }

            pool.tickTimer++;
            if (pool.tickTimer >= 30 && WB.Game && WB.Game.balls) {
                pool.tickTimer = 0;
                for (const target of WB.Game.balls) {
                    if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                    const dx = target.x - pool.x;
                    const dy = target.y - pool.y;
                    if (Math.sqrt(dx * dx + dy * dy) < pool.radius + target.radius) {
                        target.takeDamage(this.poolDamage);
                        if (WB.GLEffects) {
                            WB.GLEffects.spawnDamageNumber(target.x, target.y, this.poolDamage, '#FF6622');
                        }
                    }
                }
            }
        }
    }

    _dropPool(x, y) {
        if (this.pools.length >= this.maxPools) {
            this.pools.shift(); // remove oldest
        }
        this.pools.push({
            x, y,
            radius: 20 + WB.random() * 10,
            life: this.poolLifespan,
            tickTimer: 0,
        });
    }

    canHit() {
        return this.contactCooldown <= 0;
    }

    onHit(target) {
        target.takeDamage(this.currentDamage);
        // Also apply a burn stack
        target.poisonStacks = (target.poisonStacks || 0) + 1;
        this.hitCount++;
        this.contactCooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);
        this._onHitEffects(target, this.currentDamage, '#FF6622');

        // Drop a pool at impact
        this._dropPool(target.x, target.y);
    }

    applyScaling() {
        this.poolDamage = 1 + Math.floor(this.hitCount * 0.4);
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.4);
        this.scalingStat.value = this.poolDamage;
    }

    activateSuper() {
        // Crystal Shards: Burn+Burn inspired → VOLCANIC ERUPTION!
        // Massive lava burst — 12 pools in expanding rings + faster pool drops + burn all
        const arena = WB.Config.ARENA;
        // Inner ring (4 pools close)
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2;
            const px = Math.max(arena.x + 20, Math.min(arena.x + arena.width - 20,
                this.owner.x + Math.cos(a) * 50));
            const py = Math.max(arena.y + 20, Math.min(arena.y + arena.height - 20,
                this.owner.y + Math.sin(a) * 50));
            this._dropPool(px, py);
        }
        // Outer ring (8 pools far)
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
            const px = Math.max(arena.x + 20, Math.min(arena.x + arena.width - 20,
                this.owner.x + Math.cos(a) * 110));
            const py = Math.max(arena.y + 20, Math.min(arena.y + arena.height - 20,
                this.owner.y + Math.sin(a) * 110));
            this._dropPool(px, py);
        }
        this.maxPools = 20;
        this.poolDamage += 3;
        this.currentDamage += 4;
        this.poolLifespan = 500;
        // Pools drop every 30 frames in super (2x faster)
        // Burn all enemies on eruption
        if (WB.Game && WB.Game.balls) {
            for (const target of WB.Game.balls) {
                if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                target.poisonStacks = (target.poisonStacks || 0) + 3;
                target.takeDamage(6);
            }
        }
        WB.Renderer.triggerShake(12);
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 30, '#FF6622');
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        // Draw lava pools
        for (const pool of this.pools) {
            const fade = Math.min(1, pool.life / 60);
            B.setAlpha(0.25 * fade);
            B.fillCircle(pool.x, pool.y, pool.radius, '#FF4400');
            B.restoreAlpha();
            B.setAlpha(0.15 * fade);
            B.fillCircle(pool.x, pool.y, pool.radius * 0.6, '#FF8844');
            B.restoreAlpha();
            // Bubbles
            B.setAlpha(0.3 * fade);
            const bx = pool.x + Math.sin(this.magmaTimer * 0.08 + pool.x) * pool.radius * 0.3;
            const by = pool.y + Math.cos(this.magmaTimer * 0.06 + pool.y) * pool.radius * 0.3;
            B.fillCircle(bx, by, 2, '#FFAA44');
            B.restoreAlpha();
        }

        // Magma body glow
        B.setAlpha(0.2);
        B.fillCircle(this.owner.x, this.owner.y, r + 4, '#FF6622');
        B.restoreAlpha();

        // Molten cracks on ball
        B.setAlpha(0.4);
        B.line(
            this.owner.x - r * 0.3, this.owner.y - r * 0.2,
            this.owner.x + r * 0.2, this.owner.y + r * 0.3,
            '#FF8844', 1.5
        );
        B.line(
            this.owner.x + r * 0.1, this.owner.y - r * 0.4,
            this.owner.x + r * 0.4, this.owner.y + r * 0.1,
            '#FFAA44', 1
        );
        B.restoreAlpha();

        // Super glow
        if (this.superActive) {
            const pulse = 0.12 + Math.sin(this.magmaTimer * 0.07) * 0.06;
            B.setAlpha(pulse);
            B.strokeCircle(this.owner.x, this.owner.y, r + 10, '#FF6622', 2);
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('magma', MagmaWeapon);
