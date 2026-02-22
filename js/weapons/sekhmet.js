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
        const S = WB.WeaponSprites;

        // Frenzy ratio 0→1 based on hit count (ramps over ~20 hits)
        const frenzy = Math.min(1, this.hitCount / 20);

        // ── Sprite: Draw claw 1 and claw 2 at opposite angles ──
        if (S && S._initialized) {
            const clawScale = 25 * (1 + frenzy * 0.3);
            const brightness = 1.0 + frenzy * 0.3;
            S.drawSprite('sekhmet-claws', this.owner.x, this.owner.y, this.angle,
                clawScale, clawScale, 1.0, brightness);
            S.drawSprite('sekhmet-claws', this.owner.x, this.owner.y, this.claw2Angle,
                clawScale, clawScale, 1.0, brightness);
        }

        // Super: blood ring — reach indicator for trail hazards
        if (this.superActive) {
            const superPulse = Math.sin(this.visualTimer * 0.1) * 0.05;
            B.setAlpha(0.2 + superPulse);
            B.strokeCircle(this.owner.x, this.owner.y, this.reach, '#8B0000', 1.5);
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('sekhmet', SekhmetWeapon, 'egyptian');
