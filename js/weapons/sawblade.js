window.WB = window.WB || {};

// Sawblade: Orbiting saw rings that damage on contact. Ring count +1 per hit.
// Super: blades reverse orbit and spin faster.
class SawbladeWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'sawblade',
            baseDamage: 2,
            rotationSpeed: 0.06,
            reach: 55,
            scalingName: 'Saws',
            superThreshold: 8,
        });
        this.sawCount = 1;
        this.orbitAngle = 0;
        this.orbitSpeed = 0.05;
        this.sawSpinAngle = 0;
        this.orbitRadius = 55;
        this.sawCooldowns = [0]; // per-saw cooldown
        this.scalingStat.value = this.sawCount;
    }

    update() {
        if (this._deflectReverse > 0) this._deflectReverse--;
        const dir = this.superActive ? -1 : 1;
        this.orbitAngle += this.orbitSpeed * dir;
        this.sawSpinAngle += 0.2;

        // Decrement per-saw cooldowns
        for (let i = 0; i < this.sawCooldowns.length; i++) {
            if (this.sawCooldowns[i] > 0) this.sawCooldowns[i]--;
        }

        // Check each saw against opponents
        if (WB.Game && WB.Game.balls) {
            for (let i = 0; i < this.sawCount; i++) {
                if (this.sawCooldowns[i] > 0) continue;
                const pos = this._getSawPos(i);

                for (const target of WB.Game.balls) {
                    if (target === this.owner || !target.isAlive) continue;
                    if (WB.Physics.circleCircle(pos.x, pos.y, 10, target.x, target.y, target.radius)) {
                        target.takeDamage(this.currentDamage);
                        this.hitCount++;
                        this.sawCooldowns[i] = WB.Config.WEAPON_HIT_COOLDOWN;
                        this.applyScaling();
                        this.checkSuper();
                        WB.Audio.weaponHit(this.hitCount, this.type);
                        if (WB.Game._excitement) WB.Game._excitement.recordHit();
                        WB.Renderer.triggerShake(3);
                        if (WB.Game.particles) {
                            WB.Game.particles.emit(pos.x, pos.y, 8, '#FF6600');
                        }
                        break;
                    }
                }
            }
        }
    }

    _getSawPos(index) {
        const angleOffset = (index / this.sawCount) * Math.PI * 2;
        const angle = this.orbitAngle + angleOffset;
        return {
            x: this.owner.x + Math.cos(angle) * this.orbitRadius,
            y: this.owner.y + Math.sin(angle) * this.orbitRadius,
        };
    }

    canHit() { return false; } // Saws handle their own collision

    applyScaling() {
        this.sawCount = 1 + this.hitCount;
        if (this.sawCount > 12) this.sawCount = 12; // cap
        // Ensure cooldown array is right size
        while (this.sawCooldowns.length < this.sawCount) {
            this.sawCooldowns.push(0);
        }
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.3);
        this.scalingStat.value = this.sawCount;
    }

    activateSuper() {
        this.orbitSpeed *= 2;
        this.currentDamage += 2;
    }

    // Override getTipX/Y so parry system can find us
    getTipX() { return this._getSawPos(0).x; }
    getTipY() { return this._getSawPos(0).y; }

    draw() {
        const B = WB.GLBatch;

        if (this.superActive) {
            // Glow behind the orbit path
            B.strokeCircleGlow(this.owner.x, this.owner.y, this.orbitRadius, '#FF6600', 1, 12);
        }

        // Draw orbit path
        B.setAlpha(0.15);
        B.strokeCircle(this.owner.x, this.owner.y, this.orbitRadius, '#FF6400', 1);
        B.restoreAlpha();

        // Draw each saw
        for (let i = 0; i < this.sawCount; i++) {
            const pos = this._getSawPos(i);
            this._drawSaw(pos.x, pos.y);
        }
    }

    _drawSaw(x, y) {
        const B = WB.GLBatch;

        B.pushTransform(x, y, this.sawSpinAngle);

        const teeth = 8;
        const outerR = 10;
        const innerR = 6;

        // Saw teeth — build polygon points
        const points = [];
        for (let i = 0; i < teeth * 2; i++) {
            const angle = (i * Math.PI) / teeth;
            const r = i % 2 === 0 ? outerR : innerR;
            points.push([Math.cos(angle) * r, Math.sin(angle) * r]);
        }
        B.fillPolygon(points, '#AAA');
        B.strokePolygon(points, '#888', 1);

        // Center hole
        B.fillCircle(0, 0, 3, '#555');

        B.popTransform();
    }
}

WB.WeaponRegistry.register('sawblade', SawbladeWeapon, 'classic');
