window.WB = window.WB || {};

WB.Projectile = class {
    constructor(config) {
        this.x = config.x;
        this.y = config.y;
        this.vx = config.vx;
        this.vy = config.vy;
        this.damage = config.damage || 2;
        this.owner = config.owner;
        this.ownerWeapon = config.ownerWeapon;
        this.radius = config.radius || 3;
        this.lifespan = config.lifespan || 120;
        this.bounces = config.bounces || 0;
        this.color = config.color || '#FFF';
        this.piercing = config.piercing || false;
        this.homing = config.homing || 0;          // 0 = no homing, 0.01-0.15 = gentle curve
        this.damageFalloff = config.damageFalloff || 0; // damage multiplier lost per bounce (e.g. 0.5 = 50% per bounce)
        this.gravityAffected = config.gravityAffected || false; // Wadjet venom globs arc with gravity
        this.onMiss = config.onMiss || null; // callback(x, y) when projectile dies without hitting
        this._hasHit = false;
        this.alive = true;
        this.trail = [];
        this._hitTargets = new Set();
    }

    update() {
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 4) this.trail.shift();

        this.x += this.vx;
        this.y += this.vy;
        // Gravity-affected projectiles (Wadjet venom globs) arc downward
        if (this.gravityAffected && WB.Config.GRAVITY_MODE) {
            const ga = WB.Config.GRAVITY_ANGLE;
            this.vx += Math.cos(ga) * WB.Config.GRAVITY;
            this.vy += Math.sin(ga) * WB.Config.GRAVITY;
        }
        this.lifespan--;
        if (this.lifespan <= 0) this.alive = false;

        // Homing: gently curve toward nearest enemy ball
        if (this.homing > 0 && WB.Game && WB.Game.balls) {
            let closest = null, closestDist = Infinity;
            for (const b of WB.Game.balls) {
                if (b === this.owner || !b.isAlive) continue;
                if (this.owner && b.side === this.owner.side) continue;
                const dx = b.x - this.x, dy = b.y - this.y;
                const dist = dx * dx + dy * dy;
                if (dist < closestDist) { closestDist = dist; closest = b; }
            }
            if (closest) {
                const targetAngle = Math.atan2(closest.y - this.y, closest.x - this.x);
                const currentAngle = Math.atan2(this.vy, this.vx);
                let diff = targetAngle - currentAngle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                const newAngle = currentAngle + diff * this.homing;
                const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
                this.vx = Math.cos(newAngle) * speed;
                this.vy = Math.sin(newAngle) * speed;
            }
        }

        const a = WB.Config.ARENA;
        let bounced = false;
        let bounceX = this.x, bounceY = this.y;
        if (this.x - this.radius < a.x) {
            if (this.bounces > 0) {
                this.vx = Math.abs(this.vx);
                this.x = a.x + this.radius;
                this.bounces--;
                this._hitTargets.clear();
                bounced = true; bounceX = a.x; bounceY = this.y;
            } else { this.alive = false; }
        }
        if (this.x + this.radius > a.x + a.width) {
            if (this.bounces > 0) {
                this.vx = -Math.abs(this.vx);
                this.x = a.x + a.width - this.radius;
                this.bounces--;
                this._hitTargets.clear();
                bounced = true; bounceX = a.x + a.width; bounceY = this.y;
            } else { this.alive = false; }
        }
        if (this.y - this.radius < a.y) {
            if (this.bounces > 0) {
                this.vy = Math.abs(this.vy);
                this.y = a.y + this.radius;
                this.bounces--;
                this._hitTargets.clear();
                bounced = true; bounceX = this.x; bounceY = a.y;
            } else { this.alive = false; }
        }
        if (this.y + this.radius > a.y + a.height) {
            if (this.bounces > 0) {
                this.vy = -Math.abs(this.vy);
                this.y = a.y + a.height - this.radius;
                this.bounces--;
                this._hitTargets.clear();
                bounced = true; bounceX = this.x; bounceY = a.y + a.height;
            } else { this.alive = false; }
        }
        // Apply damage falloff on bounce (e.g. Zeus bolts lose 50% per bounce)
        if (bounced && this.damageFalloff > 0) {
            this.damage = Math.max(0.5, this.damage * (1 - this.damageFalloff));
        }
        if (bounced) {
            const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            WB.Audio.wallClack(spd);
            if (WB.GLEffects) {
                WB.GLEffects.spawnWallImpact(bounceX, bounceY, spd, this.color);
            }
            if (WB.Game && WB.Game.particles) {
                WB.Game.particles.emit(bounceX, bounceY, 2, this.color);
            }
        }

        // Fire miss callback when projectile dies without hitting (Wadjet puddles)
        if (!this.alive && !this._hasHit && this.onMiss) {
            this.onMiss(this.x, this.y);
        }
    }

    checkHit(target) {
        if (target === this.owner || !target.isAlive) return false;
        if (this.owner && this.owner.side && target.side === this.owner.side) return false;
        if (this.piercing && this._hitTargets.has(target)) return false;
        if (WB.Physics.circleCircle(this.x, this.y, this.radius, target.x, target.y, target.radius)) {
            target.takeDamage(this.damage);
            if (this.ownerWeapon) {
                this.ownerWeapon.hitCount++;
                this.ownerWeapon.applyScaling();
                this.ownerWeapon.checkSuper();
            }
            if (this.piercing) {
                this._hitTargets.add(target);
            } else {
                this.alive = false;
            }
            WB.Audio.weaponHit(this.ownerWeapon ? this.ownerWeapon.hitCount : 0, this.ownerWeapon ? this.ownerWeapon.type : 'blade');

            // Track combo for projectile owner + full clacky effects
            if (this.ownerWeapon && this.ownerWeapon._onHitEffects) {
                this.ownerWeapon._onHitEffects(target, this.damage, this.color);
            } else {
                if (WB.Game && WB.Game.particles) {
                    WB.Game.particles.emit(this.x, this.y, 8, this.color);
                }
                if (WB.GLEffects) {
                    WB.GLEffects.spawnImpact(target.x, target.y, this.color, 25 + this.damage * 2);
                    WB.GLEffects.spawnDamageNumber(target.x, target.y, this.damage, this.color);
                }
            }
            // Weapon callback (e.g. Zeus ball lightning spawning)
            if (this.ownerWeapon && this.ownerWeapon.onProjectileHit) {
                this.ownerWeapon.onProjectileHit(this, target);
            }
            WB.Renderer.triggerShake(1 + this.damage * 0.15);
            this._hasHit = true;
            return true;
        }
        return false;
    }

    draw() {
        const B = WB.GLBatch;

        // Trail
        for (let i = 0; i < this.trail.length; i++) {
            const t = this.trail[i];
            const alpha = (i / this.trail.length) * 0.3;
            const scale = 0.5 + (i / this.trail.length) * 0.4;
            B.setAlpha(alpha);
            B.fillCircle(t.x, t.y, this.radius * scale, this.color);
            B.restoreAlpha();
        }

        // Projectile body
        B.fillCircle(this.x, this.y, this.radius, this.color);
        B.strokeCircle(this.x, this.y, this.radius, '#333', 1.5);
    }
};
