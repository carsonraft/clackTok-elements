window.WB = window.WB || {};

// Saitama: One Punch Man. Looks bored. Normal punches do modest damage.
// No mid-fight transformation — he doesn't need one.
// Super: SERIOUS PUNCH — does 80 damage. Basically an instant kill.
class SaitamaWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'saitama',
            baseDamage: 2,          // "Normal" punches — intentionally modest
            rotationSpeed: 0.03,    // Casual rotation
            reach: 32,
            scalingName: 'Boredom',
            superThreshold: 10,
            isRanged: false,
        });
        this.boredom = 10;
        this.seriousMode = false;
        this.boredTimer = 0;
        this.scalingStat.value = this.boredom;
    }

    update() {
        super.update();
        this.boredTimer++;

        // Saitama doesn't even try that hard
        // Randomly stop rotating briefly (bored)
        if (!this.seriousMode && Math.random() < 0.005) {
            this.rotationSpeed = 0.01;
            setTimeout(() => { this.rotationSpeed = 0.03; }, 500);
        }
    }

    onHit(target) {
        const dmg = this.seriousMode ? this.currentDamage * 3 : this.currentDamage;
        target.takeDamage(dmg);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);

        // Even normal punches have crazy knockback
        const dx = target.x - this.owner.x;
        const dy = target.y - this.owner.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const kb = this.seriousMode ? 10 : 6;
        target.vx += (dx / d) * kb;
        target.vy += (dy / d) * kb;

        const color = this.seriousMode ? '#FFD700' : '#FFF';
        this._onHitEffects(target, dmg, color);
    }

    applyScaling() {
        // Barely scales — he's already at max power
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.2);
        this.boredom = Math.max(1, 10 - this.hitCount);
        this.scalingStat.value = this.boredom;
    }

    activateSuper() {
        // SERIOUS SERIES: SERIOUS PUNCH!!!
        this.seriousMode = true;
        this.rotationSpeed = 0.08;

        // Find nearest enemy and OBLITERATE
        if (WB.Game && WB.Game.balls) {
            const enemy = WB.Game.balls.find(b => b !== this.owner && b.isAlive && b.side !== this.owner.side);
            if (enemy) {
                // Teleport right next to enemy
                const dx = enemy.x - this.owner.x;
                const dy = enemy.y - this.owner.y;
                const d = Math.sqrt(dx * dx + dy * dy) || 1;
                this.owner.x = enemy.x - (dx / d) * (this.owner.radius + enemy.radius + 5);
                this.owner.y = enemy.y - (dy / d) * (this.owner.radius + enemy.radius + 5);

                // THE SERIOUS PUNCH
                enemy.takeDamage(80);

                // INSANE knockback
                enemy.vx += (dx / d) * 20;
                enemy.vy += (dy / d) * 20;

                // Track the hit
                this.hitCount++;
                this.applyScaling();
            }
        }

        // Screen goes CRAZY
        WB.Renderer.triggerShake(30);
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 50, '#FFD700');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 30, '#FFF');
        }
        if (WB.GLEffects) {
            WB.GLEffects.triggerShockwave(this.owner.x, this.owner.y, 1.5);
            WB.GLEffects.triggerChromatic(1.5);
            WB.GLEffects.triggerBarrel(0.8);
            WB.GLEffects.triggerSuperFlash('#FFD700');
            WB.GLEffects.triggerHitStop(12);
        }

        this.currentDamage = 15;
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.seriousMode) {
            B.fillCircleGlow(this.reach - 4, 0, 18, '#FFD700', 30);
        }

        // Arm
        B.line(r - 2, 0, this.reach - 6, 0, '#F5D5A0', this.seriousMode ? 5 : 3.5);

        // Fist — plain but POWERFUL
        const fistSize = this.seriousMode ? 9 : 6;
        B.fillCircle(this.reach - 4, 0, fistSize, '#F5D5A0');
        B.strokeCircle(this.reach - 4, 0, fistSize, '#C9A55A', 1.5);

        // Knuckle lines
        B.line(this.reach - 7, -2, this.reach - 7, 2, '#C9A55A', 1);
        B.line(this.reach - 4, -3, this.reach - 4, 3, '#C9A55A', 1);
        B.line(this.reach - 1, -2, this.reach - 1, 2, '#C9A55A', 1);

        B.popTransform();

        // Bald head shine
        B.setAlpha(0.3);
        B.fillCircle(this.owner.x - r * 0.15, this.owner.y - r * 0.25, r * 0.15, '#FFF');
        B.restoreAlpha();

        // Serious mode — golden aura with wind pressure
        if (this.seriousMode) {
            const flicker = 1 + Math.sin(Date.now() * 0.015) * 0.2;
            B.setAlpha(0.6);
            B.strokeCircle(this.owner.x, this.owner.y, r + 10 * flicker, '#FFD700', 3);
            B.restoreAlpha();
            B.setAlpha(0.15);
            B.fillCircle(this.owner.x, this.owner.y, r + 8, '#FFD700');
            B.restoreAlpha();

            // Wind pressure lines
            const t = Date.now() * 0.008;
            for (let i = 0; i < 4; i++) {
                const a = t + i * 1.57;
                const d = r + 6 + Math.sin(a * 2) * 6;
                const sx = this.owner.x + Math.cos(a) * d;
                const sy = this.owner.y + Math.sin(a) * d;
                B.setAlpha(0.4);
                B.line(sx, sy, sx + Math.cos(a) * 8, sy + Math.sin(a) * 8, '#FFD700', 1.5);
                B.restoreAlpha();
            }
        }
    }
}

WB.WeaponRegistry.register('saitama', SaitamaWeapon);
