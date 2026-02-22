window.WB = window.WB || {};

WB.Projectile = class {
    constructor(config) {
        this.x = config.x;
        this.y = config.y;
        this.vx = config.vx;
        this.vy = config.vy;
        this.damage = config.damage || 2;
        this.owner = config.owner;
        this.ownerWeapon = config.ownerWeapon;
        this.radius = config.radius || 3;
        this.lifespan = config.lifespan || 120;
        this.bounces = config.bounces || 0;
        this.color = config.color || '#FFF';
        this.piercing = config.piercing || false;
        this.homing = config.homing || 0;          // 0 = no homing, 0.01-0.15 = gentle curve
        this.damageFalloff = config.damageFalloff || 0; // damage multiplier lost per bounce (e.g. 0.5 = 50% per bounce)
        this.gravityAffected = config.gravityAffected || false; // Wadjet venom globs arc with gravity
        this.onMiss = config.onMiss || null; // callback(x, y) when projectile dies without hitting
        this.shape = config.shape || null;  // null = circle (default), 'bolt', 'arrow', 'sun-arrow', etc.
        this._hasHit = false;
        this.alive = true;
        this.trail = [];
        this._hitTargets = new Set();
        this._age = 0; // frame counter for spinning/animated shapes
    }

    update() {
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 2) this.trail.shift();

        this.x += this.vx;
        this.y += this.vy;
        // Gravity-affected projectiles (Wadjet venom globs) arc downward
        if (this.gravityAffected && WB.Config.GRAVITY_MODE) {
            const ga = WB.Config.GRAVITY_ANGLE;
            this.vx += Math.cos(ga) * WB.Config.GRAVITY;
            this.vy += Math.sin(ga) * WB.Config.GRAVITY;
        }
        this.lifespan--;
        this._age++;
        if (this.lifespan <= 0) this.alive = false;

        // Homing: gently curve toward nearest enemy ball
        if (this.homing > 0 && WB.Game && WB.Game.balls) {
            let closest = null, closestDist = Infinity;
            for (const b of WB.Game.balls) {
                if (b === this.owner || !b.isAlive) continue;
                if (this.owner && b.side === this.owner.side) continue;
                const dx = b.x - this.x, dy = b.y - this.y;
                const dist = dx * dx + dy * dy;
                if (dist < closestDist) { closestDist = dist; closest = b; }
            }
            if (closest) {
                const targetAngle = Math.atan2(closest.y - this.y, closest.x - this.x);
                const currentAngle = Math.atan2(this.vy, this.vx);
                let diff = targetAngle - currentAngle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                const newAngle = currentAngle + diff * this.homing;
                const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
                this.vx = Math.cos(newAngle) * speed;
                this.vy = Math.sin(newAngle) * speed;
            }
        }

        const a = WB.Config.ARENA;
        let bounced = false;
        let bounceX = this.x, bounceY = this.y;
        if (this.x - this.radius < a.x) {
            if (this.bounces > 0) {
                this.vx = Math.abs(this.vx);
                this.x = a.x + this.radius;
                this.bounces--;
                this._hitTargets.clear();
                bounced = true; bounceX = a.x; bounceY = this.y;
            } else { this.alive = false; }
        }
        if (this.x + this.radius > a.x + a.width) {
            if (this.bounces > 0) {
                this.vx = -Math.abs(this.vx);
                this.x = a.x + a.width - this.radius;
                this.bounces--;
                this._hitTargets.clear();
                bounced = true; bounceX = a.x + a.width; bounceY = this.y;
            } else { this.alive = false; }
        }
        if (this.y - this.radius < a.y) {
            if (this.bounces > 0) {
                this.vy = Math.abs(this.vy);
                this.y = a.y + this.radius;
                this.bounces--;
                this._hitTargets.clear();
                bounced = true; bounceX = this.x; bounceY = a.y;
            } else { this.alive = false; }
        }
        if (this.y + this.radius > a.y + a.height) {
            if (this.bounces > 0) {
                this.vy = -Math.abs(this.vy);
                this.y = a.y + a.height - this.radius;
                this.bounces--;
                this._hitTargets.clear();
                bounced = true; bounceX = this.x; bounceY = a.y + a.height;
            } else { this.alive = false; }
        }
        // Apply damage falloff on bounce (e.g. Zeus bolts lose 50% per bounce)
        if (bounced && this.damageFalloff > 0) {
            this.damage = Math.max(0.5, this.damage * (1 - this.damageFalloff));
        }
        if (bounced) {
            const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            WB.Audio.wallClack(spd);
            if (WB.GLEffects) {
                WB.GLEffects.spawnWallImpact(bounceX, bounceY, spd, this.color);
            }
            if (WB.Game && WB.Game.particles) {
                WB.Game.particles.emit(bounceX, bounceY, 2, this.color);
            }
        }

        // Fire miss callback when projectile dies without hitting (Wadjet puddles)
        if (!this.alive && !this._hasHit && this.onMiss) {
            this.onMiss(this.x, this.y);
        }
    }

    checkHit(target) {
        if (target === this.owner || !target.isAlive) return false;
        if (this.owner && this.owner.side && target.side === this.owner.side) return false;
        if (this.piercing && this._hitTargets.has(target)) return false;
        if (WB.Physics.circleCircle(this.x, this.y, this.radius, target.x, target.y, target.radius)) {
            target.takeDamage(this.damage);
            if (this.ownerWeapon) {
                this.ownerWeapon.hitCount++;
                this.ownerWeapon.totalDamageDealt += this.damage;
                this.ownerWeapon.applyScaling();
                this.ownerWeapon.checkSuper();
            }
            if (this.piercing) {
                this._hitTargets.add(target);
            } else {
                this.alive = false;
            }
            WB.Audio.weaponHit(this.ownerWeapon ? this.ownerWeapon.hitCount : 0, this.ownerWeapon ? this.ownerWeapon.type : 'blade');

            // Track combo for projectile owner + full clacky effects
            if (this.ownerWeapon && this.ownerWeapon._onHitEffects) {
                this.ownerWeapon._onHitEffects(target, this.damage, this.color);
            } else {
                if (WB.Game && WB.Game.particles) {
                    WB.Game.particles.emit(this.x, this.y, 8, this.color);
                }
                if (WB.GLEffects) {
                    WB.GLEffects.spawnImpact(target.x, target.y, this.color, 25 + this.damage * 2);
                    WB.GLEffects.spawnDamageNumber(target.x, target.y, this.damage, this.color);
                }
            }
            // Weapon callback (e.g. Zeus ball lightning spawning)
            if (this.ownerWeapon && this.ownerWeapon.onProjectileHit) {
                this.ownerWeapon.onProjectileHit(this, target);
            }
            WB.Renderer.triggerShake(1 + this.damage * 0.15);
            this._hasHit = true;
            return true;
        }
        return false;
    }

    // ═══════════════════════════════════════════════════════════
    //  DRAW — dispatches to shape-specific renderers
    // ═══════════════════════════════════════════════════════════

    draw() {
        const B = WB.GLBatch;
        const r = this.radius;
        const heading = Math.atan2(this.vy, this.vx);

        // Trail (single fading dot — lightweight motion blur)
        const tLen = this.trail.length;
        if (tLen > 1) {
            const t = this.trail[0];
            B.setAlpha(0.15);
            B.fillCircle(t.x, t.y, r * 0.5, this.color);
            B.restoreAlpha();
        }

        // Dispatch to shape renderer
        switch (this.shape) {
            case 'bolt':      this._drawBolt(B, r, heading); break;
            case 'arrow':     this._drawArrow(B, r, heading); break;
            case 'sun-arrow': this._drawSunArrow(B, r, heading); break;
            case 'bullet':    this._drawBullet(B, r, heading); break;
            case 'droplet':   this._drawDroplet(B, r, heading); break;
            case 'wave':      this._drawWave(B, r, heading); break;
            case 'star':      this._drawStar(B, r, heading); break;
            case 'sparkle':   this._drawSparkle(B, r, heading); break;
            case 'glyph':     this._drawGlyph(B, r, heading); break;
            case 'hexagon':   this._drawHexagon(B, r, heading); break;
            case 'spiked':    this._drawSpiked(B, r, heading); break;
            default:          this._drawCircle(B, r); break;
        }
    }

    // ─── Default circle (unchanged from original) ───────────
    _drawCircle(B, r) {
        B.fillCircle(this.x, this.y, r + 1, '#222');
        B.fillCircle(this.x, this.y, r, this.color);
    }

    // ─── BOLT: Zeus lightning — jagged zigzag ───────────────
    // 3-segment zigzag oriented along velocity. Looks like ⚡
    _drawBolt(B, r, heading) {
        const len = r * 3.5;   // total bolt length
        const jag = r * 1.4;   // zigzag width
        B.pushTransform(this.x, this.y, heading);
        // Dark shadow pass FIRST (thick, behind everything)
        B.line(-len * 0.5, 0,  -len * 0.15, -jag, '#222', 4.5);
        B.line(-len * 0.15, -jag,  len * 0.15, jag, '#222', 4.5);
        B.line(len * 0.15, jag,  len * 0.5, 0, '#222', 4.5);
        // Main bolt: 4-point zigzag line
        B.line(-len * 0.5, 0,  -len * 0.15, -jag, this.color, 2.5);
        B.line(-len * 0.15, -jag,  len * 0.15, jag, this.color, 2.5);
        B.line(len * 0.15, jag,  len * 0.5, 0, this.color, 2.5);
        // Bright core (thinner, white-ish)
        B.setAlpha(0.6);
        B.line(-len * 0.5, 0,  -len * 0.15, -jag, '#FFF', 1.2);
        B.line(-len * 0.15, -jag,  len * 0.15, jag, '#FFF', 1.2);
        B.line(len * 0.15, jag,  len * 0.5, 0, '#FFF', 1.2);
        B.restoreAlpha();
        // Small glow dot at tip with dark ring
        B.fillCircle(len * 0.5, 0, r * 0.65, '#222');
        B.fillCircle(len * 0.5, 0, r * 0.5, this.color);
        B.popTransform();
    }

    // ─── ARROW: Artemis / Bow — elongated triangle + tail ───
    // Chevron/arrowhead pointing forward, thin line tail
    _drawArrow(B, r, heading) {
        const len = r * 3.0;
        const w = r * 1.2;
        B.pushTransform(this.x, this.y, heading);
        // Dark shadow triangle FIRST (slightly larger)
        B.fillTriangle(
            len * 0.55, 0,
            -len * 0.35, -w * 1.15,
            -len * 0.35, w * 1.15,
            '#222'
        );
        B.line(-len * 0.55, 0, -len * 0.3, 0, '#222', 3);
        // Arrowhead triangle
        B.fillTriangle(
            len * 0.5, 0,          // tip
            -len * 0.3, -w,        // left barb
            -len * 0.3, w,         // right barb
            this.color
        );
        // Shaft line
        B.line(-len * 0.5, 0, -len * 0.3, 0, this.color, 1.5);
        // Fletching (two small lines at tail)
        B.line(-len * 0.5, 0, -len * 0.4, -w * 0.6, this.color, 1.5);
        B.line(-len * 0.5, 0, -len * 0.4, w * 0.6, this.color, 1.5);
        // Dark edge outlines
        B.line(len * 0.5, 0, -len * 0.3, -w, '#222', 1.5);
        B.line(len * 0.5, 0, -len * 0.3, w, '#222', 1.5);
        B.line(-len * 0.3, -w, -len * 0.3, w, '#222', 1.5);
        B.popTransform();
    }

    // ─── SUN-ARROW: Apollo — arrow shape + radiating spikes ─
    // Same arrow base as Artemis but with tiny sun-ray spikes
    _drawSunArrow(B, r, heading) {
        const len = r * 3.0;
        const w = r * 1.2;
        B.pushTransform(this.x, this.y, heading);
        // Dark shadow behind sun-rays (drawn first so rays pop)
        const cx = len * 0.1;
        const spike = r * 1.5;
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + this._age * 0.08;
            B.line(cx, 0, cx + Math.cos(a) * spike, Math.sin(a) * spike, '#222', 3);
        }
        // Dark shadow triangle FIRST
        B.fillTriangle(
            len * 0.55, 0,
            -len * 0.25, -w * 1.15,
            -len * 0.25, w * 1.15,
            '#222'
        );
        // Core arrowhead
        B.fillTriangle(
            len * 0.5, 0,
            -len * 0.2, -w,
            -len * 0.2, w,
            this.color
        );
        // Shaft
        B.line(-len * 0.45, 0, -len * 0.2, 0, this.color, 1.5);
        // Sun-ray spikes (colored, on top of dark shadows)
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + this._age * 0.08;
            B.line(cx, 0, cx + Math.cos(a) * spike, Math.sin(a) * spike, this.color, 1.5);
        }
        // Dark edge outlines
        B.line(len * 0.5, 0, -len * 0.2, -w, '#222', 1.5);
        B.line(len * 0.5, 0, -len * 0.2, w, '#222', 1.5);
        B.line(-len * 0.2, -w, -len * 0.2, w, '#222', 1.5);
        B.popTransform();
    }

    // ─── BULLET: Gunclacker — capsule/elongated oval ────────
    // Rectangle with rounded ends (approximated as rect + 2 circles)
    _drawBullet(B, r, heading) {
        const len = r * 2.5;
        const w = r * 0.7;
        B.pushTransform(this.x, this.y, heading);
        // Capsule body (rect + circle caps)
        B.fillRect(-len * 0.3, -w, len * 0.6, w * 2, this.color);
        B.fillCircle(len * 0.3, 0, w, this.color);
        B.fillCircle(-len * 0.3, 0, w, this.color);
        // Dark outline
        B.strokeRect(-len * 0.3, -w, len * 0.6, w * 2, '#222', 1.5);
        B.strokeCircle(len * 0.3, 0, w, '#222', 1.5);
        B.strokeCircle(-len * 0.3, 0, w, '#222', 1.5);
        // Bright nose highlight
        B.setAlpha(0.4);
        B.fillCircle(len * 0.25, -w * 0.3, w * 0.4, '#FFF');
        B.restoreAlpha();
        B.popTransform();
    }

    // ─── DROPLET: Wadjet venom — pixel art sprite from atlas ──
    _drawDroplet(B, r, heading) {
        const S = WB.WeaponSprites;
        if (S && S._initialized) {
            S.drawSprite('wadjet-glob', this.x, this.y, heading, r * 1.5, r * 1.5, 1.0, 1.0);
        } else {
            // Fallback: simple circle
            B.fillCircle(this.x, this.y, r + 1, '#222');
            B.fillCircle(this.x, this.y, r, this.color);
        }
    }

    // ─── WAVE: Water — crescent/arc shape ───────────────────
    // Concave crescent like a breaking wave
    _drawWave(B, r, heading) {
        B.pushTransform(this.x, this.y, heading);
        // Outer arc (large circle, front half)
        B.fillCircle(0, 0, r, this.color);
        // Bite out of back to create crescent (fill with background-ish)
        // Instead: draw a thick arc using two overlapping triangles
        const w = r * 1.3;
        // Top curl
        B.fillTriangle(
            r * 0.6, -r * 0.2,
            -r * 0.3, -w,
            -r * 0.6, -r * 0.2,
            this.color
        );
        // Bottom curl
        B.fillTriangle(
            r * 0.6, r * 0.2,
            -r * 0.3, w,
            -r * 0.6, r * 0.2,
            this.color
        );
        // White foam line at leading edge
        B.setAlpha(0.5);
        B.line(r * 0.5, -r * 0.7, r * 0.6, 0, '#FFF', 1.5);
        B.line(r * 0.6, 0, r * 0.5, r * 0.7, '#FFF', 1.5);
        B.restoreAlpha();
        // Outline
        B.strokeCircle(0, 0, r, '#222', 1.5);
        B.popTransform();
    }

    // ─── STAR: Shuriken — spinning 4-pointed star ───────────
    // Rotates based on _age (frame counter)
    _drawStar(B, r, heading) {
        const spin = this._age * 0.15;  // continuous rotation
        // Dark shadow (slightly larger)
        const shadowPts = [];
        for (let i = 0; i < 8; i++) {
            const a = spin + (i / 8) * Math.PI * 2;
            const dist = (i % 2 === 0) ? r * 1.45 : r * 0.5;
            shadowPts.push(this.x + Math.cos(a) * dist);
            shadowPts.push(this.y + Math.sin(a) * dist);
        }
        B.fillPolygon(shadowPts, '#222');
        // Colored star
        const points = [];
        for (let i = 0; i < 8; i++) {
            const a = spin + (i / 8) * Math.PI * 2;
            const dist = (i % 2 === 0) ? r * 1.3 : r * 0.4;
            points.push(this.x + Math.cos(a) * dist);
            points.push(this.y + Math.sin(a) * dist);
        }
        B.fillPolygon(points, this.color);
        // Dark outline edges
        for (let i = 0; i < 8; i++) {
            const ni = (i + 1) % 8;
            B.line(points[i*2], points[i*2+1], points[ni*2], points[ni*2+1], '#222', 1.5);
        }
    }

    // ─── SPARKLE: Light — 4-ray cross/starburst ─────────────
    // Plus sign / cross that rotates slowly
    _drawSparkle(B, r, heading) {
        const spin = this._age * 0.04;
        const len = r * 1.8;
        // Dark shadow rays FIRST
        for (let i = 0; i < 4; i++) {
            const a = spin + (i / 4) * Math.PI * 2;
            const ex = this.x + Math.cos(a) * len;
            const ey = this.y + Math.sin(a) * len;
            B.line(this.x, this.y, ex, ey, '#222', 3.5);
        }
        // Colored rays on top
        for (let i = 0; i < 4; i++) {
            const a = spin + (i / 4) * Math.PI * 2;
            const ex = this.x + Math.cos(a) * len;
            const ey = this.y + Math.sin(a) * len;
            B.line(this.x, this.y, ex, ey, this.color, 2);
        }
        // Dark center ring then bright center dot
        B.fillCircle(this.x, this.y, r * 0.6, '#222');
        B.fillCircle(this.x, this.y, r * 0.5, '#FFF');
        B.fillCircle(this.x, this.y, r * 0.3, this.color);
    }

    // ─── GLYPH: Thoth — pixel art sprite from atlas ────
    _drawGlyph(B, r, heading) {
        const S = WB.WeaponSprites;
        if (S && S._initialized) {
            S.drawSprite('thoth-glyph', this.x, this.y, this._age * 0.06, r * 1.4, r * 1.4, 1.0, 1.0);
        } else {
            // Fallback: simple circle
            B.fillCircle(this.x, this.y, r + 1, '#222');
            B.fillCircle(this.x, this.y, r, this.color);
        }
    }

    // ─── HEXAGON: Crystal — faceted gem shape ───────────────
    // 6-sided polygon, slightly elongated along travel
    _drawHexagon(B, r, heading) {
        const spin = this._age * 0.03;
        const size = r * 1.2;
        const points = [];
        for (let i = 0; i < 6; i++) {
            const a = spin + (i / 6) * Math.PI * 2;
            points.push(this.x + Math.cos(a) * size);
            points.push(this.y + Math.sin(a) * size);
        }
        B.fillPolygon(points, this.color);
        // Facet lines (connect alternating vertices through center for gem look)
        B.setAlpha(0.3);
        B.line(points[0], points[1], points[4], points[5], '#FFF', 1);
        B.line(points[2], points[3], points[8], points[9], '#FFF', 1);
        B.line(points[6], points[7], points[10], points[11], '#FFF', 1);
        B.restoreAlpha();
        // Outline
        for (let i = 0; i < 6; i++) {
            const ni = (i + 1) % 6;
            B.line(points[i*2], points[i*2+1], points[ni*2], points[ni*2+1], '#222', 1.5);
        }
    }

    // ─── SPIKED: Poison — circle with triangular spikes ─────
    // Base circle with 4 small protruding triangles
    _drawSpiked(B, r, heading) {
        // Base circle
        B.fillCircle(this.x, this.y, r * 0.7, this.color);
        // 4 spikes radiating out
        const spikeLen = r * 1.5;
        const spikeW = r * 0.35;
        for (let i = 0; i < 4; i++) {
            const a = heading + (i / 4) * Math.PI * 2;
            const tipX = this.x + Math.cos(a) * spikeLen;
            const tipY = this.y + Math.sin(a) * spikeLen;
            const perpX = Math.cos(a + Math.PI / 2) * spikeW;
            const perpY = Math.sin(a + Math.PI / 2) * spikeW;
            B.fillTriangle(
                tipX, tipY,
                this.x + perpX, this.y + perpY,
                this.x - perpX, this.y - perpY,
                this.color
            );
        }
        // Dark outline on base + spikes
        B.strokeCircle(this.x, this.y, r * 0.7, '#222', 1.5);
        for (let i = 0; i < 4; i++) {
            const a = heading + (i / 4) * Math.PI * 2;
            const tipX = this.x + Math.cos(a) * spikeLen;
            const tipY = this.y + Math.sin(a) * spikeLen;
            const perpX = Math.cos(a + Math.PI / 2) * spikeW;
            const perpY = Math.sin(a + Math.PI / 2) * spikeW;
            B.line(tipX, tipY, this.x + perpX, this.y + perpY, '#222', 1.5);
            B.line(tipX, tipY, this.x - perpX, this.y - perpY, '#222', 1.5);
        }
    }
};
