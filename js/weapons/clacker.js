window.WB = window.WB || {};

// Clacker Ball: Newton's Cradle inspired. Fires steel balls that bounce off walls with
// massive clacks. Melee swing is a pendulum chain of balls. Every collision produces
// stacked percussive pops. Super: fires a chain of 5 clacker balls in rapid succession.
class ClackerWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'clacker',
            baseDamage: 3,
            rotationSpeed: 0.04,
            reach: 36,
            scalingName: 'Clacks',
            superThreshold: 10,
            isRanged: false,
        });
        this.clackCount = 0;      // Total clacks generated — the REAL stat
        this.fireTimer = 0;
        this.fireRate = 100;       // Fires a clacker ball periodically
        this.ballsInFlight = 0;    // Track active clacker projectiles
        this.chainPhase = 0;       // Animation: pendulum swing phase
        this.scalingStat.value = this.clackCount;
    }

    update() {
        super.update();
        this.fireTimer++;
        this.chainPhase += 0.06;

        if (this.fireTimer >= this.fireRate) {
            this.fireClackerBall();
            this.fireTimer = 0;
        }
    }

    fireClackerBall() {
        if (!WB.Game || !WB.Game.projectiles) return;

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

        const speed = 8;
        const damage = 2 + Math.floor(this.hitCount * 0.3);
        WB.Game.projectiles.push(new WB.Projectile({
            x: this.owner.x + Math.cos(fireAngle) * (this.owner.radius + 8),
            y: this.owner.y + Math.sin(fireAngle) * (this.owner.radius + 8),
            vx: Math.cos(fireAngle) * speed,
            vy: Math.sin(fireAngle) * speed,
            damage: damage,
            owner: this.owner,
            ownerWeapon: this,
            radius: 6,
            lifespan: 120,       // Long-lived — bounces around a LOT
            bounces: 4 + Math.min(this.hitCount, 6),  // MANY bounces
            color: '#C0C0C0',
        }));

        // Clacker launch sound — sharp metallic click
        WB.Audio.projectileFire();
        this._clack(0.3);
        this.ballsInFlight++;
    }

    _clack(intensity) {
        this.clackCount++;
        this.scalingStat.value = this.clackCount;

        // Screen shake proportional to intensity
        WB.Renderer.triggerShake(2 + intensity * 4);

        // Clack effects
        if (WB.GLEffects) {
            if (intensity >= 0.5) {
                WB.GLEffects.triggerChromatic(intensity * 0.15);
            }
            if (intensity >= 0.8) {
                WB.GLEffects.triggerShockwave(this.owner.x, this.owner.y, intensity * 0.1);
            }
        }
    }

    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);

        // EXTRA clack on melee hit — the pendulum ball transfers energy
        this._clack(0.6);

        // Knockback — solid metallic impact
        const dx = target.x - this.owner.x;
        const dy = target.y - this.owner.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        target.vx += (dx / d) * 4.5;
        target.vy += (dy / d) * 4.5;

        // Full combo tracking + screen deformation + particle effects
        this._onHitEffects(target, this.currentDamage, '#C0C0C0');
    }

    applyScaling() {
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.4);
        // Fire rate improves — more clacker balls flying around
        this.fireRate = Math.max(50, 100 - this.hitCount * 5);
        this.scalingStat.value = this.clackCount;
    }

    activateSuper() {
        // CHAIN REACTION — fire 5 clacker balls in rapid succession!
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                this.fireClackerBall();
                this._clack(1.0);
                WB.Audio.comboClack(5 + i);
            }, i * 80);
        }

        // Permanent boosts
        this.currentDamage += 3;
        this.fireRate = Math.max(35, this.fireRate - 20);

        WB.Renderer.triggerShake(20);
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 30, '#C0C0C0');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 20, '#FFD700');
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        // Super glow
        if (this.superActive) {
            B.fillCircleGlow(this.reach - 4, 0, 12, '#FFD700', 20);
        }

        // Chain/string from ball to pendulum
        B.line(r - 4, 0, this.reach - 8, 0, '#888', 1.5);

        // Secondary chain offset by pendulum phase
        const pendulumOffset = Math.sin(this.chainPhase) * 3;
        B.line(r - 4, pendulumOffset, this.reach - 8, pendulumOffset * 0.5, '#666', 1);

        // Clacker ball at tip — shiny steel sphere
        B.fillCircle(this.reach - 4, 0, 7, '#D4D4D4');
        B.strokeCircle(this.reach - 4, 0, 7, '#999', 1.5);
        // Specular highlight dot
        B.setAlpha(0.7);
        B.fillCircle(this.reach - 6, -2, 2, '#FFF');
        B.restoreAlpha();

        // Second pendulum ball (slightly behind, for Newton's Cradle look)
        const swing = Math.sin(this.chainPhase * 0.8 + 0.5) * 4;
        B.setAlpha(0.6);
        B.fillCircle(this.reach * 0.65, swing, 5, '#BEBEBE');
        B.strokeCircle(this.reach * 0.65, swing, 5, '#888', 1);
        B.restoreAlpha();

        B.popTransform();

        // Super aura — metallic shimmer
        if (this.superActive) {
            const flicker = 1 + Math.sin(Date.now() * 0.008) * 0.12;
            B.setAlpha(0.35);
            B.strokeCircle(this.owner.x, this.owner.y, r + 6 * flicker, '#FFD700', 2);
            B.restoreAlpha();
            B.setAlpha(0.08);
            B.fillCircle(this.owner.x, this.owner.y, r + 4, '#C0C0C0');
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('clacker', ClackerWeapon);
