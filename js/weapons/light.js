window.WB = window.WB || {};

// Light (Prism Beam): Ranged weapon that fires fast piercing beams and heals the owner.
// Scaling: Beam damage increases. Super: Solar Flare (8-beam burst).
class LightWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'light',
            baseDamage: 2,
            rotationSpeed: 0.04,
            reach: 60,
            scalingName: 'Beam',
            superThreshold: 8,
            isRanged: true,
        });
        this.fireTimer = 0;
        this.fireRate = 70;
        this.beamDamage = 2;
        this.glowTimer = 0;
        this.scalingStat.value = this.beamDamage;
    }

    update() {
        super.update();
        this.glowTimer++;
        this.fireTimer++;
        if (this.fireTimer >= this.fireRate) {
            this.fireBeam();
            this.fireTimer = 0;
        }
    }

    fireBeam() {
        if (!WB.Game || !WB.Game.projectiles) return;
        const beamSpeed = 7;
        WB.Game.projectiles.push(new WB.Projectile({
            x: this.getTipX(),
            y: this.getTipY(),
            vx: Math.cos(this.angle) * beamSpeed,
            vy: Math.sin(this.angle) * beamSpeed,
            damage: this.beamDamage,
            owner: this.owner,
            ownerWeapon: this,
            radius: 3,
            lifespan: 100,
            bounces: 1,
            color: '#FFEE88',
            piercing: true,
        }));
        WB.Audio.projectileFire();

        // Heal owner on fire
        if (this.owner.hp < this.owner.maxHp) {
            this.owner.hp = Math.min(this.owner.hp + 1, this.owner.maxHp);
        }
    }

    onHit(target) {
        // No melee damage; beams handle hits
    }

    applyScaling() {
        this.beamDamage = 2 + Math.floor(this.hitCount * 0.5);
        this.currentDamage = this.beamDamage;
        this.scalingStat.value = this.beamDamage;
    }

    activateSuper() {
        // Solar Flare: 8-beam radial burst
        if (WB.Game && WB.Game.projectiles) {
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                WB.Game.projectiles.push(new WB.Projectile({
                    x: this.owner.x,
                    y: this.owner.y,
                    vx: Math.cos(a) * 8,
                    vy: Math.sin(a) * 8,
                    damage: this.beamDamage + 3,
                    owner: this.owner,
                    ownerWeapon: this,
                    radius: 4,
                    lifespan: 120,
                    bounces: 2,
                    color: '#FFEE88',
                    piercing: true,
                }));
            }
        }
        this.fireRate = Math.max(30, this.fireRate - 25);
        this.beamDamage += 3;
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
            B.fillCircleGlow(r + 15, 0, 20, '#FFEE88', 15);
        }

        // Prism crystal body
        B.fillPolygon([
            [r, -6],
            [r + 12, -8],
            [r + 20, -4],
            [r + 20, 4],
            [r + 12, 8],
            [r, 6]
        ], '#FFEE88');
        B.strokePolygon([
            [r, -6],
            [r + 12, -8],
            [r + 20, -4],
            [r + 20, 4],
            [r + 12, 8],
            [r, 6]
        ], '#DDBB44', 1);

        // Inner facet
        B.setAlpha(0.5);
        B.fillPolygon([
            [r + 4, -3],
            [r + 12, -4],
            [r + 16, 0],
            [r + 12, 4],
            [r + 4, 3]
        ], '#FFF');
        B.restoreAlpha();

        // Beam emitter line
        B.line(r + 20, 0, this.reach + 5, 0, '#FFEE88', 2);
        B.setAlpha(0.3);
        B.line(r + 20, 0, this.reach + 5, 0, '#FFF', 4);
        B.restoreAlpha();

        B.popTransform();

        // Healing glow aura
        if (this.glowTimer % 12 === 0) {
            B.setAlpha(0.15);
            B.fillCircle(this.owner.x, this.owner.y, r + 5, '#FFEE88');
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('light', LightWeapon);
