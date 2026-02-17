window.WB = window.WB || {};

// Nature (Vine Lash): Melee weapon with growing reach (+3 per hit) and root chance.
// Scaling: Current reach increases. Super: Overgrowth (reach 130 + thorns damage).
class NatureWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'nature',
            baseDamage: 2,
            rotationSpeed: 0.045,
            reach: 50,
            scalingName: 'Reach',
            superThreshold: 10,
        });
        this.rootChance = 0.15;
        this.vineTimer = 0;
        this.thornsDamage = 0;
        this.scalingStat.value = this.reach;
    }

    update() {
        super.update();
        this.vineTimer++;

        // Super: thorns — damage enemies that are close to owner
        if (this.superActive && this.thornsDamage > 0 && WB.Game && WB.Game.balls) {
            if (this.vineTimer % 40 === 0) {
                const thornsRadius = this.owner.radius + 20;
                for (const target of WB.Game.balls) {
                    if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                    const dx = target.x - this.owner.x;
                    const dy = target.y - this.owner.y;
                    if (Math.sqrt(dx * dx + dy * dy) < thornsRadius) {
                        target.takeDamage(this.thornsDamage);
                        if (WB.GLEffects) {
                            WB.GLEffects.spawnDamageNumber(target.x, target.y, this.thornsDamage, '#33AA44');
                        }
                    }
                }
            }
        }
    }

    onHit(target) {
        target.takeDamage(this.currentDamage);

        // Root chance — briefly stop target
        if (WB.random() < this.rootChance) {
            target.vx *= 0.1;
            target.vy *= 0.1;
            if (WB.Game && WB.Game.particles) {
                WB.Game.particles.emit(target.x, target.y, 6, '#228833');
            }
        }

        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);
        this._onHitEffects(target, this.currentDamage, '#33AA44');
    }

    applyScaling() {
        this.reach = 50 + this.hitCount * 3;
        if (this.reach > 120) this.reach = 120;
        this.rootChance = Math.min(0.5, 0.15 + this.hitCount * 0.03);
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.3);
        this.scalingStat.value = this.reach;
    }

    activateSuper() {
        // Crystal Shards: Needle+Needle inspired → WORLD TREE!
        // Vine explodes to max reach + thorns aura expands + roots all enemies on activation
        this.reach = 140;
        this.thornsDamage = 3;
        this.currentDamage += 4;
        this.rootChance = 0.7; // massive root chance
        this.scalingStat.value = this.reach;
        // World Tree eruption — root ALL enemies and deal damage
        if (WB.Game && WB.Game.balls) {
            for (const target of WB.Game.balls) {
                if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                target.vx *= 0.05;
                target.vy *= 0.05;
                target.takeDamage(6);
                if (WB.Game.particles) {
                    WB.Game.particles.explode(target.x, target.y, 12, '#33AA44');
                }
            }
        }
        // Heal from the World Tree's life force
        this.owner.hp = Math.min(this.owner.hp + 15, this.owner.maxHp);
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 25, '#44BB55');
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
        }

        // Vine — organic wavy line
        const segs = 8;
        const segLen = (this.reach - r + 5) / segs;
        let prevX = r - 3;
        let prevY = 0;
        for (let i = 1; i <= segs; i++) {
            const nx = r - 3 + segLen * i;
            const wave = Math.sin(this.vineTimer * 0.06 + i * 0.8) * 4;
            const ny = i < segs ? wave : 0;
            B.line(prevX, prevY, nx, ny, '#33AA44', 3.5);
            // Leaf nodes
            if (i % 3 === 0 && i < segs) {
                B.fillTriangle(nx - 2, ny, nx + 2, ny - 5, nx + 4, ny, '#44BB55');
            }
            prevX = nx;
            prevY = ny;
        }

        // Whip tip — barbed
        B.fillTriangle(this.reach - 3, -4, this.reach + 5, 0, this.reach - 3, 4, '#228833');

        // Thorns along vine
        B.setAlpha(0.5);
        for (let i = 0; i < 4; i++) {
            const tx = r + 5 + i * (this.reach - r) / 5;
            B.line(tx, 0, tx + 2, -4, '#228833', 1);
            B.line(tx + 4, 0, tx + 6, 4, '#228833', 1);
        }
        B.restoreAlpha();

        B.popTransform();

        // Super: thorns ring
        if (this.superActive) {
            B.setAlpha(0.15);
            B.strokeCircle(this.owner.x, this.owner.y, r + 20, '#33AA44', 2);
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('nature', NatureWeapon, 'elemental');
