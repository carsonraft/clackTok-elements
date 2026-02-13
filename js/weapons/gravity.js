window.WB = window.WB || {};

// Gravity Well: A dense black hole with an orbiting moon that delivers massive knockback.
// The gravity well creates a visible purple gradient and passively pulls nearby enemies inward.
// Scaling: Pull strength, orbit speed, and knockback increase per hit.
// Super (Singularity): Second moon spawns, well radius doubles, extreme pull yanks enemies in.
class GravityWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'gravity',
            baseDamage: 3,
            rotationSpeed: 0,    // we handle orbit manually
            reach: 55,           // orbit radius (for weapon wall bounce)
            scalingName: 'Pull',
            superThreshold: 10,
            canParry: false,
        });
        // Shrink and densify — it's a black hole
        this.owner.radius = Math.round(WB.Config.BALL_RADIUS * 0.7);
        this.owner.mass = (this.owner.radius / WB.Config.BALL_RADIUS) * WB.Config.BALL_MASS * 2.0;
        // Extra HP to compensate for small size and no parry
        this.owner.hp = Math.round(WB.Config.BALL_MAX_HP * 1.2);
        this.owner.maxHp = this.owner.hp;

        // Moon orbit
        this.orbitAngle = WB.random() * Math.PI * 2;
        this.orbitSpeed = 0.07;
        this.orbitRadius = 55;
        this.moonRadius = 10;      // visual + collision
        this.moonCount = 1;
        this.moonCooldowns = [0];

        // Gravity well
        this.wellRadius = 100;
        this.pullStrength = 0.4;
        this.pullTimer = 0;
        this.knockback = 8;

        // Visual timers
        this.wellTimer = 0;
        // Moon trail (store last few positions for afterimage)
        this.moonTrails = [[]];

        this.scalingStat.value = this.pullStrength.toFixed(1);
    }

    update() {
        this.orbitAngle += this.orbitSpeed;
        this.wellTimer++;
        this.pullTimer++;

        // Moon cooldowns
        for (let i = 0; i < this.moonCooldowns.length; i++) {
            if (this.moonCooldowns[i] > 0) this.moonCooldowns[i]--;
        }

        // Store moon trail positions (for afterimage effect)
        for (let m = 0; m < this.moonCount; m++) {
            if (!this.moonTrails[m]) this.moonTrails[m] = [];
            const pos = this._getMoonPos(m);
            this.moonTrails[m].push({ x: pos.x, y: pos.y });
            if (this.moonTrails[m].length > 5) this.moonTrails[m].shift();
        }

        // Moon collision against enemy balls
        if (WB.Game && WB.Game.balls) {
            for (let m = 0; m < this.moonCount; m++) {
                if (this.moonCooldowns[m] > 0) continue;
                const moon = this._getMoonPos(m);
                for (const target of WB.Game.balls) {
                    if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                    if (WB.Physics.circleCircle(moon.x, moon.y, this.moonRadius, target.x, target.y, target.radius)) {
                        this._moonHit(target, moon, m);
                        break;
                    }
                }
            }
        }

        // Gravity pull — every 12 frames, gently tug nearby enemies toward the well
        if (this.pullTimer >= 12 && WB.Game && WB.Game.balls) {
            this.pullTimer = 0;
            for (const target of WB.Game.balls) {
                if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                const dx = this.owner.x - target.x;
                const dy = this.owner.y - target.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < this.wellRadius && dist > 0) {
                    // Stronger when closer (inverse distance within well)
                    const pull = this.pullStrength * (1 - dist / this.wellRadius);
                    target.vx += (dx / dist) * pull;
                    target.vy += (dy / dist) * pull;
                }
            }
        }

        // Super (Singularity): speed boost to keep the dense ball mobile
        if (this.superActive && this.wellTimer % 30 === 0) {
            const speed = Math.sqrt(this.owner.vx * this.owner.vx + this.owner.vy * this.owner.vy);
            if (speed < 4) {
                // Gentle nudge in a random-ish direction to stay active
                const nudgeAngle = this.orbitAngle;
                this.owner.vx += Math.cos(nudgeAngle) * 1.5;
                this.owner.vy += Math.sin(nudgeAngle) * 1.5;
            }
        }
    }

    _getMoonPos(index) {
        const offset = (index / this.moonCount) * Math.PI * 2;
        const angle = this.orbitAngle + offset;
        return {
            x: this.owner.x + Math.cos(angle) * this.orbitRadius,
            y: this.owner.y + Math.sin(angle) * this.orbitRadius,
        };
    }

    _moonHit(target, moonPos, moonIndex) {
        target.takeDamage(this.currentDamage);

        // MASSIVE knockback — gravitational slingshot!
        // Direction: away from the owner (outward from the well)
        const dx = target.x - this.owner.x;
        const dy = target.y - this.owner.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        target.vx += (dx / dist) * this.knockback;
        target.vy += (dy / dist) * this.knockback;

        this.hitCount++;
        this.moonCooldowns[moonIndex] = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);
        if (WB.Game._excitement) WB.Game._excitement.recordHit();

        // Hit effects (combo, particles, screen deformation)
        this._onHitEffects(target, this.currentDamage, '#7733BB');

        // Extra slingshot particles at moon position
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.emit(moonPos.x, moonPos.y, 8, '#9955DD');
        }

        // Screen shake proportional to knockback
        WB.Renderer.triggerShake(4 + this.knockback * 0.4);
    }

    canHit() { return false; } // Moon handles its own collision

    applyScaling() {
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.4);
        this.orbitSpeed = Math.min(0.12, 0.05 + this.hitCount * 0.005);
        this.pullStrength = Math.min(1.5, 0.4 + this.hitCount * 0.1);
        this.knockback = Math.min(14, 8 + this.hitCount * 0.5);
        this.scalingStat.value = this.pullStrength.toFixed(1);
    }

    activateSuper() {
        // SINGULARITY! Double gravity, two moons, extreme knockback
        this.wellRadius = 200;
        this.pullStrength *= 3;
        this.knockback += 6;
        this.orbitSpeed *= 1.5;
        this.currentDamage += 4;

        // Second moon
        this.moonCount = 2;
        this.moonCooldowns.push(0);
        this.moonTrails.push([]);

        // Owner becomes even denser — smaller and heavier
        this.owner.radius = Math.round(WB.Config.BALL_RADIUS * 0.5);
        this.owner.mass *= 2;

        // Singularity pull — yank everyone toward the black hole
        if (WB.Game && WB.Game.balls) {
            for (const target of WB.Game.balls) {
                if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                const dx = this.owner.x - target.x;
                const dy = this.owner.y - target.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                target.vx += (dx / dist) * 7;
                target.vy += (dy / dist) * 7;
                target.takeDamage(8);
                if (WB.GLEffects) {
                    WB.GLEffects.spawnDamageNumber(target.x, target.y, 8, '#7733BB');
                }
            }
        }

        // Visual burst
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 30, '#7733BB');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 15, '#220044');
        }
    }

    getTipX() { return this._getMoonPos(0).x; }
    getTipY() { return this._getMoonPos(0).y; }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        // === GRAVITY WELL GRADIENT ===
        // Concentric translucent purple rings — fading outward
        const pulse = 1 + Math.sin(this.wellTimer * 0.03) * 0.15;
        const rings = [
            { frac: 1.0, alpha: 0.03, color: '#220044' },
            { frac: 0.7, alpha: 0.05, color: '#330066' },
            { frac: 0.5, alpha: 0.08, color: '#440088' },
            { frac: 0.3, alpha: 0.12, color: '#6622AA' },
        ];
        for (const ring of rings) {
            const ringRadius = this.wellRadius * ring.frac * pulse;
            B.setAlpha(ring.alpha);
            B.fillCircle(this.owner.x, this.owner.y, ringRadius, ring.color);
            B.restoreAlpha();
        }

        // Well boundary ring (subtle)
        B.setAlpha(0.06 + Math.sin(this.wellTimer * 0.05) * 0.02);
        B.strokeCircle(this.owner.x, this.owner.y, this.wellRadius * pulse, '#6622AA', 1);
        B.restoreAlpha();

        // Super state: brighter pulsing boundary
        if (this.superActive) {
            const superPulse = 0.1 + Math.sin(this.wellTimer * 0.08) * 0.05;
            B.setAlpha(superPulse);
            B.strokeCircle(this.owner.x, this.owner.y, this.wellRadius * pulse, '#9955DD', 2);
            B.restoreAlpha();
            // Inner singularity glow
            B.setAlpha(0.2);
            B.fillCircle(this.owner.x, this.owner.y, r + 4, '#110022');
            B.restoreAlpha();
        }

        // === BLACK HOLE OVERLAY ===
        // Dark inner glow on top of the ball — makes it look like a void
        B.setAlpha(0.35);
        B.fillCircle(this.owner.x, this.owner.y, r + 2, '#110022');
        B.restoreAlpha();

        // Event horizon ring
        B.setAlpha(0.25);
        B.strokeCircle(this.owner.x, this.owner.y, r + 1, '#6622AA', 1.5);
        B.restoreAlpha();

        // === MOON TRAILS + MOONS ===
        for (let m = 0; m < this.moonCount; m++) {
            const trail = this.moonTrails[m] || [];
            const moon = this._getMoonPos(m);

            // Moon afterimage trail
            for (let i = 0; i < trail.length; i++) {
                const t = trail[i];
                const alpha = (i / trail.length) * 0.15;
                B.setAlpha(alpha);
                const trailSize = this.moonRadius * (0.5 + (i / trail.length) * 0.4);
                B.fillCircle(t.x, t.y, trailSize, '#AAAAAA');
                B.restoreAlpha();
            }

            // Moon body
            B.fillCircle(moon.x, moon.y, this.moonRadius, '#CCCCBB');
            B.strokeCircle(moon.x, moon.y, this.moonRadius, '#999988', 1.5);

            // Craters (visual detail — using Math.random-free positions)
            // Fixed crater positions relative to moon center using deterministic offsets
            const craters = [
                { dx: -3, dy: -2, r: 2.5 },
                { dx: 4, dy: 1, r: 2 },
                { dx: -1, dy: 4, r: 1.5 },
            ];
            for (const c of craters) {
                B.fillCircle(moon.x + c.dx, moon.y + c.dy, c.r, '#AAAAAA');
            }

            // Moon glow during super
            if (this.superActive) {
                B.setAlpha(0.2);
                B.fillCircle(moon.x, moon.y, this.moonRadius + 4, '#9955DD');
                B.restoreAlpha();
            }
        }

        // === ORBIT PATH ===
        B.setAlpha(0.08);
        B.strokeCircle(this.owner.x, this.owner.y, this.orbitRadius, '#9955DD', 1);
        B.restoreAlpha();

        // === GRAVITATIONAL LENSING PARTICLES ===
        // Tiny purple sparkles drifting inward (visual only)
        if (this.wellTimer % 6 === 0) {
            const sparkAngle = Math.random() * Math.PI * 2;
            const sparkDist = this.wellRadius * (0.4 + Math.random() * 0.5);
            B.setAlpha(0.3);
            B.fillCircle(
                this.owner.x + Math.cos(sparkAngle) * sparkDist,
                this.owner.y + Math.sin(sparkAngle) * sparkDist,
                1 + Math.random() * 1.5,
                '#9955DD'
            );
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('gravity', GravityWeapon, 'elemental');
