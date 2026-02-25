window.WB = window.WB || {};

WB.Ball = class {
    constructor(x, y, weaponType, side, opts) {
        const o = opts || {};
        this.x = x;
        this.y = y;
        this.vx = (WB.random() - 0.5) * 3;
        this.vy = (WB.random() - 0.5) * 3;
        this.radius = o.radius || WB.Config.BALL_RADIUS;
        this.mass = (this.radius / WB.Config.BALL_RADIUS) * WB.Config.BALL_MASS;
        this.hp = o.hp || WB.Config.BALL_MAX_HP;
        this.maxHp = this.hp;
        this.color = WB.Config.COLORS[weaponType];
        this.weaponType = weaponType;
        this.side = side; // 'left' or 'right'
        this.isAlive = true;
        this.isOriginal = o.isOriginal !== undefined ? o.isOriginal : true;
        this.weapon = WB.WeaponRegistry.create(weaponType, this);
        this.poisonStacks = 0;
        this.poisonTickTimer = 0;
        this.invulnerable = false;
        this.frameCount = 0;
        this.damageFlash = 0;

        // Per-ball overrides (used by god weapons)
        this.maxSpeed = WB.Config.BALL_MAX_SPEED;
        this.gravityMultiplier = 1.0;

        // Debuff system (used by Greek Pantheon weapons)
        this.debuffs = {
            burn: [],           // Array of { damage, remaining, tickRate, timer }
            forgeMarks: 0,      // Hephaestus: damage resistance reduction
            madness: 0,         // Dionysus: stacks
            madnessDecayTimer: 0,
            movementInverted: 0, // frames remaining
            weaponReversed: 0,   // frames remaining
            slowFactor: 1,       // Poseidon: velocity multiplier (1=normal, 0.5=half speed)
            slowTimer: 0,        // frames remaining
            venomStacks: 0,      // Wadjet: permanent speed reduction (3% per stack)
        };
    }

    update() {
        this.frameCount++;

        this.x += this.vx;
        this.y += this.vy;
        if (WB.Config.GRAVITY_MODE) {
            const grav = WB.Config.GRAVITY * this.gravityMultiplier;
            const dir = this.debuffs.movementInverted > 0 ? -1 : 1;
            // Gravity angle support (Set's super shifts GRAVITY_ANGLE)
            const ga = WB.Config.GRAVITY_ANGLE;
            this.vx += Math.cos(ga) * grav * dir;
            this.vy += Math.sin(ga) * grav * dir;
        }
        this.vx *= WB.Config.BALL_FRICTION;
        this.vy *= WB.Config.BALL_FRICTION;

        // Poseidon slow debuff
        if (this.debuffs.slowTimer > 0) {
            this.vx *= this.debuffs.slowFactor;
            this.vy *= this.debuffs.slowFactor;
        }

        // Wadjet venom stacks — permanent speed reduction (4% per stack, max 80% reduction)
        if (this.debuffs.venomStacks > 0) {
            const venomMult = Math.max(0.2, 1 - this.debuffs.venomStacks * 0.04);
            this.vx *= venomMult;
            this.vy *= venomMult;
        }

        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > this.maxSpeed) {
            this.vx = (this.vx / speed) * this.maxSpeed;
            this.vy = (this.vy / speed) * this.maxSpeed;
        }

        const wallHit = WB.Physics.bounceOffWalls(this, WB.Config.ARENA);
        if (wallHit) {
            const s = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            WB.Audio.wallClack(s);
            // Wall impact visual effects
            if (WB.GLEffects) {
                // Determine wall contact point
                const a = WB.Config.ARENA;
                let wx = this.x, wy = this.y;
                if (this.x - this.radius <= a.x) wx = a.x;
                else if (this.x + this.radius >= a.x + a.width) wx = a.x + a.width;
                if (this.y - this.radius <= a.y) wy = a.y;
                else if (this.y + this.radius >= a.y + a.height) wy = a.y + a.height;
                WB.GLEffects.spawnWallImpact(wx, wy, s, this.color);
                if (s >= 7) {
                    WB.GLEffects.triggerHitStop(2);
                    WB.Renderer.triggerShake(2 + s * 0.3);
                }
                if (s >= 10) {
                    WB.GLEffects.triggerShockwave(wx, wy, s * 0.015);
                }
            }
        }

        this.weapon.update();

        if (this.poisonStacks > 0) {
            this.poisonTickTimer++;
            if (this.poisonTickTimer >= 30) {
                this.takeDamage(this.poisonStacks * 0.5);
                this.poisonTickTimer = 0;
                WB.Audio.poisonTick();
            }
        }

        // ─── Debuff processing ─────────────────────────
        const d = this.debuffs;

        // Burn DOTs (Apollo)
        for (let i = d.burn.length - 1; i >= 0; i--) {
            const b = d.burn[i];
            b.timer++;
            if (b.timer >= b.tickRate) {
                this.takeDamage(b.damage);
                b.timer = 0;
            }
            b.remaining--;
            if (b.remaining <= 0) d.burn.splice(i, 1);
        }

        // Madness stack decay (Dionysus) — lose 1 stack every 5 sec
        if (d.madness > 0) {
            d.madnessDecayTimer++;
            if (d.madnessDecayTimer >= 300) {
                d.madness = Math.max(0, d.madness - 1);
                d.madnessDecayTimer = 0;
            }
        }

        // Debuff timers
        if (d.movementInverted > 0) d.movementInverted--;
        if (d.weaponReversed > 0) d.weaponReversed--;
        if (d.slowTimer > 0) {
            d.slowTimer--;
            if (d.slowTimer <= 0) d.slowFactor = 1; // restore speed
        }

        if (this.damageFlash > 0) this.damageFlash--;
    }

    takeDamage(amount) {
        if (this.invulnerable) return;
        // Forge marks amplify incoming damage (Hephaestus debuff)
        const multiplier = 1 + (this.debuffs.forgeMarks * 0.3);
        this.hp -= amount * multiplier;
        this.damageFlash = 6;
        if (this.hp <= 0) {
            this.hp = 0;
            this.isAlive = false;
        }
    }

    getSpeed() {
        return Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    }

    draw() {
        const B = WB.GLBatch;
        const T = WB.GLText;
        // DPR-aware stroke widths — compensate for loss of bilinear blur on HiDPI
        const hiDpi = WB.GL.dpr >= 1.5;
        const outlineW = hiDpi ? 3 : 2.5;
        const debuffW = hiDpi ? 2.5 : 2;
        const markW = hiDpi ? 2 : 1.5;

        // Ball body
        const fillColor = this.damageFlash > 0 ? '#FFF' : this.color;
        B.fillCircle(this.x, this.y, this.radius, fillColor);

        // Ball image overlay — state flags take priority, then user-uploaded images
        if (WB.BallImages && this.damageFlash <= 0) {
            if (WB.BallImages.hasFlag(this.weaponType)) {
                WB.BallImages.drawFlagCircle(this.x, this.y, this.radius - 2, this.weaponType);
            } else if (WB.BallImages.hasImage(this.side)) {
                WB.BallImages.drawCircle(this.x, this.y, this.radius - 2, this.side);
            }
        }

        B.strokeCircle(this.x, this.y, this.radius, '#333', outlineW);

        // Poison visual
        if (this.poisonStacks > 0) {
            const poisonAlpha = Math.min(0.3, this.poisonStacks * 0.05);
            B.setAlpha(poisonAlpha);
            B.fillCircle(this.x, this.y, this.radius - 2, '#00C800');
            B.restoreAlpha();
        }

        // ─── Debuff indicators on victim ─────────────────
        const d = this.debuffs;

        // Venom stacks (Wadjet) — green edge tint, scales with stacks
        if (d.venomStacks > 0) {
            const venomAlpha = Math.min(0.25, d.venomStacks * 0.03);
            B.setAlpha(venomAlpha);
            B.strokeCircle(this.x, this.y, this.radius - 1, '#00A86B', debuffW);
            B.restoreAlpha();
        }

        // Burn DOT (Apollo) — orange flicker overlay
        if (d.burn.length > 0) {
            const burnPulse = Math.sin(this.frameCount * 0.2) * 0.08;
            B.setAlpha(0.15 + burnPulse);
            B.fillCircle(this.x, this.y, this.radius - 2, '#FF8C00');
            B.restoreAlpha();
        }

        // Slow (Poseidon) — blue tint ring
        if (d.slowTimer > 0) {
            B.setAlpha(0.2);
            B.strokeCircle(this.x, this.y, this.radius + 1, '#4169E1', debuffW);
            B.restoreAlpha();
        }

        // Forge marks (Hephaestus) — orange tick marks around circumference
        if (d.forgeMarks > 0) {
            const marks = Math.min(10, d.forgeMarks);
            B.setAlpha(0.3);
            for (let i = 0; i < marks; i++) {
                const a = (i / marks) * Math.PI * 2;
                const ix = this.x + Math.cos(a) * (this.radius + 1);
                const iy = this.y + Math.sin(a) * (this.radius + 1);
                const ox = this.x + Math.cos(a) * (this.radius + 4);
                const oy = this.y + Math.sin(a) * (this.radius + 4);
                B.line(ix, iy, ox, oy, '#FF8C00', markW);
            }
            B.restoreAlpha();
        }

        // Super indicator
        if (this.weapon.superActive) {
            B.strokeCircle(this.x, this.y, this.radius + 2, this.color, debuffW);
        }

        B.flush();

        // HP text — 6-pass with cardinal outlines for readability over flag textures
        const fontSize = Math.max(12, Math.floor(this.radius * 0.7));
        const font = `bold ${fontSize}px "Courier New", monospace`;
        const hpText = Math.ceil(this.hp).toString();
        T.drawTextWithStroke(hpText, this.x, this.y, font, '#FFF', '#222', 3, 'center', 'middle');
    }

    drawDead() {
        const B = WB.GLBatch;
        const hiDpi = WB.GL.dpr >= 1.5;
        const lw = hiDpi ? 2.5 : 2;

        B.setAlpha(0.3);
        B.fillCircle(this.x, this.y, this.radius, '#888');
        B.strokeCircle(this.x, this.y, this.radius, '#555', lw);

        // X eyes
        B.line(this.x - 8, this.y - 6, this.x - 2, this.y, '#333', lw);
        B.line(this.x - 2, this.y - 6, this.x - 8, this.y, '#333', lw);
        B.line(this.x + 2, this.y - 6, this.x + 8, this.y, '#333', lw);
        B.line(this.x + 8, this.y - 6, this.x + 2, this.y, '#333', lw);
        B.restoreAlpha();
    }
};
