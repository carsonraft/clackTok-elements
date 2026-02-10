window.WB = window.WB || {};

// Big Muscle Ball: Massive body, huge contact damage. Grows bigger every hit.
// Super: doubles size, becomes an unstoppable juggernaut.
class MuscleWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'muscle',
            baseDamage: 4,
            rotationSpeed: 0,
            reach: 0,
            scalingName: 'Size',
            superThreshold: 8,
            canParry: false,
        });
        // Make the ball bigger and heavier
        this.owner.radius = WB.Config.BALL_RADIUS * 1.4;
        this.owner.mass = (this.owner.radius / WB.Config.BALL_RADIUS) * WB.Config.BALL_MASS * 1.5;
        this.owner.hp = 130;
        this.owner.maxHp = 130;

        this.contactCooldown = 0;
        this.contactAura = 5;
        this.growthFactor = 0;
        this.flexTimer = 0;
        this.scalingStat.value = Math.round(this.owner.radius);
    }

    update() {
        if (this.contactCooldown > 0) this.contactCooldown--;
        this.flexTimer++;

        // Muscle ball moves slower but with more force
        const speed = this.owner.getSpeed();
        const maxSpeed = this.superActive ? 12 : 7;
        if (speed > maxSpeed) {
            this.owner.vx = (this.owner.vx / speed) * maxSpeed;
            this.owner.vy = (this.owner.vy / speed) * maxSpeed;
        }

        // Gravity pull — muscle ball is like a black hole, pulls enemies in
        if (this.superActive && WB.Game && WB.Game.balls) {
            for (const target of WB.Game.balls) {
                if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                const dx = this.owner.x - target.x;
                const dy = this.owner.y - target.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 200 && dist > 0) {
                    const pull = 0.3 / Math.max(dist / 50, 1);
                    target.vx += (dx / dist) * pull;
                    target.vy += (dy / dist) * pull;
                }
            }
        }
    }

    canHit() {
        return this.contactCooldown <= 0;
    }

    onHit(target) {
        // Damage scales with size
        const sizeMult = this.owner.radius / WB.Config.BALL_RADIUS;
        const dmg = Math.floor(this.currentDamage * sizeMult);
        target.takeDamage(dmg);
        this.hitCount++;
        this.contactCooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);

        // Massive knockback
        const dx = target.x - this.owner.x;
        const dy = target.y - this.owner.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        target.vx += (dx / d) * 6 * sizeMult;
        target.vy += (dy / d) * 6 * sizeMult;

        WB.Renderer.triggerShake(4 + dmg * 0.3);

        // Full combo tracking + screen deformation + particle effects
        this._onHitEffects(target, dmg, this.owner.color);
    }

    applyScaling() {
        // Grow bigger each hit
        this.growthFactor = this.hitCount;
        const baseR = WB.Config.BALL_RADIUS * 1.4;
        this.owner.radius = baseR + this.growthFactor * 2;
        this.owner.mass = (this.owner.radius / WB.Config.BALL_RADIUS) * WB.Config.BALL_MASS * 1.5;
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.5);
        this.scalingStat.value = Math.round(this.owner.radius);
    }

    activateSuper() {
        // MASSIVE size boost
        this.owner.radius *= 1.6;
        this.owner.mass *= 2;
        this.currentDamage += 5;
        this.owner.hp = Math.min(this.owner.hp + 30, this.owner.maxHp + 30);
        this.owner.maxHp += 30;
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;
        const ox = this.owner.x;
        const oy = this.owner.y;

        // Super: red power aura
        if (this.superActive) {
            const pulse = 1 + Math.sin(this.flexTimer * 0.08) * 0.1;
            B.fillCircleGlow(ox, oy, r * pulse + 10, '#CC2200', 20);
            B.setAlpha(0.3);
            B.strokeCircle(ox, oy, r + 8 * pulse, '#FF4400', 3);
            B.restoreAlpha();
        }

        // Muscle definition lines (drawn on top of ball body)
        // Flex animation
        const flexPhase = Math.sin(this.flexTimer * 0.05) * 0.15;

        // Bicep bumps (bilateral muscle bulges)
        const bulgeSize = r * (0.2 + flexPhase);
        B.setAlpha(0.25);

        // Left bicep
        B.fillCircle(
            ox - r * 0.6,
            oy - r * 0.3,
            bulgeSize,
            '#CC6644'
        );
        // Right bicep
        B.fillCircle(
            ox + r * 0.6,
            oy - r * 0.3,
            bulgeSize,
            '#CC6644'
        );

        B.restoreAlpha();

        // Muscle lines — pec line
        B.setAlpha(0.3);
        B.line(ox, oy - r * 0.5, ox, oy + r * 0.1, '#8B4513', 2);
        // Ab lines
        B.line(ox - r * 0.3, oy + r * 0.1, ox + r * 0.3, oy + r * 0.1, '#8B4513', 1.5);
        B.line(ox - r * 0.25, oy + r * 0.35, ox + r * 0.25, oy + r * 0.35, '#8B4513', 1.5);
        B.restoreAlpha();

        // Angry eyebrows
        B.line(ox - r * 0.35, oy - r * 0.25, ox - r * 0.1, oy - r * 0.15, '#333', 2.5);
        B.line(ox + r * 0.35, oy - r * 0.25, ox + r * 0.1, oy - r * 0.15, '#333', 2.5);

        // Angry eyes
        B.fillCircle(ox - r * 0.22, oy - r * 0.05, r * 0.08, '#FFF');
        B.fillCircle(ox + r * 0.22, oy - r * 0.05, r * 0.08, '#FFF');
        B.fillCircle(ox - r * 0.22, oy - r * 0.05, r * 0.04, '#111');
        B.fillCircle(ox + r * 0.22, oy - r * 0.05, r * 0.04, '#111');

        // Gritted teeth
        B.setAlpha(0.8);
        B.fillRect(ox - r * 0.2, oy + r * 0.15, r * 0.4, r * 0.12, '#FFF');
        B.line(ox - r * 0.1, oy + r * 0.15, ox - r * 0.1, oy + r * 0.27, '#CCC', 1);
        B.line(ox, oy + r * 0.15, ox, oy + r * 0.27, '#CCC', 1);
        B.line(ox + r * 0.1, oy + r * 0.15, ox + r * 0.1, oy + r * 0.27, '#CCC', 1);
        B.restoreAlpha();

        // Vein (throbbing line on forehead)
        if (this.superActive || this.hitCount > 3) {
            const veinPulse = 0.5 + Math.sin(this.flexTimer * 0.12) * 0.3;
            B.setAlpha(veinPulse);
            B.line(ox - r * 0.15, oy - r * 0.45, ox + r * 0.05, oy - r * 0.35, '#CC3333', 1.5);
            B.line(ox + r * 0.05, oy - r * 0.35, ox + r * 0.2, oy - r * 0.42, '#CC3333', 1.5);
            B.restoreAlpha();
        }

        // Ground impact circles when super
        if (this.superActive && this.flexTimer % 20 < 5) {
            B.setAlpha(0.15);
            B.strokeCircle(ox, oy, r + 15 + (this.flexTimer % 20) * 3, '#CC2200', 2);
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('muscle', MuscleWeapon);
