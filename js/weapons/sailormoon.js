window.WB = window.WB || {};

// Sailor Moon: Moon Tiara Action (boomerang tiara projectile). Sparkle wand melee.
// Mid-fight: Moon Crystal Power at 5 hits (healing + sparkle aura).
// Super: Silver Crystal — massive piercing beam of purifying light.
class SailorMoonWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'sailormoon',
            baseDamage: 3,
            rotationSpeed: 0.045,
            reach: 36,
            scalingName: 'Love',
            superThreshold: 10,
            isRanged: false,
        });
        this.loveLevel = 1;
        this.tiaraTimer = 0;
        this.tiaraRate = 90;       // Moon Tiara Action cooldown
        this.crystalPower = false;
        this.crystalThreshold = 5;
        this.sparklePhase = 0;
        this.healTimer = 0;
        this.scalingStat.value = this.loveLevel;
    }

    update() {
        super.update();
        this.tiaraTimer++;
        this.sparklePhase += 0.06;
        this.healTimer++;

        // Fire Moon Tiara Action
        if (this.tiaraTimer >= this.tiaraRate) {
            this._fireTiara();
            this.tiaraTimer = 0;
        }

        // Crystal Power healing
        if (this.crystalPower && this.healTimer % 90 === 0 && this.owner.hp < this.owner.maxHp) {
            this.owner.hp = Math.min(this.owner.maxHp, this.owner.hp + 2);
            if (WB.Game && WB.Game.particles) {
                WB.Game.particles.emit(this.owner.x, this.owner.y, 3, '#FFB6C1', {
                    speed: 1.5, life: 18, size: 2,
                });
            }
        }

        // Sparkle trail particles
        if (Math.random() < 0.1) {
            const tipX = this.getTipX();
            const tipY = this.getTipY();
            if (WB.Game && WB.Game.particles) {
                const colors = ['#FFB6C1', '#FFD700', '#FFF'];
                WB.Game.particles.emit(tipX, tipY, 1, colors[Math.floor(Math.random() * 3)], {
                    speed: 0.8, life: 15, size: 1.5,
                });
            }
        }
    }

    _fireTiara() {
        if (!WB.Game || !WB.Game.projectiles) return;
        let fireAngle = this.angle;
        if (WB.Game.balls) {
            const enemy = WB.Game.balls.find(b => b !== this.owner && b.isAlive && b.side !== this.owner.side);
            if (enemy) fireAngle = Math.atan2(enemy.y - this.owner.y, enemy.x - this.owner.x);
        }

        const speed = 7;
        WB.Game.projectiles.push(new WB.Projectile({
            x: this.owner.x + Math.cos(fireAngle) * (this.owner.radius + 8),
            y: this.owner.y + Math.sin(fireAngle) * (this.owner.radius + 8),
            vx: Math.cos(fireAngle) * speed,
            vy: Math.sin(fireAngle) * speed,
            damage: 5 + Math.floor(this.hitCount * 0.4),
            owner: this.owner,
            ownerWeapon: this,
            radius: 5,
            lifespan: 80,
            bounces: 2,
            color: '#FFD700',
        }));

        WB.Audio.projectileFire();
        if (WB.Game.particles) {
            WB.Game.particles.emit(this.owner.x, this.owner.y, 6, '#FFD700');
        }
    }

    onHit(target) {
        const dmg = this.crystalPower ? Math.floor(this.currentDamage * 1.4) : this.currentDamage;
        target.takeDamage(dmg);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();

        if (!this.crystalPower && this.hitCount >= this.crystalThreshold) {
            this._activateCrystalPower();
        }

        WB.Audio.weaponHit(this.hitCount, this.type);

        const dx = target.x - this.owner.x;
        const dy = target.y - this.owner.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        target.vx += (dx / d) * 4;
        target.vy += (dy / d) * 4;

        this._onHitEffects(target, dmg, '#FFB6C1');
    }

    _activateCrystalPower() {
        this.crystalPower = true;
        this.loveLevel = 5;
        this.currentDamage += 2;
        this.tiaraRate = Math.max(50, this.tiaraRate - 20);

        WB.Renderer.triggerShake(12);
        if (WB.Game && WB.Game.particles) {
            // Heart-shaped explosion (pink + gold + white)
            WB.Game.particles.explode(this.owner.x, this.owner.y, 25, '#FFB6C1');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 15, '#FFD700');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 10, '#FFF');
        }
        if (WB.GLEffects) {
            WB.GLEffects.spawnImpact(this.owner.x, this.owner.y, '#FFB6C1', 60);
            WB.GLEffects.triggerChromatic(0.35);
            WB.GLEffects.triggerShockwave(this.owner.x, this.owner.y, 0.3);
        }
        this.scalingStat.value = this.loveLevel;
    }

    applyScaling() {
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.5);
        this.loveLevel = 1 + Math.floor(this.hitCount * 0.4);
        if (this.crystalPower) this.loveLevel = Math.max(5, this.loveLevel);
        this.scalingStat.value = this.loveLevel;
    }

    activateSuper() {
        // MOON CRYSTAL POWER — SILVER CRYSTAL BEAM!
        this._fireSilverCrystal();
        this.currentDamage += 4;
        this.tiaraRate = Math.max(35, this.tiaraRate - 20);
    }

    _fireSilverCrystal() {
        if (!WB.Game || !WB.Game.projectiles) return;
        let fireAngle = this.angle;
        if (WB.Game.balls) {
            const enemy = WB.Game.balls.find(b => b !== this.owner && b.isAlive && b.side !== this.owner.side);
            if (enemy) fireAngle = Math.atan2(enemy.y - this.owner.y, enemy.x - this.owner.x);
        }

        // Massive silver beam
        WB.Game.projectiles.push(new WB.Projectile({
            x: this.owner.x + Math.cos(fireAngle) * (this.owner.radius + 10),
            y: this.owner.y + Math.sin(fireAngle) * (this.owner.radius + 10),
            vx: Math.cos(fireAngle) * 8,
            vy: Math.sin(fireAngle) * 8,
            damage: 22 + this.hitCount * 2,
            owner: this.owner,
            ownerWeapon: this,
            radius: 14,
            lifespan: 70,
            bounces: 0,
            color: '#FFF0F5',
            piercing: true,
        }));

        WB.Renderer.triggerShake(18);
        if (WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 35, '#FFB6C1');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 25, '#FFD700');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 15, '#FFF');
        }
        if (WB.GLEffects) {
            WB.GLEffects.triggerSuperFlash('#FFB6C1');
            WB.GLEffects.triggerShockwave(this.owner.x, this.owner.y, 0.7);
            WB.GLEffects.triggerChromatic(0.7);
            WB.GLEffects.triggerBarrel(0.3);
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        // Sparkle trail
        if (this.crystalPower) {
            const t = Date.now() * 0.005;
            for (let i = 0; i < 4; i++) {
                const a = t + i * Math.PI / 2;
                const sx = this.owner.x + Math.cos(a) * (r + 6);
                const sy = this.owner.y + Math.sin(a) * (r + 6);
                B.setAlpha(0.3 + Math.sin(t * 3 + i) * 0.2);
                B.fillCircle(sx, sy, 2, '#FFD700');
                B.restoreAlpha();
            }
        }

        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
            B.fillCircleGlow(this.reach * 0.7, 0, 14, '#FFF0F5', 22);
        }

        // Moon Stick / Wand
        B.fillRect(r - 2, -1.5, this.reach - r, 3, '#FFD700');
        B.strokeRect(r - 2, -1.5, this.reach - r, 3, '#DAA520', 0.8);

        // Crescent moon ornament at tip
        B.fillCircle(this.reach, 0, 5, '#FFD700');
        B.strokeCircle(this.reach, 0, 5, '#DAA520', 1);
        // Crescent cutout
        B.fillCircle(this.reach + 2, -1, 3.5, this.crystalPower ? '#FFF0F5' : '#FFF8E7');

        // Pink gem on wand shaft
        B.fillCircle(r + (this.reach - r) * 0.4, 0, 3, '#FFB6C1');
        B.strokeCircle(r + (this.reach - r) * 0.4, 0, 3, '#FF69B4', 0.8);

        // Sparkle at tip
        const sparkle = Math.sin(this.sparklePhase * 3) * 0.4 + 0.6;
        B.setAlpha(sparkle * 0.5);
        B.fillCircle(this.reach + 1, 0, 3 + sparkle * 3, '#FFF');
        B.restoreAlpha();

        B.popTransform();

        // Hair buns (odango)
        B.fillCircle(this.owner.x - r * 0.5, this.owner.y - r * 0.8, r * 0.2, '#FFD700');
        B.fillCircle(this.owner.x + r * 0.5, this.owner.y - r * 0.8, r * 0.2, '#FFD700');

        // Crystal Power aura
        if (this.crystalPower && !this.superActive) {
            const flicker = 1 + Math.sin(Date.now() * 0.012) * 0.15;
            B.setAlpha(0.25);
            B.strokeCircle(this.owner.x, this.owner.y, r + 5 * flicker, '#FFB6C1', 2);
            B.restoreAlpha();
        }
        // Super aura
        if (this.superActive) {
            const flicker = 1 + Math.sin(Date.now() * 0.01) * 0.2;
            B.setAlpha(0.5);
            B.strokeCircle(this.owner.x, this.owner.y, r + 8 * flicker, '#FFF0F5', 3);
            B.restoreAlpha();
            B.setAlpha(0.1);
            B.fillCircle(this.owner.x, this.owner.y, r + 5, '#FFB6C1');
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('sailormoon', SailorMoonWeapon);
