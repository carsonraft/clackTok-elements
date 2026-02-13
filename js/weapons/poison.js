window.WB = window.WB || {};

// Poison (Toxic Barb): Melee weapon that applies poison stacks (using ball.js built-in poison system).
// Scaling: Venom stacks per hit increase. Super: Pandemic (AOE poison all enemies).
class PoisonWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'poison',
            baseDamage: 2,
            rotationSpeed: 0.05,
            reach: 55,
            scalingName: 'Venom',
            superThreshold: 10,
        });
        this.venomPerHit = 1;
        this.toxicTimer = 0;
        this.scalingStat.value = this.venomPerHit;
    }

    update() {
        super.update();
        this.toxicTimer++;
    }

    onHit(target) {
        target.takeDamage(this.currentDamage);
        // Apply poison stacks — ball.js handles the DOT automatically!
        target.poisonStacks = (target.poisonStacks || 0) + this.venomPerHit;
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);
        this._onHitEffects(target, this.currentDamage, '#66CC33');

        // Toxic splash particles
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.emit(target.x, target.y, 6, '#66CC33');
        }
    }

    applyScaling() {
        this.venomPerHit = 1 + Math.floor(this.hitCount / 2);
        if (this.venomPerHit > 8) this.venomPerHit = 8;
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.3);
        this.scalingStat.value = this.venomPerHit;
    }

    activateSuper() {
        // Crystal Shards: Needle+Needle → TOXIC ERUPTION!
        // Venomous spines burst out in all directions like a poison porcupine
        // Fire 10 poison barb projectiles outward
        if (WB.Game && WB.Game.projectiles) {
            for (let i = 0; i < 10; i++) {
                const a = (i / 10) * Math.PI * 2;
                WB.Game.projectiles.push(new WB.Projectile({
                    x: this.owner.x + Math.cos(a) * this.owner.radius,
                    y: this.owner.y + Math.sin(a) * this.owner.radius,
                    vx: Math.cos(a) * 5,
                    vy: Math.sin(a) * 5,
                    damage: 4,
                    owner: this.owner,
                    ownerWeapon: this,
                    radius: 4,
                    lifespan: 100,
                    bounces: 1,
                    color: '#66CC33',
                    piercing: false,
                }));
            }
        }
        // Also apply massive poison to everyone
        if (WB.Game && WB.Game.balls) {
            for (const target of WB.Game.balls) {
                if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                target.poisonStacks = (target.poisonStacks || 0) + 8;
                target.takeDamage(4);
                if (WB.Game.particles) {
                    WB.Game.particles.explode(target.x, target.y, 15, '#66CC33');
                }
            }
        }
        this.currentDamage += 3;
        this.venomPerHit += 4;
        WB.Renderer.triggerShake(6);
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 20, '#88EE44');
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
            B.fillCircleGlow(0, 0, this.reach, '#66CC33', 12);
        }

        // Barbed vine / stinger
        // Stem
        B.fillRect(r - 2, -2, this.reach - r - 8, 4, '#448822');

        // Thorns along stem
        for (let i = 0; i < 3; i++) {
            const tx = r + 8 + i * 12;
            B.fillTriangle(tx, -2, tx + 3, -7, tx + 5, -2, '#66CC33');
            B.fillTriangle(tx + 2, 2, tx + 5, 7, tx + 7, 2, '#66CC33');
        }

        // Poison barb tip
        B.fillTriangle(
            this.reach - 8, -5,
            this.reach + 6, 0,
            this.reach - 8, 5,
            '#88EE44'
        );
        B.strokeTriangle(
            this.reach - 8, -5,
            this.reach + 6, 0,
            this.reach - 8, 5,
            '#44AA11', 1
        );

        // Dripping venom
        B.setAlpha(0.5);
        const drip = Math.sin(this.toxicTimer * 0.08) * 3;
        B.fillCircle(this.reach - 2, 4 + drip, 2, '#66CC33');
        B.restoreAlpha();

        B.popTransform();

        // Toxic miasma particles
        if (this.toxicTimer % 10 === 0) {
            B.setAlpha(0.15);
            const ma = this.toxicTimer * 0.04;
            const md = r + 8;
            B.fillCircle(
                this.owner.x + Math.cos(ma) * md,
                this.owner.y + Math.sin(ma) * md,
                3, '#66CC33'
            );
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('poison', PoisonWeapon, 'elemental');
