window.WB = window.WB || {};

// Ra — Sun Disk: Melee spin with damage that oscillates on a 12-second sine wave.
// Peak damage: 4 (gold), Trough damage: 1 (charcoal). Cycle is independent of hits.
// Scaling: Each hit increases PEAK damage by +0.5. Trough stays at 1.
// Super (12 hits): Cycle freezes at peak permanently. Eternal noon.
// Ball color shifts from gold (#FFD700) to charcoal (#333333) continuously.
class RaWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'ra',
            baseDamage: 9,
            rotationSpeed: 0.09,
            reach: 88,
            scalingName: 'Peak Dmg',
            superThreshold: 10,
        });
        this.cycleTimer = 0;
        this.cycleDuration = 480; // 8 seconds at 60fps
        this.peakDamage = 9;
        this.troughDamage = 2;
        this.frozenAtPeak = false;
        this.scalingStat.value = this.peakDamage;
    }

    _getCyclePhase() {
        if (this.frozenAtPeak) return 1; // always peak
        // Sine wave: 0→1→0 over cycleDuration
        return Math.abs(Math.sin(Math.PI * this.cycleTimer / this.cycleDuration));
    }

    _getCurrentDamage() {
        const phase = this._getCyclePhase();
        return this.troughDamage + (this.peakDamage - this.troughDamage) * phase;
    }

    update() {
        super.update();
        this.cycleTimer++;

        // Update ball color based on cycle phase
        const phase = this._getCyclePhase();
        this.owner.color = this._lerpColor('#333333', '#FFD700', phase);
        this.currentDamage = this._getCurrentDamage();
    }

    _lerpColor(a, b, t) {
        const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16);
        const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
        const r = Math.round(ar + (br - ar) * t);
        const g = Math.round(ag + (bg - ag) * t);
        const bl = Math.round(ab + (bb - ab) * t);
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
    }

    onHit(target) {
        const dmg = this._getCurrentDamage();
        target.takeDamage(dmg);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);

        // Color effects based on phase
        const phase = this._getCyclePhase();
        const effectColor = phase > 0.5 ? '#FFD700' : '#666666';
        this._onHitEffects(target, dmg, effectColor);

        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.emit(target.x, target.y, 3 + Math.floor(phase * 4), effectColor);
        }
    }

    applyScaling() {
        this.peakDamage = 9 + this.hitCount * 0.8;
        this.currentDamage = this._getCurrentDamage();
        this.scalingStat.value = this.peakDamage.toFixed(1);
    }

    activateSuper() {
        // Eternal noon — freeze at peak
        this.frozenAtPeak = true;
        this.owner.color = '#FFD700';

        // Sun burst
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 25, '#FFD700');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 15, '#FFA500');
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;
        const phase = this._getCyclePhase();
        const S = WB.WeaponSprites;

        // ── Pre-overlay: Corona sprite (sun rays around ball) ──
        if (S && S._initialized) {
            const rayLen = 6 + phase * 10;
            const coronaScale = r + rayLen;
            const coronaAlpha = 0.15 + phase * 0.25;
            S.drawSprite('ra-corona', this.owner.x, this.owner.y,
                this.cycleTimer * 0.01, coronaScale, coronaScale, coronaAlpha, 1.0);
        }

        // ── Main sprite: Ra disk weapon ──
        if (S && S._initialized) {
            const spriteScale = this.reach * 0.6;
            S.drawSprite('ra-disk', this.owner.x, this.owner.y, this.angle,
                spriteScale, spriteScale, 1.0, 0.5 + phase * 0.8);
        }

        // Frozen at peak indicator
        if (this.frozenAtPeak) {
            const pulse = Math.sin(Date.now() * 0.005) * 0.04;
            B.setAlpha(0.12 + pulse);
            B.strokeCircle(this.owner.x, this.owner.y, r + 14, '#FFD700', 2);
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('ra', RaWeapon, 'egyptian');
