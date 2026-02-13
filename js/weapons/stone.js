window.WB = window.WB || {};

// Stone (Boulder): Body-contact weapon with 1.3x size and high mass/knockback.
// Scaling: Mass value increases.
// Super (Crystal Shards: Stone+Stone → Ultra Stone): Become a COLOSSAL boulder —
// 2.5x size, near-immovable mass, earthquake stomp that damages nearby enemies!
class StoneWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'stone',
            baseDamage: 4,
            rotationSpeed: 0,
            reach: 0,
            scalingName: 'Mass',
            superThreshold: 10,
            canParry: false,
        });
        this.contactCooldown = 0;
        // Enlarge the ball — stone is THICC
        this.owner.radius = Math.round(WB.Config.BALL_RADIUS * 1.3);
        this.owner.mass = (this.owner.radius / WB.Config.BALL_RADIUS) * WB.Config.BALL_MASS * 1.5;
        this.scalingStat.value = this.owner.mass.toFixed(1);
    }

    update() {
        if (this.contactCooldown > 0) this.contactCooldown--;
        // Super: earthquake stomp — periodic ground pound damages nearby
        if (this.superActive && WB.Game && WB.Game.balls) {
            if (!this._stompTimer) this._stompTimer = 0;
            this._stompTimer++;
            if (this._stompTimer % 50 === 0) {
                const quakeRadius = this.owner.radius + 40;
                for (const target of WB.Game.balls) {
                    if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                    const dx = target.x - this.owner.x;
                    const dy = target.y - this.owner.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < quakeRadius) {
                        target.takeDamage(3);
                        // Bounce target up (push away)
                        if (dist > 0) {
                            target.vx += (dx / dist) * 5;
                            target.vy += (dy / dist) * 5;
                        }
                        if (WB.GLEffects) {
                            WB.GLEffects.spawnDamageNumber(target.x, target.y, 3, '#8B7355');
                        }
                    }
                }
                WB.Renderer.triggerShake(6);
                if (WB.Game.particles) {
                    WB.Game.particles.explode(this.owner.x, this.owner.y, 12, '#8B7355');
                }
            }
        }
    }

    canHit() {
        return this.contactCooldown <= 0;
    }

    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.contactCooldown = WB.Config.WEAPON_HIT_COOLDOWN;

        // Heavy knockback — boulder sends targets flying
        const dx = target.x - this.owner.x;
        const dy = target.y - this.owner.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const knockback = 4 + this.owner.mass;
        target.vx += (dx / dist) * knockback;
        target.vy += (dy / dist) * knockback;

        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);
        this._onHitEffects(target, this.currentDamage, '#8B7355');

        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.emit(target.x, target.y, 10, '#8B7355');
        }
    }

    applyScaling() {
        this.owner.mass = (this.owner.radius / WB.Config.BALL_RADIUS) * WB.Config.BALL_MASS * (1.5 + this.hitCount * 0.15);
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.5);
        this.scalingStat.value = this.owner.mass.toFixed(1);
    }

    activateSuper() {
        // Crystal Shards: Stone+Stone → ULTRA STONE!
        // Become colossal — 2.5x size, immovable mass, earthquake stomp
        this.owner.radius = Math.round(WB.Config.BALL_RADIUS * 2.5);
        this.owner.mass *= 4;
        this.owner.hp = Math.min(this.owner.hp + 40, this.owner.maxHp + 40);
        this.owner.maxHp += 40;
        this.currentDamage += 6;
        this._stompTimer = 0;
        this.scalingStat.value = this.owner.mass.toFixed(1);
        // Ground-pound burst on activation
        if (WB.Game && WB.Game.balls) {
            for (const target of WB.Game.balls) {
                if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                target.takeDamage(6);
                const dx = target.x - this.owner.x;
                const dy = target.y - this.owner.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                target.vx += (dx / dist) * 8;
                target.vy += (dy / dist) * 8;
            }
        }
        WB.Renderer.triggerShake(12);
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 25, '#8B7355');
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        // Rocky texture overlay — craggy bumps
        B.setAlpha(0.15);
        B.fillCircle(this.owner.x - r * 0.3, this.owner.y - r * 0.2, r * 0.4, '#6B5335');
        B.fillCircle(this.owner.x + r * 0.4, this.owner.y + r * 0.1, r * 0.3, '#5A4228');
        B.restoreAlpha();

        // Crack lines
        B.setAlpha(0.3);
        B.line(
            this.owner.x - r * 0.4, this.owner.y - r * 0.3,
            this.owner.x + r * 0.1, this.owner.y + r * 0.2,
            '#5A4030', 1.5
        );
        B.line(
            this.owner.x + r * 0.2, this.owner.y - r * 0.4,
            this.owner.x + r * 0.3, this.owner.y + r * 0.1,
            '#5A4030', 1
        );
        B.restoreAlpha();

        // Super: earthquake ring
        if (this.superActive) {
            const pulse = 0.1 + Math.sin(Date.now() * 0.005) * 0.05;
            B.setAlpha(pulse);
            B.strokeCircle(this.owner.x, this.owner.y, r + 10, '#8B7355', 3);
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('stone', StoneWeapon, 'elemental');
