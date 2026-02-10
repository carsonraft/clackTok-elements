window.WB = window.WB || {};

// Frieza: Death Beams (fast, narrow projectiles). Golden Frieza at 5 hits.
// Super: Death Ball — massive slow-moving sphere of destruction.
class FriezaWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'frieza',
            baseDamage: 2,
            rotationSpeed: 0.035,
            reach: 30,
            scalingName: 'Power',
            superThreshold: 10,
            isRanged: false,
        });
        this.powerLevel = 1;
        this.fireTimer = 0;
        this.fireRate = 55;       // Rapid death beams
        this.goldenActive = false;
        this.goldenThreshold = 5;
        this.tailPhase = 0;
        this.scalingStat.value = this.powerLevel;
    }

    update() {
        super.update();
        this.fireTimer++;
        this.tailPhase += 0.08;

        if (this.fireTimer >= this.fireRate) {
            this.fireDeathBeam();
            this.fireTimer = 0;
        }
    }

    fireDeathBeam() {
        if (!WB.Game || !WB.Game.projectiles) return;
        let fireAngle = this.angle;
        if (WB.Game.balls) {
            const enemy = WB.Game.balls.find(b => b !== this.owner && b.isAlive && b.side !== this.owner.side);
            if (enemy) fireAngle = Math.atan2(enemy.y - this.owner.y, enemy.x - this.owner.x);
        }

        const speed = 10;  // Death beams are FAST
        const color = this.goldenActive ? '#FFD700' : '#CC44FF';

        WB.Game.projectiles.push(new WB.Projectile({
            x: this.owner.x + Math.cos(fireAngle) * (this.owner.radius + 5),
            y: this.owner.y + Math.sin(fireAngle) * (this.owner.radius + 5),
            vx: Math.cos(fireAngle) * speed,
            vy: Math.sin(fireAngle) * speed,
            damage: 2 + Math.floor(this.hitCount * 0.3),
            owner: this.owner,
            ownerWeapon: this,
            radius: 2.5,     // Thin beam
            lifespan: 50,
            bounces: 0,
            color: color,
        }));
        WB.Audio.projectileFire();
    }

    onHit(target) {
        const dmg = this.goldenActive ? Math.floor(this.currentDamage * 1.5) : this.currentDamage;
        target.takeDamage(dmg);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();

        if (!this.goldenActive && this.hitCount >= this.goldenThreshold) {
            this._activateGolden();
        }

        WB.Audio.weaponHit(this.hitCount, this.type);

        // Tail whip knockback
        const dx = target.x - this.owner.x;
        const dy = target.y - this.owner.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        target.vx += (dx / d) * 3.5;
        target.vy += (dy / d) * 3.5;

        const color = this.goldenActive ? '#FFD700' : '#CC44FF';
        this._onHitEffects(target, dmg, color);
    }

    _activateGolden() {
        this.goldenActive = true;
        this.fireRate = Math.max(30, this.fireRate - 15);
        this.currentDamage += 2;
        WB.Renderer.triggerShake(10);
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 20, '#FFD700');
        }
        if (WB.GLEffects) {
            WB.GLEffects.spawnImpact(this.owner.x, this.owner.y, '#FFD700', 60);
            WB.GLEffects.triggerChromatic(0.4);
            WB.GLEffects.triggerShockwave(this.owner.x, this.owner.y, 0.3);
        }
    }

    applyScaling() {
        this.powerLevel = 1 + this.hitCount;
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.4);
        this.fireRate = Math.max(25, 55 - this.hitCount * 2);
        this.scalingStat.value = this.powerLevel;
    }

    activateSuper() {
        // DEATH BALL!
        this._fireDeathBall();
        this.currentDamage += 4;
        this.fireRate = Math.max(20, this.fireRate - 15);
    }

    _fireDeathBall() {
        if (!WB.Game || !WB.Game.projectiles) return;
        let fireAngle = this.angle;
        if (WB.Game.balls) {
            const enemy = WB.Game.balls.find(b => b !== this.owner && b.isAlive && b.side !== this.owner.side);
            if (enemy) fireAngle = Math.atan2(enemy.y - this.owner.y, enemy.x - this.owner.x);
        }

        // Slow but MASSIVE
        WB.Game.projectiles.push(new WB.Projectile({
            x: this.owner.x + Math.cos(fireAngle) * (this.owner.radius + 15),
            y: this.owner.y + Math.sin(fireAngle) * (this.owner.radius + 15),
            vx: Math.cos(fireAngle) * 4,
            vy: Math.sin(fireAngle) * 4,
            damage: 25 + this.hitCount * 2,
            owner: this.owner,
            ownerWeapon: this,
            radius: 18,
            lifespan: 120,
            bounces: 2,
            color: '#FF44FF',
            piercing: true,
        }));

        WB.Renderer.triggerShake(18);
        if (WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 35, '#FF44FF');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 20, '#FFD700');
        }
        if (WB.GLEffects) {
            WB.GLEffects.triggerShockwave(this.owner.x, this.owner.y, 0.6);
            WB.GLEffects.triggerChromatic(0.7);
            WB.GLEffects.triggerBarrel(0.3);
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        // Tail (behind ball)
        const tailAngle = this.angle + Math.PI;
        const tailWave = Math.sin(this.tailPhase) * 6;
        B.drawQuadratic(
            this.owner.x + Math.cos(tailAngle) * r,
            this.owner.y + Math.sin(tailAngle) * r,
            this.owner.x + Math.cos(tailAngle) * (r + 15) + tailWave,
            this.owner.y + Math.sin(tailAngle) * (r + 15) + tailWave,
            this.owner.x + Math.cos(tailAngle) * (r + 25),
            this.owner.y + Math.sin(tailAngle) * (r + 25),
            this.goldenActive ? '#FFD700' : '#CC88DD', 2.5
        );

        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
            B.fillCircleGlow(this.reach - 4, 0, 12, '#FF44FF', 20);
        }

        // Pointing finger (death beam pose)
        B.line(r - 2, 0, this.reach - 4, 0, this.goldenActive ? '#FFD700' : '#DDBBEE', 2.5);
        B.fillCircle(this.reach - 3, 0, 3, this.goldenActive ? '#FFD700' : '#EECCFF');

        // Charge glow at fingertip
        if (this.fireTimer > this.fireRate - 12) {
            const p = (this.fireTimer - (this.fireRate - 12)) / 12;
            B.setAlpha(p * 0.6);
            B.fillCircle(this.reach - 3, 0, 4 + p * 5, this.goldenActive ? '#FFD700' : '#CC44FF');
            B.restoreAlpha();
        }

        B.popTransform();

        // Golden aura
        if (this.goldenActive) {
            const flicker = 1 + Math.sin(Date.now() * 0.01) * 0.15;
            B.setAlpha(0.4);
            B.strokeCircle(this.owner.x, this.owner.y, r + 6 * flicker, '#FFD700', 2);
            B.restoreAlpha();
            B.setAlpha(0.08);
            B.fillCircle(this.owner.x, this.owner.y, r + 4, '#FFD700');
            B.restoreAlpha();
        }
        if (this.superActive) {
            const flicker = 1 + Math.sin(Date.now() * 0.012) * 0.2;
            B.setAlpha(0.5);
            B.strokeCircle(this.owner.x, this.owner.y, r + 8 * flicker, '#FF44FF', 3);
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('frieza', FriezaWeapon);
