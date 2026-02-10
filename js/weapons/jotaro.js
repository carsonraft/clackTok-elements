window.WB = window.WB || {};

// Jotaro: Star Platinum — ultra-fast melee ORA rush. Precision punches.
// Mid-fight: Star Platinum gets faster and stronger.
// Super: ZA WARUDO — time stop freezes enemy for 3 seconds while Jotaro beats them.
class JotaroWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'jotaro',
            baseDamage: 3,
            rotationSpeed: 0.07,    // Fast ORA ORA rotation
            reach: 35,
            scalingName: 'ORA',
            superThreshold: 10,
            isRanged: false,
        });
        this.oraCount = 0;
        this.oraRushTimer = 0;
        this.standPhase = 0;
        this.timeStopActive = false;
        this.timeStopTarget = null;
        this.timeStopFrames = 0;
        this.scalingStat.value = this.oraCount;
    }

    update() {
        super.update();
        this.standPhase += 0.1;
        this.oraRushTimer++;

        // Time stop effect — freeze enemy
        if (this.timeStopActive && this.timeStopTarget) {
            this.timeStopFrames--;
            this.timeStopTarget.vx = 0;
            this.timeStopTarget.vy = 0;

            // ORA barrage during time stop
            if (this.oraRushTimer % 5 === 0) {
                this.timeStopTarget.takeDamage(2);
                this.oraCount++;
                this.hitCount++;
                this.applyScaling();
                if (WB.Game && WB.Game.particles) {
                    const ox = this.timeStopTarget.x + (Math.random() - 0.5) * 20;
                    const oy = this.timeStopTarget.y + (Math.random() - 0.5) * 20;
                    WB.Game.particles.emit(ox, oy, 3, '#FFD700');
                }
                if (WB.GLEffects) {
                    WB.GLEffects.spawnDamageNumber(
                        this.timeStopTarget.x + (Math.random() - 0.5) * 30,
                        this.timeStopTarget.y, 2, '#FFD700'
                    );
                }
                WB.Renderer.triggerShake(2);
            }

            if (this.timeStopFrames <= 0) {
                this.timeStopActive = false;
                // Resume with BIG final punch
                const dx = this.timeStopTarget.x - this.owner.x;
                const dy = this.timeStopTarget.y - this.owner.y;
                const d = Math.sqrt(dx * dx + dy * dy) || 1;
                this.timeStopTarget.vx = (dx / d) * 12;
                this.timeStopTarget.vy = (dy / d) * 12;
                this.timeStopTarget.takeDamage(8);
                WB.Renderer.triggerShake(15);
                if (WB.GLEffects) {
                    WB.GLEffects.triggerShockwave(this.timeStopTarget.x, this.timeStopTarget.y, 0.5);
                    WB.GLEffects.triggerChromatic(0.5);
                }
                this.timeStopTarget = null;
            }
        }
    }

    onHit(target) {
        const dmg = this.currentDamage;
        target.takeDamage(dmg);
        this.hitCount++;
        this.oraCount++;
        this.cooldown = Math.floor(WB.Config.WEAPON_HIT_COOLDOWN * 0.7); // Faster recovery — ORA ORA
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);

        // ORA RUSH knockback — rapid small hits
        const dx = target.x - this.owner.x;
        const dy = target.y - this.owner.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        target.vx += (dx / d) * 3;
        target.vy += (dy / d) * 3;

        this._onHitEffects(target, dmg, '#6644CC');
    }

    applyScaling() {
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.4);
        this.rotationSpeed = Math.min(0.15, 0.07 + this.hitCount * 0.005);
        this.scalingStat.value = this.oraCount;
    }

    activateSuper() {
        // ZA WARUDO! TIME STOP!
        if (WB.Game && WB.Game.balls) {
            const enemy = WB.Game.balls.find(b => b !== this.owner && b.isAlive && b.side !== this.owner.side);
            if (enemy) {
                this.timeStopActive = true;
                this.timeStopTarget = enemy;
                this.timeStopFrames = 180; // 3 seconds of time stop
            }
        }

        // Time stop visual — everything goes dark/sepia
        WB.Renderer.triggerShake(15);
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 30, '#6644CC');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 20, '#FFD700');
        }
        if (WB.GLEffects) {
            WB.GLEffects.triggerSuperFlash('#6644CC');
            WB.GLEffects.triggerShockwave(this.owner.x, this.owner.y, 0.8);
            WB.GLEffects.triggerChromatic(0.8);
            WB.GLEffects.triggerHitStop(8);
        }

        this.currentDamage += 3;
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        // Star Platinum ghost stand behind Jotaro
        const standDist = r + 8;
        const standX = this.owner.x - Math.cos(this.angle) * standDist * 0.5;
        const standY = this.owner.y - Math.sin(this.angle) * standDist * 0.5;
        B.setAlpha(0.25);
        B.fillCircle(standX, standY, r * 1.1, '#8866CC');
        B.strokeCircle(standX, standY, r * 1.1, '#6644CC', 1.5);
        B.restoreAlpha();

        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
            B.fillCircleGlow(this.reach - 4, 0, 12, '#FFD700', 20);
        }

        // Star Platinum fist (purple/gold)
        B.line(r - 2, 0, this.reach - 6, 0, '#8866CC', 4);
        B.fillCircle(this.reach - 4, 0, 7, '#8866CC');
        B.strokeCircle(this.reach - 4, 0, 7, '#6644CC', 1.5);

        // Knuckle detail
        B.line(this.reach - 7, -2, this.reach - 7, 2, '#FFD700', 1);
        B.line(this.reach - 4, -3, this.reach - 4, 3, '#FFD700', 1);
        B.line(this.reach - 1, -2, this.reach - 1, 2, '#FFD700', 1);

        // ORA afterimages during rapid hits
        if (this.oraRushTimer % 6 < 3) {
            B.setAlpha(0.15);
            B.fillCircle(this.reach + 2, 3, 5, '#8866CC');
            B.fillCircle(this.reach + 2, -3, 5, '#8866CC');
            B.restoreAlpha();
        }

        B.popTransform();

        // Time stop visual — clock/ring around enemy
        if (this.timeStopActive && this.timeStopTarget && this.timeStopTarget.isAlive) {
            const t = this.timeStopTarget;
            const pulse = 0.5 + Math.sin(this.standPhase) * 0.2;
            B.setAlpha(pulse);
            B.strokeCircle(t.x, t.y, t.radius + 15, '#6644CC', 2);
            // Clock tick marks
            for (let i = 0; i < 12; i++) {
                const a = (i * Math.PI * 2) / 12;
                const ir = t.radius + 12;
                const or = t.radius + 16;
                B.line(
                    t.x + Math.cos(a) * ir, t.y + Math.sin(a) * ir,
                    t.x + Math.cos(a) * or, t.y + Math.sin(a) * or,
                    '#FFD700', 1
                );
            }
            B.restoreAlpha();
        }

        // Super aura
        if (this.superActive) {
            const flicker = 1 + Math.sin(Date.now() * 0.012) * 0.15;
            B.setAlpha(0.45);
            B.strokeCircle(this.owner.x, this.owner.y, r + 7 * flicker, '#6644CC', 2.5);
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('jotaro', JotaroWeapon);
