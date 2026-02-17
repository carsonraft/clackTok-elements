window.WB = window.WB || {};

// ─── WebGL Effects: Shake, Impact Rings, Speed Lines, Damage Numbers, Vignette ──
WB.GLEffects = {
    _shakeX: 0,
    _shakeY: 0,

    // Impact rings — expanding circles on hit
    _impacts: [],
    // Damage numbers — floating text
    _dmgNumbers: [],
    // Speed lines — radial lines behind fast-moving balls
    _speedLineTimer: 0,
    // Super activation flash
    _superFlash: 0,
    _superFlashColor: '#FFF',
    // Arena energy pulse on big hits
    _arenaPulse: 0,
    _arenaPulseColor: '#FFF',
    // Hit stop (freeze frames)
    _hitStop: 0,
    // Combo counter
    _combo: { left: 0, right: 0, leftTimer: 0, rightTimer: 0, leftDisplay: 0, rightDisplay: 0 },
    // Wall impact rings
    _wallImpacts: [],
    // Collision flash
    _collisionFlash: 0,
    _collisionFlashColor: '#FFF',

    init() {
        this._impacts = [];
        this._dmgNumbers = [];
        this._wallImpacts = [];
        this._combo = { left: 0, right: 0, leftTimer: 0, rightTimer: 0, leftDisplay: 0, rightDisplay: 0 };
    },

    resetFrame() {
        this._shakeX = 0;
        this._shakeY = 0;
    },

    applyShake(x, y) {
        const w = WB.GL.width;
        const h = WB.GL.height;
        const proj = WB.GL.projMatrix;
        proj[0] = 2 / w;   proj[1] = 0;       proj[2] = 0;
        proj[3] = 0;        proj[4] = -2 / h;  proj[5] = 0;
        proj[6] = -1 + 2 * x / w;
        proj[7] = 1 - 2 * y / h;
        proj[8] = 1;
    },

    clearShake() {
        const w = WB.GL.width;
        const h = WB.GL.height;
        const proj = WB.GL.projMatrix;
        proj[0] = 2 / w;  proj[1] = 0;       proj[2] = 0;
        proj[3] = 0;       proj[4] = -2 / h;  proj[5] = 0;
        proj[6] = -1;      proj[7] = 1;       proj[8] = 1;
    },

    // ─── Impact Ring ─────────────────────────────────
    // Called when a hit lands — creates an expanding ring
    spawnImpact(x, y, color, size) {
        this._impacts.push({
            x, y,
            color: color || '#FFF',
            maxRadius: size || 40,
            radius: 5,
            life: 1.0,
            speed: (size || 40) / 12,
        });
    },

    // ─── Damage Number ───────────────────────────────
    // Floating damage text that rises and fades
    spawnDamageNumber(x, y, amount, color) {
        this._dmgNumbers.push({
            x: x + (Math.random() - 0.5) * 20,
            y: y - 15,
            vy: -1.5,
            text: '-' + Math.ceil(amount),
            color: color || '#FF4444',
            life: 1.0,
            scale: 1.2,
        });
    },

    // ─── Super Flash ─────────────────────────────────
    // Full-screen flash when super activates
    triggerSuperFlash(color) {
        this._superFlash = 1.0;
        this._superFlashColor = color || '#FFF';
    },

    // ─── Arena Pulse ─────────────────────────────────
    // Arena border pulses with color on big hits
    triggerArenaPulse(color) {
        this._arenaPulse = 1.0;
        this._arenaPulseColor = color || '#FFF';
    },

    // ─── Hit Stop ────────────────────────────────────
    // Brief freeze frames on big hits
    triggerHitStop(frames) {
        this._hitStop = Math.max(this._hitStop, frames || 3);
    },

    // ─── Combo Counter ────────────────────────────────
    // Track consecutive hits per side
    incrementCombo(side) {
        const c = this._combo;
        if (side === 'left') {
            c.left++;
            c.leftTimer = 120; // ~2 seconds to chain — generous combo window
            c.leftDisplay = Math.max(c.leftDisplay, c.left);
        } else {
            c.right++;
            c.rightTimer = 120;
            c.rightDisplay = Math.max(c.rightDisplay, c.right);
        }
    },

    getCombo(side) {
        return side === 'left' ? this._combo.left : this._combo.right;
    },

    // ─── Wall Impact ──────────────────────────────────
    // Visual ring + sparks where a ball hits a wall
    spawnWallImpact(x, y, speed, color) {
        if (speed < 5) return;
        const intensity = Math.min(1, speed / 10);
        this._wallImpacts.push({
            x, y, color,
            radius: 5,
            maxRadius: 15 + intensity * 25,
            life: 1.0,
            speed: 2 + intensity * 2.5,
        });
        // Small spark at wall contact
        if (WB.Game && WB.Game.particles) {
            const count = Math.floor(1 + intensity * 2);
            for (let i = 0; i < count; i++) {
                WB.Game.particles.emit(x, y, 1, color, {
                    speed: 2 + Math.random() * 3 * intensity,
                    life: 6 + Math.random() * 8,
                    size: 1 + Math.random() * 2,
                });
            }
        }
    },

    // ─── Collision Flash ──────────────────────────────
    // Quick screen flash on ball-ball collisions
    triggerCollisionFlash(color) {
        this._collisionFlash = 0.4;
        this._collisionFlashColor = color || '#FFF';
    },

    // ─── Screen Deformation Helpers ───────────────────
    triggerShockwave(x, y, intensity) {
        if (WB.GL && WB.GL.triggerShockwave) {
            WB.GL.triggerShockwave(x, y, intensity || 0.3, 0.035);
        }
    },
    triggerChromatic(intensity) {
        if (WB.GL && WB.GL.triggerChromaticAberration) {
            WB.GL.triggerChromaticAberration(intensity || 0.5);
        }
    },
    triggerBarrel(intensity) {
        if (WB.GL && WB.GL.triggerBarrelDistort) {
            WB.GL.triggerBarrelDistort(intensity || 0.3);
        }
    },

    // ─── Check if in hit stop ────────────────────────
    isHitStopped() {
        return this._hitStop > 0;
    },

    // ─── Update all effects ──────────────────────────
    update() {
        // Hit stop countdown
        if (this._hitStop > 0) {
            this._hitStop--;
        }

        // Update impact rings
        for (let i = this._impacts.length - 1; i >= 0; i--) {
            const imp = this._impacts[i];
            imp.radius += imp.speed;
            imp.life -= 0.07;
            if (imp.life <= 0) this._impacts.splice(i, 1);
        }

        // Update damage numbers
        for (let i = this._dmgNumbers.length - 1; i >= 0; i--) {
            const dn = this._dmgNumbers[i];
            dn.y += dn.vy;
            dn.vy *= 0.97;
            dn.life -= 0.025;
            dn.scale *= 0.98;
            if (dn.life <= 0) this._dmgNumbers.splice(i, 1);
        }

        // Super flash decay
        if (this._superFlash > 0) {
            this._superFlash -= 0.06;
            if (this._superFlash < 0) this._superFlash = 0;
        }

        // Arena pulse decay
        if (this._arenaPulse > 0) {
            this._arenaPulse -= 0.05;
            if (this._arenaPulse < 0) this._arenaPulse = 0;
        }

        // Collision flash decay
        if (this._collisionFlash > 0) {
            this._collisionFlash -= 0.1;
            if (this._collisionFlash < 0) this._collisionFlash = 0;
        }

        // Combo timers
        const c = this._combo;
        if (c.leftTimer > 0) {
            c.leftTimer--;
            if (c.leftTimer <= 0) { c.left = 0; c.leftDisplay = 0; }
        }
        if (c.rightTimer > 0) {
            c.rightTimer--;
            if (c.rightTimer <= 0) { c.right = 0; c.rightDisplay = 0; }
        }

        // Wall impacts
        for (let i = this._wallImpacts.length - 1; i >= 0; i--) {
            const wi = this._wallImpacts[i];
            wi.radius += wi.speed;
            wi.life -= 0.08;
            if (wi.life <= 0) this._wallImpacts.splice(i, 1);
        }
    },

    // ─── Draw all effects ────────────────────────────
    draw() {
        const B = WB.GLBatch;
        const T = WB.GLText;
        const c = WB.Config;

        // Impact rings
        for (const imp of this._impacts) {
            B.setAlpha(imp.life * 0.2);
            B.strokeCircle(imp.x, imp.y, imp.radius, imp.color, 1.5 * imp.life);
            B.restoreAlpha();
        }

        // Arena energy pulse (border glow)
        if (this._arenaPulse > 0) {
            const a = c.ARENA;
            const pulseAlpha = this._arenaPulse * 0.3;
            const pulseWidth = 2 + this._arenaPulse * 3;
            B.setAlpha(pulseAlpha);
            B.strokeRect(a.x - 2, a.y - 2, a.width + 4, a.height + 4, this._arenaPulseColor, pulseWidth);
            B.restoreAlpha();
        }

        B.flush();

        // Damage numbers
        for (const dn of this._dmgNumbers) {
            const size = Math.round(20 * dn.scale);
            const font = `bold ${size}px "Courier New", monospace`;
            T.drawTextWithStroke(dn.text, dn.x, dn.y, font, dn.color, '#000', 2, 'center', 'middle');
        }

        T.flush();

        // Wall impact rings
        for (const wi of this._wallImpacts) {
            B.setAlpha(wi.life * 0.2);
            B.strokeCircle(wi.x, wi.y, wi.radius, wi.color, 1.0 * wi.life);
            B.restoreAlpha();
        }

        // Super flash overlay (full screen flash)
        if (this._superFlash > 0) {
            const rgba = WB.GL.parseColor(this._superFlashColor);
            const flashColor = `rgba(${Math.round(rgba[0]*255)},${Math.round(rgba[1]*255)},${Math.round(rgba[2]*255)},${this._superFlash * 0.1})`;
            B.fillRect(-10, -10, c.CANVAS_WIDTH + 20, c.CANVAS_HEIGHT + 20, flashColor);
            B.flush();
        }

        // Combo counters
        this._drawCombo(B, T, c);
    },

    // ─── Draw Combo Counter ───────────────────────────
    _drawCombo(B, T, c) {
        const combo = this._combo;
        const a = c.ARENA;

        // Left combo
        if (combo.left >= 2) {
            const scale = 1 + Math.min(combo.left * 0.05, 0.5);
            const size = Math.round(24 * scale);
            const font = `bold ${size}px "Courier New", monospace`;
            const comboColor = combo.left >= 10 ? '#FFD700' : combo.left >= 5 ? '#FF6600' : '#FFF';
            T.drawTextWithStroke(`${combo.left}x`, a.x + 50, a.y + 30, font, comboColor, '#333', 3, 'center', 'alphabetic');
        }

        // Right combo
        if (combo.right >= 2) {
            const scale = 1 + Math.min(combo.right * 0.05, 0.5);
            const size = Math.round(24 * scale);
            const font = `bold ${size}px "Courier New", monospace`;
            const comboColor = combo.right >= 10 ? '#FFD700' : combo.right >= 5 ? '#FF6600' : '#FFF';
            T.drawTextWithStroke(`${combo.right}x`, a.x + a.width - 50, a.y + 30, font, comboColor, '#333', 3, 'center', 'alphabetic');
        }
    },

    drawSpeedLines(ball) {
        // Removed — visual noise
    },

    // ─── Clash Sparks ────────────────────────────────
    // Radial spark lines at a collision point
    spawnClashSparks(x, y, count, color) {
        const B = WB.GLBatch;
        if (WB.Game && WB.Game.particles) {
            count = Math.ceil((count || 12) * 0.25);
            const colors = [color || '#FFD700', '#FFF', '#FFA500', '#FF6'];
            for (let i = 0; i < count; i++) {
                const c = colors[Math.floor(Math.random() * colors.length)];
                WB.Game.particles.emit(x, y, 1, c, {
                    speed: 6 + Math.random() * 5,
                    life: 8 + Math.random() * 12,
                    size: 1.5 + Math.random() * 2
                });
            }
        }
    },
};
