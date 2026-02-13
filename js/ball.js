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
        this.trail = [];

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
        };
    }

    update() {
        this.frameCount++;

        // Trail frequency scales with speed — faster = more afterimages
        const trailSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const trailInterval = trailSpeed > 7 ? 1 : trailSpeed > 4 ? 2 : 3;
        const maxTrail = trailSpeed > 7 ? 14 : trailSpeed > 4 ? 10 : 8;
        if (this.frameCount % trailInterval === 0) {
            this.trail.push({ x: this.x, y: this.y, speed: trailSpeed });
            if (this.trail.length > maxTrail) this.trail.shift();
        }

        this.x += this.vx;
        this.y += this.vy;
        if (WB.Config.GRAVITY_MODE) {
            const grav = WB.Config.GRAVITY * this.gravityMultiplier;
            // Movement inversion: gravity goes wrong direction
            this.vy += this.debuffs.movementInverted > 0 ? -grav : grav;
        }
        this.vx *= WB.Config.BALL_FRICTION;
        this.vy *= WB.Config.BALL_FRICTION;

        // Poseidon slow debuff
        if (this.debuffs.slowTimer > 0) {
            this.vx *= this.debuffs.slowFactor;
            this.vy *= this.debuffs.slowFactor;
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
                // Wall bounces — lowered thresholds for more clackiness
                if (s >= 4) {
                    WB.GLEffects.triggerHitStop(2);
                    WB.Renderer.triggerShake(3 + s * 0.6);
                    WB.GLEffects.triggerChromatic(s * 0.04);
                }
                if (s >= 6) {
                    WB.GLEffects.triggerShockwave(wx, wy, s * 0.025);
                    WB.GLEffects.triggerArenaPulse(this.color);
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

        // Trail — intensity scales with speed
        for (let i = 0; i < this.trail.length; i++) {
            const t = this.trail[i];
            const speedFactor = Math.min(1, (t.speed || 3) / 8);
            const alpha = (i / this.trail.length) * (0.1 + speedFactor * 0.2);
            const scale = 0.85 + (i / this.trail.length) * 0.1;
            B.setAlpha(alpha);
            B.fillCircle(t.x, t.y, this.radius * scale, this.color);
            B.restoreAlpha();
        }

        // Shadow
        B.fillCircle(this.x + 2, this.y + 2, this.radius, 'rgba(0,0,0,0.15)');

        // Ball body
        const fillColor = this.damageFlash > 0 ? '#FFF' : this.color;
        B.fillCircle(this.x, this.y, this.radius, fillColor);
        B.strokeCircle(this.x, this.y, this.radius, '#333', 2.5);

        // Poison visual
        if (this.poisonStacks > 0) {
            const poisonAlpha = Math.min(0.3, this.poisonStacks * 0.05);
            B.fillCircle(this.x, this.y, this.radius - 2, `rgba(0, 200, 0, ${poisonAlpha})`);
        }

        // Super glow
        if (this.weapon.superActive) {
            B.fillCircleGlow(this.x, this.y, this.radius + 2, this.color, 15);
            B.strokeCircle(this.x, this.y, this.radius + 2, this.color, 2);
        }

        B.flush();

        // HP text
        const fontSize = Math.max(12, Math.floor(this.radius * 0.7));
        const font = `bold ${fontSize}px "Courier New", monospace`;
        const hpText = Math.ceil(this.hp).toString();
        T.drawTextWithStroke(hpText, this.x, this.y, font, '#FFF', '#333', 3, 'center', 'middle');
    }

    drawDead() {
        const B = WB.GLBatch;

        B.setAlpha(0.3);
        B.fillCircle(this.x, this.y, this.radius, '#888');
        B.strokeCircle(this.x, this.y, this.radius, '#555', 2);

        // X eyes
        B.line(this.x - 8, this.y - 6, this.x - 2, this.y, '#333', 2);
        B.line(this.x - 2, this.y - 6, this.x - 8, this.y, '#333', 2);
        B.line(this.x + 2, this.y - 6, this.x + 8, this.y, '#333', 2);
        B.line(this.x + 8, this.y - 6, this.x + 2, this.y, '#333', 2);
        B.restoreAlpha();
    }
};
