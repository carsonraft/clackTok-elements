window.WB = window.WB || {};

// Piccolo: Special Beam Cannon (charged piercing shot). Hellzone Grenade (scatter bombs).
// Regeneration passive. Super: Light Grenade — massive explosion.
class PiccoloWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'piccolo',
            baseDamage: 3,
            rotationSpeed: 0.035,
            reach: 34,
            scalingName: 'Ki Charge',
            superThreshold: 10,
            isRanged: false,
        });
        this.kiCharge = 0;
        this.fireTimer = 0;
        this.fireRate = 100;       // Slower but powerful charged shots
        this.hellzoneTimer = 0;
        this.hellzoneRate = 200;
        this.regenTimer = 0;
        this.chargeGlow = 0;
        this.scalingStat.value = this.kiCharge;
    }

    update() {
        super.update();
        this.fireTimer++;
        this.hellzoneTimer++;
        this.regenTimer++;

        // Charge glow ramps up before firing
        if (this.fireTimer > this.fireRate - 30) {
            this.chargeGlow = (this.fireTimer - (this.fireRate - 30)) / 30;
        } else {
            this.chargeGlow *= 0.95;
        }

        if (this.fireTimer >= this.fireRate) {
            this.fireSpecialBeamCannon();
            this.fireTimer = 0;
        }

        if (this.hellzoneTimer >= this.hellzoneRate) {
            this.fireHellzoneGrenade();
            this.hellzoneTimer = 0;
        }

        // Passive regen (Namekian biology)
        if (this.regenTimer % 60 === 0 && this.owner.hp < this.owner.maxHp) {
            this.owner.hp = Math.min(this.owner.maxHp, this.owner.hp + 1);
        }
    }

    fireSpecialBeamCannon() {
        if (!WB.Game || !WB.Game.projectiles) return;
        let fireAngle = this.angle;
        if (WB.Game.balls) {
            const enemy = WB.Game.balls.find(b => b !== this.owner && b.isAlive && b.side !== this.owner.side);
            if (enemy) fireAngle = Math.atan2(enemy.y - this.owner.y, enemy.x - this.owner.x);
        }

        const speed = 9;
        const dmg = 6 + Math.floor(this.hitCount * 0.5);

        WB.Game.projectiles.push(new WB.Projectile({
            x: this.owner.x + Math.cos(fireAngle) * (this.owner.radius + 8),
            y: this.owner.y + Math.sin(fireAngle) * (this.owner.radius + 8),
            vx: Math.cos(fireAngle) * speed,
            vy: Math.sin(fireAngle) * speed,
            damage: dmg,
            owner: this.owner,
            ownerWeapon: this,
            radius: 4,
            lifespan: 80,
            bounces: 0,
            color: '#FFDD00',
            piercing: true,    // Special Beam Cannon pierces!
        }));

        WB.Audio.projectileFire();
        WB.Renderer.triggerShake(4);
        if (WB.Game.particles) {
            WB.Game.particles.emit(this.owner.x, this.owner.y, 8, '#FFDD00');
        }
        this.kiCharge++;
        this.scalingStat.value = this.kiCharge;
    }

    fireHellzoneGrenade() {
        if (!WB.Game || !WB.Game.projectiles) return;
        // Scatter 5 ki bombs in random directions
        for (let i = 0; i < 5; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 4 + Math.random() * 3;
            WB.Game.projectiles.push(new WB.Projectile({
                x: this.owner.x + Math.cos(angle) * (this.owner.radius + 5),
                y: this.owner.y + Math.sin(angle) * (this.owner.radius + 5),
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                damage: 3 + Math.floor(this.hitCount * 0.3),
                owner: this.owner,
                ownerWeapon: this,
                radius: 4,
                lifespan: 90,
                bounces: 2,     // Bounce around the arena
                color: '#88FF44',
            }));
        }
        WB.Audio.projectileFire();
        WB.Renderer.triggerShake(5);
        if (WB.GLEffects) {
            WB.GLEffects.spawnImpact(this.owner.x, this.owner.y, '#88FF44', 40);
        }
    }

    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);

        const dx = target.x - this.owner.x;
        const dy = target.y - this.owner.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        target.vx += (dx / d) * 4;
        target.vy += (dy / d) * 4;

        this._onHitEffects(target, this.currentDamage, '#88FF44');
    }

    applyScaling() {
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.5);
        this.fireRate = Math.max(60, 100 - this.hitCount * 3);
        this.scalingStat.value = this.kiCharge;
    }

    activateSuper() {
        // LIGHT GRENADE!
        this._fireLightGrenade();
        this.currentDamage += 4;
        this.hellzoneRate = Math.floor(this.hellzoneRate * 0.5);
    }

    _fireLightGrenade() {
        if (!WB.Game || !WB.Game.projectiles) return;
        let fireAngle = this.angle;
        if (WB.Game.balls) {
            const enemy = WB.Game.balls.find(b => b !== this.owner && b.isAlive && b.side !== this.owner.side);
            if (enemy) fireAngle = Math.atan2(enemy.y - this.owner.y, enemy.x - this.owner.x);
        }

        WB.Game.projectiles.push(new WB.Projectile({
            x: this.owner.x + Math.cos(fireAngle) * (this.owner.radius + 10),
            y: this.owner.y + Math.sin(fireAngle) * (this.owner.radius + 10),
            vx: Math.cos(fireAngle) * 7,
            vy: Math.sin(fireAngle) * 7,
            damage: 20 + this.hitCount * 2,
            owner: this.owner,
            ownerWeapon: this,
            radius: 12,
            lifespan: 70,
            bounces: 0,
            color: '#FFFF44',
            piercing: true,
        }));

        WB.Renderer.triggerShake(16);
        if (WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 30, '#FFFF44');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 15, '#88FF44');
        }
        if (WB.GLEffects) {
            WB.GLEffects.triggerShockwave(this.owner.x, this.owner.y, 0.6);
            WB.GLEffects.triggerChromatic(0.6);
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
            B.fillCircleGlow(this.reach - 4, 0, 12, '#FFFF44', 20);
        }

        // Arm (green Namekian)
        B.line(r - 2, 0, this.reach - 6, 0, '#2E8B57', 3.5);

        // Hand with two fingers extended (beam cannon pose)
        B.fillCircle(this.reach - 5, 0, 4, '#2E8B57');
        B.line(this.reach - 5, -1, this.reach + 2, -2, '#2E8B57', 2);
        B.line(this.reach - 5, 1, this.reach + 2, 2, '#2E8B57', 2);

        // Charge glow at fingertips
        if (this.chargeGlow > 0.1) {
            B.setAlpha(this.chargeGlow * 0.6);
            B.fillCircle(this.reach + 2, 0, 4 + this.chargeGlow * 6, '#FFDD00');
            // Spiral charge
            const t = Date.now() * 0.02;
            B.fillCircle(this.reach + 2 + Math.cos(t) * 3, Math.sin(t) * 3, 2, '#FFF');
            B.restoreAlpha();
        }

        B.popTransform();

        // Antenna on head
        B.line(this.owner.x, this.owner.y - r * 0.7, this.owner.x + 3, this.owner.y - r * 1.15, '#2E8B57', 2);
        B.fillCircle(this.owner.x + 3, this.owner.y - r * 1.15, 2, '#2E8B57');

        // Super aura
        if (this.superActive) {
            const flicker = 1 + Math.sin(Date.now() * 0.01) * 0.15;
            B.setAlpha(0.4);
            B.strokeCircle(this.owner.x, this.owner.y, r + 7 * flicker, '#88FF44', 2.5);
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('piccolo', PiccoloWeapon);
