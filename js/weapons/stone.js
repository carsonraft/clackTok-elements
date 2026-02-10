window.WB = window.WB || {};

// Stone (Boulder): Body-contact weapon with 1.3x size and high mass/knockback.
// Scaling: Mass value increases. Super: Landslide (2x size, +30 HP).
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
        // Landslide: grow even bigger + heal
        this.owner.radius = Math.round(WB.Config.BALL_RADIUS * 2);
        this.owner.mass *= 2;
        this.owner.hp = Math.min(this.owner.hp + 30, this.owner.maxHp + 30);
        this.owner.maxHp += 30;
        this.currentDamage += 4;
        this.scalingStat.value = this.owner.mass.toFixed(1);
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

WB.WeaponRegistry.register('stone', StoneWeapon);
