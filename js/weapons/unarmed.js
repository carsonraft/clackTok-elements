window.WB = window.WB || {};

// Unarmed: No weapon - damage scales with speed. Max speed increases per hit.
// Super: Unaffected by speed cap, faster acceleration, glowing white.
class UnarmedWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'unarmed',
            baseDamage: 1,
            rotationSpeed: 0,
            reach: 0,
            scalingName: 'Max Spd',
            superThreshold: 8,
        });
        this.maxSpeedBonus = 0;
        this.canParry = false;
        this.scalingStat.value = WB.Config.BALL_MAX_SPEED;
        this.contactCooldown = 0;
    }

    update() {
        if (this.contactCooldown > 0) this.contactCooldown--;
        // Apply max speed bonus to owner
        const baseMax = WB.Config.BALL_MAX_SPEED;
        const boostedMax = baseMax + this.maxSpeedBonus;
        const speed = this.owner.getSpeed();
        if (speed > boostedMax && !this.superActive) {
            this.owner.vx = (this.owner.vx / speed) * boostedMax;
            this.owner.vy = (this.owner.vy / speed) * boostedMax;
        }
    }

    // Unarmed deals damage on ball-body collision (checked in main.js)
    canHit() {
        return this.contactCooldown <= 0;
    }

    onHit(target) {
        // Damage = speed * multiplier
        const speed = this.owner.getSpeed();
        const dmg = Math.max(1, Math.floor(speed * 0.8));
        target.takeDamage(dmg);
        this.hitCount++;
        this.contactCooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);

        // Knockback: push target away
        const dx = target.x - this.owner.x;
        const dy = target.y - this.owner.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        target.vx += (dx / dist) * 3;
        target.vy += (dy / dist) * 3;

        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.emit(
                (this.owner.x + target.x) / 2,
                (this.owner.y + target.y) / 2,
                10, this.owner.color
            );
        }
    }

    applyScaling() {
        this.maxSpeedBonus = this.hitCount * 1.5;
        this.scalingStat.value = Math.round(WB.Config.BALL_MAX_SPEED + this.maxSpeedBonus);
    }

    activateSuper() {
        // Remove speed cap entirely
        this.maxSpeedBonus = 100;
        // Speed boost
        const speed = this.owner.getSpeed();
        if (speed > 0) {
            this.owner.vx *= 1.5;
            this.owner.vy *= 1.5;
        }
    }

    getScalingDisplay() {
        return `Max Spd: ${this.scalingStat.value}`;
    }

    draw() {
        const B = WB.GLBatch;
        // Unarmed has no weapon visual, but draw fist indicators
        const r = this.owner.radius;
        const speed = this.owner.getSpeed();

        if (this.superActive) {
            // Glowing aura
            B.strokeCircleGlow(this.owner.x, this.owner.y, r + 6, '#FFFFFF', 3, 20);
            B.strokeCircle(this.owner.x, this.owner.y, r + 6, 'rgba(255,255,255,0.6)', 3);
        }

        // Speed lines when moving fast
        if (speed > 3) {
            const angle = Math.atan2(this.owner.vy, this.owner.vx);
            const lineCount = Math.min(5, Math.floor(speed));
            const lineColor = `rgba(255,255,255,${Math.min(0.5, speed * 0.06)})`;
            for (let i = 0; i < lineCount; i++) {
                const offset = (i - lineCount / 2) * 6;
                const backAngle = angle + Math.PI;
                const startX = this.owner.x + Math.cos(backAngle) * (r + 5) + Math.cos(angle + Math.PI / 2) * offset;
                const startY = this.owner.y + Math.sin(backAngle) * (r + 5) + Math.sin(angle + Math.PI / 2) * offset;
                B.line(startX, startY, startX + Math.cos(backAngle) * (speed * 3), startY + Math.sin(backAngle) * (speed * 3), lineColor, 2);
            }
        }
    }
}

WB.WeaponRegistry.register('unarmed', UnarmedWeapon);
