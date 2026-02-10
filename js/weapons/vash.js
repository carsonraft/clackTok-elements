window.WB = window.WB || {};

// Vash the Stampede: Expert gunslinger — rapid aimed shots with his silver revolver.
// "Love and Peace" passive — tries NOT to kill (damage reduction on low HP enemies).
// Mid-fight: Angel Arm awakens at 5 hits (massive power + changes projectile color).
// Super: ANGEL ARM FULL BLAST — enormous piercing energy beam that destroys everything.
class VashWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'vash',
            baseDamage: 3,
            rotationSpeed: 0.04,
            reach: 32,
            scalingName: '$$Bounty',
            superThreshold: 10,
            isRanged: true,
        });
        this.bounty = 6000000000; // $$60 billion
        this.fireTimer = 0;
        this.fireRate = 35;       // Fast — he's the best shot
        this.angelArmActive = false;
        this.angelArmThreshold = 5;
        this.muzzleFlash = 0;
        this.recoilAngle = 0;
        this.shotsFired = 0;
        this.wingPhase = 0;
        this.scalingStat.value = Math.floor(this.bounty / 1000000000);
    }

    update() {
        super.update();
        this.fireTimer++;
        this.muzzleFlash *= 0.82;
        this.recoilAngle *= 0.88;
        this.wingPhase += 0.04;

        if (this.fireTimer >= this.fireRate) {
            this._fireRevolver();
            this.fireTimer = 0;
        }

        // Angel Arm energy particles
        if (this.angelArmActive && Math.random() < 0.1) {
            if (WB.Game && WB.Game.particles) {
                const a = Math.random() * Math.PI * 2;
                const d = this.owner.radius + 5;
                WB.Game.particles.emit(
                    this.owner.x + Math.cos(a) * d,
                    this.owner.y + Math.sin(a) * d,
                    1, '#AADDFF', { speed: 0.5, life: 15, size: 2 }
                );
            }
        }
    }

    _fireRevolver() {
        if (!WB.Game || !WB.Game.projectiles) return;
        let fireAngle = this.angle;
        if (WB.Game.balls) {
            const enemy = WB.Game.balls.find(b => b !== this.owner && b.isAlive && b.side !== this.owner.side);
            if (enemy) fireAngle = Math.atan2(enemy.y - this.owner.y, enemy.x - this.owner.x);
        }

        // Vash is absurdly accurate — tiny spread
        fireAngle += (Math.random() - 0.5) * 0.06;

        const speed = this.angelArmActive ? 14 : 11;
        const dmg = this.angelArmActive ?
            this.currentDamage + 3 :
            this.currentDamage;
        const color = this.angelArmActive ? '#AADDFF' : '#FFD700';

        WB.Game.projectiles.push(new WB.Projectile({
            x: this.owner.x + Math.cos(fireAngle) * (this.owner.radius + 6),
            y: this.owner.y + Math.sin(fireAngle) * (this.owner.radius + 6),
            vx: Math.cos(fireAngle) * speed,
            vy: Math.sin(fireAngle) * speed,
            damage: dmg,
            owner: this.owner,
            ownerWeapon: this,
            radius: this.angelArmActive ? 4 : 3,
            lifespan: 55,
            bounces: this.angelArmActive ? 2 : 1,
            color: color,
        }));

        this.shotsFired++;
        this.muzzleFlash = 1.0;
        this.recoilAngle = -0.12;

        const isReload = this.shotsFired % 6 === 0;
        WB.Audio.gunClack(isReload);
        WB.Renderer.triggerShake(isReload ? 4 : 2);

        if (WB.Game.particles) {
            const mx = this.owner.x + Math.cos(fireAngle) * (this.owner.radius + 10);
            const my = this.owner.y + Math.sin(fireAngle) * (this.owner.radius + 10);
            WB.Game.particles.emit(mx, my, isReload ? 5 : 2, color, {
                speed: 2.5, life: 8, size: 1.5,
            });
        }
    }

    onHit(target) {
        let dmg = this.currentDamage;

        // "Love and Peace" — reduce damage if enemy is very low HP
        if (target.hp < target.maxHp * 0.15 && !this.angelArmActive) {
            dmg = Math.max(1, Math.floor(dmg * 0.4));
        }

        target.takeDamage(dmg);
        this.hitCount++;
        this.bounty += 500000000;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();

        if (!this.angelArmActive && this.hitCount >= this.angelArmThreshold) {
            this._activateAngelArm();
        }

        WB.Audio.weaponHit(this.hitCount, this.type);

        const dx = target.x - this.owner.x;
        const dy = target.y - this.owner.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        target.vx += (dx / d) * 3.5;
        target.vy += (dy / d) * 3.5;

        this._onHitEffects(target, dmg, this.angelArmActive ? '#AADDFF' : '#FFD700');
    }

    _activateAngelArm() {
        this.angelArmActive = true;
        this.currentDamage += 3;
        this.fireRate = Math.max(20, this.fireRate - 10);

        WB.Renderer.triggerShake(15);
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 25, '#AADDFF');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 15, '#FFF');
        }
        if (WB.GLEffects) {
            WB.GLEffects.spawnImpact(this.owner.x, this.owner.y, '#AADDFF', 65);
            WB.GLEffects.triggerSuperFlash('#AADDFF');
            WB.GLEffects.triggerChromatic(0.5);
            WB.GLEffects.triggerShockwave(this.owner.x, this.owner.y, 0.4);
        }
        this.scalingStat.value = Math.floor(this.bounty / 1000000000);
    }

    applyScaling() {
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.5);
        this.fireRate = Math.max(18, 35 - this.hitCount * 1.5);
        this.scalingStat.value = Math.floor(this.bounty / 1000000000);
    }

    activateSuper() {
        // ANGEL ARM FULL BLAST!!!
        this._fireAngelArmBlast();
        this.currentDamage += 5;
        this.fireRate = Math.max(12, this.fireRate - 8);
    }

    _fireAngelArmBlast() {
        if (!WB.Game || !WB.Game.projectiles) return;
        let fireAngle = this.angle;
        if (WB.Game.balls) {
            const enemy = WB.Game.balls.find(b => b !== this.owner && b.isAlive && b.side !== this.owner.side);
            if (enemy) fireAngle = Math.atan2(enemy.y - this.owner.y, enemy.x - this.owner.x);
        }

        // MASSIVE energy beam
        WB.Game.projectiles.push(new WB.Projectile({
            x: this.owner.x + Math.cos(fireAngle) * (this.owner.radius + 12),
            y: this.owner.y + Math.sin(fireAngle) * (this.owner.radius + 12),
            vx: Math.cos(fireAngle) * 12,
            vy: Math.sin(fireAngle) * 12,
            damage: 30 + this.hitCount * 2,
            owner: this.owner,
            ownerWeapon: this,
            radius: 16,
            lifespan: 80,
            bounces: 0,
            color: '#CCDDFF',
            piercing: true,
        }));

        WB.Renderer.triggerShake(22);
        if (WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 40, '#AADDFF');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 25, '#FFF');
            WB.Game.particles.spark(this.owner.x, this.owner.y, 25);
        }
        if (WB.GLEffects) {
            WB.GLEffects.triggerSuperFlash('#CCDDFF');
            WB.GLEffects.triggerShockwave(this.owner.x, this.owner.y, 1.0);
            WB.GLEffects.triggerChromatic(1.0);
            WB.GLEffects.triggerBarrel(0.5);
        }
        // Rapid gunclack burst for angel arm
        for (let i = 0; i < 5; i++) {
            setTimeout(() => WB.Audio.gunClack(true), i * 35);
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;
        const drawAngle = this.angle + this.recoilAngle;

        // Angel Arm wing (behind ball)
        if (this.angelArmActive) {
            const wAngle = this.angle + Math.PI;
            const wingSpread = Math.sin(this.wingPhase) * 0.15;
            for (let i = 0; i < 5; i++) {
                const fa = wAngle + (i - 2) * 0.25 + wingSpread;
                const len = r + 15 + i * 3;
                B.setAlpha(0.2 - i * 0.03);
                B.line(this.owner.x, this.owner.y,
                    this.owner.x + Math.cos(fa) * len,
                    this.owner.y + Math.sin(fa) * len,
                    '#AADDFF', 2);
                B.restoreAlpha();
            }
        }

        B.pushTransform(this.owner.x, this.owner.y, drawAngle);

        if (this.superActive) {
            B.fillCircleGlow(this.reach * 0.6, 0, 14, '#CCDDFF', 22);
        }

        // Silver revolver barrel
        B.fillRect(r - 2, -2, this.reach - r + 4, 4, this.angelArmActive ? '#AABBCC' : '#C0C0C0');
        B.strokeRect(r - 2, -2, this.reach - r + 4, 4, '#888', 1);
        B.line(r + 2, 0, this.reach + 2, 0, '#666', 1.5);

        // Cylinder
        B.fillCircle(r + 5, 0, 4.5, this.angelArmActive ? '#99AACC' : '#AAA');
        B.strokeCircle(r + 5, 0, 4.5, '#777', 1);

        // Grip
        B.fillRect(r - 5, 0, 7, 8, '#654321');
        B.strokeRect(r - 5, 0, 7, 8, '#3C2415', 0.8);

        // Trigger guard
        B.line(r - 1, 6, r + 3, 8, '#888', 1);

        // Front sight (red — classic Vash)
        B.fillRect(this.reach - 1, -4, 2, 3, '#FF0000');

        // Muzzle flash
        if (this.muzzleFlash > 0.1) {
            B.setAlpha(this.muzzleFlash * 0.7);
            const flashColor = this.angelArmActive ? '#AADDFF' : '#FFD700';
            B.fillCircle(this.reach + 4, 0, 4 + this.muzzleFlash * 10, flashColor);
            B.fillCircle(this.reach + 6, 0, 2 + this.muzzleFlash * 5, '#FFF');
            for (let i = 0; i < 3; i++) {
                const sa = (i - 1) * 0.35;
                const len = 5 + this.muzzleFlash * 12;
                B.line(this.reach + 2, 0,
                    this.reach + 2 + Math.cos(sa) * len,
                    Math.sin(sa) * len,
                    flashColor, 1.5);
            }
            B.restoreAlpha();
        }

        B.popTransform();

        // Signature red coat hint
        B.setAlpha(0.3);
        B.strokeCircle(this.owner.x, this.owner.y, r + 2, '#CC0000', 2);
        B.restoreAlpha();

        // Hair spike
        B.line(this.owner.x, this.owner.y - r * 0.7,
            this.owner.x + 2, this.owner.y - r * 1.2, '#FFE4B5', 2);

        // Angel Arm aura
        if (this.angelArmActive && !this.superActive) {
            const flicker = 1 + Math.sin(Date.now() * 0.01) * 0.15;
            B.setAlpha(0.3);
            B.strokeCircle(this.owner.x, this.owner.y, r + 5 * flicker, '#AADDFF', 2);
            B.restoreAlpha();
        }
        if (this.superActive) {
            const flicker = 1 + Math.sin(Date.now() * 0.01) * 0.2;
            B.setAlpha(0.5);
            B.strokeCircle(this.owner.x, this.owner.y, r + 8 * flicker, '#CCDDFF', 3);
            B.restoreAlpha();
            B.setAlpha(0.1);
            B.fillCircle(this.owner.x, this.owner.y, r + 5, '#AADDFF');
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('vash', VashWeapon);
