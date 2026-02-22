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
        const S = WB.WeaponSprites;

        // Death aura intensity: 0 at full HP, 1 at 0 HP
        const hpFrac = this.owner.hp / this.owner.maxHp;
        const auraIntensity = Math.max(0, 1 - hpFrac);

        // ── Pre-overlay: Dark halo at low HP ──
        if (auraIntensity > 0.5) {
            const pulse = Math.sin(this.visualTimer * 0.06) * 0.03;
            B.setAlpha((auraIntensity - 0.5) * 0.3 + pulse);
            B.strokeCircle(this.owner.x, this.owner.y, r + 4, '#1A1A1A', 2);
            B.restoreAlpha();
        }

        // ── Pre-overlay: Super drain aura ──
        if (this.superActive) {
            const drainPulse = Math.sin(this.visualTimer * 0.1) * 0.08;
            B.setAlpha(0.2 + drainPulse);
            B.strokeCircle(this.owner.x, this.owner.y, r + 8, '#DAA520', 2);
            B.restoreAlpha();
        }

        // ── Main sprite: Anubis crook ──
        if (S && S._initialized) {
            const spriteScale = 32 * (0.85 + auraIntensity * 0.35);
            S.drawSprite('anubis-crook', this.owner.x, this.owner.y, this.angle,
                spriteScale, spriteScale, 1.0, 0.7 + auraIntensity * 0.8);
        }
    }
}

WB.WeaponRegistry.register('anubis', AnubisWeapon, 'egyptian');
