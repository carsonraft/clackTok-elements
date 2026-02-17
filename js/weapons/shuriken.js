window.WB = window.WB || {};

// Shuriken: Throws shurikens that gain +1 bounce per hit. Super: halved cooldown + piercing.
class ShurikenWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'shuriken',
            baseDamage: 2,
            rotationSpeed: 0.04,
            reach: 45,
            scalingName: 'Bounces',
            superThreshold: 10,
            isRanged: true,
        });
        this.bounceCount = 1;
        this.fireTimer = 0;
        this.fireRate = 70;
        this.scalingStat.value = this.bounceCount;
        this.spinAngle = 0;
    }

    update() {
        super.update();
        this.spinAngle += 0.15; // shurikens spin fast visually
        this.fireTimer++;
        if (this.fireTimer >= this.fireRate) {
            this.fireShuriken();
            this.fireTimer = 0;
        }
    }

    fireShuriken() {
        if (!WB.Game || !WB.Game.projectiles) return;
        const speed = 4;
        WB.Game.projectiles.push(new WB.Projectile({
            x: this.getTipX(),
            y: this.getTipY(),
            vx: Math.cos(this.angle) * speed,
            vy: Math.sin(this.angle) * speed,
            damage: this.currentDamage,
            owner: this.owner,
            ownerWeapon: this,
            radius: 5,
            lifespan: 300,
            bounces: this.bounceCount,
            piercing: this.superActive,
            color: this.superActive ? '#BFCC00' : '#858D08',
        }));
        WB.Audio.projectileFire();
    }

    applyScaling() {
        this.bounceCount = 1 + this.hitCount;
        this.scalingStat.value = this.bounceCount;
    }

    activateSuper() {
        this.fireRate = Math.max(25, Math.floor(this.fireRate / 2));
    }

    onHit(target) {
        // No melee hit - projectiles handle it
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
        }

        // Draw a shuriken star at the tip area
        B.pushTransform(r + 12, 0, this.spinAngle);

        const points = 4;
        const outerR = 12;
        const innerR = 5;
        const starPts = [];
        for (let i = 0; i < points * 2; i++) {
            const angle = (i * Math.PI) / points;
            const rad = i % 2 === 0 ? outerR : innerR;
            starPts.push([Math.cos(angle) * rad, Math.sin(angle) * rad]);
        }
        B.fillPolygon(starPts, '#777777');
        B.strokePolygon(starPts, '#555555', 1);

        // Center dot
        B.fillCircle(0, 0, 3, '#333333');

        B.popTransform();
        B.popTransform();
    }
}

WB.WeaponRegistry.register('shuriken', ShurikenWeapon, 'classic');
