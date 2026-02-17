window.WB = window.WB || {};

// Bow: Fires arrow projectiles. Arrow count increases by 1 per hit.
class BowWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'bow',
            baseDamage: 2,
            rotationSpeed: 0.03,
            reach: 68,
            scalingName: 'Arrows',
            superThreshold: 8,
            isRanged: true,
        });
        this.arrowCount = 1;
        this.fireTimer = 0;
        this.fireRate = 80;
        this.scalingStat.value = this.arrowCount;
    }

    update() {
        super.update();
        this.fireTimer++;
        if (this.fireTimer >= this.fireRate) {
            this.fireArrows();
            this.fireTimer = 0;
        }
    }

    fireArrows() {
        if (!WB.Game || !WB.Game.projectiles) return;
        const spreadAngle = 0.2;
        const startAngle = this.angle - (this.arrowCount - 1) * spreadAngle / 2;
        const arrowSpeed = 5;

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
                radius: 4,
                lifespan: 150,
                bounces: 0,
                color: '#F0D264',
                shape: 'arrow',
            }));
        }
        WB.Audio.projectileFire();
    }

    applyScaling() {
        this.arrowCount = 1 + this.hitCount;
        this.scalingStat.value = this.arrowCount;
    }

    activateSuper() {
        this.fireRate = Math.max(30, this.fireRate - 30);
        this.currentDamage += 2;
    }

    onHit(target) {
        // No melee damage; projectiles handle hits
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
        }

        // Bow body (curved wooden arc) — strokeArc approximated via strokeCircle partial
        // Use fillArc outline: draw an arc stroke from -0.45pi to +0.45pi
        const arcR = 22;
        const bowCenter = r + 12;
        // Draw the bow arc as line segments
        const arcStart = -Math.PI * 0.45;
        const arcEnd = Math.PI * 0.45;
        const arcSegs = 12;
        for (let i = 0; i < arcSegs; i++) {
            const a0 = arcStart + (arcEnd - arcStart) * (i / arcSegs);
            const a1 = arcStart + (arcEnd - arcStart) * ((i + 1) / arcSegs);
            B.line(
                bowCenter + Math.cos(a0) * arcR, Math.sin(a0) * arcR,
                bowCenter + Math.cos(a1) * arcR, Math.sin(a1) * arcR,
                '#8B5A2B', 4
            );
        }

        // Bowstring (two line segments meeting at nock point)
        const stringTopX = bowCenter + Math.cos(-Math.PI * 0.45) * arcR;
        const stringTopY = Math.sin(-Math.PI * 0.45) * arcR;
        const stringBotX = bowCenter + Math.cos(Math.PI * 0.45) * arcR;
        const stringBotY = Math.sin(Math.PI * 0.45) * arcR;
        B.line(stringTopX, stringTopY, bowCenter - 8, 0, '#DDD', 1.5);
        B.line(bowCenter - 8, 0, stringBotX, stringBotY, '#DDD', 1.5);

        // Arrow nocked on string
        B.line(bowCenter - 8, 0, this.reach + 6, 0, '#A0522D', 2.5);

        // Arrowhead
        B.fillTriangle(this.reach + 8, 0, this.reach + 1, -4, this.reach + 1, 4, '#888');

        // Arrow fletching
        B.fillTriangle(bowCenter - 5, 0, bowCenter - 12, -4, bowCenter - 12, 4, '#E85D75');

        B.popTransform();
    }
}

WB.WeaponRegistry.register('bow', BowWeapon, 'classic');
