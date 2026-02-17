window.WB = window.WB || {};

// Dionysus — Vine Whip: Melee spinning vine that applies Madness stacks.
// Madness thresholds: 3 stacks = movement inversion, 6 = weapon reversal.
// Scaling: Madness stacks applied per hit and rotation speed increase.
// Super: Activates DionysusWallShift arena modifier + dual vine extensions.
class DionysusWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'dionysus',
            baseDamage: 7,              // buffed again — vine needs to punish
            rotationSpeed: 0.085,       // faster spin
            reach: 88,                  // longer vine
            scalingName: 'Madness',
            superThreshold: 8,
        });
        // Dionysus gets slight HP boost — god of wine is resilient
        this.owner.hp = Math.round(WB.Config.BALL_MAX_HP * 1.05); // 105 HP
        this.owner.maxHp = this.owner.hp;
        this.madnessPerHit = 3;
        this.totalMadnessApplied = 0;

        // Dual vine (post-super)
        this.dualVine = false;
        this.vine2Angle = this.angle + Math.PI; // opposite side

        this.wallShift = null;
        this.scalingStat.value = this.madnessPerHit;
    }

    update() {
        const dir = (this.owner.debuffs && this.owner.debuffs.weaponReversed > 0) ? -1 : 1;
        this.angle += this.rotationSpeed * dir;
        if (this.dualVine) {
            this.vine2Angle = this.angle + Math.PI;
        }
        if (this.cooldown > 0) this.cooldown--;

        // Dual vine collision (post-super)
        if (this.dualVine && this.cooldown <= 0 && WB.Game && WB.Game.balls) {
            const tipX2 = this.owner.x + Math.cos(this.vine2Angle) * this.reach;
            const tipY2 = this.owner.y + Math.sin(this.vine2Angle) * this.reach;
            const midX2 = this.owner.x + Math.cos(this.vine2Angle) * this.reach * 0.5;
            const midY2 = this.owner.y + Math.sin(this.vine2Angle) * this.reach * 0.5;

            for (const target of WB.Game.balls) {
                if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                if (WB.Physics.lineCircle(midX2, midY2, tipX2, tipY2, target.x, target.y, target.radius)) {
                    this.onHit(target);
                    break;
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

        // Apply Madness stacks
        if (target.debuffs) {
            target.debuffs.madness = Math.min(10, target.debuffs.madness + this.madnessPerHit);
            target.debuffs.madnessDecayTimer = 0;
            this.totalMadnessApplied += this.madnessPerHit;

            // Check madness thresholds
            if (target.debuffs.madness >= 3) {
                // Movement inversion for 3 seconds
                target.debuffs.movementInverted = Math.max(target.debuffs.movementInverted, 180);
            }
            if (target.debuffs.madness >= 6) {
                // Weapon reversal for 4 seconds
                target.debuffs.weaponReversed = Math.max(target.debuffs.weaponReversed, 240);
            }

            // Madness visual indicator
            if (WB.GLEffects) {
                WB.GLEffects.spawnDamageNumber(
                    target.x, target.y - 15,
                    target.debuffs.madness,
                    '#8B00FF'
                );
            }
        }

        // Hit effects — purple vine splash
        this._onHitEffects(target, this.currentDamage, '#8B00FF');

        // Vine/grape particles
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.emit(target.x, target.y, 5, '#6A0DAD');
            WB.Game.particles.emit(target.x, target.y, 3, '#228B22');
        }
    }

    applyScaling() {
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.7);  // better scaling
        this.madnessPerHit = 3 + Math.floor(this.hitCount / 2);   // starts higher
        this.rotationSpeed = Math.min(0.15, 0.08 + this.hitCount * 0.006);  // faster cap
        this.scalingStat.value = this.madnessPerHit;
    }

    activateSuper() {
        this.currentDamage += 3;
        this.rotationSpeed *= 1.5;

        // Dual vine!
        this.dualVine = true;
        this.vine2Angle = this.angle + Math.PI;

        // Activate arena wall shift!
        this.wallShift = new WB.DionysusWallShift();
        WB.ArenaModifiers.add(this.wallShift);

        // Madness burst — apply madness stacks to all enemies
        if (WB.Game && WB.Game.balls) {
            for (const target of WB.Game.balls) {
                if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                if (target.debuffs) {
                    target.debuffs.madness = Math.min(10, target.debuffs.madness + 3);
                    if (target.debuffs.madness >= 3) {
                        target.debuffs.movementInverted = Math.max(target.debuffs.movementInverted, 180);
                    }
                    if (target.debuffs.madness >= 6) {
                        target.debuffs.weaponReversed = Math.max(target.debuffs.weaponReversed, 240);
                    }
                }
                target.takeDamage(3);
                if (WB.GLEffects) {
                    WB.GLEffects.spawnDamageNumber(target.x, target.y, 3, '#8B00FF');
                }
            }
        }

        if (WB.GLEffects) {
            WB.GLEffects.triggerChromatic(0.15);
        }

        // Visual burst — grape explosion
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 25, '#8B00FF');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 15, '#228B22');
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        // Draw primary vine
        this._drawVine(B, r, this.angle, true);

        // Draw secondary vine (post-super)
        if (this.dualVine) {
            this._drawVine(B, r, this.vine2Angle, false);
        }

        // Madness aura during super
        if (this.superActive) {
            const pulse = Math.sin(Date.now() * 0.008) * 0.05;
            B.setAlpha(0.1 + pulse);
            B.strokeCircle(this.owner.x, this.owner.y, r + 10, '#8B00FF', 2);
            B.restoreAlpha();

            // Swirling purple specks
            for (let i = 0; i < 2; i++) {
                const speckAngle = Date.now() * 0.003 + i * Math.PI;
                const speckDist = r + 8 + Math.sin(Date.now() * 0.005 + i) * 4;
                B.setAlpha(0.25);
                B.fillCircle(
                    this.owner.x + Math.cos(speckAngle) * speckDist,
                    this.owner.y + Math.sin(speckAngle) * speckDist,
                    2, '#9955DD'
                );
                B.restoreAlpha();
            }
        }
    }

    _drawVine(B, r, angle, isPrimary) {
        B.pushTransform(this.owner.x, this.owner.y, angle);

        if (isPrimary && this.superActive) {
            B.fillCircleGlow(0, 0, this.reach, '#8B00FF', 12);
        }

        // Vine stem — wavy green line
        const segments = 8;
        const segLen = (this.reach - r) / segments;
        let prevX = r;
        let prevY = 0;
        for (let i = 1; i <= segments; i++) {
            const x = r + i * segLen;
            const wave = Math.sin(i * 0.8 + Date.now() * 0.005) * (3 + i * 0.5);
            const y = wave;
            B.line(prevX, prevY, x, y, '#228B22', isPrimary ? 3.5 : 2.5);
            prevX = x;
            prevY = y;
        }

        // Vine tip — small grape cluster
        const tipX = this.reach;
        const tipWave = Math.sin(segments * 0.8 + Date.now() * 0.005) * (3 + segments * 0.5);
        B.fillCircle(tipX, tipWave, 5, '#6A0DAD');
        B.fillCircle(tipX - 3, tipWave - 3, 3.5, '#7722CC');
        B.fillCircle(tipX + 3, tipWave - 2, 3, '#9933EE');
        B.strokeCircle(tipX, tipWave, 5, '#440066', 1);

        // Small leaves along vine
        const leafX = r + this.reach * 0.4;
        const leafWave = Math.sin(3.2 + Date.now() * 0.005) * 5;
        B.fillTriangle(leafX, leafWave, leafX - 6, leafWave - 4, leafX - 4, leafWave + 4, '#2E8B2E');
        const leaf2X = r + this.reach * 0.7;
        const leaf2Wave = Math.sin(5.6 + Date.now() * 0.005) * 6;
        B.fillTriangle(leaf2X, leaf2Wave, leaf2X + 5, leaf2Wave - 3, leaf2X + 3, leaf2Wave + 4, '#2E8B2E');

        B.popTransform();
    }
}

WB.WeaponRegistry.register('dionysus', DionysusWeapon, 'pantheon');
