window.WB = window.WB || {};

// Fire (Inferno): Directional flame aura that faces movement direction.
// The flame cone damages and burns anything caught in it — like Kirby's fire breath!
// Scaling: Burn stacks per hit increase.
// Super (Crystal Shards: Burn+Burn → Fire Bird): Owner becomes a blazing comet!
// Ball gains massive speed boost, full-circle flame, and damages everything on contact.
class FireWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'fire',
            baseDamage: 2,
            rotationSpeed: 0,
            reach: 65,
            scalingName: 'Burn',
            superThreshold: 10,
            canParry: false,
        });
        this.burnPerHit = 1;
        this.flameAngle = 0;         // direction the flame cone faces
        this.flameConeWidth = Math.PI * 0.7; // 126-degree cone
        this.flameReach = 65;
        this.flameCooldown = 0;
        this.flickerTimer = 0;
        this.scalingStat.value = this.burnPerHit;
    }

    update() {
        if (this.flameCooldown > 0) this.flameCooldown--;
        this.flickerTimer++;

        // Aim flame cone in movement direction (like Kirby facing forward)
        const speed = Math.sqrt(this.owner.vx * this.owner.vx + this.owner.vy * this.owner.vy);
        if (speed > 0.5) {
            const targetAngle = Math.atan2(this.owner.vy, this.owner.vx);
            // Smooth rotation toward movement direction
            let diff = targetAngle - this.flameAngle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.flameAngle += diff * 0.15;
        }

        // Check flame cone against enemies
        if (this.flameCooldown <= 0 && WB.Game && WB.Game.balls) {
            for (const target of WB.Game.balls) {
                if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                if (this._isInFlameCone(target)) {
                    this._burnTarget(target);
                    break; // one target per tick
                }
            }
        }

        // Super (Fire Bird): Owner is a blazing comet — constant speed boost + trail damage
        if (this.superActive) {
            // Speed boost every few frames — keep the comet flying!
            if (this.flickerTimer % 15 === 0) {
                const speed = Math.sqrt(this.owner.vx * this.owner.vx + this.owner.vy * this.owner.vy);
                if (speed < 8) {
                    const boostAngle = this.flameAngle;
                    this.owner.vx += Math.cos(boostAngle) * 2.5;
                    this.owner.vy += Math.sin(boostAngle) * 2.5;
                }
            }
            // Burn everything nearby every 20 frames (the comet scorches)
            if (this.flickerTimer % 20 === 0 && WB.Game && WB.Game.balls) {
                const cometRadius = this.owner.radius + 45;
                for (const target of WB.Game.balls) {
                    if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                    const dx = target.x - this.owner.x;
                    const dy = target.y - this.owner.y;
                    if (Math.sqrt(dx * dx + dy * dy) < cometRadius) {
                        target.takeDamage(3);
                        target.poisonStacks = (target.poisonStacks || 0) + 2;
                        if (WB.GLEffects) {
                            WB.GLEffects.spawnDamageNumber(target.x, target.y, 3, '#FF4411');
                        }
                    }
                }
            }
        }
    }

    _isInFlameCone(target) {
        const dx = target.x - this.owner.x;
        const dy = target.y - this.owner.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > this.flameReach + target.radius) return false;

        // In super mode, flame is 360 degrees — always in cone
        if (this.superActive) return true;

        // Check angle within cone
        const angleToTarget = Math.atan2(dy, dx);
        let angleDiff = angleToTarget - this.flameAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        return Math.abs(angleDiff) < this.flameConeWidth / 2;
    }

    _burnTarget(target) {
        target.takeDamage(this.currentDamage);
        target.poisonStacks = (target.poisonStacks || 0) + this.burnPerHit;
        this.hitCount++;
        this.flameCooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);
        this._onHitEffects(target, this.currentDamage, '#FF4411');
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.emit(target.x, target.y, 8, '#FF8833');
        }
    }

    canHit() { return false; } // Flame cone handles its own collision

    applyScaling() {
        this.burnPerHit = 1 + Math.floor(this.hitCount * 0.5);
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.3);
        this.flameReach = 65 + this.hitCount * 2;
        if (this.flameReach > 100) this.flameReach = 100;
        this.scalingStat.value = this.burnPerHit;
    }

    activateSuper() {
        // Crystal Shards: Burn+Burn → FIRE BIRD!
        // Owner becomes a blazing comet — full-circle flame + speed boost + burn everything
        this.flameConeWidth = Math.PI * 2; // 360 degree flame!
        this.flameReach = 100; // max reach immediately
        this.currentDamage += 4;
        this.burnPerHit += 3;
        // Initial eruption burst — launch owner forward like a fireball!
        const speed = Math.sqrt(this.owner.vx * this.owner.vx + this.owner.vy * this.owner.vy);
        const launchAngle = speed > 0.5 ? Math.atan2(this.owner.vy, this.owner.vx) : this.flameAngle;
        this.owner.vx = Math.cos(launchAngle) * 12;
        this.owner.vy = Math.sin(launchAngle) * 12;
        // Burn everything on initial ignition
        if (WB.Game && WB.Game.balls) {
            for (const target of WB.Game.balls) {
                if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                target.poisonStacks = (target.poisonStacks || 0) + 5;
                target.takeDamage(8);
                if (WB.Game.particles) {
                    WB.Game.particles.explode(target.x, target.y, 20, '#FF4411');
                }
            }
        }
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 30, '#FFCC22');
        }
    }

    // Override tip position for parry system
    getTipX() { return this.owner.x + Math.cos(this.flameAngle) * this.flameReach; }
    getTipY() { return this.owner.y + Math.sin(this.flameAngle) * this.flameReach; }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        if (this.superActive) {
            // FIRE BIRD — blazing comet with directional fire trail!
            const pulse = 0.25 + Math.sin(this.flickerTimer * 0.12) * 0.1;
            // Comet halo
            B.setAlpha(pulse);
            B.fillCircle(this.owner.x, this.owner.y, this.flameReach * 0.8, '#FF4411');
            B.restoreAlpha();
            B.setAlpha(pulse * 0.7);
            B.fillCircle(this.owner.x, this.owner.y, this.flameReach * 0.5, '#FF8833');
            B.restoreAlpha();
            B.setAlpha(pulse * 0.5);
            B.fillCircle(this.owner.x, this.owner.y, this.flameReach * 0.3, '#FFCC22');
            B.restoreAlpha();
            // Comet tail — flame trail behind movement direction
            const speed = Math.sqrt(this.owner.vx * this.owner.vx + this.owner.vy * this.owner.vy);
            if (speed > 1) {
                const tailAngle = Math.atan2(-this.owner.vy, -this.owner.vx); // opposite of movement
                for (let i = 0; i < 6; i++) {
                    const tailDist = 20 + i * 15;
                    const spread = (WB.random() - 0.5) * 0.5;
                    const tx = this.owner.x + Math.cos(tailAngle + spread) * tailDist;
                    const ty = this.owner.y + Math.sin(tailAngle + spread) * tailDist;
                    const tailAlpha = 0.3 - i * 0.04;
                    B.setAlpha(Math.max(0.02, tailAlpha));
                    const tailSize = 12 - i * 1.5;
                    B.fillCircle(tx, ty, Math.max(2, tailSize), i < 2 ? '#FF4411' : (i < 4 ? '#FF8833' : '#FFCC22'));
                    B.restoreAlpha();
                }
            }
        } else {
            // Directional flame cone — the Kirby fire breath!
            const halfCone = this.flameConeWidth / 2;
            const flameSegs = 10;

            // Outer flame layer (red-orange)
            for (let i = 0; i < flameSegs; i++) {
                const t = i / flameSegs;
                const a1 = this.flameAngle - halfCone + this.flameConeWidth * t;
                const a2 = this.flameAngle - halfCone + this.flameConeWidth * (t + 1 / flameSegs);
                const flicker = this.flameReach * (0.85 + Math.sin(this.flickerTimer * 0.2 + i * 1.3) * 0.15);
                B.setAlpha(0.25 + Math.sin(this.flickerTimer * 0.15 + i) * 0.08);
                B.fillTriangle(
                    this.owner.x, this.owner.y,
                    this.owner.x + Math.cos(a1) * flicker,
                    this.owner.y + Math.sin(a1) * flicker,
                    this.owner.x + Math.cos(a2) * flicker,
                    this.owner.y + Math.sin(a2) * flicker,
                    '#FF4411'
                );
                B.restoreAlpha();
            }

            // Inner flame layer (orange-yellow, shorter)
            for (let i = 0; i < flameSegs; i++) {
                const t = i / flameSegs;
                const a1 = this.flameAngle - halfCone * 0.7 + this.flameConeWidth * 0.7 * t;
                const a2 = this.flameAngle - halfCone * 0.7 + this.flameConeWidth * 0.7 * (t + 1 / flameSegs);
                const flicker = this.flameReach * 0.55 * (0.9 + Math.sin(this.flickerTimer * 0.25 + i * 2) * 0.1);
                B.setAlpha(0.2);
                B.fillTriangle(
                    this.owner.x, this.owner.y,
                    this.owner.x + Math.cos(a1) * flicker,
                    this.owner.y + Math.sin(a1) * flicker,
                    this.owner.x + Math.cos(a2) * flicker,
                    this.owner.y + Math.sin(a2) * flicker,
                    '#FF8833'
                );
                B.restoreAlpha();
            }

            // Core flame (bright yellow, shortest)
            for (let i = 0; i < 5; i++) {
                const t = i / 5;
                const a1 = this.flameAngle - halfCone * 0.4 + this.flameConeWidth * 0.4 * t;
                const a2 = this.flameAngle - halfCone * 0.4 + this.flameConeWidth * 0.4 * (t + 0.2);
                const flicker = this.flameReach * 0.3 * (0.9 + Math.sin(this.flickerTimer * 0.3 + i * 3) * 0.1);
                B.setAlpha(0.15);
                B.fillTriangle(
                    this.owner.x, this.owner.y,
                    this.owner.x + Math.cos(a1) * flicker,
                    this.owner.y + Math.sin(a1) * flicker,
                    this.owner.x + Math.cos(a2) * flicker,
                    this.owner.y + Math.sin(a2) * flicker,
                    '#FFCC22'
                );
                B.restoreAlpha();
            }
        }

        // Ember sparks flying off the flame tip
        if (this.flickerTimer % 4 === 0) {
            B.setAlpha(0.5);
            const sparkAngle = this.flameAngle + (WB.random() - 0.5) * this.flameConeWidth * 0.8;
            const sparkDist = this.flameReach * (0.6 + WB.random() * 0.4);
            B.fillCircle(
                this.owner.x + Math.cos(sparkAngle) * sparkDist,
                this.owner.y + Math.sin(sparkAngle) * sparkDist,
                1.5 + WB.random() * 1.5, '#FFAA33'
            );
            B.restoreAlpha();
        }

        // Heat wake / ember trail behind the ball (opposite of flame direction)
        const moveSpeed = Math.sqrt(this.owner.vx * this.owner.vx + this.owner.vy * this.owner.vy);
        if (moveSpeed > 1.5) {
            const tailDir = Math.atan2(-this.owner.vy, -this.owner.vx);
            const tailCount = this.superActive ? 8 : 4;
            for (let i = 0; i < tailCount; i++) {
                const td = r + 5 + i * (this.superActive ? 14 : 10);
                const jitter = (WB.random() - 0.5) * 0.4;
                const tx = this.owner.x + Math.cos(tailDir + jitter) * td;
                const ty = this.owner.y + Math.sin(tailDir + jitter) * td;
                const ta = this.superActive
                    ? 0.35 - i * 0.035
                    : 0.2 - i * 0.04;
                B.setAlpha(Math.max(0.02, ta));
                const tSize = this.superActive
                    ? 10 - i * 0.8
                    : 5 - i * 0.8;
                const tColor = i < 1 ? '#FF4411' : (i < 3 ? '#FF8833' : '#FFCC22');
                B.fillCircle(tx, ty, Math.max(1.5, tSize), tColor);
                B.restoreAlpha();
            }
        }
    }
}

WB.WeaponRegistry.register('fire', FireWeapon);
