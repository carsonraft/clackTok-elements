window.WB = window.WB || {};

// Wadjet — Cobra Goddess: Fires venom globs every 2 seconds that arc with gravity.
// Base damage: 1. Each hit applies a venom stack (permanent 3% speed reduction).
// Each hit also increases glob size by +5% (larger projectile = easier to land).
// Super (20 hits): Missed globs leave puddles at impact point.
// Puddles last 3 seconds, apply 1 venom stack/sec to any ball passing through.
class WadjetWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'wadjet',
            baseDamage: 2,
            rotationSpeed: 0.03,
            reach: 45,
            scalingName: 'Venom',
            superThreshold: 14,
            isRanged: true,
        });
        this.fireTimer = 0;
        this.fireRate = 60; // 1 second at 60fps
        this.globSize = 6; // base projectile radius
        this.visualTimer = 0;
        this.scalingStat.value = 0; // total venom stacks applied
        this._totalVenomApplied = 0;
    }

    update() {
        // Aim toward nearest enemy
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
                this.angle += diff * 0.06;
            }
        }

        if (this.cooldown > 0) this.cooldown--;
        this.visualTimer++;
        this.fireTimer++;
        if (this.fireTimer >= this.fireRate) {
            this.fireTimer = 0;
            this._fireGlob();
        }
    }

    _fireGlob() {
        const tipX = this.getTipX();
        const tipY = this.getTipY();
        // Lob angle — aim slightly upward to create an arc
        const lobAngle = this.angle - 0.3;
        const lobSpeed = 5;
        const self = this;

        WB.Game.projectiles.push(new WB.Projectile({
            x: tipX,
            y: tipY,
            vx: Math.cos(lobAngle) * lobSpeed,
            vy: Math.sin(lobAngle) * lobSpeed,
            damage: this.currentDamage,
            owner: this.owner,
            ownerWeapon: this,
            radius: this.globSize,
            lifespan: 150, // 2.5 seconds
            bounces: 0,
            color: '#00A86B',
            gravityAffected: true,
            onMiss: this.superActive ? function(x, y) { self._spawnPuddle(x, y); } : null,
        }));
        WB.Audio.projectileFire();
    }

    _spawnPuddle(x, y) {
        if (!WB.Game || !WB.Game.hazards) return;
        // Puddle: applies venom stacks, not damage
        WB.Game.hazards.push(new WB.VenomPuddle({
            x: x,
            y: y,
            radius: this.globSize * 2,
            lifespan: 180, // 3 seconds
            color: '#00A86B',
            owner: this.owner,
            ownerWeapon: this,
        }));
    }

    onHit(target) {
        // Projectiles handle hit via checkHit — but we hook onProjectileHit for venom
    }

    onProjectileHit(projectile, target) {
        // Apply venom stack
        if (target.debuffs) {
            target.debuffs.venomStacks++;
            this._totalVenomApplied++;
            this.scalingStat.value = this._totalVenomApplied;
        }
    }

    applyScaling() {
        this.currentDamage = this.baseDamage + this.hitCount * 0.2;
        this.globSize = Math.min(12, 5 * (1 + this.hitCount * 0.05)); // +5% per hit
        this.scalingStat.value = this._totalVenomApplied;
    }

    activateSuper() {
        // Puddles begin spawning on miss (handled in _fireGlob via onMiss callback)
        // Venom burst
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 20, '#00A86B');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 12, '#006B45');
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        // Cobra body — sinuous line
        const segments = 6;
        const segLen = (this.reach - r) / segments;
        let prevX = r;
        let prevY = 0;
        for (let i = 1; i <= segments; i++) {
            const x = r + i * segLen;
            const wave = Math.sin(i * 1.2 + this.visualTimer * 0.06) * (2 + i * 0.5);
            B.line(prevX, prevY, x, wave, '#00A86B', 3 - i * 0.3);
            prevX = x;
            prevY = wave;
        }

        // Cobra head at tip — hooded shape
        const headX = this.reach;
        const headWave = Math.sin(segments * 1.2 + this.visualTimer * 0.06) * (2 + segments * 0.5);
        B.fillCircle(headX, headWave, 5, '#00A86B');
        // Hood flare
        B.fillTriangle(
            headX - 3, headWave - 6,
            headX + 6, headWave,
            headX - 3, headWave + 6,
            '#008B5C'
        );
        // Eyes
        B.fillCircle(headX + 2, headWave - 2, 1.5, '#FFD700');
        B.fillCircle(headX + 2, headWave + 2, 1.5, '#FFD700');

        B.popTransform();

        // Venom aura
        if (this._totalVenomApplied > 0) {
            const venomIntensity = Math.min(1, this._totalVenomApplied / 20);
            B.setAlpha(venomIntensity * 0.1);
            B.strokeCircle(this.owner.x, this.owner.y, r + 5, '#00A86B', 1.5);
            B.restoreAlpha();
        }

        // Super indicator
        if (this.superActive) {
            const pulse = Math.sin(this.visualTimer * 0.06) * 0.04;
            B.setAlpha(0.12 + pulse);
            B.strokeCircle(this.owner.x, this.owner.y, r + 10, '#00A86B', 2);
            B.restoreAlpha();
        }
    }
}

