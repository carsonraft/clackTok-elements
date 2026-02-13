window.WB = window.WB || {};

// Gunclacker: A revolver that fires rapid bullets with CLACKY gunshot sounds.
// Every 6 shots triggers a reload clack (louder, more resonant).
// Mid-fight: Gun upgrades to dual-wield at 5 hits (double fire rate).
// Super: FULL AUTO BURST — sprays 12 bullets in a spread pattern.
class GunclackerWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'gunclacker',
            baseDamage: 2,
            rotationSpeed: 0.04,
            reach: 30,
            scalingName: 'Rounds',
            superThreshold: 10,
            isRanged: true,
        });
        this.fireTimer = 0;
        this.fireRate = 45;         // Shots per N frames
        this.roundsFired = 0;
        this.magSize = 6;
        this.dualWield = false;
        this.dualWieldThreshold = 5;
        this.muzzleFlash = 0;
        this.recoilAngle = 0;
        this.scalingStat.value = this.roundsFired;
    }

    update() {
        super.update();
        this.fireTimer++;
        this.muzzleFlash *= 0.85;
        this.recoilAngle *= 0.9;

        if (this.fireTimer >= this.fireRate) {
            this._fireGun();
            this.fireTimer = 0;
        }

        // Dual wield fires the second gun offset
        if (this.dualWield && this.fireTimer === Math.floor(this.fireRate / 2)) {
            this._fireGun(Math.PI); // Fire from opposite side
        }
    }

    _fireGun(angleOffset) {
        if (!WB.Game || !WB.Game.projectiles) return;

        let fireAngle = this.angle + (angleOffset || 0);
        // Aim at enemy
        if (WB.Game.balls) {
            const enemy = WB.Game.balls.find(b => b !== this.owner && b.isAlive && b.side !== this.owner.side);
            if (enemy) {
                fireAngle = Math.atan2(enemy.y - this.owner.y, enemy.x - this.owner.x);
                if (angleOffset) fireAngle += (WB.random() - 0.5) * 0.3;
            }
        }

        // Slight random spread
        fireAngle += (WB.random() - 0.5) * 0.12;

        const speed = 12;
        const dmg = this.currentDamage;

        WB.Game.projectiles.push(new WB.Projectile({
            x: this.owner.x + Math.cos(fireAngle) * (this.owner.radius + 6),
            y: this.owner.y + Math.sin(fireAngle) * (this.owner.radius + 6),
            vx: Math.cos(fireAngle) * speed,
            vy: Math.sin(fireAngle) * speed,
            damage: dmg,
            owner: this.owner,
            ownerWeapon: this,
            radius: 3,
            lifespan: 50,
            bounces: 1,
            color: '#FFD700',
        }));

        this.roundsFired++;
        this.scalingStat.value = this.roundsFired;
        this.muzzleFlash = 1.0;
        this.recoilAngle = -0.15;

        // Reload clack every magSize shots
        const isReload = this.roundsFired % this.magSize === 0;
        WB.Audio.gunClack(isReload);
        WB.Renderer.triggerShake(isReload ? 5 : 2);

        if (WB.Game.particles) {
            const mx = this.owner.x + Math.cos(fireAngle) * (this.owner.radius + 10);
            const my = this.owner.y + Math.sin(fireAngle) * (this.owner.radius + 10);
            WB.Game.particles.emit(mx, my, isReload ? 6 : 3, '#FFD700', {
                speed: 3, life: 8, size: 1.5,
            });
            // Shell casing particle (ejects sideways)
            const casingAngle = fireAngle + Math.PI / 2 + (Math.random() - 0.5) * 0.5;
            WB.Game.particles.emit(
                this.owner.x + Math.cos(casingAngle) * 8,
                this.owner.y + Math.sin(casingAngle) * 8,
                1, '#C0A000', { speed: 2, life: 15, size: 1.5 }
            );
        }

        if (isReload && WB.GLEffects) {
            WB.GLEffects.spawnImpact(this.owner.x, this.owner.y, '#FFD700', 30);
            WB.GLEffects.triggerChromatic(0.1);
        }
    }

    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);

        // Activate dual wield
        if (!this.dualWield && this.hitCount >= this.dualWieldThreshold) {
            this._activateDualWield();
        }

        const dx = target.x - this.owner.x;
        const dy = target.y - this.owner.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        target.vx += (dx / d) * 3;
        target.vy += (dy / d) * 3;

        this._onHitEffects(target, this.currentDamage, '#FFD700');
    }

    _activateDualWield() {
        this.dualWield = true;
        this.currentDamage += 1;

        WB.Renderer.triggerShake(10);
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 15, '#FFD700');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 8, '#C0C0C0');
        }
        if (WB.GLEffects) {
            WB.GLEffects.spawnImpact(this.owner.x, this.owner.y, '#FFD700', 45);
            WB.GLEffects.triggerChromatic(0.25);
        }
    }

    applyScaling() {
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.4);
        this.fireRate = Math.max(25, 45 - this.hitCount * 2);
        this.scalingStat.value = this.roundsFired;
    }

    activateSuper() {
        // FULL AUTO BURST! 12 bullets in a spread
        this._fullAutoBurst();
        this.currentDamage += 3;
        this.fireRate = Math.max(15, this.fireRate - 10);
    }

    _fullAutoBurst() {
        if (!WB.Game || !WB.Game.projectiles) return;

        let baseAngle = this.angle;
        if (WB.Game.balls) {
            const enemy = WB.Game.balls.find(b => b !== this.owner && b.isAlive && b.side !== this.owner.side);
            if (enemy) baseAngle = Math.atan2(enemy.y - this.owner.y, enemy.x - this.owner.x);
        }

        // Spray 12 bullets in a fan
        for (let i = 0; i < 12; i++) {
            const spreadAngle = baseAngle + (i - 5.5) * 0.08 + (WB.random() - 0.5) * 0.1;
            const speed = 10 + WB.random() * 4;
            WB.Game.projectiles.push(new WB.Projectile({
                x: this.owner.x + Math.cos(spreadAngle) * (this.owner.radius + 6),
                y: this.owner.y + Math.sin(spreadAngle) * (this.owner.radius + 6),
                vx: Math.cos(spreadAngle) * speed,
                vy: Math.sin(spreadAngle) * speed,
                damage: this.currentDamage + 2,
                owner: this.owner,
                ownerWeapon: this,
                radius: 3,
                lifespan: 55,
                bounces: 1,
                color: '#FF4400',
            }));
        }

        this.roundsFired += 12;
        this.scalingStat.value = this.roundsFired;

        // BIG gunshot effects
        WB.Renderer.triggerShake(18);
        if (WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 30, '#FFD700');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 15, '#FF4400');
            WB.Game.particles.spark(this.owner.x, this.owner.y, 20);
        }
        if (WB.GLEffects) {
            WB.GLEffects.triggerShockwave(this.owner.x, this.owner.y, 0.5);
            WB.GLEffects.triggerChromatic(0.6);
            WB.GLEffects.triggerBarrel(0.2);
            WB.GLEffects.triggerSuperFlash('#FFD700');
        }
        // Rapid gunclack burst for the super
        for (let i = 0; i < 4; i++) {
            setTimeout(() => WB.Audio.gunClack(true), i * 40);
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;
        const drawAngle = this.angle + this.recoilAngle;

        B.pushTransform(this.owner.x, this.owner.y, drawAngle);

        if (this.superActive) {
            B.fillCircleGlow(this.reach * 0.6, 0, 12, '#FFD700', 18);
        }

        // Gun barrel
        B.fillRect(r - 2, -2, this.reach - r + 4, 4, '#555');
        B.strokeRect(r - 2, -2, this.reach - r + 4, 4, '#333', 1);

        // Barrel bore (dark center line)
        B.line(r + 2, 0, this.reach + 2, 0, '#222', 1.5);

        // Grip / handle
        B.fillRect(r - 5, -1, 8, 8, '#8B4513');
        B.strokeRect(r - 5, -1, 8, 8, '#5C2D0A', 1);

        // Trigger guard
        B.line(r - 1, 7, r + 3, 9, '#555', 1);
        B.line(r + 3, 9, r + 3, 5, '#555', 1);

        // Cylinder (revolver drum)
        B.fillCircle(r + 4, 0, 5, '#777');
        B.strokeCircle(r + 4, 0, 5, '#555', 1);
        // Cylinder chambers (tiny circles)
        for (let i = 0; i < 6; i++) {
            const ca = (i * Math.PI * 2) / 6 + Date.now() * 0.003;
            B.fillCircle(r + 4 + Math.cos(ca) * 3, Math.sin(ca) * 3, 1, '#444');
        }

        // Front sight
        B.fillRect(this.reach - 1, -4, 2, 3, '#333');

        // Muzzle flash
        if (this.muzzleFlash > 0.1) {
            B.setAlpha(this.muzzleFlash * 0.7);
            B.fillCircle(this.reach + 4, 0, 5 + this.muzzleFlash * 8, '#FFD700');
            B.fillCircle(this.reach + 6, 0, 3 + this.muzzleFlash * 4, '#FFF');
            // Flash spikes
            for (let i = 0; i < 3; i++) {
                const sa = (i - 1) * 0.4;
                const len = 6 + this.muzzleFlash * 10;
                B.line(this.reach + 2, 0,
                    this.reach + 2 + Math.cos(sa) * len,
                    Math.sin(sa) * len,
                    '#FFAA00', 2);
            }
            B.restoreAlpha();
        }

        B.popTransform();

        // Dual wield — second gun drawn mirrored
        if (this.dualWield) {
            const angle2 = drawAngle + Math.PI;
            B.pushTransform(this.owner.x, this.owner.y, angle2);
            B.fillRect(r - 2, -2, this.reach - r + 4, 4, '#666');
            B.strokeRect(r - 2, -2, this.reach - r + 4, 4, '#444', 1);
            B.line(r + 2, 0, this.reach + 2, 0, '#333', 1.5);
            B.fillRect(r - 5, -1, 8, 8, '#8B4513');
            B.fillCircle(r + 4, 0, 5, '#888');
            B.strokeCircle(r + 4, 0, 5, '#666', 1);
            B.fillRect(this.reach - 1, -4, 2, 3, '#444');
            B.popTransform();
        }

        // Smoke wisps from barrel
        if (this.muzzleFlash > 0.3 && WB.Game && WB.Game.particles) {
            const tipX = this.owner.x + Math.cos(drawAngle) * (this.reach + 5);
            const tipY = this.owner.y + Math.sin(drawAngle) * (this.reach + 5);
            if (Math.random() < 0.3) {
                WB.Game.particles.emit(tipX, tipY, 1, '#999', {
                    speed: 0.5, life: 20, size: 2,
                });
            }
        }

        // Super aura
        if (this.superActive) {
            const flicker = 1 + Math.sin(Date.now() * 0.01) * 0.15;
            B.setAlpha(0.35);
            B.strokeCircle(this.owner.x, this.owner.y, r + 6 * flicker, '#FFD700', 2.5);
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('gunclacker', GunclackerWeapon, 'classic');
