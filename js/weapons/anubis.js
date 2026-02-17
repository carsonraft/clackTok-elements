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

        // Death aura — intensifies as HP drops
        const hpFrac = this.owner.hp / this.owner.maxHp;
        const auraIntensity = Math.max(0, 1 - hpFrac); // 0 at full HP, 1 at 0 HP

        if (auraIntensity > 0.1) {
            const pulse = Math.sin(this.visualTimer * 0.06) * 0.03;
            B.setAlpha(auraIntensity * 0.15 + pulse);
            B.fillCircle(this.owner.x, this.owner.y, r + 6 + auraIntensity * 8, '#1A1A1A');
            B.restoreAlpha();

            // Gold death ring
            B.setAlpha(auraIntensity * 0.2 + pulse);
            B.strokeCircle(this.owner.x, this.owner.y, r + 4 + auraIntensity * 6, '#DAA520', 1.5);
            B.restoreAlpha();
        }

        // Super: pulsing dark aura showing the drain
        if (this.superActive) {
            const drainPulse = Math.sin(this.visualTimer * 0.1) * 0.08;
            B.setAlpha(0.12 + drainPulse);
            B.strokeCircle(this.owner.x, this.owner.y, r + 12, '#DAA520', 2);
            B.restoreAlpha();
        }

        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        // Crook staff — long curved staff
        // Shaft
        B.fillRect(r - 2, -3, this.reach - r + 4, 6, '#3D2B1F');
        B.line(r, 0, this.reach, 0, '#5C4033', 2);

        // Crook hook at tip — curved gold hook
        const hookX = this.reach;
        B.fillCircle(hookX, -4, 5, '#DAA520');
        B.fillCircle(hookX - 3, -8, 4, '#DAA520');
        B.fillCircle(hookX - 7, -9, 3, '#B8860B');
        B.strokeCircle(hookX - 2, -6, 7, '#8B6914', 1.5);

        // Gold bands on shaft
        B.fillRect(r + 10, -4, 4, 8, '#DAA520');
        B.fillRect(r + 25, -4, 3, 8, '#B8860B');

        B.popTransform();
    }
}

WB.WeaponRegistry.register('anubis', AnubisWeapon, 'egyptian');
