window.WB = window.WB || {};

// Naruto: Shadow Clone jutsu fires clone projectiles. Sage Mode at 5 hits (stronger + regen).
// Rasengan melee. Super: Rasenshuriken — massive piercing AoE projectile.
class NarutoWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'naruto',
            baseDamage: 3,
            rotationSpeed: 0.04,
            reach: 34,
            scalingName: 'Jutsu Lvl',
            superThreshold: 10,
            isRanged: false,
        });
        this.jutsuLevel = 1;
        this.fireTimer = 0;
        this.fireRate = 85;
        this.sageModeActive = false;
        this.sageModeThreshold = 5;
        this.rasenganSpin = 0;
        this.scalingStat.value = this.jutsuLevel;
    }

    update() {
        super.update();
        this.fireTimer++;
        this.rasenganSpin += 0.15;

        if (this.fireTimer >= this.fireRate) {
            this.fireShadowClone();
            this.fireTimer = 0;
        }

        // Sage mode passive regen
        if (this.sageModeActive && this.owner.hp < this.owner.maxHp) {
            if (Math.random() < 0.02) {
                this.owner.hp = Math.min(this.owner.maxHp, this.owner.hp + 1);
            }
        }
    }

    fireShadowClone() {
        if (!WB.Game || !WB.Game.projectiles) return;
        let fireAngle = this._aimAtEnemy();
        const speed = 6;
        const count = this.sageModeActive ? 2 : 1;

        for (let i = 0; i < count; i++) {
            const angle = fireAngle + (i - (count - 1) / 2) * 0.3;
            WB.Game.projectiles.push(new WB.Projectile({
                x: this.owner.x + Math.cos(angle) * (this.owner.radius + 6),
                y: this.owner.y + Math.sin(angle) * (this.owner.radius + 6),
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                damage: 2 + Math.floor(this.hitCount * 0.3),
                owner: this.owner,
                ownerWeapon: this,
                radius: 4,
                lifespan: 70,
                bounces: 0,
                color: '#FF8833',
            }));
        }
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
        const dmg = this.sageModeActive ? Math.floor(this.currentDamage * 1.4) : this.currentDamage;
        target.takeDamage(dmg);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();

        if (!this.sageModeActive && this.hitCount >= this.sageModeThreshold) {
            this._activateSageMode();
        }

        WB.Audio.weaponHit(this.hitCount, this.type);

        const dx = target.x - this.owner.x;
        const dy = target.y - this.owner.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        target.vx += (dx / d) * 4;
        target.vy += (dy / d) * 4;

        this._onHitEffects(target, dmg, '#FF8833');
    }

    _activateSageMode() {
        this.sageModeActive = true;
        this.currentDamage += 2;
        this.fireRate = Math.max(45, this.fireRate - 20);
        WB.Renderer.triggerShake(10);
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 20, '#FFAA00');
        }
        if (WB.GLEffects) {
            WB.GLEffects.spawnImpact(this.owner.x, this.owner.y, '#FFAA00', 60);
            WB.GLEffects.triggerChromatic(0.4);
            WB.GLEffects.triggerShockwave(this.owner.x, this.owner.y, 0.3);
        }
    }

    applyScaling() {
        this.jutsuLevel = 1 + this.hitCount;
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.5);
        this.scalingStat.value = this.jutsuLevel;
    }

    activateSuper() {
        // RASENSHURIKEN!
        this._fireRasenshuriken();
        this.fireRate = Math.max(30, this.fireRate - 25);
        this.currentDamage += 4;
    }

    _fireRasenshuriken() {
        if (!WB.Game || !WB.Game.projectiles) return;
        const fireAngle = this._aimAtEnemy();
        const speed = 9;

        WB.Game.projectiles.push(new WB.Projectile({
            x: this.owner.x + Math.cos(fireAngle) * (this.owner.radius + 8),
            y: this.owner.y + Math.sin(fireAngle) * (this.owner.radius + 8),
            vx: Math.cos(fireAngle) * speed,
            vy: Math.sin(fireAngle) * speed,
            damage: 18 + this.hitCount * 2,
            owner: this.owner,
            ownerWeapon: this,
            radius: 12,
            lifespan: 80,
            bounces: 1,
            color: '#44BBFF',
            piercing: true,
        }));

        WB.Renderer.triggerShake(16);
        if (WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 30, '#44BBFF');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 15, '#FFAA00');
        }
        if (WB.GLEffects) {
            WB.GLEffects.triggerShockwave(this.owner.x, this.owner.y, 0.6);
            WB.GLEffects.triggerChromatic(0.7);
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        // Super glow
        if (this.superActive) {
            B.fillCircleGlow(this.reach - 4, 0, 14, '#44BBFF', 22);
        }

        // Arm
        B.line(r - 2, 0, this.reach - 8, 0, '#F5D5A0', 3);

        // Rasengan sphere at tip
        const rasenColor = this.sageModeActive ? '#FFAA00' : '#44BBFF';
        B.fillCircle(this.reach - 4, 0, 7, rasenColor);
        B.setAlpha(0.4);
        // Spinning swirl lines inside rasengan
        for (let i = 0; i < 3; i++) {
            const a = this.rasenganSpin + i * 2.094;
            const sx = this.reach - 4 + Math.cos(a) * 4;
            const sy = Math.sin(a) * 4;
            B.fillCircle(sx, sy, 2, '#FFF');
        }
        B.restoreAlpha();
        B.strokeCircle(this.reach - 4, 0, 7, '#2299DD', 1.5);

        B.popTransform();

        // Sage mode orange eye marks
        if (this.sageModeActive) {
            B.setAlpha(0.6);
            B.fillRect(this.owner.x - r * 0.35, this.owner.y - r * 0.15, r * 0.12, r * 0.3, '#FF6600');
            B.fillRect(this.owner.x + r * 0.23, this.owner.y - r * 0.15, r * 0.12, r * 0.3, '#FF6600');
            B.restoreAlpha();
        }

        // Super aura
        if (this.superActive) {
            const flicker = 1 + Math.sin(Date.now() * 0.01) * 0.15;
            B.setAlpha(0.4);
            B.strokeCircle(this.owner.x, this.owner.y, r + 6 * flicker, '#FFAA00', 2);
            B.restoreAlpha();
            B.setAlpha(0.08);
            B.fillCircle(this.owner.x, this.owner.y, r + 4, '#FFAA00');
            B.restoreAlpha();
        } else if (this.sageModeActive) {
            const flicker = 1 + Math.sin(Date.now() * 0.008) * 0.1;
            B.setAlpha(0.3);
            B.strokeCircle(this.owner.x, this.owner.y, r + 4 * flicker, '#FF8833', 1.5);
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('naruto', NarutoWeapon);
