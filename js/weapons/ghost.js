window.WB = window.WB || {};

// Ghost: Phases in and out of existence. While phased, immune to damage but can still deal contact damage.
// Scaling: Phase duration increases per hit. Super: permanent phase + life drain aura.
class GhostWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'ghost',
            baseDamage: 2,
            rotationSpeed: 0,
            reach: 0,
            scalingName: 'Phase',
            superThreshold: 8,
            canParry: false,
        });
        this.phaseTimer = 0;
        this.phaseDuration = 90;    // frames phased (1.5s)
        this.solidDuration = 120;   // frames solid (2s)
        this.phased = false;
        this.contactCooldown = 0;
        this.contactAura = 12; // ghost reaches out beyond body
        this.flickerTimer = 0;
        this.drainDamage = 0;
        this.scalingStat.value = (this.phaseDuration / 60).toFixed(1) + 's';
    }

    update() {
        if (this.contactCooldown > 0) this.contactCooldown--;
        this.flickerTimer++;
        this.phaseTimer++;

        if (this.superActive) {
            // Permanent phase in super mode
            if (!this.phased) {
                this.phased = true;
                this.owner.invulnerable = true;
            }
            // Life drain aura — damage nearby enemies
            this._drainNearby();
        } else {
            // Phase cycle
            if (this.phased) {
                if (this.phaseTimer >= this.phaseDuration) {
                    this.phased = false;
                    this.owner.invulnerable = false;
                    this.phaseTimer = 0;
                }
            } else {
                if (this.phaseTimer >= this.solidDuration) {
                    this.phased = true;
                    this.owner.invulnerable = true;
                    this.phaseTimer = 0;
                    // Ghostly particle burst on phase
                    if (WB.Game && WB.Game.particles) {
                        WB.Game.particles.emit(this.owner.x, this.owner.y, 8, 'rgba(150,220,255,0.8)');
                    }
                }
            }
        }
    }

    _drainNearby() {
        if (!WB.Game || !WB.Game.balls) return;
        // Drain once every 30 frames
        if (this.flickerTimer % 30 !== 0) return;

        const drainRadius = this.owner.radius + 60;
        for (const target of WB.Game.balls) {
            if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
            const dx = target.x - this.owner.x;
            const dy = target.y - this.owner.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < drainRadius) {
                const dmg = 1 + this.drainDamage;
                target.takeDamage(dmg);
                WB.Audio.poisonTick();
                if (WB.Game.particles) {
                    // Drain particles flow from target to ghost
                    for (let i = 0; i < 4; i++) {
                        WB.Game.particles.emit(
                            target.x + (this.owner.x - target.x) * Math.random(),
                            target.y + (this.owner.y - target.y) * Math.random(),
                            1, '#88DDFF'
                        );
                    }
                }
                if (WB.GLEffects) {
                    WB.GLEffects.spawnDamageNumber(target.x, target.y, dmg, '#88DDFF');
                }
            }
        }
    }

    canHit() {
        return this.contactCooldown <= 0;
    }

    onHit(target) {
        const dmg = this.currentDamage + (this.phased ? 2 : 0); // bonus damage while phased
        target.takeDamage(dmg);
        this.hitCount++;
        this.contactCooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);

        // Full combo tracking + screen deformation + particle effects
        this._onHitEffects(target, dmg, '#88DDFF');
    }

    applyScaling() {
        this.phaseDuration = 90 + this.hitCount * 15;
        this.solidDuration = Math.max(40, 120 - this.hitCount * 8);
        this.drainDamage = Math.floor(this.hitCount * 0.5);
        this.scalingStat.value = (this.phaseDuration / 60).toFixed(1) + 's';
    }

    activateSuper() {
        this.phased = true;
        this.owner.invulnerable = true;
        this.currentDamage += 3;
        this.drainDamage += 2;
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;
        const phase = this.phased;

        // Ghost body overlay — translucent ethereal effect
        if (phase) {
            // Flickering translucent ghost
            const flicker = 0.3 + Math.sin(this.flickerTimer * 0.15) * 0.15;
            B.setAlpha(flicker);

            // Ghostly outer glow
            B.fillCircle(this.owner.x, this.owner.y, r + 8, '#88DDFF');

            // Wispy tendrils (3 rotating wisps)
            for (let i = 0; i < 3; i++) {
                const wispAngle = this.flickerTimer * 0.04 + i * Math.PI * 2 / 3;
                const wispDist = r + 5 + Math.sin(this.flickerTimer * 0.08 + i) * 8;
                const wx = this.owner.x + Math.cos(wispAngle) * wispDist;
                const wy = this.owner.y + Math.sin(wispAngle) * wispDist;
                B.fillCircle(wx, wy, 4, '#AAEEFF');
            }

            B.restoreAlpha();

            // Inner ethereal glow (brighter)
            B.setAlpha(0.15);
            B.fillCircle(this.owner.x, this.owner.y, r + 15, '#CCFFFF');
            B.restoreAlpha();
        } else {
            // Solid state — subtle ghost features
            // Small wisp indicators
            B.setAlpha(0.2);
            const wispAngle = this.flickerTimer * 0.02;
            B.fillCircle(
                this.owner.x + Math.cos(wispAngle) * (r + 3),
                this.owner.y + Math.sin(wispAngle) * (r + 3),
                3, '#88DDFF'
            );
            B.restoreAlpha();

            // Phase progress indicator (ring fills up as next phase approaches)
            if (!this.superActive) {
                const progress = this.phaseTimer / this.solidDuration;
                if (progress > 0.5) {
                    const arcAlpha = (progress - 0.5) * 0.6;
                    B.setAlpha(arcAlpha);
                    B.strokeCircle(this.owner.x, this.owner.y, r + 4, '#88DDFF', 2);
                    B.restoreAlpha();
                }
            }
        }

        // Super: drain aura ring
        if (this.superActive) {
            const drainPulse = 0.15 + Math.sin(this.flickerTimer * 0.06) * 0.08;
            B.setAlpha(drainPulse);
            B.strokeCircle(this.owner.x, this.owner.y, r + 60, '#88DDFF', 1.5);
            B.fillCircle(this.owner.x, this.owner.y, r + 60, 'rgba(136,221,255,0.03)');
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('ghost', GhostWeapon, 'classic');
