window.WB = window.WB || {};

// Apollo — Sun Bow: Fires spread-shot solar arrows that apply burn DOT.
// Scaling: Arrow count and burn damage increase per hit.
// Super: Fires a volley of piercing sun rays + drops ground fire hazards.
class ApolloWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'apollo',
            baseDamage: 4,            // restored from 3 — arrows need impact damage
            rotationSpeed: 0.04,
            reach: 58,
            scalingName: 'Arrows',
            superThreshold: 10,       // back to 10 (was 12)
            isRanged: true,
        });
        this.arrowCount = 3;
        this.burnDamage = 1.2;        // buffed from 1.0 — burn needs to be threatening
        this.burnDuration = 120;      // slightly longer (was 110) — burns need to last
        this.burnTickRate = 15;       // slightly faster burn ticks (was 16) — more DOT pressure
        this.fireTimer = 0;
        this.fireRate = 44;           // buffed from 48 — needs more arrow volume
        this.scalingStat.value = this.arrowCount;
    }

    update() {
        super.update();
        this.fireTimer++;
        if (this.fireTimer >= this.fireRate) {
            this.fireArrows();
            this.fireTimer = 0;
        }
    }

    fireArrows() {
        if (!WB.Game || !WB.Game.projectiles) return;
        const spreadAngle = 0.25;
        const startAngle = this.angle - (this.arrowCount - 1) * spreadAngle / 2;
        const arrowSpeed = 7;  // partially restored (was 6, originally 8)

        for (let i = 0; i < this.arrowCount; i++) {
            const a = startAngle + i * spreadAngle;
            WB.Game.projectiles.push(new WB.Projectile({
                x: this.getTipX(),
                y: this.getTipY(),
                vx: Math.cos(a) * arrowSpeed,
                vy: Math.sin(a) * arrowSpeed,
                damage: this.currentDamage,
                owner: this.owner,
                ownerWeapon: this,
                radius: 3,
                lifespan: 90,          // shorter lifespan (was 120)
                bounces: 0,            // no bounces (was 1) — small arena bounces too strong
                color: '#FFA500',
                piercing: this.superActive, // piercing during super
            }));
        }
        WB.Audio.projectileFire();
    }

    // Apply burn on projectile hit
    onProjectileHit(proj, target) {
        if (target.debuffs) {
            target.debuffs.burn.push({
                damage: this.burnDamage,
                remaining: this.burnDuration,
                tickRate: this.burnTickRate,
                timer: 0,
            });
        }
        // Fire particle on burn apply
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.emit(target.x, target.y, 3, '#FF6600');
        }
    }

    applyScaling() {
        this.arrowCount = 3 + Math.floor(this.hitCount / 3);
        this.burnDamage = Math.min(2.5, 1.0 + this.hitCount * 0.15);  // between old values
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.25);
        this.scalingStat.value = this.arrowCount;
    }

    activateSuper() {
        this.currentDamage += 2;
        this.fireRate = Math.max(35, this.fireRate - 15);
        this.burnDamage += 0.5;
        this.burnDuration = 150; // longer burns

        // Drop 3 ground fire hazard patches
        if (WB.Game && WB.Game.hazards) {
            for (let i = 0; i < 3; i++) {
                const angle = (i / 3) * Math.PI * 2 + WB.random();
                const dist = 40 + WB.random() * 40;
                WB.Game.hazards.push(new WB.Hazard({
                    x: this.owner.x + Math.cos(angle) * dist,
                    y: this.owner.y + Math.sin(angle) * dist,
                    radius: 28,
                    damage: 1.5,
                    tickRate: 20,
                    lifespan: 300,
                    color: '#FFA500',
                    owner: this.owner,
                    ownerWeapon: this,
                }));
            }
        }

        // Fire a massive volley
        for (let i = 0; i < 8; i++) {
            setTimeout(() => this.fireArrows(), i * 40);
        }

        // Visual burst — solar flare
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 30, '#FFA500');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 20, '#FF6600');
        }
    }

    onHit(target) {
        // No melee damage; projectiles handle hits
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
            B.fillCircleGlow(r + 14, 0, 22, '#FFA500', 18);
        }

        // Sun bow — golden arc
        const arcR = 20;
        const bowCenter = r + 12;
        const arcStart = -Math.PI * 0.5;
        const arcEnd = Math.PI * 0.5;
        const arcSegs = 12;
        for (let i = 0; i < arcSegs; i++) {
            const a0 = arcStart + (arcEnd - arcStart) * (i / arcSegs);
            const a1 = arcStart + (arcEnd - arcStart) * ((i + 1) / arcSegs);
            B.line(
                bowCenter + Math.cos(a0) * arcR, Math.sin(a0) * arcR,
                bowCenter + Math.cos(a1) * arcR, Math.sin(a1) * arcR,
                '#DAA520', 4
            );
        }

        // Golden bowstring
        const stY1 = Math.sin(-Math.PI * 0.5) * arcR;
        const stY2 = Math.sin(Math.PI * 0.5) * arcR;
        B.line(bowCenter + Math.cos(-Math.PI * 0.5) * arcR, stY1, bowCenter - 6, 0, '#FFD700', 1.5);
        B.line(bowCenter - 6, 0, bowCenter + Math.cos(Math.PI * 0.5) * arcR, stY2, '#FFD700', 1.5);

        // Sun arrow nocked
        B.line(bowCenter - 6, 0, this.reach + 4, 0, '#CC6600', 2);

        // Sun arrowhead — radiating point
        B.fillTriangle(this.reach + 6, 0, this.reach, -4, this.reach, 4, '#FFA500');

        // Sun rays around arrowhead
        B.setAlpha(0.3);
        for (let i = 0; i < 4; i++) {
            const rayA = (i / 4) * Math.PI * 2;
            B.line(this.reach + 3, 0,
                this.reach + 3 + Math.cos(rayA) * 6, Math.sin(rayA) * 6,
                '#FFD700', 1);
        }
        B.restoreAlpha();

        // Orange fletching
        B.fillTriangle(bowCenter - 4, 0, bowCenter - 10, -3, bowCenter - 10, 3, '#FF6600');

        B.popTransform();

        // Solar aura during super
        if (this.superActive) {
            const pulse = Math.sin(Date.now() * 0.01) * 3;
            B.setAlpha(0.08);
            B.fillCircle(this.owner.x, this.owner.y, r + 15 + pulse, '#FFA500');
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('apollo', ApolloWeapon, 'pantheon');
