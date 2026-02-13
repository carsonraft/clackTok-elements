window.WB = window.WB || {};

// Arena-level effects that modify the battlefield during combat
// (Poseidon flood, Dionysus wall shift, etc.)
WB.ArenaModifiers = {
    _modifiers: [],

    add(modifier) {
        this._modifiers.push(modifier);
    },

    clear() {
        this._modifiers = [];
    },

    update() {
        for (const m of this._modifiers) {
            if (m.update) m.update();
        }
    },

    draw() {
        const B = WB.GLBatch;
        for (const m of this._modifiers) {
            if (m.draw) m.draw();
        }
    },

    // Query helpers for specific modifier types
    getModifier(type) {
        return this._modifiers.find(m => m.type === type) || null;
    }
};

// ─── Poseidon Flood ────────────────────────────────────────
// Rising water line that slows non-Poseidon balls below it
WB.PoseidonFlood = class {
    constructor(owner) {
        this.type = 'flood';
        this.owner = owner;  // Poseidon's ball
        const a = WB.Config.ARENA;
        this.waterLineY = a.y + a.height; // starts at arena bottom
        this.riseAmount = a.height * 0.05; // 5% per hit
        this.slowFactor = 0.97; // per-frame velocity multiplier
    }

    // Called from Poseidon weapon on hit after super
    rise() {
        const a = WB.Config.ARENA;
        this.waterLineY = Math.max(a.y + a.height * 0.2, this.waterLineY - this.riseAmount);
    }

    update() {
        if (!WB.Game || !WB.Game.balls) return;
        for (const b of WB.Game.balls) {
            if (!b.isAlive) continue;
            // Poseidon (same side as owner) is immune
            if (this.owner && b.side === this.owner.side) continue;
            // Slow balls below water line
            if (b.y + b.radius > this.waterLineY) {
                b.vx *= this.slowFactor;
                b.vy *= this.slowFactor;
            }
        }
    }

    draw() {
        const B = WB.GLBatch;
        const a = WB.Config.ARENA;
        const waterH = (a.y + a.height) - this.waterLineY;
        if (waterH <= 0) return;

        // Water body
        B.setAlpha(0.15);
        B.fillRect(a.x, this.waterLineY, a.width, waterH, '#008080');
        B.restoreAlpha();

        // Wavy surface line
        B.setAlpha(0.4);
        B.line(a.x, this.waterLineY, a.x + a.width, this.waterLineY, '#00AAAA', 2);
        B.restoreAlpha();
    }
};

// ─── Dionysus Wall Shift ───────────────────────────────────
// Arena walls lerp to random positions every 3 seconds
WB.DionysusWallShift = class {
    constructor() {
        this.type = 'wallshift';
        this.timer = 0;
        this.shiftRate = 180; // 3 sec at 60fps
        this.maxShift = 0.15; // 15% max shift in any direction
        this._baseArena = {
            x: WB.Config.ARENA.x,
            y: WB.Config.ARENA.y,
            width: WB.Config.ARENA.width,
            height: WB.Config.ARENA.height
        };
        this.targetDx = 0;
        this.targetDy = 0;
        this.targetDw = 0;
        this.targetDh = 0;
        this.dx = 0;
        this.dy = 0;
        this.dw = 0;
        this.dh = 0;
    }

    update() {
        this.timer++;
        if (this.timer >= this.shiftRate) {
            this.timer = 0;
            const maxX = this._baseArena.width * this.maxShift;
            const maxY = this._baseArena.height * this.maxShift;
            // Random offset for position
            this.targetDx = (WB.random() - 0.5) * 2 * maxX;
            this.targetDy = (WB.random() - 0.5) * 2 * maxY;
            // Slight width/height squeeze (shrink only, max 10%)
            this.targetDw = -WB.random() * this._baseArena.width * 0.1;
            this.targetDh = -WB.random() * this._baseArena.height * 0.1;
        }

        // Smooth lerp toward target
        const lerp = 0.02;
        this.dx += (this.targetDx - this.dx) * lerp;
        this.dy += (this.targetDy - this.dy) * lerp;
        this.dw += (this.targetDw - this.dw) * lerp;
        this.dh += (this.targetDh - this.dh) * lerp;

        // Apply to arena config
        WB.Config.ARENA.x = this._baseArena.x + this.dx;
        WB.Config.ARENA.y = this._baseArena.y + this.dy;
        WB.Config.ARENA.width = this._baseArena.width + this.dw;
        WB.Config.ARENA.height = this._baseArena.height + this.dh;

        // Push any balls that ended up outside the shifted arena back inside
        if (WB.Game && WB.Game.balls) {
            const a = WB.Config.ARENA;
            for (const b of WB.Game.balls) {
                if (!b.isAlive) continue;
                if (b.x - b.radius < a.x) b.x = a.x + b.radius;
                if (b.x + b.radius > a.x + a.width) b.x = a.x + a.width - b.radius;
                if (b.y - b.radius < a.y) b.y = a.y + b.radius;
                if (b.y + b.radius > a.y + a.height) b.y = a.y + a.height - b.radius;
            }
        }
    }

    // Restore original arena bounds (call on battle end)
    restore() {
        WB.Config.ARENA.x = this._baseArena.x;
        WB.Config.ARENA.y = this._baseArena.y;
        WB.Config.ARENA.width = this._baseArena.width;
        WB.Config.ARENA.height = this._baseArena.height;
    }

    draw() {
        // Arena draws from WB.Config.ARENA, so no extra drawing needed
        // Optional: add visual indicator of shifting
        if (Math.abs(this.dx) > 2 || Math.abs(this.dy) > 2) {
            const B = WB.GLBatch;
            const a = WB.Config.ARENA;
            B.setAlpha(0.08);
            B.fillRect(a.x, a.y, a.width, a.height, '#8B00FF');
            B.restoreAlpha();
        }
    }
};
