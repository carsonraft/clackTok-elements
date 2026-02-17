window.WB = window.WB || {};

// Shadow (Phantom Edge): Melee weapon that phases in/out — unparryable when phased.
// Scaling: Damage multiplier increases. Super: Eclipse (permanently unparryable + lifesteal).
class ShadowWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'shadow',
            baseDamage: 3,
            rotationSpeed: 0.055,
            reach: 65,
            scalingName: 'Power',
            superThreshold: 10,
        });
        this.phaseTimer = 0;
        this.phaseDuration = 60;
        this.solidDuration = 90;
        this.phased = false;
        this.damageMultiplier = 1.0;
        this.flickerTimer = 0;
        this.scalingStat.value = this.damageMultiplier.toFixed(1) + 'x';
    }

    update() {
        if (this._deflectReverse > 0) this._deflectReverse--;
        this.angle += this.rotationSpeed * this.getDir();
        if (this.cooldown > 0) this.cooldown--;
        this.flickerTimer++;
        this.phaseTimer++;

        if (this.superActive) {
            // Black Hole: permanently phased + gravity pull
            if (!this.phased) {
                this.phased = true;
                this.unparryable = true;
            }
            // Gravity well — pull enemies toward owner
            if (this._blackHole && WB.Game && WB.Game.balls) {
                const pullRadius = this.owner.radius + 100;
                for (const target of WB.Game.balls) {
                    if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                    const dx = this.owner.x - target.x;
                    const dy = this.owner.y - target.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < pullRadius && dist > 0) {
                        const pull = 0.25;
                        target.vx += (dx / dist) * pull;
                        target.vy += (dy / dist) * pull;
                    }
                }
                // Periodic life drain to nearby enemies
                if (this.flickerTimer % 35 === 0) {
                    const drainRadius = this.owner.radius + 50;
                    for (const target of WB.Game.balls) {
                        if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                        const dx = target.x - this.owner.x;
                        const dy = target.y - this.owner.y;
                        if (Math.sqrt(dx * dx + dy * dy) < drainRadius) {
                            target.takeDamage(2);
                            this.owner.hp = Math.min(this.owner.hp + 2, this.owner.maxHp);
                            if (WB.GLEffects) {
                                WB.GLEffects.spawnDamageNumber(target.x, target.y, 2, '#7744CC');
                            }
                        }
                    }
                }
            }
        } else {
            // Phase cycle
            if (this.phased) {
                this.unparryable = true;
                if (this.phaseTimer >= this.phaseDuration) {
                    this.phased = false;
                    this.unparryable = false;
                    this.phaseTimer = 0;
                }
            } else {
                if (this.phaseTimer >= this.solidDuration) {
                    this.phased = true;
                    this.unparryable = true;
                    this.phaseTimer = 0;
                    if (WB.Game && WB.Game.particles) {
                        WB.Game.particles.emit(this.owner.x, this.owner.y, 6, '#553388');
                    }
                }
            }
        }
    }

    onHit(target) {
        const dmg = Math.round(this.currentDamage * this.damageMultiplier);
        // Bonus damage while phased
        const totalDmg = this.phased ? dmg + 2 : dmg;
        target.takeDamage(totalDmg);

        // Lifesteal in super mode
        if (this.superActive) {
            const heal = Math.ceil(totalDmg * 0.3);
            this.owner.hp = Math.min(this.owner.hp + heal, this.owner.maxHp);
        }

        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);
        this._onHitEffects(target, totalDmg, '#553388');
    }

    applyScaling() {
        this.damageMultiplier = 1.0 + this.hitCount * 0.15;
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.3);
        this.scalingStat.value = this.damageMultiplier.toFixed(1) + 'x';
    }

    activateSuper() {
        // Crystal Shards inspired → BLACK HOLE!
        // Become permanently phased + create a gravity well that pulls enemies in + drain life
        this.phased = true;
        this.unparryable = true;
        this.damageMultiplier += 0.8;
        this.currentDamage += 4;
        this._blackHole = true;
        // Initial shadow burst — damage + slow all enemies
        if (WB.Game && WB.Game.balls) {
            for (const target of WB.Game.balls) {
                if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                target.takeDamage(5);
                target.vx *= 0.3;
                target.vy *= 0.3;
                if (WB.Game.particles) {
                    WB.Game.particles.explode(target.x, target.y, 10, '#553388');
                }
            }
        }
        if (WB.GLEffects) {
            WB.GLEffects.triggerChromatic(0.1);
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        const alpha = this.phased
            ? 0.35 + Math.sin(this.flickerTimer * 0.12) * 0.15
            : 0.85;

        B.setAlpha(alpha);
        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
        }

        // Shadow blade — dark ethereal edge
        B.fillPolygon([
            [r - 2, -4],
            [r + 10, -6],
            [this.reach + 2, -1],
            [this.reach + 2, 1],
            [r + 10, 6],
            [r - 2, 4]
        ], '#442266');
        B.strokePolygon([
            [r - 2, -4],
            [r + 10, -6],
            [this.reach + 2, -1],
            [this.reach + 2, 1],
            [r + 10, 6],
            [r - 2, 4]
        ], '#331155', 1.5);

        // Dark energy core line
        B.line(r + 5, 0, this.reach - 5, 0, '#AA66FF', 1.5);

        // Handle
        B.fillRect(r - 6, -3, 8, 6, '#2A1544');

        B.popTransform();
        B.restoreAlpha();

        // Phase indicator — dark wisps
        if (this.phased) {
            B.setAlpha(0.2);
            for (let i = 0; i < 3; i++) {
                const wa = this.flickerTimer * 0.06 + i * Math.PI * 2 / 3;
                const wd = r + 8 + Math.sin(this.flickerTimer * 0.04 + i) * 5;
                B.fillCircle(
                    this.owner.x + Math.cos(wa) * wd,
                    this.owner.y + Math.sin(wa) * wd,
                    3, '#7744CC'
                );
            }
            B.restoreAlpha();
        }

        // Eclipse aura
        if (this.superActive) {
            const pulse = 0.08 + Math.sin(this.flickerTimer * 0.05) * 0.04;
            B.setAlpha(pulse);
            B.fillCircle(this.owner.x, this.owner.y, r + 15, '#553388');
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('shadow', ShadowWeapon, 'elemental');
