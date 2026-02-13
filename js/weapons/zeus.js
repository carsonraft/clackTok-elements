window.WB = window.WB || {};

// Zeus — Lightning Bolt: Fires bouncing lightning bolts that lose damage per bounce.
// Scaling: Bolt speed and bounce count increase per hit.
// Super: Spawns 3 drifting ball-lightning hazard zones + fires a volley of 5 bolts.
class ZeusWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'zeus',
            baseDamage: 4,            // pulled back from 5
            rotationSpeed: 0.04,
            reach: 50,
            scalingName: 'Bolts',
            superThreshold: 9,        // between 8 and 10
            isRanged: true,
        });
        this.boltSpeed = 7;          // pulled back from 8 (was 6.5 originally)
        this.boltBounces = 3;
        this.fireTimer = 0;
        this.fireRate = 60;           // pulled back from 50 (was 80 originally)
        this.boltsFired = 0;
        this.scalingStat.value = this.boltBounces;
    }

    update() {
        super.update();
        this.fireTimer++;
        if (this.fireTimer >= this.fireRate) {
            this.fireBolt();
            this.fireTimer = 0;
        }
    }

    fireBolt() {
        if (!WB.Game || !WB.Game.projectiles) return;

        // Aim at nearest enemy
        let fireAngle = this.angle;
        if (WB.Game.balls) {
            let closest = null, closestDist = Infinity;
            for (const b of WB.Game.balls) {
                if (b === this.owner || !b.isAlive || b.side === this.owner.side) continue;
                const dx = b.x - this.owner.x, dy = b.y - this.owner.y;
                const dist = dx * dx + dy * dy;
                if (dist < closestDist) { closestDist = dist; closest = b; }
            }
            if (closest) {
                fireAngle = Math.atan2(closest.y - this.owner.y, closest.x - this.owner.x);
                fireAngle += (WB.random() - 0.5) * 0.25; // tighter spread (was 0.4)
            }
        }

        // Minimal random spread (was 0.3 — way too inaccurate)
        fireAngle += (WB.random() - 0.5) * 0.15;

        WB.Game.projectiles.push(new WB.Projectile({
            x: this.owner.x + Math.cos(fireAngle) * (this.owner.radius + 6),
            y: this.owner.y + Math.sin(fireAngle) * (this.owner.radius + 6),
            vx: Math.cos(fireAngle) * this.boltSpeed,
            vy: Math.sin(fireAngle) * this.boltSpeed,
            damage: this.currentDamage,
            owner: this.owner,
            ownerWeapon: this,
            radius: 4,
            lifespan: 100,
            bounces: this.boltBounces,
            color: '#FFD700',
            homing: 0.02,           // mild homing — lightning seeks targets
            damageFalloff: 0.25,    // less damage loss per bounce (was 0.35)
        }));
        this.boltsFired++;
        WB.Audio.projectileFire();
    }

    // Called when a Zeus bolt hits a target — spawn mini ball lightning
    onProjectileHit(proj, target) {
        if (!this.superActive) return;
        // 15% chance to spawn a small ball lightning on hit during super (was 30% — too spammy visually)
        if (WB.random() < 0.15 && WB.Game && WB.Game.hazards) {
            WB.Game.hazards.push(new WB.Hazard({
                x: target.x,
                y: target.y,
                radius: 20,
                damage: 1,
                tickRate: 20,
                lifespan: 60,
                color: '#FFD700',
                owner: this.owner,
                ownerWeapon: this,
                vx: (WB.random() - 0.5) * 2,
                vy: (WB.random() - 0.5) * 2,
            }));
        }
    }

    applyScaling() {
        this.boltBounces = 3 + Math.floor(this.hitCount * 0.3);
        this.boltSpeed = Math.min(12, 7 + this.hitCount * 0.3);    // starts from base 7 (was 8)
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.4); // better dmg scaling
        this.scalingStat.value = this.boltBounces;
    }

    activateSuper() {
        this.currentDamage += 3;
        this.fireRate = Math.max(35, this.fireRate - 20);

        // Spawn 3 drifting ball-lightning hazard zones
        if (WB.Game && WB.Game.hazards) {
            for (let i = 0; i < 3; i++) {
                const angle = (i / 3) * Math.PI * 2 + WB.random() * 0.5;
                WB.Game.hazards.push(new WB.Hazard({
                    x: this.owner.x + Math.cos(angle) * 60,
                    y: this.owner.y + Math.sin(angle) * 60,
                    radius: 28,
                    damage: 2,
                    tickRate: 25,
                    lifespan: 240,
                    color: '#FFD700',
                    owner: this.owner,
                    ownerWeapon: this,
                    vx: (WB.random() - 0.5) * 1.5,
                    vy: (WB.random() - 0.5) * 1.5,
                }));
            }
        }

        // Fire a volley of 5 bolts
        for (let i = 0; i < 5; i++) {
            setTimeout(() => this.fireBolt(), i * 60);
        }

        // Visual burst
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 25, '#FFD700');
            WB.Game.particles.spark(this.owner.x, this.owner.y, 15);
        }
    }

    onHit(target) {
        // No melee damage; projectiles handle hits
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
            B.fillCircleGlow(r + 12, 0, 14, '#FFD700', 10);
        }

        // Bolt shaft — jagged lightning shape
        const shaftLen = this.reach;
        const zigzag = [
            [r, 0],
            [r + shaftLen * 0.2, -5],
            [r + shaftLen * 0.35, 4],
            [r + shaftLen * 0.5, -3],
            [r + shaftLen * 0.65, 5],
            [r + shaftLen * 0.8, -2],
            [shaftLen + 4, 0],
        ];

        // Lightning glow trail
        B.setAlpha(0.25);
        for (let i = 0; i < zigzag.length - 1; i++) {
            B.line(zigzag[i][0], zigzag[i][1], zigzag[i + 1][0], zigzag[i + 1][1], '#FFD700', 6);
        }
        B.restoreAlpha();

        // Solid bolt
        for (let i = 0; i < zigzag.length - 1; i++) {
            B.line(zigzag[i][0], zigzag[i][1], zigzag[i + 1][0], zigzag[i + 1][1], '#FFF8DC', 3);
        }

        // Bolt tip — bright point
        B.fillCircle(shaftLen + 4, 0, 3, '#FFD700');

        B.popTransform();

        // Electric aura during super
        if (this.superActive) {
            const flicker = Math.sin(Date.now() * 0.015) * 0.1;
            B.setAlpha(0.12 + flicker);
            B.strokeCircle(this.owner.x, this.owner.y, r + 8, '#FFD700', 2);
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('zeus', ZeusWeapon, 'pantheon');
