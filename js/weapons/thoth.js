window.WB = window.WB || {};

// Thoth — Glyph Projectile: Fires slow glyphs that accelerate per hit.
// Each hit increases projectile speed by +15% and damage by +0.3.
// Glyphs start slow and gradually become near-instant.
// Super (15 hits): Glyphs become penetrating — pass through targets,
// bounce once off walls, can hit multiple times per flight.
class ThothWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'thoth',
            baseDamage: 3,
            rotationSpeed: 0.03,
            reach: 50,
            scalingName: 'Glyph Spd',
            superThreshold: 15,
            isRanged: true,
        });
        this.fireTimer = 0;
        this.fireRate = 55; // ~0.9 seconds at 60fps
        this.glyphSpeed = 4; // starts slow
        this.scalingStat.value = this.glyphSpeed.toFixed(1);
    }

    update() {
        if (this._deflectReverse > 0) this._deflectReverse--;
        // Rotate to aim at nearest enemy
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
                this.angle += diff * 0.08 * this.getDir(); // gentle tracking
            }
        }

        if (this.cooldown > 0) this.cooldown--;
        this.fireTimer++;
        if (this.fireTimer >= this.fireRate) {
            this.fireTimer = 0;
            this._fireGlyph();
        }
    }

    _fireGlyph() {
        const tipX = this.getTipX();
        const tipY = this.getTipY();
        const a = this.angle;

        WB.Game.projectiles.push(new WB.Projectile({
            x: tipX,
            y: tipY,
            vx: Math.cos(a) * this.glyphSpeed,
            vy: Math.sin(a) * this.glyphSpeed,
            damage: this.currentDamage,
            owner: this.owner,
            ownerWeapon: this,
            radius: 5,
            lifespan: 180, // 3 seconds
            bounces: this.superActive ? 1 : 0,
            piercing: this.superActive,
            color: '#191970',
            shape: 'glyph',
        }));
        WB.Audio.projectileFire();
    }

    onHit(target) {
        // Projectiles handle hits via checkHit callback
    }

    applyScaling() {
        this.glyphSpeed = Math.min(14, 4 * Math.pow(1.15, this.hitCount)); // +15% per hit, cap at max ball speed
        this.currentDamage = this.baseDamage + this.hitCount * 0.3;
        this.scalingStat.value = this.glyphSpeed.toFixed(1);
    }

    activateSuper() {
        // Glyphs become penetrating + wall-bouncing (applied in _fireGlyph)
        // Burst of glyph energy
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 18, '#191970');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 10, '#4169E1');
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        // Speed ratio 0→1 (glyphSpeed goes from 4 to ~14)
        const speedRatio = Math.min(1, (this.glyphSpeed - 4) / 10);

        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        // Ibis staff — wider, more visible
        // Shaft
        B.fillRect(r - 2, -3.5, this.reach - r + 4, 7, '#2F1F4F');
        B.line(r, 0, this.reach - 5, 0, '#3D2B6B', 2.5);

        // Glyph orb at tip — larger, color shifts navy→bright purple as speed builds
        const tipX = this.reach;
        const orbR = Math.round(25 + (106 - 25) * speedRatio);
        const orbG = Math.round(25 + (90 - 25) * speedRatio);
        const orbB = Math.round(112 + (205 - 112) * speedRatio);
        const orbColor = `rgb(${orbR},${orbG},${orbB})`;
        B.fillCircle(tipX, 0, 8, orbColor);
        B.strokeCircle(tipX, 0, 8, '#4169E1', 2);

        // Inner glyph symbol — bolder crosshair/eye
        B.line(tipX - 4, 0, tipX + 4, 0, '#6A5ACD', 1.5);
        B.line(tipX, -4, tipX, 4, '#6A5ACD', 1.5);
        B.fillCircle(tipX, 0, 3, '#7B68EE');

        // Gold bands — wider + second band
        B.fillRect(r + 8, -4.5, 4, 9, '#DAA520');
        B.fillRect(r + 20, -3.5, 3, 7, '#B8860B');

        // Speed indicator — MULTIPLE orbiting dots, brighter, bigger with speed
        if (this.hitCount > 0) {
            const dotCount = 1 + Math.floor(speedRatio * 3); // 1→4 dots
            const orbitSpeed = 0.02 + speedRatio * 0.08;
            const orbitAngle = Date.now() * orbitSpeed;
            const orbitR = 8 + speedRatio * 4;
            const dotAlpha = 0.4 + speedRatio * 0.4; // 0.4→0.8
            const dotSize = 2 + speedRatio * 2; // 2→4
            for (let i = 0; i < dotCount; i++) {
                const a = orbitAngle + i * Math.PI * 2 / dotCount;
                B.setAlpha(dotAlpha);
                B.fillCircle(
                    tipX + Math.cos(a) * orbitR,
                    Math.sin(a) * orbitR,
                    dotSize, '#4169E1'
                );
                B.restoreAlpha();
            }
        }

        B.popTransform();

        // Super indicator — orbiting glyphs around ball
        if (this.superActive) {
            const t = Date.now() * 0.003;
            for (let i = 0; i < 3; i++) {
                const a = t + i * Math.PI * 2 / 3;
                const ox = this.owner.x + Math.cos(a) * (r + 10);
                const oy = this.owner.y + Math.sin(a) * (r + 10);
                B.setAlpha(0.3);
                B.fillCircle(ox, oy, 3, '#4169E1');
                B.restoreAlpha();
            }
        }
    }
}

WB.WeaponRegistry.register('thoth', ThothWeapon, 'egyptian');
