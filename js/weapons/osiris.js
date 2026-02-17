window.WB = window.WB || {};

// Osiris — Flail & Crook: Asymmetric dual melee (one long/light, one short/heavy).
// Damage bank: stores 30% of all damage HE receives into a death bank.
// Every 5th hit he deals, the entire bank is added as bonus damage, then empties.
// Scaling: Each hit increases flail length by +2px.
// Super (12 hits): Bank fill rate → 50%. Release every 3rd hit instead of 5th.
class OsirisWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'osiris',
            baseDamage: 2, // crook damage
            rotationSpeed: 0.065,
            reach: 70, // crook reach (short/heavy)
            scalingName: 'Bank',
            superThreshold: 12,
        });
        this.flailReach = 85;  // flail reach (long/light)
        this.flailDamage = 1;
        this.flailAngle = this.angle + Math.PI; // opposite side
        this.deathBank = 0;
        this.bankRate = 0.3; // 30% of damage received
        this.releaseEvery = 5; // release every Nth hit
        this._lastHp = this.owner.hp;
        this.visualTimer = 0;
        this.scalingStat.value = '0';
    }

    update() {
        if (this._deflectReverse > 0) this._deflectReverse--;
        this.angle += this.rotationSpeed * this.getDir();
        this.flailAngle = this.angle + Math.PI;
        if (this.cooldown > 0) this.cooldown--;
        this.visualTimer++;

        // Track damage received → fill death bank
        const currentHp = this.owner.hp;
        if (currentHp < this._lastHp) {
            const dmgReceived = this._lastHp - currentHp;
            this.deathBank += dmgReceived * this.bankRate;
        }
        this._lastHp = currentHp;
        this.scalingStat.value = Math.floor(this.deathBank);

        // Flail collision (second weapon on opposite side)
        if (this.cooldown <= 0 && WB.Game && WB.Game.balls) {
            const tipX2 = this.owner.x + Math.cos(this.flailAngle) * this.flailReach;
            const tipY2 = this.owner.y + Math.sin(this.flailAngle) * this.flailReach;
            const midX2 = this.owner.x + Math.cos(this.flailAngle) * this.flailReach * 0.4;
            const midY2 = this.owner.y + Math.sin(this.flailAngle) * this.flailReach * 0.4;

            for (const target of WB.Game.balls) {
                if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                if (WB.Physics.lineCircle(midX2, midY2, tipX2, tipY2, target.x, target.y, target.radius)) {
                    this._onFlailHit(target);
                    break;
                }
            }
        }
    }

    _onFlailHit(target) {
        let dmg = this.flailDamage;
        this.hitCount++;

        // Check bank release
        if (this.hitCount % this.releaseEvery === 0 && this.deathBank > 0) {
            dmg += this.deathBank;
            this.deathBank = 0;
            // Bank release visual
            if (WB.GLEffects) {
                WB.GLEffects.spawnImpact(target.x, target.y, '#9370DB', 35);
            }
            if (WB.Game && WB.Game.particles) {
                WB.Game.particles.explode(target.x, target.y, 10, '#9370DB');
            }
        }

        target.takeDamage(dmg);
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);
        this._onHitEffects(target, dmg, '#98FB98');
    }

    onHit(target) {
        let dmg = this.currentDamage;
        this.hitCount++;

        // Check bank release
        if (this.hitCount % this.releaseEvery === 0 && this.deathBank > 0) {
            dmg += this.deathBank;
            this.deathBank = 0;
            // Bank release visual
            if (WB.GLEffects) {
                WB.GLEffects.spawnImpact(target.x, target.y, '#9370DB', 35);
            }
            if (WB.Game && WB.Game.particles) {
                WB.Game.particles.explode(target.x, target.y, 10, '#9370DB');
            }
        }

        target.takeDamage(dmg);
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);
        this._onHitEffects(target, dmg, '#98FB98');

        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.emit(target.x, target.y, 4, '#98FB98');
        }
    }

    applyScaling() {
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.2);
        this.flailReach = Math.min(110, 85 + this.hitCount * 2); // +2px per hit
        this.flailDamage = 1 + Math.floor(this.hitCount * 0.15);
        this.scalingStat.value = Math.floor(this.deathBank);
    }

    activateSuper() {
        // Bank rate increases, release frequency increases
        this.bankRate = 0.5; // 50% of damage received
        this.releaseEvery = 3; // every 3rd hit

        // Wrapping lines glow burst
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 20, '#98FB98');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 12, '#FFFFFF');
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        // Wrapping lines on ball (mummy wraps) — glow brighter as bank fills
        const bankIntensity = Math.min(1, this.deathBank / 30);
        if (bankIntensity > 0.05) {
            B.setAlpha(0.1 + bankIntensity * 0.2);
            for (let i = 0; i < 4; i++) {
                const a = i * Math.PI / 2 + this.visualTimer * 0.008;
                const x1 = this.owner.x + Math.cos(a) * r * 0.7;
                const y1 = this.owner.y + Math.sin(a) * r * 0.7;
                const x2 = this.owner.x + Math.cos(a + 0.8) * r * 0.9;
                const y2 = this.owner.y + Math.sin(a + 0.8) * r * 0.9;
                B.line(x1, y1, x2, y2, '#FFFFFF', 2);
            }
            B.restoreAlpha();
        }

        // Death bank visual — purple number above HP
        if (this.deathBank >= 1 && WB.GLText) {
            const bankText = Math.floor(this.deathBank).toString();
            WB.GLText.drawTextWithStroke(
                bankText,
                this.owner.x, this.owner.y - r - 12,
                'bold 14px "Courier New", monospace',
                '#9370DB', '#333', 2, 'center', 'middle'
            );
        }

        // Crook (short/heavy side)
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        // Shaft — wider
        B.fillRect(r - 2, -4, this.reach - r + 2, 8, '#5C4033');
        // Crook hook — larger circles
        B.fillCircle(this.reach, -4, 6, '#98FB98');
        B.fillCircle(this.reach - 4, -8, 4.5, '#7CDB7C');
        B.strokeCircle(this.reach - 2, -5, 7, '#4A854A', 1.5);
        B.popTransform();

        // Flail (long/light side)
        B.pushTransform(this.owner.x, this.owner.y, this.flailAngle);
        // Chain segments — bigger links
        const chainSegs = 5;
        const segLen = (this.flailReach - r) / chainSegs;
        for (let i = 0; i < chainSegs; i++) {
            const sx = r + i * segLen;
            B.fillCircle(sx + segLen * 0.5, 0, 3, '#AAAAAA');
        }
        B.line(r, 0, this.flailReach - 8, 0, '#888888', 2.5);
        // Flail head — bigger
        B.fillCircle(this.flailReach - 4, 0, 8, '#C0C0C0');
        B.strokeCircle(this.flailReach - 4, 0, 8, '#888888', 1.5);
        B.popTransform();

        // Super indicator
        if (this.superActive) {
            const pulse = Math.sin(this.visualTimer * 0.06) * 0.04;
            B.setAlpha(0.12 + pulse);
            B.strokeCircle(this.owner.x, this.owner.y, r + 8, '#98FB98', 2);
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('osiris', OsirisWeapon, 'egyptian');
