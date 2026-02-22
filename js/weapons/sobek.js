window.WB = window.WB || {};

// Sobek — Jaw Snap: Short-range melee. While NOT hitting, builds pressure (+1/sec).
// On hit, ALL stored pressure is added as bonus damage, then pressure resets.
// Each hit increases pressure build rate by +0.2/sec.
// Super (8 hits): Pressure retains 50% after hit instead of resetting to 0.
// Build rate doubles. The crocodile reloads faster and never fully empties.
class SobekWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'sobek',
            baseDamage: 1,
            rotationSpeed: 0.03, // slow — jaw tracks target
            reach: 50, // short range jaw
            scalingName: 'Pressure',
            superThreshold: 10,
        });
        this.pressure = 0;
        this.pressureBuildRate = 0.6; // per second (per 60 frames)
        this.jawOpen = 0; // visual timer for jaw snap animation
        this.visualTimer = 0;
        this.scalingStat.value = '0';
    }

    update() {
        if (this._deflectReverse > 0) this._deflectReverse--;
        // Track toward nearest enemy (slow pursuit)
        if (WB.Game && WB.Game.balls) {
            let closest = null, closestDist = Infinity;
            for (const b of WB.Game.balls) {
                if (b === this.owner || !b.isAlive || b.side === this.owner.side) continue;
                const dx = b.x - this.owner.x, dy = b.y - this.owner.y;
                const dist = dx * dx + dy * dy;
                if (dist < closestDist) { closestDist = dist; closest = b; }
            }
            if (closest) {
                const targetAngle = Math.atan2(closest.y - this.owner.y, closest.x - this.owner.x);
                let diff = targetAngle - this.angle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                this.angle += Math.sign(diff) * Math.min(Math.abs(diff), this.rotationSpeed) * this.getDir();
            }
        }

        if (this.cooldown > 0) this.cooldown--;
        this.visualTimer++;

        // Build pressure every frame (rate is per second = per 60 frames), cap at 15
        this.pressure = Math.min(10, this.pressure + this.pressureBuildRate / 60);
        this.scalingStat.value = Math.floor(this.pressure);

        // Jaw snap animation decay
        if (this.jawOpen > 0) this.jawOpen--;
    }

    onHit(target) {
        // Base damage + ALL stored pressure
        const dmg = this.currentDamage + this.pressure;

        target.takeDamage(dmg);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;

        // Jaw snap animation
        this.jawOpen = 15;

        // Reset pressure (or retain 50% post-super)
        if (this.superActive) {
            this.pressure *= 0.3;
        } else {
            this.pressure = 0;
        }

        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);

        this._onHitEffects(target, dmg, '#006400');

        // Snap particles — teeth/crunch
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.emit(target.x, target.y, 6, '#006400');
            WB.Game.particles.emit(target.x, target.y, 3, '#FFFFFF');
        }
    }

    applyScaling() {
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.3);
        // Increase pressure build rate
        const rateMultiplier = this.superActive ? 2 : 1;
        this.pressureBuildRate = (0.6 + this.hitCount * 0.1) * rateMultiplier;
        this.scalingStat.value = Math.floor(this.pressure);
    }

    activateSuper() {
        // Pressure retains 50% (handled in onHit), build rate doubles (handled in applyScaling)
        this.applyScaling();

        // Massive snap burst
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 20, '#006400');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 12, '#228B22');
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;
        const S = WB.WeaponSprites;

        // Pressure ratio 0→1 (pressure ranges 0–10)
        const pRatio = Math.min(1, this.pressure / 10);

        // Pressure shake — ball visibly vibrates as pressure builds
        const shakeMag = Math.min(3, this.pressure * 0.05);
        const shakeX = shakeMag > 0.2 ? (Math.sin(this.visualTimer * 0.7) * shakeMag) : 0;
        const shakeY = shakeMag > 0.2 ? (Math.cos(this.visualTimer * 0.9) * shakeMag) : 0;

        // ── Sprite: Sobek jaw with pressure shake offset ──
        if (S && S._initialized) {
            const spriteScale = 30 * (1 + pRatio * 0.15);
            S.drawSprite('sobek-jaw', this.owner.x + shakeX, this.owner.y + shakeY,
                this.angle, spriteScale, spriteScale, 1.0, 1.0 + pRatio * 0.3);
        }

        // Super: scales pattern on ball
        if (this.superActive) {
            B.setAlpha(0.15);
            for (let i = 0; i < 6; i++) {
                const a = i * Math.PI / 3 + this.visualTimer * 0.005;
                const sx = this.owner.x + Math.cos(a) * r * 0.6;
                const sy = this.owner.y + Math.sin(a) * r * 0.6;
                B.fillCircle(sx, sy, 3, '#228B22');
            }
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('sobek', SobekWeapon, 'egyptian');
