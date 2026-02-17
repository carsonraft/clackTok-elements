window.WB = window.WB || {};

// Athena — Shield & Spear: Hybrid defensive/offensive weapon.
// Shield cone reflects incoming projectiles (reverses velocity + adds damage bonus).
// Spear jabs periodically for melee damage. Scaling: Shield reflect bonus + spear damage.
// Super: Continuous spear spin + double shield reflect force + larger cone.
class AthenaWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'athena',
            baseDamage: 4,            // pulled back from 5
            rotationSpeed: 0.045,     // pulled back from 0.05
            reach: 72,                // pulled back from 75
            scalingName: 'Shield',
            superThreshold: 9,        // between 8 and 10
            canParry: true,
        });
        // Shield
        this.shieldAngle = 0;
        this.shieldConeWidth = Math.PI * 0.6; // ~108° (between 90 and 126)
        this.reflectBonus = 1.4;     // pulled back from 1.5
        this.reflectCooldown = 0;

        // Spear
        this.spearTimer = 0;
        this.spearRate = 48;         // pulled back from 40 (was 60)
        this.spearJabbing = false;
        this.spearJabFrame = 0;
        this.spearJabDuration = 12;
        this.spearReach = 72;

        // Athena is tankier
        this.owner.hp = Math.round(WB.Config.BALL_MAX_HP * 1.10); // pulled back from 1.15
        this.owner.maxHp = this.owner.hp;

        this.scalingStat.value = this.reflectBonus.toFixed(1) + 'x';
    }

    update() {
        // Shield faces movement direction (or nearest enemy if slow)
        const speed = this.owner.getSpeed();
        if (speed > 1) {
            const targetAngle = Math.atan2(this.owner.vy, this.owner.vx);
            // Actually face TOWARD nearest enemy, not movement direction
            let bestAngle = targetAngle;
            if (WB.Game && WB.Game.balls) {
                let closest = null, closestDist = Infinity;
                for (const b of WB.Game.balls) {
                    if (b === this.owner || !b.isAlive || b.side === this.owner.side) continue;
                    const dx = b.x - this.owner.x, dy = b.y - this.owner.y;
                    const dist = dx * dx + dy * dy;
                    if (dist < closestDist) { closestDist = dist; closest = b; }
                }
                if (closest) {
                    bestAngle = Math.atan2(closest.y - this.owner.y, closest.x - this.owner.x);
                }
            }
            let diff = bestAngle - this.shieldAngle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.shieldAngle += diff * 0.1;
        }

        // Weapon rotation (for spear visual)
        if (this._deflectReverse > 0) this._deflectReverse--;
        this.angle += this.rotationSpeed * this.getDir();
        if (this.cooldown > 0) this.cooldown--;
        if (this.reflectCooldown > 0) this.reflectCooldown--;

        // Spear jab timer
        this.spearTimer++;
        if (this.spearTimer >= this.spearRate && !this.spearJabbing) {
            this.spearJabbing = true;
            this.spearJabFrame = 0;
            this.spearTimer = 0;
        }
        if (this.spearJabbing) {
            this.spearJabFrame++;
            if (this.spearJabFrame >= this.spearJabDuration) {
                this.spearJabbing = false;
            }
        }

        // Reflect projectiles in shield cone
        this._reflectProjectiles();

        // Spear jab collision (during jab animation)
        if (this.spearJabbing && this.spearJabFrame > 2 && this.spearJabFrame < 8 && this.canHit()) {
            this._spearHitCheck();
        }

        // Super: also do continuous spear rotation hits
        if (this.superActive && this.cooldown <= 0) {
            this._spearHitCheck();
        }
    }

    _reflectProjectiles() {
        if (!WB.Game || !WB.Game.projectiles) return;
        if (this.reflectCooldown > 0) return;

        for (const proj of WB.Game.projectiles) {
            if (!proj.alive) continue;
            // Only reflect enemy projectiles
            if (proj.owner && proj.owner.side === this.owner.side) continue;

            // Check if projectile is within shield range
            const dx = proj.x - this.owner.x;
            const dy = proj.y - this.owner.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > this.owner.radius + 35) continue;

            // Check if in shield cone
            if (!this._isInShieldCone(proj.x, proj.y)) continue;

            // REFLECT! Reverse velocity and boost damage
            proj.vx = -proj.vx * 1.3;
            proj.vy = -proj.vy * 1.3;
            proj.damage = Math.ceil(proj.damage * this.reflectBonus);
            proj.owner = this.owner; // Now belongs to Athena
            proj.ownerWeapon = this;
            proj.color = '#C0C0C0'; // Silver
            proj._hitTargets.clear();

            this.reflectCooldown = 10;  // faster reflects (was 18) — Athena is a shield expert
            this.hitCount++;
            this.applyScaling();
            this.checkSuper();

            // Reflect visual
            WB.Audio.parry();
            WB.Renderer.triggerShake(4);
            if (WB.GLEffects) {
                WB.GLEffects.spawnImpact(proj.x, proj.y, '#C0C0C0', 25);
                WB.GLEffects.spawnClashSparks(proj.x, proj.y, 4, '#C0C0C0');
            }
            if (WB.Game.particles) {
                WB.Game.particles.spark(proj.x, proj.y, 6);
            }
            break; // One reflect per frame
        }
    }

    _isInShieldCone(px, py) {
        const angleToTarget = Math.atan2(py - this.owner.y, px - this.owner.x);
        let angleDiff = angleToTarget - this.shieldAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        return Math.abs(angleDiff) < this.shieldConeWidth / 2;
    }

    _spearHitCheck() {
        if (!WB.Game || !WB.Game.balls) return;
        // Spear points opposite of shield (behind = attack direction)
        const spearAngle = this.superActive ? this.angle : this.shieldAngle;
        const tipX = this.owner.x + Math.cos(spearAngle) * this.spearReach;
        const tipY = this.owner.y + Math.sin(spearAngle) * this.spearReach;
        const midX = this.owner.x + Math.cos(spearAngle) * this.spearReach * 0.5;
        const midY = this.owner.y + Math.sin(spearAngle) * this.spearReach * 0.5;

        for (const target of WB.Game.balls) {
            if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
            if (WB.Physics.lineCircle(midX, midY, tipX, tipY, target.x, target.y, target.radius)) {
                this.onHit(target);
                break;
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
        this._onHitEffects(target, this.currentDamage, '#C0C0C0');
    }

    applyScaling() {
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.4);
        this.reflectBonus = Math.min(2.2, 1.4 + this.hitCount * 0.1);
        this.scalingStat.value = this.reflectBonus.toFixed(1) + 'x';
    }

    activateSuper() {
        this.currentDamage += 3;
        this.shieldConeWidth = Math.PI * 1.2; // wider shield
        this.reflectBonus *= 2;
        this.rotationSpeed = 0.08; // continuous spear spin
        this.spearRate = 30;

        // Burst — shield bash push all enemies
        if (WB.Game && WB.Game.balls) {
            for (const target of WB.Game.balls) {
                if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
                const dx = target.x - this.owner.x;
                const dy = target.y - this.owner.y;
                const d = Math.sqrt(dx * dx + dy * dy) || 1;
                target.vx += (dx / d) * 6;
                target.vy += (dy / d) * 6;
                target.takeDamage(4);
                if (WB.GLEffects) {
                    WB.GLEffects.spawnDamageNumber(target.x, target.y, 4, '#C0C0C0');
                }
            }
        }

        // Visual burst
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 25, '#C0C0C0');
            WB.Game.particles.spark(this.owner.x, this.owner.y, 15);
        }
    }

    getTipX() {
        const spearAngle = this.superActive ? this.angle : this.shieldAngle;
        return this.owner.x + Math.cos(spearAngle) * this.spearReach;
    }
    getTipY() {
        const spearAngle = this.superActive ? this.angle : this.shieldAngle;
        return this.owner.y + Math.sin(spearAngle) * this.spearReach;
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        // === SHIELD CONE ===
        const halfCone = this.shieldConeWidth / 2;
        const shieldDist = r + 18;
        const shieldOuterR = r + 28;

        // Shield arc fill
        B.setAlpha(0.12);
        const segs = 10;
        for (let i = 0; i < segs; i++) {
            const a1 = this.shieldAngle - halfCone + this.shieldConeWidth * (i / segs);
            const a2 = this.shieldAngle - halfCone + this.shieldConeWidth * ((i + 1) / segs);
            B.fillTriangle(
                this.owner.x, this.owner.y,
                this.owner.x + Math.cos(a1) * shieldOuterR, this.owner.y + Math.sin(a1) * shieldOuterR,
                this.owner.x + Math.cos(a2) * shieldOuterR, this.owner.y + Math.sin(a2) * shieldOuterR,
                '#C0C0C0'
            );
        }
        B.restoreAlpha();

        // Shield arc edge
        B.setAlpha(0.25);
        for (let i = 0; i < segs; i++) {
            const a1 = this.shieldAngle - halfCone + this.shieldConeWidth * (i / segs);
            const a2 = this.shieldAngle - halfCone + this.shieldConeWidth * ((i + 1) / segs);
            B.line(
                this.owner.x + Math.cos(a1) * shieldDist, this.owner.y + Math.sin(a1) * shieldDist,
                this.owner.x + Math.cos(a2) * shieldDist, this.owner.y + Math.sin(a2) * shieldDist,
                '#808080', 3
            );
        }
        B.restoreAlpha();

        // Shield center emblem (small circle on shield face)
        const emblX = this.owner.x + Math.cos(this.shieldAngle) * (shieldDist - 2);
        const emblY = this.owner.y + Math.sin(this.shieldAngle) * (shieldDist - 2);
        B.setAlpha(0.3);
        B.fillCircle(emblX, emblY, 5, '#DAA520');
        B.restoreAlpha();

        // === SPEAR ===
        const spearAngle = this.superActive ? this.angle : this.shieldAngle;
        const jabOffset = this.spearJabbing ? Math.sin(this.spearJabFrame / this.spearJabDuration * Math.PI) * 15 : 0;
        const spearLen = this.spearReach + jabOffset;

        // Spear shaft
        const shaftStartX = this.owner.x + Math.cos(spearAngle) * r;
        const shaftStartY = this.owner.y + Math.sin(spearAngle) * r;
        const shaftEndX = this.owner.x + Math.cos(spearAngle) * spearLen;
        const shaftEndY = this.owner.y + Math.sin(spearAngle) * spearLen;
        B.line(shaftStartX, shaftStartY, shaftEndX, shaftEndY, '#8B7355', 3);

        // Spear head
        const headBase = spearLen - 10;
        const hbX = this.owner.x + Math.cos(spearAngle) * headBase;
        const hbY = this.owner.y + Math.sin(spearAngle) * headBase;
        const htX = this.owner.x + Math.cos(spearAngle) * (spearLen + 3);
        const htY = this.owner.y + Math.sin(spearAngle) * (spearLen + 3);
        const perpX = Math.cos(spearAngle + Math.PI / 2) * 5;
        const perpY = Math.sin(spearAngle + Math.PI / 2) * 5;
        B.fillTriangle(htX, htY, hbX + perpX, hbY + perpY, hbX - perpX, hbY - perpY, '#B0B0B0');

        // Super glow
        if (this.superActive) {
            B.fillCircleGlow(this.owner.x, this.owner.y, this.spearReach * 0.5, '#C0C0C0', 12);
            // Brighter shield
            B.setAlpha(0.08);
            for (let i = 0; i < segs; i++) {
                const a1 = this.shieldAngle - halfCone + this.shieldConeWidth * (i / segs);
                const a2 = this.shieldAngle - halfCone + this.shieldConeWidth * ((i + 1) / segs);
                B.fillTriangle(
                    this.owner.x, this.owner.y,
                    this.owner.x + Math.cos(a1) * (shieldOuterR + 8), this.owner.y + Math.sin(a1) * (shieldOuterR + 8),
                    this.owner.x + Math.cos(a2) * (shieldOuterR + 8), this.owner.y + Math.sin(a2) * (shieldOuterR + 8),
                    '#DAA520'
                );
            }
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('athena', AthenaWeapon, 'pantheon');
