window.WB = window.WB || {};

// Magnet: Pulls opponent toward you. Pull strength increases per hit.
// Super: alternates between pull and push every 2 seconds.
class MagnetWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'magnet',
            baseDamage: 2,
            rotationSpeed: 0,
            reach: 55,
            scalingName: 'Pull',
            superThreshold: 10,
        });
        this.pullStrength = 0.03;
        this.canParry = false;
        this.pulseAngle = 0;
        this.contactCooldown = 0;
        this.isPushing = false;
        this.modeTimer = 0;
        this.scalingStat.value = Math.round(this.pullStrength * 1000);
    }

    update() {
        this.pulseAngle += 0.08;
        if (this.contactCooldown > 0) this.contactCooldown--;
        if (this.cooldown > 0) this.cooldown--;

        if (this.superActive) {
            this.modeTimer++;
            if (this.modeTimer % 120 === 0) {
                this.isPushing = !this.isPushing;
            }
        }

        // Apply pull/push force on opponent
        if (WB.Game && WB.Game.balls) {
            const opponent = WB.Game.balls.find(b => b !== this.owner && b.isAlive);
            if (opponent) {
                const dx = this.owner.x - opponent.x;
                const dy = this.owner.y - opponent.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0 && dist < 350) {
                    const force = this.pullStrength * (this.isPushing ? -1 : 1);
                    // Force is stronger when closer
                    const falloff = Math.max(0.3, 1 - dist / 350);
                    opponent.vx += (dx / dist) * force * falloff;
                    opponent.vy += (dy / dist) * force * falloff;

                    // Point magnet toward opponent
                    this.angle = Math.atan2(opponent.y - this.owner.y, opponent.x - this.owner.x);
                }
            }
        }
    }

    canHit() {
        return this.contactCooldown <= 0;
    }

    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.contactCooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.emit(target.x, target.y, 8, this.isPushing ? '#4488FF' : '#FF4444');
        }
    }

    applyScaling() {
        this.pullStrength = 0.03 + this.hitCount * 0.015;
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.5);
        this.scalingStat.value = Math.round(this.pullStrength * 1000);
    }

    activateSuper() {
        this.pullStrength *= 1.5;
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;
        const pulse = Math.sin(this.pulseAngle) * 3;

        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
            const glowColor = this.isPushing ? '#4488FF' : '#FF4444';
            B.fillCircleGlow(0, 0, this.reach, glowColor, 15);
        }

        // Magnet body - U shape
        const magX = r + 5;
        const magW = 28 + pulse;
        const magH = 20;

        // Left pole (red = north)
        B.fillRect(magX, -magH, 8, magH, '#DD3333');

        // Right pole (blue = south)
        B.fillRect(magX, 0, 8, magH, '#3355CC');

        // U connector
        B.fillRect(magX + 8, -magH, magW - 8, 6, '#888888');
        B.fillRect(magX + 8, magH - 6, magW - 8, 6, '#888888');
        B.fillRect(magX + magW - 6, -magH, 6, magH * 2, '#888888');

        // Field lines (visual only)
        const fieldAlpha = 0.15 + Math.sin(this.pulseAngle * 2) * 0.1;
        const fieldColor = this.isPushing ? `rgba(68,136,255,${fieldAlpha})` : `rgba(255,68,68,${fieldAlpha})`;
        for (let i = 0; i < 3; i++) {
            const offset = (i - 1) * 12;
            const extend = 15 + Math.sin(this.pulseAngle + i) * 8;
            B.drawQuadratic(
                magX + magW, offset,
                magX + magW + extend, offset,
                magX + magW + extend + 5, 0,
                fieldColor, 1.5
            );
        }

        B.popTransform();
    }
}

WB.WeaponRegistry.register('magnet', MagnetWeapon);
