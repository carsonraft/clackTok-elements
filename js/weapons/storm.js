window.WB = window.WB || {};

// Storm (Thunder Hammer): Melee weapon where every 3rd hit triggers a thunderclap AOE.
// Scaling: Thunder AOE damage increases. Super: Every hit triggers thunderclap.
class StormWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'storm',
            baseDamage: 4,
            rotationSpeed: 0.045,
            reach: 75,
            scalingName: 'Thunder',
            superThreshold: 10,
        });
        this.thunderDamage = 3;
        this.thunderRadius = 80;
        this.stormTimer = 0;
        this.scalingStat.value = this.thunderDamage;
    }

    update() {
        super.update();
        this.stormTimer++;
    }

    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);
        this._onHitEffects(target, this.currentDamage, '#7744CC');

        // Thunderclap: every 3rd hit (or every hit in super mode)
        if (this.superActive || this.hitCount % 3 === 0) {
            this._thunderclap(target.x, target.y);
        }
    }

    _thunderclap(cx, cy) {
        if (!WB.Game || !WB.Game.balls) return;
        for (const target of WB.Game.balls) {
            if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
            const dx = target.x - cx;
            const dy = target.y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < this.thunderRadius) {
                target.takeDamage(this.thunderDamage);
                // Knockback from thunder
                if (dist > 0) {
                    target.vx += (dx / dist) * 3;
                    target.vy += (dy / dist) * 3;
                }
                if (WB.GLEffects) {
                    WB.GLEffects.spawnDamageNumber(target.x, target.y, this.thunderDamage, '#FFE333');
                }
            }
        }
        // Thunder visual
        if (WB.Game.particles) {
            WB.Game.particles.explode(cx, cy, 15, '#FFE333');
        }
        if (WB.GLEffects) {
            WB.GLEffects.spawnImpact(cx, cy, '#7744CC', 60);
            WB.GLEffects.triggerChromatic(0.3);
        }
        WB.Renderer.triggerShake(8);
    }

    applyScaling() {
        this.thunderDamage = 3 + Math.floor(this.hitCount * 0.5);
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.4);
        this.scalingStat.value = this.thunderDamage;
    }

    activateSuper() {
        // Crystal Shards: Bomb+Bomb inspired → THUNDER GOD!
        // Every hit is a thunderclap + massive initial lightning storm
        this.thunderDamage += 6;
        this.thunderRadius = 130;
        this.currentDamage += 4;
        this.rotationSpeed *= 1.5;
        // Initial lightning storm — strike ALL enemies with thunder
        if (WB.Game && WB.Game.balls) {
            for (const target of WB.Game.balls) {
                if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                target.takeDamage(8);
                const dx = target.x - this.owner.x;
                const dy = target.y - this.owner.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                target.vx += (dx / dist) * 5;
                target.vy += (dy / dist) * 5;
                if (WB.GLEffects) {
                    WB.GLEffects.spawnDamageNumber(target.x, target.y, 8, '#FFE333');
                    WB.GLEffects.spawnImpact(target.x, target.y, '#7744CC', 50);
                }
                if (WB.Game.particles) {
                    WB.Game.particles.explode(target.x, target.y, 15, '#FFE333');
                }
            }
        }
        if (WB.GLEffects) {
            WB.GLEffects.triggerChromatic(0.6);
        }
        WB.Renderer.triggerShake(15);
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
            B.fillCircleGlow(0, 0, this.reach, '#7744CC', 15);
        }

        // Thunder hammer handle
        B.fillRect(r - 2, -4, this.reach - r - 14, 8, '#5533AA');

        // Hammer head — electrified
        const headX = this.reach - 18;
        B.fillRect(headX, -14, 22, 28, '#6644BB');
        B.strokeRect(headX, -14, 22, 28, '#4422AA', 2);

        // Lightning emblem on head
        B.fillPolygon([
            [headX + 8, -8],
            [headX + 13, -2],
            [headX + 10, -2],
            [headX + 15, 6],
            [headX + 9, 0],
            [headX + 12, 0]
        ], '#FFE333');

        // Hammer face highlight
        B.fillRect(headX + 16, -12, 5, 24, '#8866DD');

        // Metal band
        B.fillRect(headX - 2, -5, 4, 10, '#4422AA');

        B.popTransform();

        // Storm clouds circling (super)
        if (this.superActive) {
            B.setAlpha(0.12);
            for (let i = 0; i < 4; i++) {
                const ca = this.stormTimer * 0.03 + i * Math.PI / 2;
                const cd = r + 30;
                B.fillCircle(
                    this.owner.x + Math.cos(ca) * cd,
                    this.owner.y + Math.sin(ca) * cd,
                    8, '#7744CC'
                );
            }
            B.restoreAlpha();
        }

        // Occasional lightning flash near hammer
        if (this.stormTimer % 20 < 3) {
            B.setAlpha(0.25);
            const tipX = this.owner.x + Math.cos(this.angle) * this.reach;
            const tipY = this.owner.y + Math.sin(this.angle) * this.reach;
            B.fillCircle(tipX, tipY, 6, '#FFE333');
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('storm', StormWeapon);
