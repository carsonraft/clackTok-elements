window.WB = window.WB || {};

// Hephaestus — Forge Hammer: Heavy melee weapon that applies Forge Mark debuffs.
// Forge Marks increase incoming damage on the target by 30% per stack.
// Scaling: Forge mark stacks applied per hit increase with hits.
// Super: Leaves a fire trail hazard under the target after each hit + big damage boost.
class HephaestusWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'hephaestus',
            baseDamage: 6,            // restored to 6 — reach nerf 78→75 is enough
            rotationSpeed: 0.04,      // slightly slower start (was 0.045)
            reach: 75,                // tuned down from 78 — shorter range
            scalingName: 'Marks',
            superThreshold: 12,       // harder to reach super (was 10)
        });
        // Hephaestus is slightly tanky
        this.owner.hp = Math.round(WB.Config.BALL_MAX_HP * 1.0);  // no HP bonus (was 1.05)
        this.owner.maxHp = this.owner.hp;
        this.owner.mass *= 1.05;      // less mass (was 1.08)

        this.marksPerHit = 1;
        this.maxRotationSpeed = 0.075; // slower max (was 0.085)
        this.baseMaxRotation = 0.075;
        this.currentSpeed = 0.04;
        this.minRotationSpeed = 0.025; // lower floor (was 0.035)
        this.accelerating = true;
        this.totalMarksApplied = 0;
        this.scalingStat.value = this.marksPerHit;
    }

    update() {
        // Hammer-style acceleration/deceleration cycle
        if (this.accelerating) {
            this.currentSpeed += 0.0012;  // faster ramp up
            if (this.currentSpeed >= this.maxRotationSpeed) {
                this.accelerating = false;
            }
        } else {
            this.currentSpeed -= 0.0008;
            if (this.currentSpeed <= this.minRotationSpeed) {  // higher floor
                this.accelerating = true;
            }
        }
        this.rotationSpeed = this.currentSpeed;

        // Use base update for rotation and cooldown
        if (this._deflectReverse > 0) this._deflectReverse--;
        this.angle += this.rotationSpeed * this.getDir();
        if (this.cooldown > 0) this.cooldown--;
    }

    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);

        // Apply Forge Marks debuff
        if (target.debuffs) {
            target.debuffs.forgeMarks = Math.min(10, target.debuffs.forgeMarks + this.marksPerHit);
            this.totalMarksApplied += this.marksPerHit;
        }

        // Super: leave fire hazard at target location
        if (this.superActive && WB.Game && WB.Game.hazards) {
            WB.Game.hazards.push(new WB.Hazard({
                x: target.x,
                y: target.y,
                radius: 30,
                damage: 1.5,
                tickRate: 20,
                lifespan: 180,
                color: '#CC5500',
                owner: this.owner,
                ownerWeapon: this,
            }));
        }

        // Hit effects
        this._onHitEffects(target, this.currentDamage, '#CC5500');

        // Forge spark particles
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.spark(target.x, target.y, 8);
            WB.Game.particles.emit(target.x, target.y, 4, '#FF6600');
        }

        // Show forge mark indicator
        if (WB.GLEffects && target.debuffs) {
            WB.GLEffects.spawnDamageNumber(
                target.x, target.y - 15,
                this.marksPerHit,
                '#FF4400'
            );
        }
    }

    applyScaling() {
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.45); // less scaling (was 0.6)
        this.marksPerHit = 1 + Math.floor(this.hitCount / 4);  // slower mark scaling (was /3)
        this.maxRotationSpeed = Math.min(0.12, this.baseMaxRotation + this.hitCount * 0.004);
        this.minRotationSpeed = Math.min(0.05, 0.025 + this.hitCount * 0.002);
        this.scalingStat.value = this.marksPerHit;
    }

    activateSuper() {
        this.currentDamage += 4;
        this.maxRotationSpeed *= 1.4;
        this.minRotationSpeed *= 1.4;
        this.unparryable = true;
        // Small HP on super — iron skin
        this.owner.hp = Math.min(this.owner.hp + 10, this.owner.maxHp + 10);
        this.owner.maxHp += 10;

        // Create a ring of fire hazards around the forge
        if (WB.Game && WB.Game.hazards) {
            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2;
                WB.Game.hazards.push(new WB.Hazard({
                    x: this.owner.x + Math.cos(angle) * 50,
                    y: this.owner.y + Math.sin(angle) * 50,
                    radius: 25,
                    damage: 2,
                    tickRate: 25,
                    lifespan: 240,
                    color: '#CC5500',
                    owner: this.owner,
                    ownerWeapon: this,
                }));
            }
        }

        // Visual burst — sparks and flames
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 25, '#CC5500');
            WB.Game.particles.spark(this.owner.x, this.owner.y, 20);
            WB.Game.particles.explode(this.owner.x, this.owner.y, 15, '#FF6600');
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
            B.fillCircleGlow(0, 0, this.reach, '#CC5500', 18);
        }

        // Forge hammer handle — dark wood
        B.fillRect(r - 2, -4, this.reach - r - 14, 8, '#5C3317');

        // Hammer head — dark iron block with warm glow
        const headX = this.reach - 20;
        B.fillRect(headX, -14, 24, 28, '#4A4A4A');
        B.strokeRect(headX, -14, 24, 28, '#333', 2);

        // Hot glow on hammer face (the striking end)
        B.setAlpha(0.4);
        B.fillRect(headX + 18, -12, 5, 24, '#FF6600');
        B.restoreAlpha();

        // Forge mark symbol — small anvil icon on hammer
        B.fillRect(headX + 6, -3, 8, 6, '#666');
        B.fillRect(headX + 4, 2, 12, 2, '#666');

        // Metal band
        B.fillRect(headX - 2, -6, 4, 12, '#555');

        B.popTransform();

        // Forge glow aura during super
        if (this.superActive) {
            const pulse = Math.sin(Date.now() * 0.008) * 0.05;
            B.setAlpha(0.08 + pulse);
            B.fillCircle(this.owner.x, this.owner.y, r + 12, '#FF4400');
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('hephaestus', HephaestusWeapon, 'pantheon');
