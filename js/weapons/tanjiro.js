window.WB = window.WB || {};

// Tanjiro: Water Breathing sword — graceful arcing slashes with water trail.
// Hinokami Kagura at 5 hits (fire mode — more damage, fire trail).
// Super: Sun Halo Dragon Head — massive fire dragon projectile.
class TanjiroWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'tanjiro',
            baseDamage: 4,
            rotationSpeed: 0.05,
            reach: 40,
            scalingName: 'Breathing',
            superThreshold: 10,
            isRanged: false,
        });
        this.breathingForm = 1;
        this.hinokamiActive = false;
        this.hinokamiThreshold = 5;
        this.slashTrail = [];
        this.waterTimer = 0;
        this.scalingStat.value = this.breathingForm;
    }

    update() {
        super.update();
        this.waterTimer += 0.08;

        // Store trail for water/fire arc
        this.slashTrail.push({
            x: this.getTipX(),
            y: this.getTipY(),
            age: 0,
        });
        if (this.slashTrail.length > 10) this.slashTrail.shift();
        for (const t of this.slashTrail) t.age++;

        // Water/fire particles along trail
        if (Math.random() < 0.15) {
            const tipX = this.getTipX();
            const tipY = this.getTipY();
            if (WB.Game && WB.Game.particles) {
                const color = this.hinokamiActive ? '#FF4400' : '#44BBFF';
                WB.Game.particles.emit(tipX, tipY, 1, color, {
                    speed: 1, life: 12, size: 2,
                });
            }
        }
    }

    onHit(target) {
        const dmg = this.hinokamiActive ? Math.floor(this.currentDamage * 1.5) : this.currentDamage;
        target.takeDamage(dmg);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();

        if (!this.hinokamiActive && this.hitCount >= this.hinokamiThreshold) {
            this._activateHinokami();
        }

        WB.Audio.weaponHit(this.hitCount, this.type);

        const dx = target.x - this.owner.x;
        const dy = target.y - this.owner.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        target.vx += (dx / d) * 4.5;
        target.vy += (dy / d) * 4.5;

        const color = this.hinokamiActive ? '#FF4400' : '#44BBFF';
        this._onHitEffects(target, dmg, color);
    }

    _activateHinokami() {
        this.hinokamiActive = true;
        this.breathingForm = 13; // Hinokami Kagura
        this.currentDamage += 3;
        this.rotationSpeed = 0.065;

        WB.Renderer.triggerShake(12);
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 25, '#FF4400');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 10, '#FFCC00');
        }
        if (WB.GLEffects) {
            WB.GLEffects.spawnImpact(this.owner.x, this.owner.y, '#FF4400', 60);
            WB.GLEffects.triggerChromatic(0.4);
            WB.GLEffects.triggerShockwave(this.owner.x, this.owner.y, 0.3);
        }
        this.scalingStat.value = this.breathingForm;
    }

    applyScaling() {
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.5);
        if (!this.hinokamiActive) {
            this.breathingForm = 1 + Math.floor(this.hitCount * 0.5);
        }
        this.scalingStat.value = this.breathingForm;
    }

    activateSuper() {
        // SUN HALO DRAGON HEAD!
        this._fireDragonHead();
        this.currentDamage += 5;
        this.rotationSpeed = 0.08;
    }

    _fireDragonHead() {
        if (!WB.Game || !WB.Game.projectiles) return;
        let fireAngle = this.angle;
        if (WB.Game.balls) {
            const enemy = WB.Game.balls.find(b => b !== this.owner && b.isAlive && b.side !== this.owner.side);
            if (enemy) fireAngle = Math.atan2(enemy.y - this.owner.y, enemy.x - this.owner.x);
        }

        // Fire dragon — big, hot, piercing
        WB.Game.projectiles.push(new WB.Projectile({
            x: this.owner.x + Math.cos(fireAngle) * (this.owner.radius + 10),
            y: this.owner.y + Math.sin(fireAngle) * (this.owner.radius + 10),
            vx: Math.cos(fireAngle) * 10,
            vy: Math.sin(fireAngle) * 10,
            damage: 22 + this.hitCount * 2,
            owner: this.owner,
            ownerWeapon: this,
            radius: 12,
            lifespan: 70,
            bounces: 0,
            color: '#FF6600',
            piercing: true,
        }));

        WB.Renderer.triggerShake(18);
        if (WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 35, '#FF4400');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 20, '#FFCC00');
        }
        if (WB.GLEffects) {
            WB.GLEffects.triggerShockwave(this.owner.x, this.owner.y, 0.7);
            WB.GLEffects.triggerChromatic(0.7);
            WB.GLEffects.triggerBarrel(0.3);
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        // Water/fire trail arc
        const trailColor = this.hinokamiActive ? '#FF4400' : '#44BBFF';
        for (let i = 0; i < this.slashTrail.length - 1; i++) {
            const t = this.slashTrail[i];
            const alpha = (1 - t.age / 20) * 0.4;
            if (alpha <= 0) continue;
            B.setAlpha(alpha);
            const next = this.slashTrail[i + 1];
            B.line(t.x, t.y, next.x, next.y, trailColor, 3);
            B.restoreAlpha();
        }

        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        if (this.superActive) {
            B.fillCircleGlow(this.reach * 0.7, 0, 14, '#FF6600', 22);
        }

        // Nichirin blade
        const bladeColor = this.hinokamiActive ? '#FF4400' : '#333';
        B.fillRect(r - 2, -1.5, this.reach - r, 3, bladeColor);
        // Red edge (always)
        B.line(r - 2, -1.5, this.reach, -1.5, '#CC0000', 1);
        B.strokeRect(r - 2, -1.5, this.reach - r, 3, '#666', 0.8);

        // Guard (circular tsuba)
        B.fillCircle(r - 3, 0, 4, '#333');
        B.strokeCircle(r - 3, 0, 4, '#DAA520', 1);

        // Handle wrap (checkered pattern hint)
        B.fillRect(r - 10, -2, 7, 4, '#222');
        B.line(r - 9, -2, r - 6, 2, '#555', 0.8);
        B.line(r - 7, -2, r - 4, 2, '#555', 0.8);

        // Fire effect along blade (Hinokami mode)
        if (this.hinokamiActive) {
            const t = Date.now() * 0.01;
            for (let i = 0; i < 3; i++) {
                const bx = r + (this.reach - r) * (0.3 + i * 0.25);
                const by = Math.sin(t + i * 1.5) * 4;
                B.setAlpha(0.35);
                B.fillCircle(bx, by, 3 + Math.sin(t * 2 + i), '#FF8800');
                B.restoreAlpha();
            }
        }

        B.popTransform();

        // Earring scar hint
        B.setAlpha(0.4);
        B.fillCircle(this.owner.x - r * 0.25, this.owner.y - r * 0.3, r * 0.08, '#AA0000');
        B.restoreAlpha();

        // Auras
        if (this.hinokamiActive && !this.superActive) {
            const flicker = 1 + Math.sin(Date.now() * 0.012) * 0.15;
            B.setAlpha(0.3);
            B.strokeCircle(this.owner.x, this.owner.y, r + 5 * flicker, '#FF4400', 2);
            B.restoreAlpha();
        }
        if (this.superActive) {
            const flicker = 1 + Math.sin(Date.now() * 0.01) * 0.2;
            B.setAlpha(0.5);
            B.strokeCircle(this.owner.x, this.owner.y, r + 8 * flicker, '#FF6600', 3);
            B.restoreAlpha();
            B.setAlpha(0.1);
            B.fillCircle(this.owner.x, this.owner.y, r + 5, '#FFCC00');
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('tanjiro', TanjiroWeapon);
