window.WB = window.WB || {};

// Sekhmet — Dual Claws: Two short-range weapons on opposite sides, fast rotation.
// Base damage: 1. Each hit MULTIPLIES damage by 1.1x (exponential, no ceiling).
// Rotation speed also increases +0.002 per hit.
// Super (18 hits): Claws leave a blood trail (hazard) as they rotate,
// dealing 50% of current claw damage on contact. Trail lasts 0.3s.
class SekhmetWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'sekhmet',
            baseDamage: 1.5,
            rotationSpeed: 0.085,
            reach: 62, // short range dual claws
            scalingName: 'Frenzy',
            superThreshold: 18,
        });
        this.claw2Angle = this.angle + Math.PI; // opposite side
        this.trailTimer = 0;
        this.visualTimer = 0;
        this.scalingStat.value = this.currentDamage.toFixed(1);
    }

    update() {
        if (this._deflectReverse > 0) this._deflectReverse--;
        this.angle += this.rotationSpeed * this.getDir();
        this.claw2Angle = this.angle + Math.PI;
        if (this.cooldown > 0) this.cooldown--;
        this.visualTimer++;

        // Second claw collision (like Dionysus dual vine)
        if (this.cooldown <= 0 && WB.Game && WB.Game.balls) {
            const tipX2 = this.owner.x + Math.cos(this.claw2Angle) * this.reach;
            const tipY2 = this.owner.y + Math.sin(this.claw2Angle) * this.reach;
            const midX2 = this.owner.x + Math.cos(this.claw2Angle) * this.reach * 0.4;
            const midY2 = this.owner.y + Math.sin(this.claw2Angle) * this.reach * 0.4;

            for (const target of WB.Game.balls) {
                if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                if (WB.Physics.lineCircle(midX2, midY2, tipX2, tipY2, target.x, target.y, target.radius)) {
                    this.onHit(target);
                    break;
                }
            }
        }

        // Super: spawn blood trail hazards at claw tips
        if (this.superActive) {
            this.trailTimer++;
            if (this.trailTimer >= 4) { // every 4 frames
                this.trailTimer = 0;
                const trailDmg = this.currentDamage * 0.5;
                if (WB.Game && WB.Game.hazards) {
                    // Trail from claw 1
                    WB.Game.hazards.push(new WB.Hazard({
                        x: this.getTipX(),
                        y: this.getTipY(),
                        radius: 8,
                        damage: trailDmg,
                        tickRate: 10,
                        lifespan: 18, // 0.3 seconds
                        color: '#8B0000',
                        owner: this.owner,
                        ownerWeapon: this,
                    }));
                    // Trail from claw 2
                    const tip2X = this.owner.x + Math.cos(this.claw2Angle) * this.reach;
                    const tip2Y = this.owner.y + Math.sin(this.claw2Angle) * this.reach;
                    WB.Game.hazards.push(new WB.Hazard({
                        x: tip2X,
                        y: tip2Y,
                        radius: 8,
                        damage: trailDmg,
                        tickRate: 10,
                        lifespan: 18,
                        color: '#8B0000',
                        owner: this.owner,
                        ownerWeapon: this,
                    }));
                }
            }
        }
    }

    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);

        this._onHitEffects(target, this.currentDamage, '#8B0000');

        // Blood splatter
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.emit(target.x, target.y, 5, '#8B0000');
            WB.Game.particles.emit(target.x, target.y, 3, '#DC143C');
        }
    }

    applyScaling() {
        // Multiplicative: 1.0 × 1.1^hitCount
        this.currentDamage = this.baseDamage * Math.pow(1.1, this.hitCount);
        this.rotationSpeed = Math.min(0.2, 0.085 + this.hitCount * 0.002);
        this.scalingStat.value = this.currentDamage.toFixed(1);
    }

    activateSuper() {
        // Blood trail begins (handled in update)
        // Damage burst
        if (WB.Game && WB.Game.balls) {
            for (const target of WB.Game.balls) {
                if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                target.takeDamage(this.currentDamage);
                if (WB.GLEffects) {
                    WB.GLEffects.spawnDamageNumber(target.x, target.y, this.currentDamage, '#8B0000');
                }
            }
        }

        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 25, '#8B0000');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 15, '#DC143C');
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        // Frenzy ratio 0→1 based on hit count (ramps over ~20 hits)
        const frenzy = Math.min(1, this.hitCount / 20);

        // Draw claw 1
        this._drawClaw(B, r, this.angle, frenzy);
        // Draw claw 2
        this._drawClaw(B, r, this.claw2Angle, frenzy);

        // Super: blood ring — reach indicator for trail hazards
        if (this.superActive) {
            const superPulse = Math.sin(this.visualTimer * 0.1) * 0.05;
            B.setAlpha(0.2 + superPulse);
            B.strokeCircle(this.owner.x, this.owner.y, this.reach, '#8B0000', 1.5);
            B.restoreAlpha();
        }
    }

    _drawClaw(B, r, angle, frenzy) {
        B.pushTransform(this.owner.x, this.owner.y, angle);

        // Claw arm — wider
        B.fillRect(r - 2, -4, this.reach - r - 8, 8, '#5C1010');

        // Three claw fingers — LENGTH and COLOR scale with frenzy
        const clawBase = this.reach - 12;
        const clawLen = 14 * (1 + frenzy * 0.5); // grows up to 50% longer
        // Color shifts: crimson #DC143C → hot white-red #FF6666
        const cR = Math.round(220 + (255 - 220) * frenzy);
        const cG = Math.round(20 + (102 - 20) * frenzy);
        const cB = Math.round(60 + (102 - 60) * frenzy);
        const clawColor = `rgb(${cR},${cG},${cB})`;
        // Tip radius grows with frenzy — bigger base
        const tipRadius = 2.5 + frenzy * 1.5;

        for (let i = -1; i <= 1; i++) {
            const spread = i * 0.25;
            const cx1 = clawBase;
            const cy1 = i * 3;
            const cx2 = clawBase + clawLen;
            const cy2 = i * 5 + spread * 8;
            B.line(cx1, cy1, cx2, cy2, clawColor, 3 + frenzy * 0.5);
            // Claw tip — pulses larger at high frenzy
            B.fillCircle(cx2, cy2, tipRadius, '#FF4444');
        }

        B.popTransform();
    }
}

WB.WeaponRegistry.register('sekhmet', SekhmetWeapon, 'egyptian');
