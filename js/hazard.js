window.WB = window.WB || {};

// Persistent area-damage zone (used by Apollo sunbeam patches, Hephaestus fire trails, etc.)
WB.Hazard = class {
    constructor(config) {
        this.x = config.x;
        this.y = config.y;
        this.radius = config.radius || 20;
        this.damage = config.damage || 1;
        this.tickRate = config.tickRate || 30;   // frames between damage ticks per target
        this.lifespan = config.lifespan || 120;
        this.maxLife = this.lifespan;
        this.color = config.color || '#FF4411';
        this.owner = config.owner || null;       // Ball that created it (for side checks)
        this.ownerWeapon = config.ownerWeapon || null;
        this.alive = true;
        this._hitTimers = new Map();             // target → cooldown frames remaining
        this.vx = config.vx || 0;               // optional drift velocity
        this.vy = config.vy || 0;
    }

    update() {
        this.lifespan--;
        if (this.lifespan <= 0) { this.alive = false; return; }

        // Drift (used by Zeus ball lightning)
        if (this.vx !== 0 || this.vy !== 0) {
            this.x += this.vx;
            this.y += this.vy;
            // Bounce off arena walls
            const a = WB.Config.ARENA;
            if (this.x - this.radius < a.x) { this.vx = Math.abs(this.vx); this.x = a.x + this.radius; }
            if (this.x + this.radius > a.x + a.width) { this.vx = -Math.abs(this.vx); this.x = a.x + a.width - this.radius; }
            if (this.y - this.radius < a.y) { this.vy = Math.abs(this.vy); this.y = a.y + this.radius; }
            if (this.y + this.radius > a.y + a.height) { this.vy = -Math.abs(this.vy); this.y = a.y + a.height - this.radius; }
        }

        // Check damage against balls
        if (WB.Game && WB.Game.balls) {
            for (const target of WB.Game.balls) {
                if (!target.isAlive) continue;
                // Don't hit same side
                if (this.owner && target.side === this.owner.side) continue;
                // Per-target cooldown
                const cd = this._hitTimers.get(target) || 0;
                if (cd > 0) { this._hitTimers.set(target, cd - 1); continue; }
                // Circle collision
                if (WB.Physics.circleCircle(this.x, this.y, this.radius, target.x, target.y, target.radius)) {
                    target.takeDamage(this.damage);
                    this._hitTimers.set(target, this.tickRate);
                    // Track hit for weapon scaling
                    if (this.ownerWeapon) {
                        this.ownerWeapon.hitCount++;
                        this.ownerWeapon.totalDamageDealt += this.damage;
                        this.ownerWeapon.applyScaling();
                        this.ownerWeapon.checkSuper();
                    }
                    // Visual feedback
                    if (WB.GLEffects) {
                        WB.GLEffects.spawnDamageNumber(target.x, target.y, this.damage, this.color);
                        WB.GLEffects.spawnImpact(target.x, target.y, this.color, 15);
                    }
                    if (WB.Game.particles) {
                        WB.Game.particles.emit(target.x, target.y, 4, this.color);
                    }
                }
            }
        }
    }

    draw() {
        const B = WB.GLBatch;
        const fadeRatio = Math.min(1, this.lifespan / (this.maxLife * 0.3)); // fade in last 30%
        const alpha = fadeRatio;

        // Pulsing glow
        const pulse = 1 + Math.sin(Date.now() * 0.005) * 0.1;
        const drawRadius = this.radius * pulse;

        // Minimal fill — just a faint tint so overlapping hazards don't white-out the screen
        B.setAlpha(alpha * 0.06);
        B.fillCircle(this.x, this.y, drawRadius, this.color);
        B.restoreAlpha();

        // Visible ring outline — this is the primary visual
        B.setAlpha(alpha * 0.4);
        B.strokeCircle(this.x, this.y, drawRadius, this.color, 2);
        B.restoreAlpha();

        // Small bright center dot
        B.setAlpha(alpha * 0.25);
        B.fillCircle(this.x, this.y, 4, this.color);
        B.restoreAlpha();
    }
};
