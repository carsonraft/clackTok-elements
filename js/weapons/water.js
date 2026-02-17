window.WB = window.WB || {};

// Water (Tidal Surge): Hybrid melee + projectile weapon. Fires wide slow waves that push enemies.
// Scaling: Wave count increases. Super: Tsunami (huge piercing wave).
class WaterWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'water',
            baseDamage: 2,
            rotationSpeed: 0.04,
            reach: 60,
            scalingName: 'Waves',
            superThreshold: 10,
            isRanged: true,
        });
        this.waveCount = 1;
        this.fireTimer = 0;
        this.fireRate = 90;
        this.waveTimer = 0;
        this.scalingStat.value = this.waveCount;
    }

    update() {
        super.update();
        this.waveTimer++;
        this.fireTimer++;
        if (this.fireTimer >= this.fireRate) {
            this.fireWaves();
            this.fireTimer = 0;
        }
    }

    fireWaves() {
        if (!WB.Game || !WB.Game.projectiles) return;
        const spreadAngle = 0.3;
        const startAngle = this.angle - (this.waveCount - 1) * spreadAngle / 2;
        const waveSpeed = 3;

        for (let i = 0; i < this.waveCount; i++) {
            const a = startAngle + i * spreadAngle;
            WB.Game.projectiles.push(new WB.Projectile({
                x: this.getTipX(),
                y: this.getTipY(),
                vx: Math.cos(a) * waveSpeed,
                vy: Math.sin(a) * waveSpeed,
                damage: this.currentDamage,
                owner: this.owner,
                ownerWeapon: this,
                radius: 8,
                lifespan: 120,
                bounces: 1,
                color: '#3388DD',
                piercing: false,
            }));
        }
        WB.Audio.projectileFire();
    }

    onHit(target) {
        // Melee hits also push
        target.takeDamage(1);
        const dx = target.x - this.owner.x;
        const dy = target.y - this.owner.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        target.vx += (dx / dist) * 2;
        target.vy += (dy / dist) * 2;
    }

    applyScaling() {
        this.waveCount = 1 + Math.floor(this.hitCount / 2);
        if (this.waveCount > 7) this.waveCount = 7;
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.3);
        this.scalingStat.value = this.waveCount;
    }

    activateSuper() {
        // Crystal Shards: Ice+Ice inspired → TIDAL WAVE!
        // Giant rolling wave wall that sweeps across the arena
        // Launch 12 massive piercing waves in a forward-facing arc
        if (WB.Game && WB.Game.projectiles) {
            const aimAngle = this.angle;
            for (let i = 0; i < 12; i++) {
                const spread = (i / 12) * Math.PI * 2;
                WB.Game.projectiles.push(new WB.Projectile({
                    x: this.owner.x,
                    y: this.owner.y,
                    vx: Math.cos(spread) * 3.5,
                    vy: Math.sin(spread) * 3.5,
                    damage: 7,
                    owner: this.owner,
                    ownerWeapon: this,
                    radius: 15,
                    lifespan: 180,
                    bounces: 3,
                    color: '#3388DD',
                    piercing: true,
                }));
            }
        }
        this.fireRate = Math.max(30, this.fireRate - 40);
        this.waveCount = Math.min(this.waveCount + 3, 10);
        this.currentDamage += 3;
        WB.Renderer.triggerShake(8);
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 25, '#3388DD');
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
        }

        // Wave staff — trident-like shape
        // Shaft
        B.fillRect(r - 2, -2, this.reach - r - 5, 4, '#5577AA');

        // Trident head
        const headX = this.reach - 8;
        B.fillTriangle(headX, 0, this.reach + 5, 0, headX, -6, '#3388DD');
        B.fillTriangle(headX, 0, this.reach + 5, 0, headX, 6, '#3388DD');
        B.fillTriangle(this.reach - 3, -3, this.reach + 8, 0, this.reach - 3, 3, '#55AAEE');

        // Water droplet accents
        B.setAlpha(0.4);
        const wobble = Math.sin(this.waveTimer * 0.1) * 3;
        B.fillCircle(r + 15, wobble, 3, '#88CCFF');
        B.fillCircle(r + 25, -wobble, 2.5, '#88CCFF');
        B.restoreAlpha();

        B.popTransform();
    }
}

WB.WeaponRegistry.register('water', WaterWeapon, 'elemental');
