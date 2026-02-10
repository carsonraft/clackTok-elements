window.WB = window.WB || {};

// Luffy: Gum-Gum rubber stretch punches with extra long reach. Gear 2 at 5 hits (speed boost).
// Super: Gear 5 — massive Red Hawk fire punch.
class LuffyWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'luffy',
            baseDamage: 3,
            rotationSpeed: 0.04,
            reach: 50,      // Extra long reach — rubber arms!
            scalingName: 'Gear',
            superThreshold: 10,
            isRanged: false,
        });
        this.gearLevel = 1;
        this.gear2Active = false;
        this.gear2Threshold = 5;
        this.stretchPhase = 0;
        this.punchExtend = 0;
        this.scalingStat.value = this.gearLevel;
    }

    update() {
        super.update();
        this.stretchPhase += 0.05;

        // Stretchy reach oscillation
        const stretch = Math.sin(this.stretchPhase) * 8;
        this.reach = this.baseReach + stretch;

        // Gear 2 speed boost
        if (this.gear2Active) {
            this.rotationSpeed = 0.065;
            // Steam particles
            if (Math.random() < 0.08 && WB.Game && WB.Game.particles) {
                WB.Game.particles.emit(this.owner.x, this.owner.y - this.owner.radius, 1, '#FF8888', {
                    speed: 1, life: 15, size: 2,
                });
            }
        }

        // Punch extend animation decay
        if (this.punchExtend > 0) this.punchExtend *= 0.9;
    }

    onHit(target) {
        const dmg = this.gear2Active ? Math.floor(this.currentDamage * 1.3) : this.currentDamage;
        target.takeDamage(dmg);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();

        if (!this.gear2Active && this.hitCount >= this.gear2Threshold) {
            this._activateGear2();
        }

        WB.Audio.weaponHit(this.hitCount, this.type);

        // Rubber bounce knockback — HUGE
        const dx = target.x - this.owner.x;
        const dy = target.y - this.owner.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        target.vx += (dx / d) * 6;
        target.vy += (dy / d) * 6;
        // Luffy bounces back too (rubber recoil)
        this.owner.vx -= (dx / d) * 1.5;
        this.owner.vy -= (dy / d) * 1.5;

        this.punchExtend = 15;
        this._onHitEffects(target, dmg, '#CC2222');
    }

    _activateGear2() {
        this.gear2Active = true;
        this.gearLevel = 2;
        this.currentDamage += 2;
        this.owner.vx *= 1.8;
        this.owner.vy *= 1.8;
        WB.Renderer.triggerShake(10);
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 20, '#FF4444');
        }
        if (WB.GLEffects) {
            WB.GLEffects.spawnImpact(this.owner.x, this.owner.y, '#FF4444', 60);
            WB.GLEffects.triggerChromatic(0.35);
            WB.GLEffects.triggerShockwave(this.owner.x, this.owner.y, 0.25);
        }
        this.scalingStat.value = this.gearLevel;
    }

    applyScaling() {
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.5);
        if (!this.gear2Active) this.gearLevel = 1;
        this.scalingStat.value = this.gearLevel;
    }

    activateSuper() {
        // GEAR 5 — Red Hawk!
        this.gearLevel = 5;
        this.scalingStat.value = 5;
        this._fireRedHawk();
        this.currentDamage += 5;
        this.baseReach += 15;
        this.rotationSpeed = 0.08;
    }

    _fireRedHawk() {
        if (!WB.Game || !WB.Game.projectiles) return;
        const fireAngle = this.angle;
        const enemy = WB.Game.balls ? WB.Game.balls.find(b => b !== this.owner && b.isAlive && b.side !== this.owner.side) : null;
        const aim = enemy ? Math.atan2(enemy.y - this.owner.y, enemy.x - this.owner.x) : fireAngle;

        // Giant fire fist projectile
        WB.Game.projectiles.push(new WB.Projectile({
            x: this.owner.x + Math.cos(aim) * (this.owner.radius + 10),
            y: this.owner.y + Math.sin(aim) * (this.owner.radius + 10),
            vx: Math.cos(aim) * 10,
            vy: Math.sin(aim) * 10,
            damage: 22 + this.hitCount * 2,
            owner: this.owner,
            ownerWeapon: this,
            radius: 14,
            lifespan: 60,
            bounces: 0,
            color: '#FF2200',
            piercing: true,
        }));

        WB.Renderer.triggerShake(18);
        if (WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 35, '#FF4400');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 20, '#FFCC00');
        }
        if (WB.GLEffects) {
            WB.GLEffects.triggerShockwave(this.owner.x, this.owner.y, 0.7);
            WB.GLEffects.triggerChromatic(0.8);
            WB.GLEffects.triggerBarrel(0.3);
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;
        const extend = this.punchExtend;

        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
            B.fillCircleGlow(this.reach + extend - 4, 0, 16, '#FF4400', 25);
        }

        // Stretchy rubber arm (wavy line)
        const segments = 8;
        const segLen = (this.reach + extend - r) / segments;
        let prevX = r - 2, prevY = 0;
        for (let i = 1; i <= segments; i++) {
            const sx = r - 2 + i * segLen;
            const wave = Math.sin(this.stretchPhase * 2 + i * 0.8) * (this.gear2Active ? 1.5 : 2.5);
            const sy = wave;
            B.line(prevX, prevY, sx, sy, '#F5D5A0', 3.5);
            prevX = sx;
            prevY = sy;
        }

        // Fist
        const fistColor = this.superActive ? '#FF2200' : (this.gear2Active ? '#FF8888' : '#F5D5A0');
        B.fillCircle(this.reach + extend - 4, 0, 7, fistColor);
        B.strokeCircle(this.reach + extend - 4, 0, 7, '#CC8855', 1.5);

        // Fire effect on fist (Gear 5)
        if (this.superActive) {
            const t = Date.now() * 0.01;
            for (let i = 0; i < 3; i++) {
                const a = t + i * 2.1;
                const fx = this.reach + extend - 4 + Math.cos(a) * 8;
                const fy = Math.sin(a) * 8;
                B.setAlpha(0.4);
                B.fillCircle(fx, fy, 3 + Math.sin(a * 2), '#FF6600');
                B.restoreAlpha();
            }
        }

        B.popTransform();

        // Gear 2 steam aura
        if (this.gear2Active && !this.superActive) {
            const flicker = 1 + Math.sin(Date.now() * 0.015) * 0.2;
            B.setAlpha(0.2);
            B.strokeCircle(this.owner.x, this.owner.y, r + 4 * flicker, '#FF6666', 2);
            B.restoreAlpha();
        }

        // Gear 5 aura
        if (this.superActive) {
            const flicker = 1 + Math.sin(Date.now() * 0.01) * 0.2;
            B.setAlpha(0.5);
            B.strokeCircle(this.owner.x, this.owner.y, r + 8 * flicker, '#FF4400', 3);
            B.restoreAlpha();
            B.setAlpha(0.1);
            B.fillCircle(this.owner.x, this.owner.y, r + 5, '#FFCC00');
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('luffy', LuffyWeapon);
