window.WB = window.WB || {};

// David Martinez (Cyberpunk Edgerunners): Sandevistan time-slow + Gorilla Arms.
// Fires smart bullets that track enemies. Melee hits are HEAVY (gorilla arms).
// Mid-fight: Sandevistan at 5 hits (speed boost + afterimages).
// Super: Cyberskeleton Overload — massive AOE burst + auto-dodge for 3 seconds.
class DavidWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'david',
            baseDamage: 4,
            rotationSpeed: 0.05,
            reach: 38,
            scalingName: 'Eddies',
            superThreshold: 10,
            isRanged: false,
        });
        this.eddies = 0;
        this.fireTimer = 0;
        this.fireRate = 65;
        this.sandevistanActive = false;
        this.sandevistanThreshold = 5;
        this.afterimages = [];
        this.cyberPsychosis = 0;
        this.dodgeTimer = 0;
        this.scalingStat.value = this.eddies;
    }

    update() {
        super.update();
        this.fireTimer++;

        // Store afterimages for Sandevistan
        if (this.sandevistanActive) {
            if (this.afterimages.length > 6) this.afterimages.shift();
            this.afterimages.push({ x: this.owner.x, y: this.owner.y, age: 0 });
            for (const a of this.afterimages) a.age++;
        }

        // Fire smart bullets
        if (this.fireTimer >= this.fireRate) {
            this._fireSmartBullet();
            this.fireTimer = 0;
        }

        // Super dodge effect — jitter position slightly
        if (this.dodgeTimer > 0) {
            this.dodgeTimer--;
            if (this.dodgeTimer % 8 === 0) {
                this.owner.vx += (Math.random() - 0.5) * 6;
                this.owner.vy += (Math.random() - 0.5) * 6;
            }
        }

        // Cyberpsychosis visual particles
        if (this.cyberPsychosis > 3 && Math.random() < 0.05) {
            if (WB.Game && WB.Game.particles) {
                WB.Game.particles.emit(this.owner.x, this.owner.y, 1, '#FF0040', {
                    speed: 1, life: 12, size: 1.5,
                });
            }
        }
    }

    _fireSmartBullet() {
        if (!WB.Game || !WB.Game.projectiles) return;
        let fireAngle = this.angle;
        if (WB.Game.balls) {
            const enemy = WB.Game.balls.find(b => b !== this.owner && b.isAlive && b.side !== this.owner.side);
            if (enemy) fireAngle = Math.atan2(enemy.y - this.owner.y, enemy.x - this.owner.x);
        }

        // Smart bullet — slightly tracking
        fireAngle += (Math.random() - 0.5) * 0.2;
        const speed = 9;

        WB.Game.projectiles.push(new WB.Projectile({
            x: this.owner.x + Math.cos(fireAngle) * (this.owner.radius + 6),
            y: this.owner.y + Math.sin(fireAngle) * (this.owner.radius + 6),
            vx: Math.cos(fireAngle) * speed,
            vy: Math.sin(fireAngle) * speed,
            damage: 3 + Math.floor(this.hitCount * 0.3),
            owner: this.owner,
            ownerWeapon: this,
            radius: 3,
            lifespan: 55,
            bounces: 1,
            color: '#00FFFF',
        }));

        WB.Audio.gunClack(false);
        WB.Renderer.triggerShake(2);
        if (WB.Game.particles) {
            const mx = this.owner.x + Math.cos(fireAngle) * (this.owner.radius + 10);
            const my = this.owner.y + Math.sin(fireAngle) * (this.owner.radius + 10);
            WB.Game.particles.emit(mx, my, 3, '#00FFFF', { speed: 2, life: 8, size: 1.5 });
        }
    }

    onHit(target) {
        // Gorilla Arms — HEAVY melee
        const dmg = this.sandevistanActive ? Math.floor(this.currentDamage * 1.5) : this.currentDamage;
        target.takeDamage(dmg);
        this.hitCount++;
        this.eddies += 10;
        this.cyberPsychosis++;
        this.cooldown = this.sandevistanActive ?
            Math.floor(WB.Config.WEAPON_HIT_COOLDOWN * 0.6) :
            WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();

        if (!this.sandevistanActive && this.hitCount >= this.sandevistanThreshold) {
            this._activateSandevistan();
        }

        WB.Audio.weaponHit(this.hitCount, this.type);

        // Gorilla Arms knockback — MASSIVE
        const dx = target.x - this.owner.x;
        const dy = target.y - this.owner.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        target.vx += (dx / d) * 6;
        target.vy += (dy / d) * 6;

        this._onHitEffects(target, dmg, '#00FFFF');
    }

    _activateSandevistan() {
        this.sandevistanActive = true;
        this.rotationSpeed = 0.08;
        this.currentDamage += 2;
        this.fireRate = Math.max(35, this.fireRate - 20);

        WB.Renderer.triggerShake(12);
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 20, '#00FFFF');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 12, '#FF0040');
        }
        if (WB.GLEffects) {
            WB.GLEffects.spawnImpact(this.owner.x, this.owner.y, '#00FFFF', 55);
            WB.GLEffects.triggerChromatic(0.4);
            WB.GLEffects.triggerShockwave(this.owner.x, this.owner.y, 0.3);
        }
        this.scalingStat.value = this.eddies;
    }

    applyScaling() {
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.5);
        this.scalingStat.value = this.eddies;
    }

    activateSuper() {
        // CYBERSKELETON OVERLOAD!
        this._cyberOverload();
        this.currentDamage += 5;
        this.rotationSpeed = 0.1;
        this.dodgeTimer = 180; // 3 seconds auto-dodge
    }

    _cyberOverload() {
        if (!WB.Game || !WB.Game.projectiles) return;

        // AOE burst — 8 bullets in all directions
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI * 2) / 8;
            WB.Game.projectiles.push(new WB.Projectile({
                x: this.owner.x + Math.cos(angle) * (this.owner.radius + 6),
                y: this.owner.y + Math.sin(angle) * (this.owner.radius + 6),
                vx: Math.cos(angle) * 10,
                vy: Math.sin(angle) * 10,
                damage: 8 + this.hitCount,
                owner: this.owner,
                ownerWeapon: this,
                radius: 4,
                lifespan: 60,
                bounces: 1,
                color: '#FF0040',
            }));
        }

        WB.Renderer.triggerShake(20);
        if (WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 35, '#00FFFF');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 25, '#FF0040');
            WB.Game.particles.spark(this.owner.x, this.owner.y, 20);
        }
        if (WB.GLEffects) {
            WB.GLEffects.triggerSuperFlash('#00FFFF');
            WB.GLEffects.triggerShockwave(this.owner.x, this.owner.y, 0.8);
            WB.GLEffects.triggerChromatic(0.8);
            WB.GLEffects.triggerBarrel(0.3);
        }
        // Rapid gunclack burst
        for (let i = 0; i < 3; i++) {
            setTimeout(() => WB.Audio.gunClack(true), i * 50);
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        // Sandevistan afterimages
        if (this.sandevistanActive) {
            for (const a of this.afterimages) {
                const alpha = Math.max(0, 0.2 - a.age * 0.03);
                if (alpha <= 0) continue;
                B.setAlpha(alpha);
                B.fillCircle(a.x, a.y, r * 0.9, '#00FFFF');
                B.restoreAlpha();
            }
        }

        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
            B.fillCircleGlow(this.reach * 0.6, 0, 14, '#FF0040', 22);
        }

        // Gorilla Arm (cybernetic)
        B.line(r - 2, 0, this.reach - 8, 0, '#888', 4.5);
        // Segmented cyber-arm plating
        for (let i = 0; i < 3; i++) {
            const sx = r + i * ((this.reach - r) / 3.5);
            B.fillRect(sx, -3, 6, 6, '#555');
            B.strokeRect(sx, -3, 6, 6, '#00FFFF', 0.6);
        }
        // Gorilla fist (oversized)
        B.fillCircle(this.reach - 4, 0, 8, '#666');
        B.strokeCircle(this.reach - 4, 0, 8, '#00FFFF', 1.5);
        // Knuckle LEDs
        for (let i = 0; i < 3; i++) {
            B.fillCircle(this.reach - 6 + i * 3, -4, 1, '#FF0040');
        }

        B.popTransform();

        // Cybernetic eye glow
        B.fillCircle(this.owner.x + r * 0.25, this.owner.y - r * 0.2, r * 0.1, '#00FFFF');

        // Dodge visual — glitch flicker
        if (this.dodgeTimer > 0 && this.dodgeTimer % 6 < 3) {
            B.setAlpha(0.15);
            B.fillCircle(this.owner.x + (Math.random() - 0.5) * 10, this.owner.y, r, '#FF0040');
            B.restoreAlpha();
        }

        // Super aura (cyber red + cyan)
        if (this.superActive) {
            const flicker = 1 + Math.sin(Date.now() * 0.012) * 0.15;
            B.setAlpha(0.45);
            B.strokeCircle(this.owner.x, this.owner.y, r + 7 * flicker, '#00FFFF', 2);
            B.restoreAlpha();
            B.setAlpha(0.2);
            B.strokeCircle(this.owner.x, this.owner.y, r + 5 * flicker, '#FF0040', 1.5);
            B.restoreAlpha();
        } else if (this.sandevistanActive) {
            const flicker = 1 + Math.sin(Date.now() * 0.015) * 0.15;
            B.setAlpha(0.3);
            B.strokeCircle(this.owner.x, this.owner.y, r + 4 * flicker, '#00FFFF', 1.5);
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('david', DavidWeapon);
