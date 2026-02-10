window.WB = window.WB || {};

// Zoro: Three-sword style — extra wide melee arc + fast rotation.
// Mid-fight: Asura mode (triple damage, triple afterimage).
// Super: Billion-Fold World Trichiliocosm — massive 360° slash wave.
class ZoroWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'zoro',
            baseDamage: 4,
            rotationSpeed: 0.06,   // Fast spinning swordsman
            reach: 40,
            scalingName: 'Swords',
            superThreshold: 10,
            isRanged: false,
        });
        this.swordsActive = 3;
        this.asuraActive = false;
        this.asuraThreshold = 5;
        this.slashTrail = [];
        this.scalingStat.value = this.swordsActive;
    }

    update() {
        super.update();
        // Store trail positions for afterimage
        this.slashTrail.push({ x: this.getTipX(), y: this.getTipY(), angle: this.angle });
        if (this.slashTrail.length > (this.asuraActive ? 12 : 6)) this.slashTrail.shift();
    }

    onHit(target) {
        const multiplier = this.asuraActive ? 3 : 1;
        const dmg = this.currentDamage * multiplier;
        target.takeDamage(dmg);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();

        if (!this.asuraActive && this.hitCount >= this.asuraThreshold) {
            this._activateAsura();
        }

        WB.Audio.weaponHit(this.hitCount, this.type);

        // Slash knockback
        const dx = target.x - this.owner.x;
        const dy = target.y - this.owner.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        target.vx += (dx / d) * 5;
        target.vy += (dy / d) * 5;

        this._onHitEffects(target, dmg, '#2E8B2E');
    }

    _activateAsura() {
        this.asuraActive = true;
        this.rotationSpeed = 0.09;
        WB.Renderer.triggerShake(12);
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 20, '#2E8B2E');
        }
        if (WB.GLEffects) {
            WB.GLEffects.spawnImpact(this.owner.x, this.owner.y, '#2E8B2E', 70);
            WB.GLEffects.triggerChromatic(0.4);
            WB.GLEffects.triggerShockwave(this.owner.x, this.owner.y, 0.35);
        }
    }

    applyScaling() {
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.6);
        this.swordsActive = 3;
        this.scalingStat.value = this.swordsActive;
    }

    activateSuper() {
        // BILLION-FOLD WORLD TRICHILIOCOSM!
        this._fireSlashWave();
        this.currentDamage += 5;
        this.rotationSpeed = 0.12;
    }

    _fireSlashWave() {
        if (!WB.Game || !WB.Game.projectiles) return;
        // 8 slash projectiles in all directions
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI * 2) / 8;
            WB.Game.projectiles.push(new WB.Projectile({
                x: this.owner.x + Math.cos(angle) * (this.owner.radius + 5),
                y: this.owner.y + Math.sin(angle) * (this.owner.radius + 5),
                vx: Math.cos(angle) * 8,
                vy: Math.sin(angle) * 8,
                damage: 10 + this.hitCount,
                owner: this.owner,
                ownerWeapon: this,
                radius: 5,
                lifespan: 50,
                bounces: 1,
                color: '#88FF88',
                piercing: true,
            }));
        }

        WB.Renderer.triggerShake(20);
        if (WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 40, '#2E8B2E');
        }
        if (WB.GLEffects) {
            WB.GLEffects.triggerShockwave(this.owner.x, this.owner.y, 0.8);
            WB.GLEffects.triggerChromatic(0.8);
            WB.GLEffects.triggerBarrel(0.4);
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        // Afterimage trail (ghost swords)
        for (let i = 0; i < this.slashTrail.length; i++) {
            const t = this.slashTrail[i];
            const alpha = (i / this.slashTrail.length) * 0.25;
            B.setAlpha(alpha);
            B.line(this.owner.x, this.owner.y, t.x, t.y, '#AAFFAA', 2);
            B.restoreAlpha();
        }

        // Three swords at different angle offsets
        const offsets = this.asuraActive ? [-0.4, 0, 0.4, -0.8, 0.8, -1.2] : [-0.3, 0, 0.3];

        for (let s = 0; s < offsets.length; s++) {
            const sAngle = this.angle + offsets[s];
            B.pushTransform(this.owner.x, this.owner.y, sAngle);

            if (s > 2) {
                B.setAlpha(0.3); // Asura ghost swords
            }

            // Blade
            B.fillRect(r - 2, -1.5, this.reach - r + 2, 3, '#E0E0E0');
            B.strokeRect(r - 2, -1.5, this.reach - r + 2, 3, '#999', 1);
            // Guard
            B.fillRect(r - 4, -4, 3, 8, '#DAA520');
            // Handle
            B.fillRect(r - 8, -2, 4, 4, '#333');

            if (s > 2) B.restoreAlpha();
            B.popTransform();
        }

        // Super aura
        if (this.superActive) {
            const flicker = 1 + Math.sin(Date.now() * 0.01) * 0.15;
            B.setAlpha(0.4);
            B.strokeCircle(this.owner.x, this.owner.y, r + 8 * flicker, '#2E8B2E', 2.5);
            B.restoreAlpha();
        }

        // Asura demon face hint (three pairs of eyes)
        if (this.asuraActive && !this.superActive) {
            B.setAlpha(0.3);
            B.strokeCircle(this.owner.x, this.owner.y, r + 5, '#880000', 1.5);
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('zoro', ZoroWeapon);
