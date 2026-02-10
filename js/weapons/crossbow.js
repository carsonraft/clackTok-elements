window.WB = window.WB || {};

// Crossbow: Fires 1 bolt per second. Arrow damage scales +1 per successful hit.
class CrossbowWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'crossbow',
            baseDamage: 3,
            rotationSpeed: 0.035,
            reach: 58,
            scalingName: 'Bolt Dmg',
            superThreshold: 10,
            isRanged: true,
        });
        this.boltDamage = 3;
        this.fireTimer = 0;
        this.fireRate = 60; // 1 per second
        this.scalingStat.value = this.boltDamage;
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
        const speed = 7; // fast bolt

        // Aim toward the nearest enemy instead of using weapon rotation angle
        let fireAngle = this.angle;
        if (WB.Game.balls) {
            let closest = null;
            let closestDist = Infinity;
            for (const b of WB.Game.balls) {
                if (b === this.owner || !b.isAlive || b.side === this.owner.side) continue;
                const dx = b.x - this.owner.x;
                const dy = b.y - this.owner.y;
                const dist = dx * dx + dy * dy;
                if (dist < closestDist) {
                    closestDist = dist;
                    closest = b;
                }
            }
            if (closest) {
                fireAngle = Math.atan2(closest.y - this.owner.y, closest.x - this.owner.x);
            }
        }

        WB.Game.projectiles.push(new WB.Projectile({
            x: this.getTipX(),
            y: this.getTipY(),
            vx: Math.cos(fireAngle) * speed,
            vy: Math.sin(fireAngle) * speed,
            damage: this.boltDamage,
            owner: this.owner,
            ownerWeapon: this,
            radius: 3,
            lifespan: 100,
            bounces: 0,
            color: '#7CB900',
        }));
        WB.Audio.projectileFire();
    }

    applyScaling() {
        this.boltDamage = 3 + this.hitCount;
        this.scalingStat.value = this.boltDamage;
    }

    activateSuper() {
        this.fireRate = 35; // much faster
        this.boltDamage += 3;
    }

    onHit(target) {
        // No melee
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
            B.fillCircleGlow(r + 14, 0, 18, '#7CB900', 12);
        }

        // Crossbow stock
        B.fillRect(r - 4, -4, 20, 8, '#6B3A1F');

        // Crossbow prod (horizontal bow piece) — quadratic bezier stroke
        B.drawQuadratic(r + 14, -16, r + 20, 0, r + 14, 16, '#555', 3);

        // String (two line segments)
        B.line(r + 14, -15, r + 8, 0, '#CCC', 1.5);
        B.line(r + 8, 0, r + 14, 15, '#CCC', 1.5);

        // Bolt channel/rail
        B.fillRect(r + 6, -2, this.reach - r - 6, 4, '#888');

        // Bolt loaded
        B.line(r + 8, 0, this.reach + 3, 0, '#5A3A1A', 2);

        // Bolt tip
        B.fillTriangle(this.reach + 5, 0, this.reach, -3, this.reach, 3, '#7CB900');

        B.popTransform();
    }
}

WB.WeaponRegistry.register('crossbow', CrossbowWeapon);
