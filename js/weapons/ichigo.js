window.WB = window.WB || {};

// Ichigo: Getsuga Tensho ranged energy slash. Bankai at 5 hits (speed + black sword).
// Super: Mugetsu — one devastating black energy wave.
class IchigoWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'ichigo',
            baseDamage: 4,
            rotationSpeed: 0.045,
            reach: 44,           // Big sword — Zangetsu
            scalingName: 'Reiatsu',
            superThreshold: 10,
            isRanged: false,
        });
        this.reiatsu = 1;
        this.fireTimer = 0;
        this.fireRate = 80;
        this.bankaiActive = false;
        this.bankaiThreshold = 5;
        this.scalingStat.value = this.reiatsu;
    }

    update() {
        super.update();
        this.fireTimer++;

        if (this.fireTimer >= this.fireRate) {
            this.fireGetsuga();
            this.fireTimer = 0;
        }
    }

    fireGetsuga() {
        if (!WB.Game || !WB.Game.projectiles) return;
        let fireAngle = this.angle;
        if (WB.Game.balls) {
            const enemy = WB.Game.balls.find(b => b !== this.owner && b.isAlive && b.side !== this.owner.side);
            if (enemy) fireAngle = Math.atan2(enemy.y - this.owner.y, enemy.x - this.owner.x);
        }

        const color = this.bankaiActive ? '#111133' : '#44CCFF';
        const speed = this.bankaiActive ? 9 : 7;
        const dmg = 4 + Math.floor(this.hitCount * 0.5);

        WB.Game.projectiles.push(new WB.Projectile({
            x: this.owner.x + Math.cos(fireAngle) * (this.owner.radius + 8),
            y: this.owner.y + Math.sin(fireAngle) * (this.owner.radius + 8),
            vx: Math.cos(fireAngle) * speed,
            vy: Math.sin(fireAngle) * speed,
            damage: dmg,
            owner: this.owner,
            ownerWeapon: this,
            radius: this.bankaiActive ? 6 : 5,
            lifespan: 70,
            bounces: 0,
            color: color,
        }));
        WB.Audio.projectileFire();

        // Slash particles
        if (WB.Game.particles) {
            WB.Game.particles.emit(
                this.owner.x + Math.cos(fireAngle) * this.reach,
                this.owner.y + Math.sin(fireAngle) * this.reach,
                5, color
            );
        }
    }

    onHit(target) {
        const dmg = this.bankaiActive ? Math.floor(this.currentDamage * 1.5) : this.currentDamage;
        target.takeDamage(dmg);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();

        if (!this.bankaiActive && this.hitCount >= this.bankaiThreshold) {
            this._activateBankai();
        }

        WB.Audio.weaponHit(this.hitCount, this.type);

        const dx = target.x - this.owner.x;
        const dy = target.y - this.owner.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        target.vx += (dx / d) * 5;
        target.vy += (dy / d) * 5;

        const color = this.bankaiActive ? '#111133' : '#44CCFF';
        this._onHitEffects(target, dmg, color);
    }

    _activateBankai() {
        this.bankaiActive = true;
        this.rotationSpeed = 0.07;
        this.fireRate = Math.max(40, this.fireRate - 25);
        this.reach = 38; // Bankai sword is sleeker, slightly shorter
        this.baseReach = 38;

        WB.Renderer.triggerShake(12);
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 25, '#111133');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 10, '#FF4444');
        }
        if (WB.GLEffects) {
            WB.GLEffects.spawnImpact(this.owner.x, this.owner.y, '#111133', 70);
            WB.GLEffects.triggerChromatic(0.5);
            WB.GLEffects.triggerShockwave(this.owner.x, this.owner.y, 0.4);
        }
    }

    applyScaling() {
        this.reiatsu = 1 + this.hitCount;
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.5);
        this.scalingStat.value = this.reiatsu;
    }

    activateSuper() {
        // MUGETSU! Final Getsuga Tensho
        this._fireMugetsu();
        this.currentDamage += 6;
        this.fireRate = Math.max(25, this.fireRate - 20);
    }

    _fireMugetsu() {
        if (!WB.Game || !WB.Game.projectiles) return;
        let fireAngle = this.angle;
        if (WB.Game.balls) {
            const enemy = WB.Game.balls.find(b => b !== this.owner && b.isAlive && b.side !== this.owner.side);
            if (enemy) fireAngle = Math.atan2(enemy.y - this.owner.y, enemy.x - this.owner.x);
        }

        // Massive black energy wave
        WB.Game.projectiles.push(new WB.Projectile({
            x: this.owner.x + Math.cos(fireAngle) * (this.owner.radius + 10),
            y: this.owner.y + Math.sin(fireAngle) * (this.owner.radius + 10),
            vx: Math.cos(fireAngle) * 12,
            vy: Math.sin(fireAngle) * 12,
            damage: 30 + this.hitCount * 2,
            owner: this.owner,
            ownerWeapon: this,
            radius: 14,
            lifespan: 80,
            bounces: 0,
            color: '#111111',
            piercing: true,
        }));

        WB.Renderer.triggerShake(22);
        if (WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 40, '#111133');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 20, '#6644FF');
        }
        if (WB.GLEffects) {
            WB.GLEffects.triggerShockwave(this.owner.x, this.owner.y, 1.0);
            WB.GLEffects.triggerChromatic(1.0);
            WB.GLEffects.triggerBarrel(0.5);
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
            B.fillCircleGlow(this.reach - 4, 0, 14, '#6644FF', 22);
        }

        if (this.bankaiActive) {
            // Bankai: Tensa Zangetsu — sleek black blade
            B.fillRect(r - 2, -1.5, this.reach - r + 2, 3, '#222');
            B.strokeRect(r - 2, -1.5, this.reach - r + 2, 3, '#555', 1);
            // Red edge
            B.line(r - 2, -1.5, this.reach, -1.5, '#880000', 1);
            // Guard — small tsuba
            B.fillCircle(r - 3, 0, 4, '#333');
            B.strokeCircle(r - 3, 0, 4, '#666', 1);
            // Handle wrap
            B.fillRect(r - 10, -2, 7, 4, '#222');
            B.line(r - 9, -2, r - 5, 2, '#666', 0.8);
            B.line(r - 7, -2, r - 3, 2, '#666', 0.8);
        } else {
            // Shikai: Big cleaver Zangetsu
            B.fillRect(r - 2, -3, this.reach - r, 6, '#C0C0C0');
            B.strokeRect(r - 2, -3, this.reach - r, 6, '#888', 1);
            // Wrap handle
            B.fillRect(r - 8, -3, 6, 6, '#654321');
            B.line(r - 7, -3, r - 3, 3, '#8B6914', 1);
        }

        // Getsuga charge glow
        if (this.fireTimer > this.fireRate - 20) {
            const p = (this.fireTimer - (this.fireRate - 20)) / 20;
            const color = this.bankaiActive ? '#333366' : '#44CCFF';
            B.setAlpha(p * 0.4);
            B.fillCircle(this.reach * 0.7, 0, 10 + p * 8, color);
            B.restoreAlpha();
        }

        B.popTransform();

        // Bankai aura
        if (this.bankaiActive) {
            const flicker = 1 + Math.sin(Date.now() * 0.012) * 0.15;
            B.setAlpha(0.3);
            B.strokeCircle(this.owner.x, this.owner.y, r + 5 * flicker, '#111133', 2);
            B.restoreAlpha();
        }
        if (this.superActive) {
            const flicker = 1 + Math.sin(Date.now() * 0.01) * 0.2;
            B.setAlpha(0.5);
            B.strokeCircle(this.owner.x, this.owner.y, r + 8 * flicker, '#6644FF', 3);
            B.restoreAlpha();
            B.setAlpha(0.08);
            B.fillCircle(this.owner.x, this.owner.y, r + 6, '#111133');
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('ichigo', IchigoWeapon);