// VenomPuddle — special hazard that applies venom stacks instead of damage
WB.VenomPuddle = class {
    constructor(config) {
        this.x = config.x;
        this.y = config.y;
        this.radius = config.radius || 10;
        this.lifespan = config.lifespan || 180;
        this.maxLife = this.lifespan;
        this.color = config.color || '#00A86B';
        this.owner = config.owner || null;
        this.ownerWeapon = config.ownerWeapon || null;
        this.alive = true;
        this.tickTimer = 0;
        this.tickRate = 60; // 1 venom stack per second
        this._hitTimers = new Map();
    }

    update() {
        this.lifespan--;
        if (this.lifespan <= 0) { this.alive = false; return; }

        // Check for balls passing through
        if (WB.Game && WB.Game.balls) {
            for (const target of WB.Game.balls) {
                if (!target.isAlive) continue;
                if (this.owner && target.side === this.owner.side) continue;
                // Per-target cooldown
                const cd = this._hitTimers.get(target) || 0;
                if (cd > 0) { this._hitTimers.set(target, cd - 1); continue; }
                if (WB.Physics.circleCircle(this.x, this.y, this.radius, target.x, target.y, target.radius)) {
                    // Apply venom stack
                    if (target.debuffs) {
                        target.debuffs.venomStacks++;
                        if (this.ownerWeapon) {
                            this.ownerWeapon._totalVenomApplied++;
                            this.ownerWeapon.scalingStat.value = this.ownerWeapon._totalVenomApplied;
                        }
                    }
                    this._hitTimers.set(target, this.tickRate);
                    // Visual
                    if (WB.GLEffects) {
                        WB.GLEffects.spawnDamageNumber(target.x, target.y, 1, '#00A86B');
                    }
                    if (WB.Game.particles) {
                        WB.Game.particles.emit(target.x, target.y, 3, '#00A86B');
                    }
                }
            }
        }
    }

    draw() {
        const B = WB.GLBatch;
        const fadeRatio = Math.min(1, this.lifespan / (this.maxLife * 0.3));
        const pulse = 1 + Math.sin(Date.now() * 0.004) * 0.08;
        const drawRadius = this.radius * pulse;

        // Toxic green puddle
        B.setAlpha(fadeRatio * 0.12);
        B.fillCircle(this.x, this.y, drawRadius, this.color);
        B.restoreAlpha();

        B.setAlpha(fadeRatio * 0.3);
        B.strokeCircle(this.x, this.y, drawRadius, this.color, 1.5);
        B.restoreAlpha();

        // Bubbles
        B.setAlpha(fadeRatio * 0.2);
        const bubbleAngle = Date.now() * 0.003;
        B.fillCircle(
            this.x + Math.cos(bubbleAngle) * this.radius * 0.4,
            this.y + Math.sin(bubbleAngle) * this.radius * 0.4,
            2, '#66FFB2'
        );
        B.restoreAlpha();
    }
};

WB.WeaponRegistry.register('wadjet', WadjetWeapon, 'egyptian');
