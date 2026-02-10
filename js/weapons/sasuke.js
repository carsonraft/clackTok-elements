window.WB = window.WB || {};

// Sasuke: Chidori melee + Fireball projectiles. Sharingan dodge at 5 hits.
// Super: Amaterasu — black flame projectile that deals massive DoT.
class SasukeWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'sasuke',
            baseDamage: 4,
            rotationSpeed: 0.045,
            reach: 36,
            scalingName: 'Sharingan',
            superThreshold: 10,
            isRanged: false,
        });
        this.sharinganLevel = 0;
        this.fireTimer = 0;
        this.fireRate = 90;
        this.sharinganActive = false;
        this.sharinganThreshold = 5;
        this.chidoriCharge = 0;
        this.dodgeCooldown = 0;
        this.scalingStat.value = this.sharinganLevel;
    }

    update() {
        super.update();
        this.fireTimer++;
        this.chidoriCharge = (this.chidoriCharge + 0.1) % (Math.PI * 2);
        if (this.dodgeCooldown > 0) this.dodgeCooldown--;

        if (this.fireTimer >= this.fireRate) {
            this.fireFireball();
            this.fireTimer = 0;
        }

        // Sharingan dodge — deflect incoming projectiles
        if (this.sharinganActive && this.dodgeCooldown <= 0) {
            this._sharinganDodge();
        }
    }

    _sharinganDodge() {
        if (!WB.Game || !WB.Game.projectiles) return;
        for (const proj of WB.Game.projectiles) {
            if (proj.owner === this.owner || !proj.alive) continue;
            const dx = proj.x - this.owner.x;
            const dy = proj.y - this.owner.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < this.owner.radius + 25) {
                // Deflect projectile
                proj.vx = -proj.vx * 0.8;
                proj.vy = -proj.vy * 0.8;
                proj.owner = this.owner;
                proj.ownerWeapon = this;
                proj.color = '#6633CC';
                this.dodgeCooldown = 60;
                if (WB.GLEffects) {
                    WB.GLEffects.spawnImpact(this.owner.x, this.owner.y, '#FF0000', 30);
                    WB.GLEffects.triggerChromatic(0.15);
                }
                WB.Audio.parry();
                break;
            }
        }
    }

    fireFireball() {
        if (!WB.Game || !WB.Game.projectiles) return;
        const fireAngle = this._aimAtEnemy();
        const speed = 6;

        WB.Game.projectiles.push(new WB.Projectile({
            x: this.owner.x + Math.cos(fireAngle) * (this.owner.radius + 6),
            y: this.owner.y + Math.sin(fireAngle) * (this.owner.radius + 6),
            vx: Math.cos(fireAngle) * speed,
            vy: Math.sin(fireAngle) * speed,
            damage: 3 + Math.floor(this.hitCount * 0.4),
            owner: this.owner,
            ownerWeapon: this,
            radius: 5,
            lifespan: 60,
            bounces: 0,
            color: '#FF4422',
        }));
        WB.Audio.projectileFire();
    }

    _aimAtEnemy() {
        if (!WB.Game || !WB.Game.balls) return this.angle;
        let closest = null, closestDist = Infinity;
        for (const b of WB.Game.balls) {
            if (b === this.owner || !b.isAlive || b.side === this.owner.side) continue;
            const dx = b.x - this.owner.x;
            const dy = b.y - this.owner.y;
            const dist = dx * dx + dy * dy;
            if (dist < closestDist) { closestDist = dist; closest = b; }
        }
        if (closest) return Math.atan2(closest.y - this.owner.y, closest.x - this.owner.x);
        return this.angle;
    }

    onHit(target) {
        // Chidori melee — electric damage
        const dmg = this.currentDamage;
        target.takeDamage(dmg);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();

        if (!this.sharinganActive && this.hitCount >= this.sharinganThreshold) {
            this._activateSharingan();
        }

        WB.Audio.weaponHit(this.hitCount, this.type);

        // Electric knockback
        const dx = target.x - this.owner.x;
        const dy = target.y - this.owner.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        target.vx += (dx / d) * 5;
        target.vy += (dy / d) * 5;

        this._onHitEffects(target, dmg, '#6633CC');
    }

    _activateSharingan() {
        this.sharinganActive = true;
        this.rotationSpeed *= 1.3;
        this.fireRate = Math.max(50, this.fireRate - 20);
        WB.Renderer.triggerShake(8);
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 15, '#FF0000');
        }
        if (WB.GLEffects) {
            WB.GLEffects.spawnImpact(this.owner.x, this.owner.y, '#FF0000', 50);
            WB.GLEffects.triggerChromatic(0.35);
        }
    }

    applyScaling() {
        this.sharinganLevel = this.hitCount;
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.5);
        this.scalingStat.value = this.sharinganLevel;
    }

    activateSuper() {
        // AMATERASU! Black flames
        this._fireAmaterasu();
        this.currentDamage += 4;
        this.fireRate = Math.max(30, this.fireRate - 25);
    }

    _fireAmaterasu() {
        if (!WB.Game || !WB.Game.projectiles) return;
        const fireAngle = this._aimAtEnemy();

        // Three black flame projectiles in a spread
        for (let i = -1; i <= 1; i++) {
            const angle = fireAngle + i * 0.2;
            const speed = 7 + Math.abs(i);
            WB.Game.projectiles.push(new WB.Projectile({
                x: this.owner.x + Math.cos(angle) * (this.owner.radius + 8),
                y: this.owner.y + Math.sin(angle) * (this.owner.radius + 8),
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                damage: 12 + this.hitCount,
                owner: this.owner,
                ownerWeapon: this,
                radius: 8,
                lifespan: 90,
                bounces: 0,
                color: '#220022',
                piercing: true,
            }));
        }

        WB.Renderer.triggerShake(14);
        if (WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 25, '#440044');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 15, '#FF0000');
        }
        if (WB.GLEffects) {
            WB.GLEffects.triggerShockwave(this.owner.x, this.owner.y, 0.5);
            WB.GLEffects.triggerChromatic(0.6);
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
            B.fillCircleGlow(this.reach - 4, 0, 12, '#6633CC', 20);
        }

        // Arm
        B.line(r - 2, 0, this.reach - 8, 0, '#F5D5A0', 3);

        // Chidori hand — crackling lightning
        B.fillCircle(this.reach - 4, 0, 6, '#4488FF');
        // Lightning crackle
        const t = this.chidoriCharge;
        for (let i = 0; i < 4; i++) {
            const a = t + i * 1.57;
            const len = 5 + Math.sin(a * 3) * 3;
            const ex = this.reach - 4 + Math.cos(a) * len;
            const ey = Math.sin(a) * len;
            B.line(this.reach - 4, 0, ex, ey, '#AADDFF', 1.5);
        }
        B.strokeCircle(this.reach - 4, 0, 6, '#2266CC', 1.5);

        B.popTransform();

        // Sharingan eye indicator
        if (this.sharinganActive) {
            B.fillCircle(this.owner.x, this.owner.y - r * 0.1, r * 0.12, '#FF0000');
            B.fillCircle(this.owner.x, this.owner.y - r * 0.1, r * 0.05, '#111');
        }

        // Super aura
        if (this.superActive) {
            const flicker = 1 + Math.sin(Date.now() * 0.012) * 0.15;
            B.setAlpha(0.45);
            B.strokeCircle(this.owner.x, this.owner.y, r + 6 * flicker, '#6633CC', 2.5);
            B.restoreAlpha();
            // Purple lightning sparks
            const sparkT = Date.now() * 0.006;
            for (let i = 0; i < 3; i++) {
                const a = sparkT + i * 2.1;
                const sd = r + 3 + Math.sin(a * 3) * 5;
                B.setAlpha(0.6);
                B.fillCircle(this.owner.x + Math.cos(a) * sd, this.owner.y + Math.sin(a) * sd, 1.5, '#AADDFF');
                B.restoreAlpha();
            }
        }
    }
}

WB.WeaponRegistry.register('sasuke', SasukeWeapon);
