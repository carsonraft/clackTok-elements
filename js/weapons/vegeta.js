window.WB = window.WB || {};

// Vegeta: Pride-fueled ki fighter. Fires rapid ki blasts. Super: Final Flash beam + brief invulnerability.
class VegetaWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'vegeta',
            baseDamage: 2,
            rotationSpeed: 0.035,
            reach: 32,
            scalingName: 'Power Lvl',
            superThreshold: 10,
            isRanged: false, // keep melee active (punches)
        });
        this.powerLevel = 1;
        this.kiDamage = 2;
        this.fireTimer = 0;
        this.fireRate = 70; // Faster than Goku's 90
        this.finalFlashFired = false;
        this.scalingStat.value = this.powerLevel;
        // Galick Gun charge — fires a medium beam every few rounds
        this.galickTimer = 0;
        this.galickRate = 200;
    }

    update() {
        super.update();
        this.fireTimer++;
        this.galickTimer++;

        // Regular ki blasts
        if (this.fireTimer >= this.fireRate) {
            this.fireKiBlast();
            this.fireTimer = 0;
        }

        // Galick Gun — medium beam attack
        if (this.galickTimer >= this.galickRate) {
            this.fireGalickGun();
            this.galickTimer = 0;
        }
    }

    fireKiBlast() {
        if (!WB.Game || !WB.Game.projectiles) return;
        const speed = 7;

        // Aim at nearest enemy
        let fireAngle = this.angle;
        if (WB.Game.balls) {
            let closest = null;
            let closestDist = Infinity;
            for (const b of WB.Game.balls) {
                if (b === this.owner || !b.isAlive || b.side === this.owner.side) continue;
                const dx = b.x - this.owner.x;
                const dy = b.y - this.owner.y;
                const dist = dx * dx + dy * dy;
                if (dist < closestDist) {
                    closestDist = dist;
                    closest = b;
                }
            }
            if (closest) {
                fireAngle = Math.atan2(closest.y - this.owner.y, closest.x - this.owner.x);
            }
        }

        WB.Game.projectiles.push(new WB.Projectile({
            x: this.owner.x + Math.cos(fireAngle) * (this.owner.radius + 5),
            y: this.owner.y + Math.sin(fireAngle) * (this.owner.radius + 5),
            vx: Math.cos(fireAngle) * speed,
            vy: Math.sin(fireAngle) * speed,
            damage: this.kiDamage,
            owner: this.owner,
            ownerWeapon: this,
            radius: 3.5,
            lifespan: 70,
            bounces: 0,
            color: '#AA66FF',
        }));
        WB.Audio.projectileFire();
    }

    fireGalickGun() {
        if (!WB.Game || !WB.Game.projectiles) return;

        // Aim at nearest enemy
        let fireAngle = this.angle;
        if (WB.Game.balls) {
            const enemy = WB.Game.balls.find(b => b !== this.owner && b.isAlive && b.side !== this.owner.side);
            if (enemy) {
                fireAngle = Math.atan2(enemy.y - this.owner.y, enemy.x - this.owner.x);
            }
        }

        const speed = 8;
        WB.Game.projectiles.push(new WB.Projectile({
            x: this.owner.x + Math.cos(fireAngle) * (this.owner.radius + 6),
            y: this.owner.y + Math.sin(fireAngle) * (this.owner.radius + 6),
            vx: Math.cos(fireAngle) * speed,
            vy: Math.sin(fireAngle) * speed,
            damage: 5 + this.hitCount,
            owner: this.owner,
            ownerWeapon: this,
            radius: 6,
            lifespan: 50,
            bounces: 0,
            color: '#CC44FF',
        }));

        WB.Renderer.triggerShake(4);
        if (WB.Game.particles) {
            WB.Game.particles.emit(this.owner.x, this.owner.y, 12, '#CC44FF');
        }
        if (WB.GLEffects) {
            WB.GLEffects.spawnImpact(this.owner.x, this.owner.y, '#CC44FF', 40);
        }
    }

    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);

        // Punch knockback (stronger than Goku — Vegeta's pride)
        const dx = target.x - this.owner.x;
        const dy = target.y - this.owner.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        target.vx += (dx / d) * 4;
        target.vy += (dy / d) * 4;

        // Full combo tracking + screen deformation + particle effects
        this._onHitEffects(target, this.currentDamage, '#AA66FF');
    }

    applyScaling() {
        this.powerLevel = 1 + this.hitCount;
        this.kiDamage = 2 + Math.floor(this.hitCount * 0.8);
        this.fireRate = Math.max(35, 70 - this.hitCount * 3);
        this.scalingStat.value = this.powerLevel;
    }

    activateSuper() {
        // Final Flash!
        this.fireFinalFlash();
        // Permanent boosts
        this.fireRate = Math.max(25, this.fireRate - 15);
        this.kiDamage += 4;
        this.currentDamage += 3;
        this.galickRate = Math.floor(this.galickRate * 0.6);
    }

    fireFinalFlash() {
        if (!WB.Game || !WB.Game.projectiles) return;

        // Aim at nearest enemy
        let fireAngle = this.angle;
        if (WB.Game.balls) {
            const enemy = WB.Game.balls.find(b => b !== this.owner && b.isAlive && b.side !== this.owner.side);
            if (enemy) {
                fireAngle = Math.atan2(enemy.y - this.owner.y, enemy.x - this.owner.x);
            }
        }

        const speed = 12;
        WB.Game.projectiles.push(new WB.Projectile({
            x: this.owner.x + Math.cos(fireAngle) * (this.owner.radius + 10),
            y: this.owner.y + Math.sin(fireAngle) * (this.owner.radius + 10),
            vx: Math.cos(fireAngle) * speed,
            vy: Math.sin(fireAngle) * speed,
            damage: 20 + this.hitCount * 2,
            owner: this.owner,
            ownerWeapon: this,
            radius: 10,
            lifespan: 70,
            bounces: 0,
            color: '#EEDD00',
            piercing: true,
        }));

        // Massive screen shake
        WB.Renderer.triggerShake(15);

        // Explosion of particles
        if (WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 35, '#EEDD00');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 20, '#CC44FF');
        }

        // Big visual effects
        if (WB.GLEffects) {
            WB.GLEffects.triggerSuperFlash('#EEDD00');
            WB.GLEffects.spawnImpact(this.owner.x, this.owner.y, '#EEDD00', 100);
            WB.GLEffects.triggerHitStop(8);
        }

        // Brief invulnerability (Vegeta's pride — hold position while firing)
        this.owner.invulnerable = true;
        setTimeout(() => { this.owner.invulnerable = false; }, 500);

        this.finalFlashFired = true;
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        // Super: blue energy aura glow
        if (this.superActive) {
            B.fillCircleGlow(this.reach - 4, 0, 10, '#6644FF', 20);
        }

        // Arm (short line from ball to fist — gloved)
        B.line(r - 2, 0, this.reach - 6, 0, '#F5D5A0', 4);

        // Glove (white fighting glove)
        B.fillCircle(this.reach - 4, 0, 6, '#FFFFFF');
        B.strokeCircle(this.reach - 4, 0, 6, '#CCCCAA', 1.5);

        // Knuckle lines
        B.line(this.reach - 7, -2, this.reach - 7, 2, '#CCCCAA', 1);
        B.line(this.reach - 4, -3, this.reach - 4, 3, '#CCCCAA', 1);
        B.line(this.reach - 1, -2, this.reach - 1, 2, '#CCCCAA', 1);

        // Ki charge glow (purple)
        if (this.fireTimer > this.fireRate - 15) {
            const chargeProgress = (this.fireTimer - (this.fireRate - 15)) / 15;
            B.setAlpha(chargeProgress * 0.5);
            B.fillCircle(this.reach - 4, 0, 7 + chargeProgress * 5, '#AA66FF');
            B.restoreAlpha();
        }

        // Galick Gun charge glow (brighter purple)
        if (this.galickTimer > this.galickRate - 30) {
            const chargeProgress = (this.galickTimer - (this.galickRate - 30)) / 30;
            B.setAlpha(chargeProgress * 0.3);
            B.fillCircle(0, 0, r + chargeProgress * 8, '#CC44FF');
            B.restoreAlpha();
        }

        B.popTransform();

        // Super blue/purple aura (in world space)
        if (this.superActive) {
            const flicker = 1 + Math.sin(Date.now() * 0.012) * 0.18;

            // Outer blue aura
            B.setAlpha(0.45);
            B.strokeCircle(this.owner.x, this.owner.y, r + 7 * flicker, '#6644FF', 2.5);
            B.restoreAlpha();

            // Inner purple glow
            B.setAlpha(0.1);
            B.fillCircle(this.owner.x, this.owner.y, r + 5, '#AA66FF');
            B.restoreAlpha();

            // Electric sparks around body
            const sparkTime = Date.now() * 0.005;
            for (let i = 0; i < 3; i++) {
                const a = sparkTime + i * 2.1;
                const sparkDist = r + 4 + Math.sin(a * 3) * 5;
                const sx = this.owner.x + Math.cos(a) * sparkDist;
                const sy = this.owner.y + Math.sin(a) * sparkDist;
                B.setAlpha(0.6);
                B.fillCircle(sx, sy, 1.5, '#FFFFFF');
                B.restoreAlpha();
            }
        }
    }
}

WB.WeaponRegistry.register('vegeta', VegetaWeapon);
