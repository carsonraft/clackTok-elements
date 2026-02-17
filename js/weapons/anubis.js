window.WB = window.WB || {};

// Anubis — Crook Staff: Melee weapon whose damage scales inversely with his own HP.
// Formula: actual_damage = (base + hitScaling) × (100 / currentHP).
// At full HP: 1x. At 50 HP: 2x. At 25 HP: 4x. At 10 HP: 10x.
// Super: Anubis begins passively losing 1 HP/sec — a self-imposed countdown
// that continuously increases his damage multiplier. Racing his own death.
class AnubisWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'anubis',
            baseDamage: 2.5,
            rotationSpeed: 0.06,
            reach: 75,
            scalingName: 'Reaper',
            superThreshold: 10,
        });
        this._lastHp = this.owner.hp;
        this.selfDrainTimer = 0;
        this.visualTimer = 0;
        this.scalingStat.value = '1.0x';
    }

    update() {
        super.update();
        this.visualTimer++;

        // Super: passively lose 1 HP per second (60 frames)
        if (this.superActive) {
            this.selfDrainTimer++;
            if (this.selfDrainTimer >= 60) {
                this.selfDrainTimer = 0;
                if (this.owner.hp > 1) {
                    this.owner.hp -= 1;
                    // Don't let self-drain kill — floor at 1 HP
                    if (this.owner.hp < 1) this.owner.hp = 1;
                }
            }
        }
    }

    _getDamageMultiplier() {
        return 100 / Math.max(1, this.owner.hp);
    }

    onHit(target) {
        const baseDmg = this.baseDamage + Math.floor(this.hitCount * 0.4);
        const multiplier = this._getDamageMultiplier();
        const dmg = baseDmg * multiplier;

        target.takeDamage(dmg);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);

        this._onHitEffects(target, dmg, '#DAA520');

        // Death particles — gold flecks
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.emit(target.x, target.y, 4, '#DAA520');
            WB.Game.particles.emit(target.x, target.y, 2, '#1A1A1A');
        }
    }

    applyScaling() {
        const multiplier = this._getDamageMultiplier();
        this.currentDamage = (this.baseDamage + Math.floor(this.hitCount * 0.4)) * multiplier;
        this.scalingStat.value = multiplier.toFixed(1) + 'x';
    }

    activateSuper() {
        // Begin the death countdown — self-drain starts in update()
        // Burst of dark energy on activation
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 20, '#1A1A1A');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 12, '#DAA520');
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        // Death aura intensity: 0 at full HP, 1 at 0 HP
        const hpFrac = this.owner.hp / this.owner.maxHp;
        const auraIntensity = Math.max(0, 1 - hpFrac);

        // At low HP (>50% intensity), show a dark halo — death is coming
        if (auraIntensity > 0.5) {
            const pulse = Math.sin(this.visualTimer * 0.06) * 0.03;
            B.setAlpha((auraIntensity - 0.5) * 0.3 + pulse);
            B.strokeCircle(this.owner.x, this.owner.y, r + 4, '#1A1A1A', 2);
            B.restoreAlpha();
        }

        // Super: pulsing dark aura showing the drain — more visible
        if (this.superActive) {
            const drainPulse = Math.sin(this.visualTimer * 0.1) * 0.08;
            B.setAlpha(0.2 + drainPulse);
            B.strokeCircle(this.owner.x, this.owner.y, r + 8, '#DAA520', 2);
            B.restoreAlpha();
        }

        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        // Crook staff — wider, more visible
        // Shaft
        B.fillRect(r - 2, -4, this.reach - r + 4, 8, '#3D2B1F');
        B.line(r, 0, this.reach, 0, '#5C4033', 2.5);

        // Crook hook at tip — gold intensifies, hook GROWS with auraIntensity
        const gldR = Math.round(139 + (255 - 139) * auraIntensity);
        const gldG = Math.round(115 + (215 - 115) * auraIntensity);
        const gldB = Math.round(0 + (0) * auraIntensity);
        const hookGold = `rgb(${gldR},${gldG},${gldB})`;
        // Hook scale: 0.8→1.2 with auraIntensity
        const hookScale = 0.8 + auraIntensity * 0.4;
        const hookX = this.reach;
        B.fillCircle(hookX, -5 * hookScale, 7 * hookScale, hookGold);
        B.fillCircle(hookX - 4 * hookScale, -10 * hookScale, 5.5 * hookScale, hookGold);
        B.fillCircle(hookX - 9 * hookScale, -11 * hookScale, 4 * hookScale, '#B8860B');
        B.strokeCircle(hookX - 3 * hookScale, -7 * hookScale, 9 * hookScale, '#8B6914', 2);

        // Gold bands on shaft — wider
        B.fillRect(r + 10, -5, 5, 10, hookGold);
        B.fillRect(r + 25, -4.5, 4, 9, '#B8860B');

        B.popTransform();
    }
}

WB.WeaponRegistry.register('anubis', AnubisWeapon, 'egyptian');
