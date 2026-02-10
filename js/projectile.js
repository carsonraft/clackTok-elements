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
        this.alive = true;
        this.trail = [];
        this._hitTargets = new Set();
    }

    update() {
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 8) this.trail.shift();

        this.x += this.vx;
        this.y += this.vy;
        this.lifespan--;
        if (this.lifespan <= 0) this.alive = false;

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
        // CLACKY projectile bounce effects!
        if (bounced) {
            const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            WB.Audio.wallClack(spd);
            if (WB.GLEffects) {
                WB.GLEffects.spawnWallImpact(bounceX, bounceY, spd, this.color);
                if (spd >= 4) {
                    WB.Renderer.triggerShake(1 + spd * 0.3);
                    WB.GLEffects.triggerChromatic(spd * 0.02);
                }
            }
            if (WB.Game && WB.Game.particles) {
                WB.Game.particles.emit(bounceX, bounceY, 4, this.color);
            }
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
            // Extra screen shake on projectile hit
            WB.Renderer.triggerShake(2 + this.damage * 0.3);
            return true;
        }
        return false;
    }

    draw() {
        const B = WB.GLBatch;

        // Trail — longer and brighter for more visual impact
        for (let i = 0; i < this.trail.length; i++) {
            const t = this.trail[i];
            const alpha = (i / this.trail.length) * 0.5;
            const scale = 0.5 + (i / this.trail.length) * 0.4;
            B.setAlpha(alpha);
            B.fillCircle(t.x, t.y, this.radius * scale, this.color);
            B.restoreAlpha();
        }

        // Shadow
        B.fillCircle(this.x + 1, this.y + 1, this.radius, 'rgba(0,0,0,0.12)');

        // Projectile body
        B.fillCircle(this.x, this.y, this.radius, this.color);
        B.strokeCircle(this.x, this.y, this.radius, '#333', 1.5);
    }
};
