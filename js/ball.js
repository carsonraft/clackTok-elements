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
            this.vy += WB.Config.GRAVITY;
        }
        this.vx *= WB.Config.BALL_FRICTION;
        this.vy *= WB.Config.BALL_FRICTION;

        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > WB.Config.BALL_MAX_SPEED) {
            this.vx = (this.vx / speed) * WB.Config.BALL_MAX_SPEED;
            this.vy = (this.vy / speed) * WB.Config.BALL_MAX_SPEED;
        }

        // Smooth continuous steering toward opponent (replaces jerky periodic nudge)
        if (WB.Game && WB.Game.balls) {
            const opponent = WB.Game.balls.find(b => b !== this && b.isAlive && b.side !== this.side);
            if (opponent) {
                const dx = opponent.x - this.x;
                const dy = opponent.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0) {
                    // Spread nudge force evenly across every frame
                    const str = WB.Config.NUDGE_STRENGTH / WB.Config.NUDGE_INTERVAL;
                    this.vx += (dx / dist) * str * 0.7;
                    this.vy += (dy / dist) * str * 0.7;
                    // Light random drift (much gentler than before)
                    if (this.frameCount % 10 === 0) {
                        this.vx += (WB.random() - 0.5) * str * 3;
                        this.vy += (WB.random() - 0.5) * str * 3;
                    }
                }
            }
        }

        const curSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (curSpeed < 1.5) {
            const boost = 2 / Math.max(curSpeed, 0.1);
            this.vx *= boost;
            this.vy *= boost;
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

        if (this.damageFlash > 0) this.damageFlash--;
    }

    takeDamage(amount) {
        if (this.invulnerable) return;
        this.hp -= amount;
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
        const fontSize = Math.max(10, Math.floor(this.radius * 0.6));
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
