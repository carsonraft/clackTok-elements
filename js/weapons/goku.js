window.WB = window.WB || {};

// Goku: Ki-based hybrid fighter. Fires ki blasts + melee punches.
// Mid-fight Kaioken boost at 5 hits. Super: Kamehameha beam (massive).
class GokuWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'goku',
            baseDamage: 3,          // Buffed from 2 — Goku hits harder
            rotationSpeed: 0.035,   // Slightly faster weapon rotation
            reach: 38,              // Slightly longer reach
            scalingName: 'Power Lvl',
            superThreshold: 10,
            isRanged: false,
        });
        this.powerLevel = 1;
        this.kiDamage = 3;          // Buffed from 2
        this.fireTimer = 0;
        this.fireRate = 75;         // Buffed from 90 — closer to Vegeta's 70
        this.kamehamehaFired = false;
        this.kaiokenActive = false;
        this.kaiokenThreshold = 5;  // Kaioken activates at 5 hits
        this.instantTransmissionCooldown = 0;
        this.scalingStat.value = this.powerLevel;
    }

    update() {
        super.update();
        this.fireTimer++;
        if (this.instantTransmissionCooldown > 0) this.instantTransmissionCooldown--;

        if (this.fireTimer >= this.fireRate) {
            this.fireKiBlast();
            this.fireTimer = 0;
        }

        // Instant Transmission — teleport behind opponent occasionally
        if (this.kaiokenActive && this.instantTransmissionCooldown <= 0) {
            this._tryInstantTransmission();
        }
    }

    _tryInstantTransmission() {
        if (!WB.Game || !WB.Game.balls) return;
        // Only trigger when close enough and with some randomness
        const enemy = WB.Game.balls.find(b => b !== this.owner && b.isAlive && b.side !== this.owner.side);
        if (!enemy) return;
        const dx = enemy.x - this.owner.x;
        const dy = enemy.y - this.owner.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Teleport when at medium range with 1% chance per frame
        if (dist > 100 && dist < 300 && WB.random() < 0.01) {
            // Teleport behind enemy
            const behind = -1;
            const newX = enemy.x + (dx / dist) * behind * (enemy.radius + this.owner.radius + 10);
            const newY = enemy.y + (dy / dist) * behind * (enemy.radius + this.owner.radius + 10);
            // Clamp to arena
            const a = WB.Config.ARENA;
            this.owner.x = Math.max(a.x + this.owner.radius, Math.min(a.x + a.width - this.owner.radius, newX));
            this.owner.y = Math.max(a.y + this.owner.radius, Math.min(a.y + a.height - this.owner.radius, newY));
            // Boost toward enemy
            this.owner.vx = -(dx / dist) * 6;
            this.owner.vy = -(dy / dist) * 6;

            this.instantTransmissionCooldown = 180; // 3 second cooldown

            // Vanish particles at old position and appear particles at new
            if (WB.Game.particles) {
                WB.Game.particles.emit(this.owner.x, this.owner.y, 8, '#FFD700');
            }
            // Small chromatic burst on teleport
            if (WB.GLEffects) {
                WB.GLEffects.triggerChromatic(0.2);
            }
        }
    }

    fireKiBlast() {
        if (!WB.Game || !WB.Game.projectiles) return;
        const speed = 7;    // Buffed from 6
        const radius = this.kaiokenActive ? 5 : 4;

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

        const color = this.kaiokenActive ? '#FF4444' : '#FFDD44';

        WB.Game.projectiles.push(new WB.Projectile({
            x: this.owner.x + Math.cos(fireAngle) * (this.owner.radius + 5),
            y: this.owner.y + Math.sin(fireAngle) * (this.owner.radius + 5),
            vx: Math.cos(fireAngle) * speed,
            vy: Math.sin(fireAngle) * speed,
            damage: this.kiDamage,
            owner: this.owner,
            ownerWeapon: this,
            radius: radius,
            lifespan: 80,
            bounces: 0,
            color: color,
        }));
        WB.Audio.projectileFire();

        // Kaioken: fire a second blast at slight angle
        if (this.kaiokenActive && WB.random() < 0.4) {
            const offsetAngle = fireAngle + (WB.random() - 0.5) * 0.3;
            WB.Game.projectiles.push(new WB.Projectile({
                x: this.owner.x + Math.cos(offsetAngle) * (this.owner.radius + 5),
                y: this.owner.y + Math.sin(offsetAngle) * (this.owner.radius + 5),
                vx: Math.cos(offsetAngle) * speed * 0.9,
                vy: Math.sin(offsetAngle) * speed * 0.9,
                damage: Math.floor(this.kiDamage * 0.6),
                owner: this.owner,
                ownerWeapon: this,
                radius: 3,
                lifespan: 60,
                bounces: 0,
                color: '#FF6644',
            }));
        }
    }

    onHit(target) {
        const dmg = this.kaiokenActive ? Math.floor(this.currentDamage * 1.5) : this.currentDamage;
        target.takeDamage(dmg);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();

        // Check Kaioken activation
        if (!this.kaiokenActive && this.hitCount >= this.kaiokenThreshold) {
            this._activateKaioken();
        }

        WB.Audio.weaponHit(this.hitCount, this.type);

        // Strong knockback (buffed from 3 to match Vegeta)
        const dx = target.x - this.owner.x;
        const dy = target.y - this.owner.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        target.vx += (dx / d) * 4;
        target.vy += (dy / d) * 4;

        // Full combo tracking + screen deformation + particle effects
        const color = this.kaiokenActive ? '#FF4444' : '#FFDD44';
        this._onHitEffects(target, dmg, color);
    }

    _activateKaioken() {
        this.kaiokenActive = true;
        // Kaioken boost — mid-fight power spike
        this.currentDamage += 2;
        this.kiDamage += 2;
        this.fireRate = Math.max(40, this.fireRate - 20);
        this.owner.vx *= 1.5;
        this.owner.vy *= 1.5;

        // Visual burst
        WB.Renderer.triggerShake(8);
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 15, '#FF4444');
        }
        if (WB.GLEffects) {
            WB.GLEffects.spawnImpact(this.owner.x, this.owner.y, '#FF4444', 50);
            WB.GLEffects.triggerChromatic(0.4);
            WB.GLEffects.triggerShockwave(this.owner.x, this.owner.y, 0.3);
        }
    }

    applyScaling() {
        this.powerLevel = 1 + this.hitCount;
        this.kiDamage = 3 + this.hitCount;   // Buffed base from 2 to 3
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.5);
        this.scalingStat.value = this.powerLevel;
    }

    activateSuper() {
        // Kamehameha beam — BIGGER and STRONGER than before
        this.fireKamehameha();
        // Permanent boosts
        this.fireRate = 35;          // Buffed from 50
        this.kiDamage += 5;          // Buffed from 3
        this.currentDamage += 3;     // Buffed from 2
    }

    fireKamehameha() {
        if (!WB.Game || !WB.Game.projectiles) return;

        let fireAngle = this.angle;
        if (WB.Game.balls) {
            const enemy = WB.Game.balls.find(b => b !== this.owner && b.isAlive && b.side !== this.owner.side);
            if (enemy) {
                fireAngle = Math.atan2(enemy.y - this.owner.y, enemy.x - this.owner.x);
            }
        }

        const speed = 11;
        // Main beam — bigger, stronger
        WB.Game.projectiles.push(new WB.Projectile({
            x: this.owner.x + Math.cos(fireAngle) * (this.owner.radius + 8),
            y: this.owner.y + Math.sin(fireAngle) * (this.owner.radius + 8),
            vx: Math.cos(fireAngle) * speed,
            vy: Math.sin(fireAngle) * speed,
            damage: 20 + this.hitCount * 2,   // Buffed from 15
            owner: this.owner,
            ownerWeapon: this,
            radius: 10,                        // Buffed from 8
            lifespan: 70,                      // Buffed from 60
            bounces: 0,
            color: '#44CCFF',
            piercing: true,
        }));

        // Secondary energy wave behind the main beam
        setTimeout(() => {
            if (!WB.Game || !WB.Game.projectiles) return;
            WB.Game.projectiles.push(new WB.Projectile({
                x: this.owner.x + Math.cos(fireAngle) * (this.owner.radius + 5),
                y: this.owner.y + Math.sin(fireAngle) * (this.owner.radius + 5),
                vx: Math.cos(fireAngle) * speed * 0.8,
                vy: Math.sin(fireAngle) * speed * 0.8,
                damage: 8 + this.hitCount,
                owner: this.owner,
                ownerWeapon: this,
                radius: 6,
                lifespan: 50,
                bounces: 0,
                color: '#88DDFF',
                piercing: true,
            }));
        }, 100);

        // Massive screen shake for the beam
        WB.Renderer.triggerShake(15);

        // Explosion of particles
        if (WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 30, '#44CCFF');
        }

        // Screen deformation
        if (WB.GLEffects) {
            WB.GLEffects.triggerShockwave(this.owner.x, this.owner.y, 0.5);
            WB.GLEffects.triggerChromatic(0.6);
        }

        this.kamehamehaFired = true;
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        // Kaioken/Super aura glow on fist
        if (this.superActive) {
            B.fillCircleGlow(this.reach - 4, 0, 10, '#FFD700', 20);
        } else if (this.kaiokenActive) {
            B.fillCircleGlow(this.reach - 4, 0, 8, '#FF4444', 15);
        }

        // Arm
        const armColor = this.kaiokenActive ? '#FFBBAA' : '#F5D5A0';
        B.line(r - 2, 0, this.reach - 6, 0, armColor, 4);

        // Fist
        B.fillCircle(this.reach - 4, 0, 6, armColor);
        B.strokeCircle(this.reach - 4, 0, 6, this.kaiokenActive ? '#CC6644' : '#C9A55A', 1.5);

        // Knuckle lines
        const knuckleColor = this.kaiokenActive ? '#CC6644' : '#C9A55A';
        B.line(this.reach - 7, -2, this.reach - 7, 2, knuckleColor, 1);
        B.line(this.reach - 4, -3, this.reach - 4, 3, knuckleColor, 1);
        B.line(this.reach - 1, -2, this.reach - 1, 2, knuckleColor, 1);

        // Ki charge glow
        if (this.fireTimer > this.fireRate - 20) {
            const chargeProgress = (this.fireTimer - (this.fireRate - 20)) / 20;
            const chargeColor = this.kaiokenActive ? '#FF4444' : '#FFDD44';
            B.setAlpha(chargeProgress * 0.4);
            B.fillCircle(this.reach - 4, 0, 8 + chargeProgress * 6, chargeColor);
            B.restoreAlpha();
        }

        B.popTransform();

        // Aura (world space)
        if (this.superActive) {
            // Golden Super Saiyan aura
            const flicker = 1 + Math.sin(Date.now() * 0.01) * 0.15;
            B.setAlpha(0.5);
            B.strokeCircle(this.owner.x, this.owner.y, r + 6 * flicker, '#FFD700', 2);
            B.restoreAlpha();
            B.setAlpha(0.08);
            B.fillCircle(this.owner.x, this.owner.y, r + 4, '#FFD700');
            B.restoreAlpha();
        } else if (this.kaiokenActive) {
            // Red Kaioken aura
            const flicker = 1 + Math.sin(Date.now() * 0.012) * 0.2;
            B.setAlpha(0.45);
            B.strokeCircle(this.owner.x, this.owner.y, r + 5 * flicker, '#FF4444', 2.5);
            B.restoreAlpha();
            B.setAlpha(0.06);
            B.fillCircle(this.owner.x, this.owner.y, r + 3, '#FF4444');
            B.restoreAlpha();
            // Red energy sparks
            const sparkTime = Date.now() * 0.006;
            for (let i = 0; i < 2; i++) {
                const a = sparkTime + i * 3.14;
                const sparkDist = r + 3 + Math.sin(a * 2) * 4;
                const sx = this.owner.x + Math.cos(a) * sparkDist;
                const sy = this.owner.y + Math.sin(a) * sparkDist;
                B.setAlpha(0.5);
                B.fillCircle(sx, sy, 1.5, '#FF6644');
                B.restoreAlpha();
            }
        }
    }
}

WB.WeaponRegistry.register('goku', GokuWeapon);
