window.WB = window.WB || {};

// Lance: Jousts every 3 seconds. Joust damage +2 per hit. Super: can aim at opponents.
class LanceWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'lance',
            baseDamage: 2,
            rotationSpeed: 0.04,
            reach: 85,
            scalingName: 'Joust Dmg',
            superThreshold: 8,
        });
        this.joustDamage = 4;
        this.joustTimer = 0;
        this.joustInterval = 180; // 3 seconds at 60fps
        this.isJousting = false;
        this.joustFrames = 0;
        this.joustDuration = 30; // half second charge
        this.joustVx = 0;
        this.joustVy = 0;
        this.savedVx = 0;
        this.savedVy = 0;
        this.scalingStat.value = this.joustDamage;
    }

    update() {
        this.joustTimer++;

        if (this.isJousting) {
            this.joustFrames++;
            // During joust: override ball velocity with charge direction
            this.owner.vx = this.joustVx;
            this.owner.vy = this.joustVy;
            this.owner.invulnerable = true;

            if (this.joustFrames >= this.joustDuration) {
                this.isJousting = false;
                this.joustFrames = 0;
                this.owner.invulnerable = false;
            }
            // Cooldown doesn't tick during joust
        } else {
            this.angle += this.rotationSpeed;
            if (this.cooldown > 0) this.cooldown--;

            if (this.joustTimer >= this.joustInterval) {
                this.startJoust();
                this.joustTimer = 0;
            }
        }
    }

    startJoust() {
        this.isJousting = true;
        this.joustFrames = 0;
        this.savedVx = this.owner.vx;
        this.savedVy = this.owner.vy;

        let dirX, dirY;
        // Always aim at opponent
        if (WB.Game && WB.Game.balls) {
            const opponent = WB.Game.balls.find(b => b !== this.owner && b.isAlive);
            if (opponent) {
                dirX = opponent.x - this.owner.x;
                dirY = opponent.y - this.owner.y;
            }
        }
        if (dirX === undefined) {
            dirX = Math.cos(this.angle);
            dirY = Math.sin(this.angle);
        }

        const dist = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
        const joustSpeed = 12;
        this.joustVx = (dirX / dist) * joustSpeed;
        this.joustVy = (dirY / dist) * joustSpeed;

        // Lock weapon angle to joust direction
        this.angle = Math.atan2(dirY, dirX);

        WB.Audio.projectileFire();
    }

    canHit() {
        return this.isJousting && this.cooldown <= 0;
    }

    onHit(target) {
        const dmg = this.isJousting ? this.joustDamage : this.currentDamage;
        target.takeDamage(dmg);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);

        // Big knockback during joust
        const dx = target.x - this.owner.x;
        const dy = target.y - this.owner.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        target.vx += (dx / d) * 5;
        target.vy += (dy / d) * 5;

        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.emit(target.x, target.y, 12, this.owner.color);
        }
    }

    applyScaling() {
        this.joustDamage = 4 + this.hitCount * 2;
        this.scalingStat.value = this.joustDamage;
    }

    activateSuper() {
        this.joustInterval = 120; // joust more often
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
            // Glow behind the lance tip area
            B.fillCircleGlow(this.reach - 3, 0, 18, '#FEED9A', 15);
        }

        // Lance shaft (long tapered pole)
        const shaftW = this.isJousting ? 7 : 5;
        B.fillRect(r - 2, -shaftW / 2, this.reach - r + 2 - 10, shaftW, '#B8860B');

        // Lance tip (conical point)
        const tipColor = this.isJousting ? '#FFD700' : '#C0C0C0';
        B.fillTriangle(this.reach - 12, -8, this.reach + 6, 0, this.reach - 12, 8, tipColor);
        B.strokePolygon([
            [this.reach - 12, -8],
            [this.reach + 6, 0],
            [this.reach - 12, 8]
        ], '#888', 1.5);

        // Hand guard (vamplate)
        B.fillArc(r + 8, 0, 10, -Math.PI * 0.5, Math.PI * 0.5, '#DAA520');

        // Invulnerability shield during joust
        if (this.isJousting) {
            B.setAlpha(0.5);
            B.strokeCircle(0, 0, r + 6, '#FFD700', 3);
            B.restoreAlpha();
        }

        // Joust indicator - flash when about to joust
        if (!this.isJousting && this.joustTimer > this.joustInterval - 30) {
            const flash = ((this.joustInterval - this.joustTimer) % 10 < 5) ? 0.5 : 0;
            if (flash > 0) {
                B.setAlpha(flash);
                B.fillCircle(0, 0, r + 5, '#FFD700');
                B.restoreAlpha();
            }
        }

        B.popTransform();
    }
}

WB.WeaponRegistry.register('lance', LanceWeapon);
