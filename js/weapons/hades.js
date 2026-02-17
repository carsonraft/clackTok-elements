window.WB = window.WB || {};

// Hades — Death Pulse: Periodic AoE burst that damages nearby enemies and heals Hades.
// Passive gravity pull draws enemies closer. Scaling: Pulse damage and pull increase.
// Super (Underworld Eruption): Inverts gravity to REPULSION, pushing enemies into walls.
class HadesWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'hades',
            baseDamage: 2,
            rotationSpeed: 0,
            reach: 0,
            scalingName: 'Pulse',
            superThreshold: 10,
            canParry: false,
        });
        // Hades is tanky — lord of the dead doesn't die easily
        this.owner.radius = Math.round(WB.Config.BALL_RADIUS * 1.0);
        this.owner.mass *= 1.1;    // heavier (was 1.05)
        this.owner.hp = Math.round(WB.Config.BALL_MAX_HP * 1.15); // 115 HP — needs survivability
        this.owner.maxHp = this.owner.hp;

        this.pulseTimer = 0;
        this.pulseRate = 110;     // faster pulses (was 140) — more frequent damage
        this.pulseRadius = 75;    // tuned down from 80 — slightly smaller catch zone
        this.pulseDamage = 4;     // more damage per pulse (was 3)
        this.healPerHit = 2;      // tuned down from 3 — was sustaining too well

        // Gravity pull — stronger to keep enemies in pulse range
        this.pullStrength = 0.14; // was 0.10
        this.pullTimer = 0;
        this.repulsionMode = false; // Flipped on super

        this.contactCooldown = 0;
        this.contactAura = 3;  // nerfed from 5
        this.visualTimer = 0;

        this.scalingStat.value = this.pulseDamage;
    }

    update() {
        if (this.contactCooldown > 0) this.contactCooldown--;
        this.pulseTimer++;
        this.pullTimer++;
        this.visualTimer++;

        // Gravity pull/push — every 8 frames
        if (this.pullTimer >= 8 && WB.Game && WB.Game.balls) {
            this.pullTimer = 0;
            for (const target of WB.Game.balls) {
                if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                const dx = this.owner.x - target.x;
                const dy = this.owner.y - target.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < this.pulseRadius * 1.5 && dist > 0) {
                    const factor = this.pullStrength * (1 - dist / (this.pulseRadius * 1.5));
                    const dir = this.repulsionMode ? -1 : 1;
                    target.vx += (dx / dist) * factor * dir;
                    target.vy += (dy / dist) * factor * dir;
                }
            }
        }

        // Death pulse — periodic AoE burst
        if (this.pulseTimer >= this.pulseRate) {
            this.pulseTimer = 0;
            this._deathPulse();
        }
    }

    _deathPulse() {
        if (!WB.Game || !WB.Game.balls) return;
        let hitAny = false;

        for (const target of WB.Game.balls) {
            if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
            const dx = target.x - this.owner.x;
            const dy = target.y - this.owner.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < this.pulseRadius) {
                target.takeDamage(this.pulseDamage);
                hitAny = true;
                this.hitCount++;
                this.applyScaling();
                this.checkSuper();

                // Push/pull based on mode
                if (dist > 0) {
                    const force = this.repulsionMode ? 4 : -2;
                    target.vx += (dx / dist) * force;
                    target.vy += (dy / dist) * force;
                }

                if (WB.GLEffects) {
                    WB.GLEffects.spawnDamageNumber(target.x, target.y, this.pulseDamage, '#2E0854');
                }
            }
        }

        // Heal on hit
        if (hitAny) {
            this.owner.hp = Math.min(this.owner.maxHp, this.owner.hp + this.healPerHit);
            WB.Audio.weaponHit(this.hitCount, this.type);
        }

        // Pulse visual effects
        WB.Renderer.triggerShake(2);
        if (WB.GLEffects) {
            WB.GLEffects.spawnImpact(this.owner.x, this.owner.y, '#2E0854', 30);
        }
        if (WB.Game && WB.Game.particles) {
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                const px = this.owner.x + Math.cos(angle) * (this.pulseRadius * 0.5);
                const py = this.owner.y + Math.sin(angle) * (this.pulseRadius * 0.5);
                WB.Game.particles.emit(px, py, 1, '#6A0DAD');
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
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);

        // No lifesteal on contact — only pulse heals (gives counterplay)

        this._onHitEffects(target, this.currentDamage, '#2E0854');
    }

    applyScaling() {
        this.pulseDamage = 4 + Math.floor(this.hitCount * 0.25);  // better pulse scaling
        this.pullStrength = Math.min(0.35, 0.14 + this.hitCount * 0.025); // stronger pull cap
        this.healPerHit = 3 + Math.floor(this.hitCount / 6);   // more frequent heal gains
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.25);
        this.scalingStat.value = this.pulseDamage;
    }

    activateSuper() {
        // UNDERWORLD ERUPTION — flip to repulsion mode!
        this.repulsionMode = true;
        this.pulseDamage += 2;     // nerfed from +3
        this.pulseRadius = 85;     // nerfed from 100
        this.pulseRate = 90;       // nerfed from 75
        this.pullStrength *= 1.3;  // nerfed from 1.5x
        this.healPerHit += 1;

        // Small HP boost
        this.owner.hp = Math.min(this.owner.hp + 10, this.owner.maxHp + 10);
        this.owner.maxHp += 10;

        // Eruption burst — massive push
        if (WB.Game && WB.Game.balls) {
            for (const target of WB.Game.balls) {
                if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                const dx = target.x - this.owner.x;
                const dy = target.y - this.owner.y;
                const d = Math.sqrt(dx * dx + dy * dy) || 1;
                target.vx += (dx / d) * 7;
                target.vy += (dy / d) * 7;
                target.takeDamage(4);
                if (WB.GLEffects) {
                    WB.GLEffects.spawnDamageNumber(target.x, target.y, 4, '#6A0DAD');
                }
            }
        }

        // Visual eruption
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 35, '#2E0854');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 20, '#6A0DAD');
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        // Death aura — concentric dark rings
        const pulse = Math.sin(this.visualTimer * 0.04) * 0.04;
        const rings = [
            { frac: 1.0, alpha: 0.04, color: '#110022' },
            { frac: 0.6, alpha: 0.08, color: '#220044' },
            { frac: 0.3, alpha: 0.12, color: '#330066' },
        ];
        for (const ring of rings) {
            const ringR = this.pulseRadius * ring.frac;
            B.setAlpha(ring.alpha + pulse);
            B.fillCircle(this.owner.x, this.owner.y, ringR, ring.color);
            B.restoreAlpha();
        }

        // Pulse boundary ring
        B.setAlpha(0.08 + Math.sin(this.visualTimer * 0.05) * 0.03);
        B.strokeCircle(this.owner.x, this.owner.y, this.pulseRadius, '#6A0DAD', 1);
        B.restoreAlpha();

        // Pulse charging indicator (fills up as next pulse approaches)
        const chargeProgress = this.pulseTimer / this.pulseRate;
        if (chargeProgress > 0.5) {
            const chargeAlpha = (chargeProgress - 0.5) * 0.3;
            B.setAlpha(chargeAlpha);
            B.strokeCircle(this.owner.x, this.owner.y, r + 5, '#6A0DAD', 2);
            B.restoreAlpha();
        }

        // Dark overlay on ball
        B.setAlpha(0.2);
        B.fillCircle(this.owner.x, this.owner.y, r + 2, '#110022');
        B.restoreAlpha();

        // Soul wisps — floating purple specks
        for (let i = 0; i < 3; i++) {
            const wispAngle = this.visualTimer * 0.03 + i * Math.PI * 2 / 3;
            const wispDist = r + 8 + Math.sin(this.visualTimer * 0.05 + i * 2) * 6;
            const wx = this.owner.x + Math.cos(wispAngle) * wispDist;
            const wy = this.owner.y + Math.sin(wispAngle) * wispDist;
            B.setAlpha(0.3);
            B.fillCircle(wx, wy, 2, '#9955DD');
            B.restoreAlpha();
        }

        // Super: repulsion mode indicator — red-purple pulsing boundary
        if (this.superActive) {
            const superPulse = 0.12 + Math.sin(this.visualTimer * 0.08) * 0.06;
            B.setAlpha(superPulse);
            B.strokeCircle(this.owner.x, this.owner.y, this.pulseRadius, '#FF3366', 2);
            B.restoreAlpha();

            // Direction arrows pointing outward
            for (let i = 0; i < 4; i++) {
                const arrowAngle = this.visualTimer * 0.02 + i * Math.PI / 2;
                const arrowDist = this.pulseRadius * 0.7;
                const ax = this.owner.x + Math.cos(arrowAngle) * arrowDist;
                const ay = this.owner.y + Math.sin(arrowAngle) * arrowDist;
                B.setAlpha(0.15);
                B.fillCircle(ax, ay, 3, '#FF3366');
                B.restoreAlpha();
            }
        }
    }
}

WB.WeaponRegistry.register('hades', HadesWeapon, 'pantheon');
