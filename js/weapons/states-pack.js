window.WB = window.WB || {};

// ─── US States & Territories Weapon Pack (Season 3) ─────────────
// 50 unique state weapons + 6 territory placeholders.
// Global rules: No supers. 100 HP. All damage whole numbers.
// Scaling IS the progression — superThreshold set to 9999.

(function() {
'use strict';
var NO_SUPER = 9999;

// ═══════════════════════════════════════════════════════════════
//  HELPER: SVG sprite draw for weapons that have icons
//  Returns true if sprite was drawn, false if fallback needed.
//  Aligns SVG pivot (20,50) with ball edge and tip (90,50) with reach.
//
//  SVG layout: 100x100 viewBox, attachment at x=20, tip at x=90.
//  Math: halfW = (reach - r) / 1.4
//        center offset from ball = r + 0.6 * halfW
//  This ensures the visual tip lands exactly at the weapon's hitbox.
// ═══════════════════════════════════════════════════════════════
function drawWeaponSprite(weapon, spriteKey) {
    var S = WB.WeaponSprites;
    if (!S || !S.hasSprite(spriteKey)) return false;
    WB.GLBatch.flush(); // Flush batch before switching to sprite shader
    var r = weapon.owner.radius;
    var halfW = (weapon.reach - r) / 1.4;
    var offset = r + 0.6 * halfW;
    var cx = weapon.owner.x + Math.cos(weapon.angle) * offset;
    var cy = weapon.owner.y + Math.sin(weapon.angle) * offset;
    S.drawSprite(spriteKey, cx, cy, weapon.angle, halfW, halfW, 1.0, 1.0);
    return true;
}

// ═══════════════════════════════════════════════════════════════
//  HELPER: standard melee draw (stick + colored tip)
// ═══════════════════════════════════════════════════════════════
function drawMeleeWeapon(weapon, tipShape) {
    var B = WB.GLBatch;
    var r = weapon.owner.radius;
    var color = weapon.owner.color;
    B.pushTransform(weapon.owner.x, weapon.owner.y, weapon.angle);
    // Shaft
    B.fillRect(r, -2.5, weapon.reach - r - 6, 5, '#8B7355');
    B.strokeRect(r, -2.5, weapon.reach - r - 6, 5, '#6B5335', 1);
    // Tip
    if (tipShape === 'rect') {
        B.fillRect(weapon.reach - 14, -6, 14, 12, color);
        B.strokeRect(weapon.reach - 14, -6, 14, 12, '#333', 1.5);
    } else {
        B.fillCircle(weapon.reach - 3, 0, 7, color);
        B.strokeCircle(weapon.reach - 3, 0, 7, '#333', 1.5);
    }
    B.popTransform();
}

// ═══════════════════════════════════════════════════════════════
//  1. ALABAMA — Projectile (rockets)
//  Fires a rocket every 3 seconds. Every 3rd is BIG (2x size, 2x dmg).
//  Scaling: +10% rocket speed per hit.
// ═══════════════════════════════════════════════════════════════
class AlabamaWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'alabama', baseDamage: 6, rotationSpeed: 0.04, reach: 50, scalingName: 'Rockets', superThreshold: NO_SUPER, isRanged: true });
        this.fireTimer = 0;
        this.fireRate = 140; // ~2.3 seconds
        this.rocketSpeed = 7;
        this.rocketsFired = 0;
        this.scalingStat.value = this.rocketsFired;
    }
    update() {
        super.update();
        this.fireTimer++;
        if (this.fireTimer >= this.fireRate) { this.fireRocket(); this.fireTimer = 0; }
    }
    fireRocket() {
        if (!WB.Game || !WB.Game.projectiles) return;
        this.rocketsFired++;
        var isBig = (this.rocketsFired % 3 === 0);
        var dmg = isBig ? this.currentDamage * 2 : this.currentDamage;
        var size = isBig ? 6 : 3;
        // Aim at enemy
        var angle = this.angle;
        if (WB.Game.balls) {
            for (var i = 0; i < WB.Game.balls.length; i++) {
                var b = WB.Game.balls[i];
                if (b !== this.owner && b.isAlive && b.side !== this.owner.side) {
                    angle = Math.atan2(b.y - this.owner.y, b.x - this.owner.x);
                    angle += (WB.random() - 0.5) * 0.2;
                    break;
                }
            }
        }
        WB.Game.projectiles.push(new WB.Projectile({
            x: this.owner.x + Math.cos(angle) * (this.owner.radius + 8),
            y: this.owner.y + Math.sin(angle) * (this.owner.radius + 8),
            vx: Math.cos(angle) * this.rocketSpeed,
            vy: Math.sin(angle) * this.rocketSpeed,
            damage: Math.round(dmg), owner: this.owner, ownerWeapon: this,
            radius: size, lifespan: 120, bounces: 0, color: '#990000',
            shape: 'sprite', spriteKey: 'alabama-rocket'
        }));
        WB.Audio.projectileFire();
    }
    applyScaling() {
        this.rocketSpeed = 7 + this.hitCount * 0.5;
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.5);
        this.scalingStat.value = this.rocketsFired;
    }
    onHit() {} // ranged only
    draw() {
        // Alabama's SVG is used on projectiles (rockets), not the launcher arm
        var B = WB.GLBatch;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        // Launcher tube
        B.fillRect(this.owner.radius, -4, 30, 8, '#555');
        B.strokeRect(this.owner.radius, -4, 30, 8, '#333', 1.5);
        B.popTransform();
        // Rocket counter on ball
        if (this.rocketsFired > 0) {
            var countStr = '' + this.rocketsFired;
            WB.GLText.drawTextLite(countStr, this.owner.x, this.owner.y - this.owner.radius - 10, '12px Courier New', '#FFF', '#333', 'center');
        }
    }
}
WB.WeaponRegistry.register('alabama', AlabamaWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  2. ALASKA — Body slam (mass tank)
//  Starts 1.3x size, 1.3x mass. No weapon. Gets denser per hit.
// ═══════════════════════════════════════════════════════════════
class AlaskaWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'alaska', baseDamage: 2, rotationSpeed: 0, reach: 0, scalingName: 'Mass', superThreshold: NO_SUPER, canParry: false });
        this.owner.radius = Math.round(WB.Config.BALL_RADIUS * 1.1);
        this.owner.mass = (this.owner.radius / WB.Config.BALL_RADIUS) * WB.Config.BALL_MASS;
        this.contactCooldown = 0;
        this.contactCooldownTime = 75;
        this.contactAura = 2;
        this.scalingStat.value = this.owner.mass.toFixed(1);
    }
    update() { if (this.contactCooldown > 0) this.contactCooldown--; }
    canHit() { return this.contactCooldown <= 0; }
    onHit(target) {
        var speed = this.owner.getSpeed();
        var dmg = Math.round(this.currentDamage + speed * 0.1);
        target.takeDamage(dmg);
        this.hitCount++;
        this.contactCooldown = this.contactCooldownTime;
        this.applyScaling();
        // Knockback scales with mass
        var dx = target.x - this.owner.x, dy = target.y - this.owner.y;
        var d = Math.sqrt(dx * dx + dy * dy) || 1;
        var kb = Math.min(6, 2 + this.owner.mass * 0.15);
        target.vx += (dx / d) * kb;
        target.vy += (dy / d) * kb;
        this._onHitEffects(target, dmg, this.owner.color);
        WB.Audio.weaponHit(this.hitCount, this.type);
    }
    applyScaling() {
        // No mass growth — Alaska is big but doesn't snowball
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.15);
        this.scalingStat.value = this.owner.mass.toFixed(1);
    }
    draw() {
        // No weapon visual — just the heavy ball
        var B = WB.GLBatch;
        B.setAlpha(0.15);
        B.strokeCircle(this.owner.x, this.owner.y, this.owner.radius + 4, '#003366', 2);
        B.restoreAlpha();
    }
}
WB.WeaponRegistry.register('alaska', AlaskaWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  3. ARIZONA — AoE heat pulse
//  Fires every 2 sec. Scaling: pulse radius +10% per hit.
// ═══════════════════════════════════════════════════════════════
class ArizonaWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'arizona', baseDamage: 5, rotationSpeed: 0, reach: 0, scalingName: 'Radius', superThreshold: NO_SUPER, canParry: false });
        this.pulseTimer = 0;
        this.pulseRate = 35;
        this.pulseRadius = 85;
        this.contactCooldown = 0;
        this.contactAura = 0;
        this.scalingStat.value = Math.round(this.pulseRadius);
    }
    update() {
        if (this.contactCooldown > 0) this.contactCooldown--;
        this.pulseTimer++;
        if (this.pulseTimer >= this.pulseRate) { this.pulseTimer = 0; this._heatPulse(); }
    }
    _heatPulse() {
        if (!WB.Game || !WB.Game.balls) return;
        for (var i = 0; i < WB.Game.balls.length; i++) {
            var target = WB.Game.balls[i];
            if (target === this.owner || !target.isAlive || target.side === this.owner.side) continue;
            var dx = target.x - this.owner.x, dy = target.y - this.owner.y;
            if (Math.sqrt(dx * dx + dy * dy) < this.pulseRadius) {
                target.takeDamage(this.currentDamage);
                this.hitCount++;
                this.applyScaling();
                if (WB.GLEffects) WB.GLEffects.spawnDamageNumber(target.x, target.y, this.currentDamage, '#C41E3A');
            }
        }
        if (WB.GLEffects) WB.GLEffects.spawnImpact(this.owner.x, this.owner.y, '#C41E3A', this.pulseRadius * 0.5);
        if (WB.Game.particles) WB.Game.particles.emit(this.owner.x, this.owner.y, 5, '#C41E3A');
    }
    canHit() { return false; }
    onHit() {}
    applyScaling() {
        this.pulseRadius = Math.min(130, 85 + this.hitCount * 3);
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.6);
        this.scalingStat.value = Math.round(this.pulseRadius);
    }
    draw() {
        var B = WB.GLBatch;
        var pulse = Math.sin(this.pulseTimer / this.pulseRate * Math.PI * 2) * 0.05;
        B.setAlpha(0.06 + pulse);
        B.fillCircle(this.owner.x, this.owner.y, this.pulseRadius, '#C41E3A');
        B.restoreAlpha();
        B.setAlpha(0.25);
        B.strokeCircle(this.owner.x, this.owner.y, this.pulseRadius, '#C41E3A', 1.5);
        B.restoreAlpha();
    }
}
WB.WeaponRegistry.register('arizona', ArizonaWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  4. ARKANSAS — Projectile (diamond shards)
//  Volley every 2 sec. Shards embed in walls as static hazards.
// ═══════════════════════════════════════════════════════════════
class ArkansasWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'arkansas', baseDamage: 4, rotationSpeed: 0.04, reach: 50, scalingName: 'Shards', superThreshold: NO_SUPER, isRanged: true });
        this.fireTimer = 0;
        this.fireRate = 170;
        this.shardCount = 1;
        this.scalingStat.value = this.shardCount;
    }
    update() {
        super.update();
        this.fireTimer++;
        if (this.fireTimer >= this.fireRate) { this.fireTimer = 0; this._fireVolley(); }
    }
    _fireVolley() {
        if (!WB.Game || !WB.Game.projectiles) return;
        var baseAngle = this.angle;
        if (WB.Game.balls) {
            for (var i = 0; i < WB.Game.balls.length; i++) {
                var b = WB.Game.balls[i];
                if (b !== this.owner && b.isAlive && b.side !== this.owner.side) {
                    baseAngle = Math.atan2(b.y - this.owner.y, b.x - this.owner.x);
                    break;
                }
            }
        }
        var spread = 0.3;
        for (var s = 0; s < this.shardCount; s++) {
            var a = baseAngle + (s - (this.shardCount - 1) / 2) * (spread / this.shardCount) + (WB.random() - 0.5) * 0.15;
            var self = this;
            WB.Game.projectiles.push(new WB.Projectile({
                x: this.owner.x + Math.cos(a) * (this.owner.radius + 6),
                y: this.owner.y + Math.sin(a) * (this.owner.radius + 6),
                vx: Math.cos(a) * 6, vy: Math.sin(a) * 6,
                damage: this.currentDamage, owner: this.owner, ownerWeapon: this,
                radius: 3, lifespan: 90, bounces: 0, color: '#A0522D',
                shape: 'sprite', spriteKey: 'arkansas-shard',
                onMiss: function(x, y) {
                    if (WB.Game && WB.Game.hazards) {
                        WB.Game.hazards.push(new WB.Hazard({
                            x: x, y: y, radius: 8, damage: 0, tickRate: 999, lifespan: 120,
                            color: '#A0522D', owner: self.owner, ownerWeapon: self
                        }));
                    }
                }
            }));
        }
        WB.Audio.projectileFire();
    }
    applyScaling() {
        this.shardCount = Math.min(4, 1 + Math.floor(this.hitCount * 0.2));
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.25);
        this.scalingStat.value = this.shardCount;
    }
    onHit() {}
    draw() {
        // Arkansas shard SVG is used on projectiles, not the launcher arm
        var B = WB.GLBatch;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        B.fillRect(this.owner.radius, -3, 25, 6, '#8B6914');
        B.strokeRect(this.owner.radius, -3, 25, 6, '#5C4A12', 1);
        // Diamond tip
        var tx = this.reach - 3;
        B.fillTriangle(tx - 5, 0, tx, -6, tx + 5, 0, '#A0522D');
        B.fillTriangle(tx - 5, 0, tx, 6, tx + 5, 0, '#A0522D');
        B.popTransform();
    }
}
WB.WeaponRegistry.register('arkansas', ArkansasWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  5. CALIFORNIA — Melee spin (fault line blade)
//  Every 5th hit triggers a quake — random impulse to ALL balls.
//  Scaling: seismic energy (+1 per hit), quake intensity scales.
// ═══════════════════════════════════════════════════════════════
class CaliforniaWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'california', baseDamage: 4, rotationSpeed: 0.05, reach: 80, scalingName: 'Seismic', superThreshold: NO_SUPER });
        this.seismicEnergy = 0;
        this.fissureTimer = 0;
        this.scalingStat.value = this.seismicEnergy;
    }
    update() {
        super.update();
        if (this.fissureTimer > 0) this.fissureTimer--;
    }
    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.seismicEnergy++;
        this.applyScaling();
        this._onHitEffects(target, this.currentDamage, this.owner.color);
        WB.Audio.weaponHit(this.hitCount, this.type);
        // Every 3rd hit: QUAKE
        if (this.seismicEnergy % 3 === 0) this._triggerQuake();
    }
    _triggerQuake() {
        if (!WB.Game || !WB.Game.balls) return;
        var intensity = 5 + this.seismicEnergy * 0.6;
        for (var i = 0; i < WB.Game.balls.length; i++) {
            var b = WB.Game.balls[i];
            if (!b.isAlive) continue;
            var angle = WB.random() * Math.PI * 2;
            b.vx += Math.cos(angle) * intensity;
            b.vy += Math.sin(angle) * intensity;
        }
        // Fissure visual (2 sec)
        this.fissureTimer = 120;
        WB.Renderer.triggerShake(5 + this.seismicEnergy * 0.3);
        if (WB.Game.particles) WB.Game.particles.explode(this.owner.x, this.owner.y, 10, '#FFD700');
    }
    applyScaling() {
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.4);
        this.scalingStat.value = this.seismicEnergy;
    }
    draw() {
        drawMeleeWeapon(this, 'rect');
        // Fissure visual
        if (this.fissureTimer > 0) {
            var B = WB.GLBatch;
            var alpha = this.fissureTimer / 120 * 0.3;
            B.setAlpha(alpha);
            B.line(this.owner.x - 40, this.owner.y, this.owner.x + 40, this.owner.y + 5, '#8B4513', 3);
            B.restoreAlpha();
        }
    }
}
WB.WeaponRegistry.register('california', CaliforniaWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  6. COLORADO — Body slam (boulder)
//  3x damage resistance, can't be knocked back. 1.5x gravity.
//  Scaling: gravity multiplier +5% per hit. Damage scales w/ velocity.
// ═══════════════════════════════════════════════════════════════
class ColoradoWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'colorado', baseDamage: 2, rotationSpeed: 0, reach: 0, scalingName: 'Gravity', superThreshold: NO_SUPER, canParry: false });
        this.owner.mass *= 1.3;
        this.owner.gravityMultiplier = 1.1;
        this.contactCooldown = 0;
        this.contactCooldownTime = 70;
        this.contactAura = 2;
        this._wallBounceCount = 0;
        this.scalingStat.value = this.owner.gravityMultiplier.toFixed(2);
    }
    update() {
        if (this.contactCooldown > 0) this.contactCooldown--;
    }
    canHit() { return this.contactCooldown <= 0; }
    onHit(target) {
        var speed = this.owner.getSpeed();
        var dmg = Math.round(this.currentDamage + speed * 0.08);
        target.takeDamage(dmg);
        this.hitCount++;
        this.contactCooldown = this.contactCooldownTime;
        this.applyScaling();
        this._onHitEffects(target, dmg, this.owner.color);
        WB.Audio.weaponHit(this.hitCount, this.type);
    }
    applyScaling() {
        this.owner.gravityMultiplier = Math.min(1.5, 1.1 + this.hitCount * 0.015);
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.15);
        this.scalingStat.value = this.owner.gravityMultiplier.toFixed(2);
    }
    draw() {
        var B = WB.GLBatch;
        B.setAlpha(0.12);
        B.strokeCircle(this.owner.x, this.owner.y, this.owner.radius + 3, '#4B0082', 2.5);
        B.restoreAlpha();
    }
}
WB.WeaponRegistry.register('colorado', ColoradoWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  7. CONNECTICUT — Melee spin (briefcase). Insurance stacks.
//  Each hit = +1 insurance stack. Stacks absorb 1 damage each.
//  Stacks regenerate passively +1 per 5 seconds.
// ═══════════════════════════════════════════════════════════════
class ConnecticutWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'connecticut', baseDamage: 2, rotationSpeed: 0.035, reach: 80, scalingName: 'Ins.Stacks', superThreshold: NO_SUPER });
        this.insuranceStacks = 0;
        this.regenTimer = 0;
        this.scalingStat.value = this.insuranceStacks;
        // Patch takeDamage to absorb with stacks
        var self = this;
        var origTakeDamage = this.owner.takeDamage.bind(this.owner);
        this.owner.takeDamage = function(dmg) {
            while (dmg > 0 && self.insuranceStacks > 0) { dmg--; self.insuranceStacks--; }
            self.scalingStat.value = self.insuranceStacks;
            if (dmg > 0) origTakeDamage(dmg);
        };
    }
    update() {
        super.update();
        this.regenTimer++;
        if (this.regenTimer >= 480) { // 8 seconds (slowed from 5)
            this.regenTimer = 0;
            if (this.insuranceStacks < 10) { this.insuranceStacks++; }
            this.scalingStat.value = this.insuranceStacks;
        }
    }
    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.cooldown = 7;
        if (this.insuranceStacks < 10) this.insuranceStacks++;
        this.applyScaling();
        this._onHitEffects(target, this.currentDamage, this.owner.color);
        WB.Audio.weaponHit(this.hitCount, this.type);
    }
    applyScaling() {
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.3);
        this.scalingStat.value = this.insuranceStacks;
    }
    draw() {
        var B = WB.GLBatch;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        // Briefcase shape
        B.fillRect(this.owner.radius, -5, this.reach - this.owner.radius - 4, 10, '#003B6F');
        B.strokeRect(this.owner.radius, -5, this.reach - this.owner.radius - 4, 10, '#222', 1.5);
        // Handle
        B.fillRect(this.owner.radius + 10, -7, 8, 2, '#888');
        B.popTransform();
        // Stack counter
        if (this.insuranceStacks > 0) {
            WB.GLText.drawTextLite('' + this.insuranceStacks, this.owner.x, this.owner.y - this.owner.radius - 10, '12px Courier New', '#003B6F', '#333', 'center');
        }
    }
}
WB.WeaponRegistry.register('connecticut', ConnecticutWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  8. DELAWARE — Body slam (shells)
//  Starts at 0.7x size. Each hit adds a shell ring (+1 contact dmg,
//  +5% diameter). Shells have 8HP, absorb damage, break & rebuild.
// ═══════════════════════════════════════════════════════════════
class DelawareWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'delaware', baseDamage: 1, rotationSpeed: 0, reach: 0, scalingName: 'Shells', superThreshold: NO_SUPER, canParry: false });
        this.owner.radius = Math.round(WB.Config.BALL_RADIUS * 0.7);
        this.owner.mass = (this.owner.radius / WB.Config.BALL_RADIUS) * WB.Config.BALL_MASS;
        this.shells = []; // { hp: 4 }
        this.maxShells = 2;
        this.shellHP = 4;
        this.rebuildHits = 0; // hits since last shell broke
        this.contactCooldown = 0;
        this.contactCooldownTime = 70;
        this.contactAura = 2;
        this.scalingStat.value = this.shells.length;
        // Override takeDamage to route through shells
        var self = this;
        var origTakeDamage = this.owner.takeDamage.bind(this.owner);
        this.owner.takeDamage = function(dmg) {
            if (self.shells.length > 0) {
                var outer = self.shells[self.shells.length - 1];
                outer.hp -= dmg;
                if (outer.hp <= 0) {
                    self.shells.pop();
                    self._recalcSize();
                    self.scalingStat.value = self.shells.length;
                }
                return; // shell absorbed all damage
            }
            origTakeDamage(dmg);
        };
    }
    _recalcSize() {
        var base = WB.Config.BALL_RADIUS * 0.7;
        this.owner.radius = Math.round(base * (1 + this.shells.length * 0.15));
        this.owner.mass = (this.owner.radius / WB.Config.BALL_RADIUS) * WB.Config.BALL_MASS;
    }
    update() { if (this.contactCooldown > 0) this.contactCooldown--; }
    canHit() { return this.contactCooldown <= 0; }
    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.contactCooldown = this.contactCooldownTime;
        this.rebuildHits++;
        // Rebuild shell every 5 hits if below max
        if (this.rebuildHits >= 5 && this.shells.length < this.maxShells) {
            this.shells.push({ hp: this.shellHP });
            this._recalcSize();
            this.rebuildHits = 0;
        }
        this.applyScaling();
        this._onHitEffects(target, this.currentDamage, this.owner.color);
        WB.Audio.weaponHit(this.hitCount, this.type);
    }
    applyScaling() {
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.2);
        this.scalingStat.value = this.shells.length;
    }
    draw() {
        var B = WB.GLBatch;
        // Draw shell rings
        for (var i = 0; i < this.shells.length; i++) {
            var ringR = this.owner.radius - i * 2;
            var alpha = 0.15 + (this.shells[i].hp / this.shellHP) * 0.15;
            B.setAlpha(alpha);
            B.strokeCircle(this.owner.x, this.owner.y, ringR + 2, '#00539B', 2);
            B.restoreAlpha();
        }
    }
}
WB.WeaponRegistry.register('delaware', DelawareWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  9. FLORIDA — Melee spin (gator jaw). Florida Man events!
//  15% chance per hit → random physics modifier for 2 seconds.
//  Chance +2% per hit.
// ═══════════════════════════════════════════════════════════════
class FloridaWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'florida', baseDamage: 4, rotationSpeed: 0.07, reach: 75, scalingName: 'Chaos', superThreshold: NO_SUPER });
        this.eventChance = 0.25;
        this.eventTimer = 0;
        this.scalingStat.value = Math.round(this.eventChance * 100) + '%';
    }
    update() {
        super.update();
        if (this.eventTimer > 0) this.eventTimer--;
        // Frame-based event reset (setTimeout doesn't work in simulator)
        if (this._eventResetTimer > 0) {
            this._eventResetTimer--;
            if (this._eventResetTimer <= 0 && this._eventReset) { this._eventReset(); this._eventReset = null; }
        }
    }
    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this._onHitEffects(target, this.currentDamage, this.owner.color);
        WB.Audio.weaponHit(this.hitCount, this.type);
        // Florida Man event
        if (WB.random() < this.eventChance) this._floridaManEvent();
    }
    _floridaManEvent() {
        this.eventTimer = 120;
        // Only beneficial events now — Florida Man helps you
        var events = ['speed', 'bounce', 'spin', 'size_up', 'regen'];
        var ev = events[Math.floor(WB.random() * events.length)];
        var self = this.owner;
        var wep = this;
        switch(ev) {
            case 'speed':
                var ms = self.maxSpeed; self.maxSpeed *= 1.8;
                self.vx *= 1.4; self.vy *= 1.4;
                wep._eventResetTimer = 150;
                wep._eventReset = function() { self.maxSpeed = ms; };
                break;
            case 'bounce': self.vx *= 1.8; self.vy *= 1.8; break;
            case 'spin': wep.rotationSpeed *= 2.5;
                wep._eventResetTimer = 150;
                wep._eventReset = function() { wep.rotationSpeed /= 2.5; };
                break;
            case 'size_up': self.radius = Math.round(self.radius * 1.2); self.mass *= 1.3;
                wep._eventResetTimer = 180;
                wep._eventReset = function() { self.radius = Math.round(self.radius / 1.2); self.mass /= 1.3; };
                break;
            case 'regen': self.hp = Math.min(self.maxHp, self.hp + 5); break;
        }
        WB.Renderer.triggerShake(4);
        if (WB.Game.particles) WB.Game.particles.explode(self.x, self.y, 8, '#FF6600');
    }
    applyScaling() {
        this.eventChance = Math.min(0.6, 0.25 + this.hitCount * 0.03);
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.5);
        this.scalingStat.value = Math.round(this.eventChance * 100) + '%';
    }
    draw() {
        var B = WB.GLBatch;
        var r = this.owner.radius;
        if (drawWeaponSprite(this, 'florida-jaw')) {
            // Still draw event indicator ring
            if (this.eventTimer > 0) {
                B.setAlpha(0.3);
                B.strokeCircle(this.owner.x, this.owner.y, r + 8, '#FF6600', 2);
                B.restoreAlpha();
            }
            return;
        }
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        // Gator jaw — two triangular teeth
        var jawLen = this.reach;
        B.fillRect(r, -3, jawLen - r - 10, 6, '#2E8B57');
        B.strokeRect(r, -3, jawLen - r - 10, 6, '#1B5E3A', 1);
        // Upper jaw
        B.fillTriangle(jawLen - 12, -2, jawLen, 0, jawLen - 12, -8, '#2E8B57');
        // Lower jaw
        B.fillTriangle(jawLen - 12, 2, jawLen, 0, jawLen - 12, 8, '#2E8B57');
        // Teeth
        B.fillTriangle(jawLen - 8, -2, jawLen - 4, -6, jawLen - 4, -2, '#FFF');
        B.fillTriangle(jawLen - 8, 2, jawLen - 4, 6, jawLen - 4, 2, '#FFF');
        B.popTransform();
        // Event indicator
        if (this.eventTimer > 0) {
            B.setAlpha(0.3);
            B.strokeCircle(this.owner.x, this.owner.y, r + 8, '#FF6600', 2);
            B.restoreAlpha();
        }
    }
}
WB.WeaponRegistry.register('florida', FloridaWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  10. GEORGIA — Pulsing aura (fizz ring)
//  Expands/contracts in rhythm. Damage on expanding phase only.
//  Scaling: pressure (+1/hit) → faster expansion, bigger radius.
// ═══════════════════════════════════════════════════════════════
class GeorgiaWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'georgia', baseDamage: 5, rotationSpeed: 0, reach: 0, scalingName: 'Pressure', superThreshold: NO_SUPER, canParry: false });
        this.pressure = 0;
        this.fizzTimer = 0;
        this.fizzMaxRadius = 88;
        this.fizzSpeed = 1.8;
        this.fizzRadius = 0;
        this.expanding = true;
        this.fizzDmgCooldown = 0;
        this.contactCooldown = 0;
        this.contactAura = 0;
        this.scalingStat.value = this.pressure;
    }
    update() {
        if (this.contactCooldown > 0) this.contactCooldown--;
        if (this.fizzDmgCooldown > 0) this.fizzDmgCooldown--;
        this.fizzTimer++;
        // Expand/contract cycle
        if (this.expanding) {
            this.fizzRadius += this.fizzSpeed;
            if (this.fizzRadius >= this.fizzMaxRadius) this.expanding = false;
        } else {
            this.fizzRadius -= this.fizzSpeed * 0.8;
            if (this.fizzRadius <= 10) this.expanding = true;
        }
        // Damage on expanding AND contracting phases
        if (this.fizzDmgCooldown <= 0) {
            this._fizzDamage();
            this.fizzDmgCooldown = 9;
        }
    }
    _fizzDamage() {
        if (!WB.Game || !WB.Game.balls) return;
        for (var i = 0; i < WB.Game.balls.length; i++) {
            var t = WB.Game.balls[i];
            if (t === this.owner || !t.isAlive || t.side === this.owner.side) continue;
            var dx = t.x - this.owner.x, dy = t.y - this.owner.y;
            if (Math.sqrt(dx * dx + dy * dy) < this.fizzRadius) {
                t.takeDamage(this.currentDamage);
                this.hitCount++;
                this.applyScaling();
                if (WB.GLEffects) WB.GLEffects.spawnDamageNumber(t.x, t.y, this.currentDamage, '#FF4444');
            }
        }
    }
    canHit() { return false; }
    onHit() {}
    applyScaling() {
        this.pressure++;
        this.fizzSpeed = 1.8 + this.pressure * 0.15;
        this.fizzMaxRadius = Math.min(120, 88 + this.pressure * 3);
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.5);
        this.scalingStat.value = this.pressure;
    }
    draw() {
        var B = WB.GLBatch;
        // Fizz aura ring
        var alpha = this.expanding ? 0.2 : 0.05;
        B.setAlpha(alpha);
        B.fillCircle(this.owner.x, this.owner.y, this.fizzRadius, '#FF4444');
        B.restoreAlpha();
        B.setAlpha(0.35);
        B.strokeCircle(this.owner.x, this.owner.y, this.fizzRadius, '#FF4444', 1.5);
        B.restoreAlpha();
        // Fizz SVG sprite overlay on ball
        var S = WB.WeaponSprites;
        if (S && S.hasSprite('georgia-fizz')) {
            B.flush();
            var size = this.owner.radius * 1.5;
            var pulseAlpha = this.expanding ? 0.9 : 0.6;
            S.drawSprite('georgia-fizz', this.owner.x, this.owner.y, this.fizzTimer * 0.01, size, size, pulseAlpha, 1.0);
        }
        // Pressure counter
        if (this.pressure > 0) {
            WB.GLText.drawTextLite('' + this.pressure, this.owner.x, this.owner.y - this.owner.radius - 10, '12px Courier New', '#FF4444', '#333', 'center');
        }
    }
}
WB.WeaponRegistry.register('georgia', GeorgiaWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  11. HAWAII — AoE lava pulse + lava pools
//  Each hit leaves a lava pool. Pools last 4+ seconds, deal 1 dmg/sec.
// ═══════════════════════════════════════════════════════════════
class HawaiiWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'hawaii', baseDamage: 6, rotationSpeed: 0, reach: 0, scalingName: 'Heat', superThreshold: NO_SUPER, canParry: false });
        this.pulseTimer = 0;
        this.pulseRate = 41;
        this.pulseRadius = 85;
        this.pullStrength = 0.08;
        this.contactCooldown = 0;
        this.contactAura = 0;
        this.scalingStat.value = Math.round(this.pulseRadius);
    }
    update() {
        if (this.contactCooldown > 0) this.contactCooldown--;
        this.pulseTimer++;
        if (this.pulseTimer >= this.pulseRate) { this.pulseTimer = 0; this._lavaPulse(); }
        // Constant lava pull — draws enemies toward the volcano
        if (WB.Game && WB.Game.balls) {
            for (var i = 0; i < WB.Game.balls.length; i++) {
                var b = WB.Game.balls[i];
                if (b === this.owner || !b.isAlive || b.side === this.owner.side) continue;
                var dx = this.owner.x - b.x, dy = this.owner.y - b.y;
                var dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < this.pulseRadius * 1.5 && dist > 0) {
                    b.vx += (dx / dist) * this.pullStrength;
                    b.vy += (dy / dist) * this.pullStrength;
                }
            }
        }
    }
    _lavaPulse() {
        if (!WB.Game || !WB.Game.balls) return;
        for (var i = 0; i < WB.Game.balls.length; i++) {
            var t = WB.Game.balls[i];
            if (t === this.owner || !t.isAlive || t.side === this.owner.side) continue;
            var dx = t.x - this.owner.x, dy = t.y - this.owner.y;
            if (Math.sqrt(dx * dx + dy * dy) < this.pulseRadius) {
                t.takeDamage(this.currentDamage);
                this.hitCount++;
                this.applyScaling();
                if (WB.GLEffects) WB.GLEffects.spawnDamageNumber(t.x, t.y, this.currentDamage, '#FF0000');
            }
        }
        if (WB.GLEffects) WB.GLEffects.spawnImpact(this.owner.x, this.owner.y, '#FF0000', this.pulseRadius * 0.4);
        if (WB.Game.particles) WB.Game.particles.emit(this.owner.x, this.owner.y, 5, '#FF4400');
    }
    canHit() { return false; }
    onHit() {}
    applyScaling() {
        this.pulseRadius = Math.min(130, 85 + this.hitCount * 3);
        this.pullStrength = Math.min(0.25, 0.1 + this.hitCount * 0.018);
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.7);
        this.scalingStat.value = Math.round(this.pulseRadius);
    }
    draw() {
        var B = WB.GLBatch;
        var pulse = Math.sin(this.pulseTimer / this.pulseRate * Math.PI * 2) * 0.05;
        B.setAlpha(0.08 + pulse);
        B.fillCircle(this.owner.x, this.owner.y, this.pulseRadius, '#FF0000');
        B.restoreAlpha();
        B.setAlpha(0.25);
        B.strokeCircle(this.owner.x, this.owner.y, this.pulseRadius, '#FF4400', 1.5);
        B.restoreAlpha();
    }
}
WB.WeaponRegistry.register('hawaii', HawaiiWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  12. IDAHO — Projectile (popcorn kernels)
//  Fast, straight. +1 kernel per hit to the volley. Pop sound.
// ═══════════════════════════════════════════════════════════════
class IdahoWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'idaho', baseDamage: 2, rotationSpeed: 0.04, reach: 50, scalingName: 'Kernels', superThreshold: NO_SUPER, isRanged: true });
        this.fireTimer = 0;
        this.fireRate = 130;
        this.kernelCount = 1;
        this.scalingStat.value = this.kernelCount;
    }
    update() {
        super.update();
        this.fireTimer++;
        if (this.fireTimer >= this.fireRate) { this.fireTimer = 0; this._fireKernels(); }
    }
    _fireKernels() {
        if (!WB.Game || !WB.Game.projectiles) return;
        var baseAngle = this.angle;
        if (WB.Game.balls) {
            for (var i = 0; i < WB.Game.balls.length; i++) {
                var b = WB.Game.balls[i];
                if (b !== this.owner && b.isAlive && b.side !== this.owner.side) {
                    baseAngle = Math.atan2(b.y - this.owner.y, b.x - this.owner.x); break;
                }
            }
        }
        for (var k = 0; k < this.kernelCount; k++) {
            var a = baseAngle + (WB.random() - 0.5) * 0.3;
            var spd = 7 + this.hitCount * 0.2;
            WB.Game.projectiles.push(new WB.Projectile({
                x: this.owner.x + Math.cos(a) * (this.owner.radius + 5),
                y: this.owner.y + Math.sin(a) * (this.owner.radius + 5),
                vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
                damage: this.currentDamage, owner: this.owner, ownerWeapon: this,
                radius: 2, lifespan: 80, bounces: 0, color: '#C5A253',
                shape: 'sprite', spriteKey: 'idaho-kernel'
            }));
        }
        WB.Audio.projectileFire();
    }
    applyScaling() {
        this.kernelCount = Math.min(5, 1 + Math.floor(this.hitCount * 0.3));
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount / 5);
        this.scalingStat.value = this.kernelCount;
    }
    onHit() {}
    draw() {
        // Idaho kernel SVG is used on projectiles, not the launcher arm
        var B = WB.GLBatch;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        B.fillRect(this.owner.radius, -3, 25, 6, '#8B7355');
        B.fillCircle(this.reach - 2, 0, 4, '#C5A253');
        B.strokeCircle(this.reach - 2, 0, 4, '#333', 1);
        B.popTransform();
    }
}
WB.WeaponRegistry.register('idaho', IdahoWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  13. ILLINOIS — Melee spin (pizza cutter). Global wind force.
//  Each hit increases wind force (+5%/hit) affecting all balls.
//  Wind alternates direction every 4 seconds.
// ═══════════════════════════════════════════════════════════════
class IllinoisWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'illinois', baseDamage: 4, rotationSpeed: 0.05, reach: 80, scalingName: 'Wind', superThreshold: NO_SUPER });
        this.windStrength = 0.3;
        this.windTimer = 0;
        this.windDir = 1; // +1 = right, -1 = left
        this.scalingStat.value = this.windStrength.toFixed(1);
    }
    update() {
        super.update();
        this.windTimer++;
        if (this.windTimer >= 240) { this.windTimer = 0; this.windDir *= -1; }
        // Apply wind to all balls
        if (this.windStrength > 0 && WB.Game && WB.Game.balls) {
            for (var i = 0; i < WB.Game.balls.length; i++) {
                var b = WB.Game.balls[i];
                if (b.isAlive && b !== this.owner && b.side !== this.owner.side) b.vx += this.windStrength * this.windDir * 0.005;
            }
        }
    }
    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this._onHitEffects(target, this.currentDamage, this.owner.color);
        WB.Audio.weaponHit(this.hitCount, this.type);
    }
    applyScaling() {
        this.windStrength = Math.min(0.8, 0.3 + this.hitCount * 0.03);
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.4);
        this.scalingStat.value = this.windStrength.toFixed(1);
    }
    draw() {
        if (drawWeaponSprite(this, 'illinois-cutter')) return;
        var B = WB.GLBatch;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        // Pizza cutter — circular blade on a stick
        B.fillRect(this.owner.radius, -2, this.reach - this.owner.radius - 10, 4, '#8B7355');
        B.fillCircle(this.reach - 4, 0, 8, '#0033A0');
        B.strokeCircle(this.reach - 4, 0, 8, '#222', 1.5);
        // Spokes
        for (var si = 0; si < 4; si++) {
            var sa = si * Math.PI / 2;
            B.line(this.reach - 4, 0, this.reach - 4 + Math.cos(sa) * 6, Math.sin(sa) * 6, '#555', 1);
        }
        B.popTransform();
    }
}
WB.WeaponRegistry.register('illinois', IllinoisWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  14. INDIANA — Body slam (racecar). 1.3x base speed.
//  Wall bounces retain 95% velocity. Every 3 wall bounces: +1 dmg.
// ═══════════════════════════════════════════════════════════════
class IndianaWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'indiana', baseDamage: 2, rotationSpeed: 0, reach: 0, scalingName: 'Speed', superThreshold: NO_SUPER, canParry: false });
        this.owner.maxSpeed = WB.Config.BALL_MAX_SPEED * 1.0;
        this.contactCooldown = 0;
        this.contactCooldownTime = 75;
        this.contactAura = 2;
        this.wallBounces = 0;
        this.scalingStat.value = this.owner.maxSpeed.toFixed(1);
    }
    update() {
        if (this.contactCooldown > 0) this.contactCooldown--;
        // Detect wall bounce without calling bounceOffWalls (ball.js already handles that)
        var a = WB.Config.ARENA;
        var o = this.owner;
        var atWall = (o.x - o.radius <= a.x + 1) || (o.x + o.radius >= a.x + a.width - 1) ||
                     (o.y - o.radius <= a.y + 1) || (o.y + o.radius >= a.y + a.height - 1);
        if (atWall && !this._wasAtWall) {
            this.wallBounces++;
        }
        this._wasAtWall = atWall;
    }
    canHit() { return this.contactCooldown <= 0; }
    onHit(target) {
        var speed = this.owner.getSpeed();
        var dmg = Math.round(this.currentDamage + speed * 0.05);
        target.takeDamage(dmg);
        this.hitCount++;
        this.contactCooldown = this.contactCooldownTime;
        this.applyScaling();
        this._onHitEffects(target, dmg, this.owner.color);
        WB.Audio.weaponHit(this.hitCount, this.type);
    }
    applyScaling() {
        this.owner.maxSpeed = Math.min(WB.Config.BALL_MAX_SPEED * 1.15, WB.Config.BALL_MAX_SPEED * (1.0 + this.hitCount * 0.01));
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.15);
        this.scalingStat.value = this.owner.maxSpeed.toFixed(1);
    }
    draw() {
        var B = WB.GLBatch;
        var speed = this.owner.getSpeed();
        if (speed > 4) {
            var alpha = Math.min(0.25, (speed - 4) * 0.04);
            var ma = Math.atan2(-this.owner.vy, -this.owner.vx);
            B.setAlpha(alpha);
            for (var i = 0; i < 3; i++) {
                var off = (i - 1) * 0.25;
                var lx = this.owner.x + Math.cos(ma + off) * (this.owner.radius + 3);
                var ly = this.owner.y + Math.sin(ma + off) * (this.owner.radius + 3);
                B.line(lx, ly, lx + Math.cos(ma) * (3 + speed), ly + Math.sin(ma) * (3 + speed), '#041E42', 1.5);
            }
            B.restoreAlpha();
        }
    }
}
WB.WeaponRegistry.register('indiana', IndianaWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  15. IOWA — Melee spin (corn stalks). Multi-weapon.
//  Every 3 hits: +1 additional stalk at offset angle.
//  Stalks grow in length +5% per hit.
// ═══════════════════════════════════════════════════════════════
class IowaWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'iowa', baseDamage: 3, rotationSpeed: 0.05, reach: 70, scalingName: 'Stalks', superThreshold: NO_SUPER });
        this.stalkCount = 1;
        this.stalkLength = 70;
        this.scalingStat.value = this.stalkCount;
    }
    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this._onHitEffects(target, this.currentDamage, this.owner.color);
        WB.Audio.weaponHit(this.hitCount, this.type);
    }
    applyScaling() {
        this.stalkCount = Math.min(3, 1 + Math.floor(this.hitCount / 4));
        this.stalkLength = Math.min(110, 70 + this.hitCount * 3);
        this.reach = this.stalkLength;
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.3);
        this.scalingStat.value = this.stalkCount;
    }
    draw() {
        if (drawWeaponSprite(this, 'iowa-stalk')) return;
        var B = WB.GLBatch;
        var r = this.owner.radius;
        for (var s = 0; s < this.stalkCount; s++) {
            var offsetAngle = this.angle + s * (Math.PI * 2 / Math.max(this.stalkCount, 1));
            B.pushTransform(this.owner.x, this.owner.y, offsetAngle);
            // Thin corn stalk
            B.fillRect(r, -1.5, this.stalkLength - r - 4, 3, '#228B22');
            B.strokeRect(r, -1.5, this.stalkLength - r - 4, 3, '#1A6B1A', 1);
            // Corn tip
            B.fillCircle(this.stalkLength - 2, 0, 4, '#FFD700');
            B.strokeCircle(this.stalkLength - 2, 0, 4, '#B8860B', 1);
            B.popTransform();
        }
    }
}
WB.WeaponRegistry.register('iowa', IowaWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  16. KANSAS — Melee spin (tornado funnel). Suction force.
//  Each hit: suction strength +5%, rotation speed +5%.
// ═══════════════════════════════════════════════════════════════
class KansasWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'kansas', baseDamage: 4, rotationSpeed: 0.05, reach: 85, scalingName: 'Suction', superThreshold: NO_SUPER });
        this.suctionStrength = 0.08;
        this.scalingStat.value = (this.suctionStrength * 100).toFixed(0) + '%';
    }
    update() {
        super.update();
        // Suction pull toward self
        if (this.suctionStrength > 0 && WB.Game && WB.Game.balls) {
            for (var i = 0; i < WB.Game.balls.length; i++) {
                var t = WB.Game.balls[i];
                if (t === this.owner || !t.isAlive || t.side === this.owner.side) continue;
                var dx = this.owner.x - t.x, dy = this.owner.y - t.y;
                var dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120 && dist > 0) {
                    t.vx += (dx / dist) * this.suctionStrength;
                    t.vy += (dy / dist) * this.suctionStrength;
                }
            }
        }
    }
    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this._onHitEffects(target, this.currentDamage, this.owner.color);
        WB.Audio.weaponHit(this.hitCount, this.type);
    }
    applyScaling() {
        this.suctionStrength = Math.min(0.15, 0.08 + this.hitCount * 0.004);
        this.rotationSpeed = Math.min(0.08, 0.05 + this.hitCount * 0.002);
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.4);
        this.scalingStat.value = (this.suctionStrength * 100).toFixed(0) + '%';
    }
    draw() {
        if (drawWeaponSprite(this, 'kansas-funnel')) return;
        var B = WB.GLBatch;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        // Funnel — cone shape
        var r = this.owner.radius;
        B.fillTriangle(r, -3, this.reach, -10, this.reach, 10, '#006BA6');
        B.fillTriangle(r, 3, this.reach, -10, this.reach, 10, '#006BA6');
        B.strokeRect(r, -3, this.reach - r, 6, '#004A80', 1);
        B.popTransform();
    }
}
WB.WeaponRegistry.register('kansas', KansasWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  17. KENTUCKY — Melee spin (bourbon barrel). Drunk debuff.
//  Each hit: +1 bourbon stack on target → +3% random movement deviation.
//  Every 4 hits: +1 barrel damage.
// ═══════════════════════════════════════════════════════════════
class KentuckyWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'kentucky', baseDamage: 4, rotationSpeed: 0.04, reach: 80, scalingName: 'Stacks', superThreshold: NO_SUPER });
        this.scalingStat.value = 0;
    }
    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        // Apply bourbon stack — use venomStacks as proxy (adds movement disruption)
        if (!target._bourbonStacks) target._bourbonStacks = 0;
        target._bourbonStacks++;
        // Add random velocity deviation proportional to stacks
        var deviation = target._bourbonStacks * 0.05;
        var angle = WB.random() * Math.PI * 2;
        var speed = target.getSpeed();
        target.vx += Math.cos(angle) * speed * deviation;
        target.vy += Math.sin(angle) * speed * deviation;
        this.applyScaling();
        this._onHitEffects(target, this.currentDamage, this.owner.color);
        WB.Audio.weaponHit(this.hitCount, this.type);
    }
    applyScaling() {
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount / 3);
        this.scalingStat.value = this.hitCount;
    }
    draw() {
        if (drawWeaponSprite(this, 'kentucky-barrel')) return;
        var B = WB.GLBatch;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        var r = this.owner.radius;
        // Barrel shape — wide rectangle
        B.fillRect(r, -5, this.reach - r - 4, 10, '#7B3F00');
        B.strokeRect(r, -5, this.reach - r - 4, 10, '#5A2D00', 1.5);
        // Barrel rings
        B.line(r + 8, -5, r + 8, 5, '#B8860B', 1);
        B.line(this.reach - 12, -5, this.reach - 12, 5, '#B8860B', 1);
        B.popTransform();
    }
}
WB.WeaponRegistry.register('kentucky', KentuckyWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  18. LOUISIANA — AoE swamp pulse. Friction zones.
//  Each hit: +5% friction increase in growing radius. Louisiana immune.
// ═══════════════════════════════════════════════════════════════
class LouisianaWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'louisiana', baseDamage: 5, rotationSpeed: 0, reach: 0, scalingName: 'Swamp', superThreshold: NO_SUPER, canParry: false });
        this.pulseTimer = 0;
        this.pulseRate = 40;
        this.pulseRadius = 75;
        this.frictionMult = 0.94;
        this.contactCooldown = 0;
        this.contactAura = 0;
        this.scalingStat.value = Math.round((1 - this.frictionMult) * 100) + '%';
    }
    update() {
        if (this.contactCooldown > 0) this.contactCooldown--;
        this.pulseTimer++;
        if (this.pulseTimer >= this.pulseRate) { this.pulseTimer = 0; this._swampPulse(); }
        // Apply friction to enemies in range
        if (WB.Game && WB.Game.balls) {
            for (var i = 0; i < WB.Game.balls.length; i++) {
                var t = WB.Game.balls[i];
                if (t === this.owner || !t.isAlive || t.side === this.owner.side) continue;
                var dx = t.x - this.owner.x, dy = t.y - this.owner.y;
                if (Math.sqrt(dx * dx + dy * dy) < this.pulseRadius) {
                    t.vx *= this.frictionMult;
                    t.vy *= this.frictionMult;
                }
            }
        }
    }
    _swampPulse() {
        if (!WB.Game || !WB.Game.balls) return;
        for (var i = 0; i < WB.Game.balls.length; i++) {
            var t = WB.Game.balls[i];
            if (t === this.owner || !t.isAlive || t.side === this.owner.side) continue;
            var dx = t.x - this.owner.x, dy = t.y - this.owner.y;
            if (Math.sqrt(dx * dx + dy * dy) < this.pulseRadius) {
                t.takeDamage(this.currentDamage);
                this.hitCount++;
                this.applyScaling();
                if (WB.GLEffects) WB.GLEffects.spawnDamageNumber(t.x, t.y, this.currentDamage, '#4B0082');
            }
        }
    }
    canHit() { return false; }
    onHit() {}
    applyScaling() {
        this.frictionMult = Math.max(0.85, 0.94 - this.hitCount * 0.01);
        this.pulseRadius = Math.min(120, 75 + this.hitCount * 4);
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.7);
        this.scalingStat.value = Math.round((1 - this.frictionMult) * 100) + '%';
    }
    draw() {
        var B = WB.GLBatch;
        B.setAlpha(0.08);
        B.fillCircle(this.owner.x, this.owner.y, this.pulseRadius, '#2E8B57');
        B.restoreAlpha();
        B.setAlpha(0.2);
        B.strokeCircle(this.owner.x, this.owner.y, this.pulseRadius, '#4B0082', 1.5);
        B.restoreAlpha();
    }
}
WB.WeaponRegistry.register('louisiana', LouisianaWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  19. MAINE — Projectile (lobster claws). Slow, huge, grips.
//  +8% claw size per hit. Every 3 hits: +1 dmg. Grip for 0.5s.
// ═══════════════════════════════════════════════════════════════
class MaineWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'maine', baseDamage: 4, rotationSpeed: 0.04, reach: 50, scalingName: 'Claw Size', superThreshold: NO_SUPER, isRanged: true });
        this.fireTimer = 0;
        this.fireRate = 120;
        this.clawSize = 5;
        this.scalingStat.value = this.clawSize;
    }
    update() {
        super.update();
        this.fireTimer++;
        if (this.fireTimer >= this.fireRate) { this.fireTimer = 0; this._fireClaw(); }
    }
    _fireClaw() {
        if (!WB.Game || !WB.Game.projectiles) return;
        var angle = this.angle;
        if (WB.Game.balls) {
            for (var i = 0; i < WB.Game.balls.length; i++) {
                var b = WB.Game.balls[i];
                if (b !== this.owner && b.isAlive && b.side !== this.owner.side) {
                    angle = Math.atan2(b.y - this.owner.y, b.x - this.owner.x); break;
                }
            }
        }
        WB.Game.projectiles.push(new WB.Projectile({
            x: this.owner.x + Math.cos(angle) * (this.owner.radius + 8),
            y: this.owner.y + Math.sin(angle) * (this.owner.radius + 8),
            vx: Math.cos(angle) * 4, vy: Math.sin(angle) * 4,
            damage: this.currentDamage, owner: this.owner, ownerWeapon: this,
            radius: this.clawSize, lifespan: 120, bounces: 0, color: '#003F87',
            shape: 'sprite', spriteKey: 'maine-claw'
        }));
        WB.Audio.projectileFire();
    }
    onProjectileHit(proj, target) {
        // Grip: slow target for 30 frames
        target.debuffs.slowFactor = 0.3;
        target.debuffs.slowTimer = Math.max(target.debuffs.slowTimer, 30);
    }
    applyScaling() {
        this.clawSize = 5 + Math.floor(this.hitCount * 0.4);
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount / 3);
        this.scalingStat.value = this.clawSize;
    }
    onHit() {}
    draw() {
        // Maine claw SVG is used on projectiles, not the launcher arm
        var B = WB.GLBatch;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        B.fillRect(this.owner.radius, -3, 25, 6, '#8B4513');
        // Claw pincers
        B.fillTriangle(this.reach - 5, -8, this.reach + 5, 0, this.reach - 5, 0, '#CC0000');
        B.fillTriangle(this.reach - 5, 8, this.reach + 5, 0, this.reach - 5, 0, '#CC0000');
        B.popTransform();
    }
}
WB.WeaponRegistry.register('maine', MaineWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  20. MARYLAND — Melee spin (crab claws, two short weapons)
//  +3% claw size, +2% lateral speed, -1% forward speed per hit.
// ═══════════════════════════════════════════════════════════════
class MarylandWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'maryland', baseDamage: 4, rotationSpeed: 0.055, reach: 75, scalingName: 'Claws', superThreshold: NO_SUPER });
        this.clawSize = 1.0;
        this.scalingStat.value = this.clawSize.toFixed(1);
    }
    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this._onHitEffects(target, this.currentDamage, this.owner.color);
        WB.Audio.weaponHit(this.hitCount, this.type);
    }
    applyScaling() {
        this.clawSize = 1.0 + this.hitCount * 0.04;
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.5);
        this.scalingStat.value = this.clawSize.toFixed(1);
    }
    draw() {
        if (drawWeaponSprite(this, 'maryland-claw')) return;
        var B = WB.GLBatch;
        var r = this.owner.radius;
        var cs = this.clawSize;
        // Two claws at opposite angles
        for (var c = 0; c < 2; c++) {
            var a = this.angle + c * Math.PI;
            B.pushTransform(this.owner.x, this.owner.y, a);
            B.fillRect(r, -2 * cs, this.reach - r - 4, 4 * cs, '#E03C31');
            B.strokeRect(r, -2 * cs, this.reach - r - 4, 4 * cs, '#8B0000', 1);
            // Pincer tips
            B.fillTriangle(this.reach - 4, -4 * cs, this.reach + 3, 0, this.reach - 4, 4 * cs, '#E03C31');
            B.popTransform();
        }
    }
}
WB.WeaponRegistry.register('maryland', MarylandWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  21. MASSACHUSETTS — Projectile (bricks). Fast, straight.
//  -3% fire cooldown, +5% speed per hit. Wall-embed bricks.
// ═══════════════════════════════════════════════════════════════
class MassachusettsWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'massachusetts', baseDamage: 2, rotationSpeed: 0.04, reach: 50, scalingName: 'Fire Rate', superThreshold: NO_SUPER, isRanged: true });
        this.fireTimer = 0;
        this.fireRate = 100;
        this.brickSpeed = 7;
        this.scalingStat.value = this.fireRate;
    }
    update() {
        super.update();
        this.fireTimer++;
        if (this.fireTimer >= this.fireRate) { this.fireTimer = 0; this._fireBrick(); }
    }
    _fireBrick() {
        if (!WB.Game || !WB.Game.projectiles) return;
        var angle = this.angle;
        if (WB.Game.balls) {
            for (var i = 0; i < WB.Game.balls.length; i++) {
                var b = WB.Game.balls[i];
                if (b !== this.owner && b.isAlive && b.side !== this.owner.side) {
                    angle = Math.atan2(b.y - this.owner.y, b.x - this.owner.x); break;
                }
            }
        }
        WB.Game.projectiles.push(new WB.Projectile({
            x: this.owner.x + Math.cos(angle) * (this.owner.radius + 6),
            y: this.owner.y + Math.sin(angle) * (this.owner.radius + 6),
            vx: Math.cos(angle) * this.brickSpeed, vy: Math.sin(angle) * this.brickSpeed,
            damage: this.currentDamage, owner: this.owner, ownerWeapon: this,
            radius: 4, lifespan: 100, bounces: 0, color: '#8B4513', shape: 'bullet'
        }));
        WB.Audio.projectileFire();
    }
    applyScaling() {
        this.fireRate = Math.max(25, 100 - Math.floor(this.hitCount * 3.0));
        this.brickSpeed = 7 + this.hitCount * 0.25;
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.3);
        this.scalingStat.value = this.fireRate;
    }
    onHit() {}
    draw() {
        var B = WB.GLBatch;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        B.fillRect(this.owner.radius, -3, 25, 6, '#666');
        B.fillRect(this.reach - 8, -4, 8, 8, '#8B4513');
        B.strokeRect(this.reach - 8, -4, 8, 8, '#5C2D12', 1.5);
        B.popTransform();
    }
}
WB.WeaponRegistry.register('massachusetts', MassachusettsWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  22. MICHIGAN — Body slam (assembly line). Armor plates every 5 hits.
//  +5 HP healed, +3% damage resistance per 5 hits. +1 dmg per 5 hits.
// ═══════════════════════════════════════════════════════════════
class MichiganWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'michigan', baseDamage: 2, rotationSpeed: 0, reach: 0, scalingName: 'Armor', superThreshold: NO_SUPER, canParry: false });
        this.owner.mass *= 1.2;
        this.armorPlates = 0;
        this.damageReduction = 0;
        this.contactCooldown = 0;
        this.contactCooldownTime = 60;
        this.contactAura = 2;
        this._gearAge = 0;
        this.scalingStat.value = this.armorPlates;
        // Patch takeDamage for armor
        var self = this;
        var origTakeDamage = this.owner.takeDamage.bind(this.owner);
        this.owner.takeDamage = function(dmg) {
            var reduced = Math.round(dmg * (1 - self.damageReduction));
            if (reduced < 1) reduced = 1;
            origTakeDamage(reduced);
        };
    }
    update() { this._gearAge++; if (this.contactCooldown > 0) this.contactCooldown--; }
    canHit() { return this.contactCooldown <= 0; }
    onHit(target) {
        var dmg = this.currentDamage;
        target.takeDamage(dmg);
        this.hitCount++;
        this.contactCooldown = this.contactCooldownTime;
        this.applyScaling();
        this._onHitEffects(target, dmg, this.owner.color);
        WB.Audio.weaponHit(this.hitCount, this.type);
    }
    applyScaling() {
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount / 6);
        // Every 9 hits: armor plate (slower, no healing)
        var newPlates = Math.floor(this.hitCount / 9);
        if (newPlates > this.armorPlates) {
            this.armorPlates = newPlates;
            this.damageReduction = Math.min(0.2, this.armorPlates * 0.03);
        }
        this.scalingStat.value = this.armorPlates;
    }
    draw() {
        var B = WB.GLBatch;
        // Gear sprite centered on ball (body slam — the ball IS the weapon)
        var S = WB.WeaponSprites;
        if (S && S.hasSprite('michigan-gear')) {
            B.flush();
            var size = this.owner.radius * 1.4;
            S.drawSprite('michigan-gear', this.owner.x, this.owner.y, this._gearAge * 0.02, size, size, 0.6, 1.0);
        }
        // Armor plate rings on top
        if (this.armorPlates > 0) {
            B.setAlpha(0.15);
            for (var p = 0; p < Math.min(this.armorPlates, 5); p++) {
                B.strokeCircle(this.owner.x, this.owner.y, this.owner.radius + 2 + p * 2, '#003B6F', 2);
            }
            B.restoreAlpha();
        }
    }
}
WB.WeaponRegistry.register('michigan', MichiganWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  23. MINNESOTA — Melee spin (hockey stick). Spawns pucks.
//  Each hit fires a puck projectile in facing direction.
//  Pucks bounce off walls twice. Rotation speed +5% per hit.
// ═══════════════════════════════════════════════════════════════
class MinnesotaWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'minnesota', baseDamage: 4, rotationSpeed: 0.06, reach: 70, scalingName: 'Pucks', superThreshold: NO_SUPER });
        this.pucksFired = 0;
        this.scalingStat.value = this.pucksFired;
    }
    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this._onHitEffects(target, this.currentDamage, this.owner.color);
        WB.Audio.weaponHit(this.hitCount, this.type);
        // Fire a puck in weapon facing direction
        this._firePuck();
    }
    _firePuck() {
        if (!WB.Game || !WB.Game.projectiles) return;
        this.pucksFired++;
        var a = this.angle;
        WB.Game.projectiles.push(new WB.Projectile({
            x: this.owner.x + Math.cos(a) * (this.reach + 5),
            y: this.owner.y + Math.sin(a) * (this.reach + 5),
            vx: Math.cos(a) * 8, vy: Math.sin(a) * 8,
            damage: 1, owner: this.owner, ownerWeapon: this,
            radius: 3, lifespan: 90, bounces: 2, color: '#222',
            shape: 'sprite', spriteKey: 'minnesota-puck'
        }));
    }
    applyScaling() {
        this.rotationSpeed = 0.06 + this.hitCount * 0.003;
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.3);
        this.scalingStat.value = this.pucksFired;
    }
    draw() {
        if (drawWeaponSprite(this, 'minnesota-stick')) return;
        var B = WB.GLBatch;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        var r = this.owner.radius;
        // Stick shaft
        B.fillRect(r, -2, this.reach - r - 12, 4, '#8B7355');
        B.strokeRect(r, -2, this.reach - r - 12, 4, '#6B5335', 1);
        // Hockey blade (L-shaped)
        B.fillRect(this.reach - 12, -1, 12, 3, '#003B5C');
        B.fillRect(this.reach - 3, -6, 3, 12, '#003B5C');
        B.popTransform();
    }
}
WB.WeaponRegistry.register('minnesota', MinnesotaWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  24. MISSISSIPPI — Melee spin (paddle wheel). Very slow, long.
//  Every 2 hits: +1 dmg. Movement speed -1%, paddle length +5%.
//  Generates directional current behind it.
// ═══════════════════════════════════════════════════════════════
class MississippiWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'mississippi', baseDamage: 2, rotationSpeed: 0.025, reach: 80, scalingName: 'Current', superThreshold: NO_SUPER });
        this.currentStrength = 0;
        this.scalingStat.value = this.currentStrength.toFixed(1);
    }
    update() {
        super.update();
        // Generate current — push enemies in movement direction
        if (this.currentStrength > 0 && WB.Game && WB.Game.balls) {
            var speed = this.owner.getSpeed();
            if (speed > 1) {
                var mx = this.owner.vx / speed, my = this.owner.vy / speed;
                for (var i = 0; i < WB.Game.balls.length; i++) {
                    var t = WB.Game.balls[i];
                    if (t === this.owner || !t.isAlive || t.side === this.owner.side) continue;
                    var dx = t.x - this.owner.x, dy = t.y - this.owner.y;
                    var dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 100 && dist > 0) {
                        t.vx += mx * this.currentStrength * 0.03;
                        t.vy += my * this.currentStrength * 0.03;
                    }
                }
            }
        }
    }
    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this._onHitEffects(target, this.currentDamage, this.owner.color);
        WB.Audio.weaponHit(this.hitCount, this.type);
    }
    applyScaling() {
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount / 3);
        this.reach = 80 + this.hitCount * 3;
        this.owner.maxSpeed = Math.max(5, WB.Config.BALL_MAX_SPEED * (1 - this.hitCount * 0.01));
        this.currentStrength += 0.5;
        this.scalingStat.value = this.currentStrength.toFixed(0);
    }
    draw() {
        // Paddle wheel sprite centered on ball, spinning with weapon angle
        var S = WB.WeaponSprites;
        if (S && S.hasSprite('mississippi-paddle')) {
            WB.GLBatch.flush();
            var size = this.owner.radius * 1.5;
            S.drawSprite('mississippi-paddle', this.owner.x, this.owner.y, this.angle, size, size, 0.8, 1.0);
            return;
        }
        var B = WB.GLBatch;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        var r = this.owner.radius;
        // Long paddle
        B.fillRect(r, -2, this.reach - r - 6, 4, '#6B0C22');
        B.strokeRect(r, -2, this.reach - r - 6, 4, '#4A0816', 1);
        // Paddle blade at tip
        B.fillRect(this.reach - 10, -8, 10, 16, '#6B0C22');
        B.strokeRect(this.reach - 10, -8, 10, 16, '#333', 1.5);
        B.popTransform();
    }
}
WB.WeaponRegistry.register('mississippi', MississippiWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  25. MISSOURI — Melee spin (arch blade). Gateway teleport.
//  Each hit stores a marker at current position (max 5).
//  Every 5th hit: teleport to oldest marker.
// ═══════════════════════════════════════════════════════════════
class MissouriWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'missouri', baseDamage: 4, rotationSpeed: 0.05, reach: 80, scalingName: 'Markers', superThreshold: NO_SUPER });
        this.markers = [];
        this.maxMarkers = 5;
        this.scalingStat.value = this.markers.length;
    }
    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        // Store gateway marker
        this.markers.push({ x: this.owner.x, y: this.owner.y, time: Date.now() });
        if (this.markers.length > this.maxMarkers) this.markers.shift();
        // Every 3rd hit: teleport to oldest marker
        if (this.hitCount % 3 === 0 && this.markers.length > 0) {
            var m = this.markers.shift();
            this.owner.x = m.x;
            this.owner.y = m.y;
            if (WB.Game.particles) WB.Game.particles.explode(this.owner.x, this.owner.y, 8, '#003B6F');
        }
        this.applyScaling();
        this._onHitEffects(target, this.currentDamage, this.owner.color);
        WB.Audio.weaponHit(this.hitCount, this.type);
    }
    applyScaling() {
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.4);
        this.scalingStat.value = this.markers.length;
    }
    update() {
        super.update();
        // Expire old markers (15 seconds)
        var now = Date.now();
        while (this.markers.length > 0 && now - this.markers[0].time > 15000) this.markers.shift();
    }
    draw() {
        var B = WB.GLBatch;
        // Draw markers
        for (var i = 0; i < this.markers.length; i++) {
            B.setAlpha(0.2);
            B.strokeCircle(this.markers[i].x, this.markers[i].y, 8, '#003B6F', 1.5);
            B.restoreAlpha();
        }
        if (drawWeaponSprite(this, 'missouri-arch')) return;
        // Arch blade weapon
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        var r = this.owner.radius;
        B.fillRect(r, -2.5, this.reach - r - 8, 5, '#8B7355');
        // Arch tip
        B.strokeCircle(this.reach - 4, 0, 6, '#003B6F', 2.5);
        B.popTransform();
    }
}
WB.WeaponRegistry.register('missouri', MissouriWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  26. MONTANA — Melee spin (elk antler rack). Multiple hitboxes.
//  +1 antler point every hit (starts with 2). Snag on hit.
// ═══════════════════════════════════════════════════════════════
class MontanaWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'montana', baseDamage: 3, rotationSpeed: 0.05, reach: 85, scalingName: 'Points', superThreshold: NO_SUPER });
        this.antlerPoints = 2;
        this.scalingStat.value = this.antlerPoints;
    }
    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        // Snag — brief slow
        target.debuffs.slowFactor = 0.4;
        target.debuffs.slowTimer = Math.max(target.debuffs.slowTimer, 40);
        this.applyScaling();
        this._onHitEffects(target, this.currentDamage, this.owner.color);
        WB.Audio.weaponHit(this.hitCount, this.type);
    }
    applyScaling() {
        this.antlerPoints = Math.min(6, 2 + Math.floor(this.hitCount * 0.5));
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.5);
        this.scalingStat.value = this.antlerPoints;
    }
    draw() {
        if (drawWeaponSprite(this, 'montana-antler')) return;
        var B = WB.GLBatch;
        var r = this.owner.radius;
        // Multiple branching antler points
        for (var p = 0; p < Math.min(this.antlerPoints, 8); p++) {
            var branchAngle = this.angle + (p - this.antlerPoints / 2) * 0.15;
            var branchLen = this.reach * (0.7 + p * 0.04);
            B.pushTransform(this.owner.x, this.owner.y, branchAngle);
            B.fillRect(r, -1.5, branchLen - r - 4, 3, '#CD853F');
            B.strokeRect(r, -1.5, branchLen - r - 4, 3, '#8B6914', 0.5);
            B.fillCircle(branchLen - 2, 0, 3, '#FFF8DC');
            B.popTransform();
        }
    }
}
WB.WeaponRegistry.register('montana', MontanaWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  27. NEBRASKA — Body slam (bull charge). Charges in straight line.
//  +8% charge speed, +5% duration, +2% mass per hit. Pause to redirect.
// ═══════════════════════════════════════════════════════════════
class NebraskaWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'nebraska', baseDamage: 3, rotationSpeed: 0, reach: 0, scalingName: 'Charge', superThreshold: NO_SUPER, canParry: false });
        this.chargeSpeed = 6;
        this.chargeDuration = 90;
        this.pauseDuration = 50;
        this.chargeTimer = 0;
        this.charging = false;
        this.pausing = false;
        this.chargeAngle = 0;
        this.contactCooldown = 0;
        this.contactCooldownTime = 50;
        this.contactAura = 2;
        this.scalingStat.value = this.chargeSpeed.toFixed(1);
    }
    update() {
        if (this.contactCooldown > 0) this.contactCooldown--;
        this.chargeTimer++;
        if (this.pausing) {
            this.owner.vx *= 0.85; this.owner.vy *= 0.85;
            if (this.chargeTimer >= this.pauseDuration) { this._startCharge(); }
        } else if (this.charging) {
            this.owner.vx = Math.cos(this.chargeAngle) * this.chargeSpeed;
            this.owner.vy = Math.sin(this.chargeAngle) * this.chargeSpeed;
            if (this.chargeTimer >= this.chargeDuration) { this.pausing = true; this.charging = false; this.chargeTimer = 0; }
        } else {
            this._startCharge();
        }
    }
    _startCharge() {
        this.charging = true; this.pausing = false; this.chargeTimer = 0;
        // Aim at enemy
        if (WB.Game && WB.Game.balls) {
            for (var i = 0; i < WB.Game.balls.length; i++) {
                var b = WB.Game.balls[i];
                if (b !== this.owner && b.isAlive && b.side !== this.owner.side) {
                    this.chargeAngle = Math.atan2(b.y - this.owner.y, b.x - this.owner.x);
                    return;
                }
            }
        }
        this.chargeAngle = WB.random() * Math.PI * 2;
    }
    canHit() { return this.contactCooldown <= 0 && this.charging; }
    onHit(target) {
        var speed = this.owner.getSpeed();
        var dmg = Math.round(this.currentDamage + speed * 0.1);
        target.takeDamage(dmg);
        this.hitCount++;
        this.contactCooldown = this.contactCooldownTime;
        this.applyScaling();
        this._onHitEffects(target, dmg, this.owner.color);
        WB.Audio.weaponHit(this.hitCount, this.type);
    }
    applyScaling() {
        this.chargeSpeed = Math.min(8, 6 + this.hitCount * 0.2);
        this.chargeDuration = Math.min(100, 90 + this.hitCount * 2);
        this.pauseDuration = Math.max(40, 50 - Math.floor(this.hitCount * 0.2));
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.2);
        this.scalingStat.value = this.chargeSpeed.toFixed(1);
    }
    draw() {
        var B = WB.GLBatch;
        if (this.charging) {
            B.setAlpha(0.2);
            var ma = Math.atan2(-this.owner.vy, -this.owner.vx);
            B.line(this.owner.x, this.owner.y, this.owner.x + Math.cos(ma) * 20, this.owner.y + Math.sin(ma) * 20, '#E41C38', 3);
            B.restoreAlpha();
        }
    }
}
WB.WeaponRegistry.register('nebraska', NebraskaWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  28. NEVADA — Melee spin (slot machine arm). Random damage.
//  Each hit: damage × random(floor, ceiling). Jackpot every 7th.
// ═══════════════════════════════════════════════════════════════
class NevadaWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'nevada', baseDamage: 2, rotationSpeed: 0.05, reach: 75, scalingName: 'Jackpot', superThreshold: NO_SUPER });
        this.slotFloor = 1.0;
        this.slotCeiling = 2.5;
        this.jackpotCounter = 0;
        this.scalingStat.value = this.jackpotCounter + '/9';
    }
    onHit(target) {
        this.jackpotCounter++;
        var mult;
        if (this.jackpotCounter >= 9) {
            mult = 4; // JACKPOT!
            this.jackpotCounter = 0;
            WB.Renderer.triggerShake(8);
            if (WB.Game.particles) WB.Game.particles.explode(target.x, target.y, 15, '#FFD700');
        } else {
            mult = this.slotFloor + WB.random() * (this.slotCeiling - this.slotFloor);
        }
        var dmg = Math.round(this.currentDamage * mult);
        target.takeDamage(dmg);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this._onHitEffects(target, dmg, this.owner.color);
        WB.Audio.weaponHit(this.hitCount, this.type);
    }
    applyScaling() {
        this.slotFloor = Math.min(1.8, 1.0 + this.hitCount * 0.03);
        this.slotCeiling = Math.min(3.5, 2.5 + this.hitCount * 0.06);
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.25);
        this.scalingStat.value = this.jackpotCounter + '/9';
    }
    draw() {
        if (drawWeaponSprite(this, 'nevada-slot')) {
            // Still draw jackpot counter overlay
            WB.GLText.drawTextLite(this.jackpotCounter + '/9', this.owner.x, this.owner.y - this.owner.radius - 10, '12px Courier New', '#FFD700', '#333', 'center');
            return;
        }
        var B = WB.GLBatch;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        var r = this.owner.radius;
        // Slot arm — long lever
        B.fillRect(r, -2.5, this.reach - r - 8, 5, '#C0C0C0');
        B.strokeRect(r, -2.5, this.reach - r - 8, 5, '#888', 1);
        // Handle ball at tip
        B.fillCircle(this.reach - 4, 0, 6, '#FF0000');
        B.strokeCircle(this.reach - 4, 0, 6, '#8B0000', 1.5);
        B.popTransform();
        // Jackpot counter
        WB.GLText.drawTextLite(this.jackpotCounter + '/9', this.owner.x, this.owner.y - this.owner.radius - 10, '12px Courier New', '#FFD700', '#333', 'center');
    }
}
WB.WeaponRegistry.register('nevada', NevadaWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  29. NEW HAMPSHIRE — Body slam (granite). Pure tank.
//  +3% damage resistance, +1 contact damage every 2 hits. Nothing else.
// ═══════════════════════════════════════════════════════════════
class NewHampshireWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'new-hampshire', baseDamage: 2, rotationSpeed: 0, reach: 0, scalingName: 'Resist', superThreshold: NO_SUPER, canParry: false });
        this.damageResist = 0;
        this.contactCooldown = 0;
        this.contactCooldownTime = 68;
        this.contactAura = 2;
        this.scalingStat.value = Math.round(this.damageResist * 100) + '%';
        // Armor — capped at 25% reduction
        var self = this;
        var origTakeDamage = this.owner.takeDamage.bind(this.owner);
        this.owner.takeDamage = function(dmg) {
            var reduced = Math.round(dmg * (1 - self.damageResist));
            if (reduced < 1) reduced = 1;
            origTakeDamage(reduced);
        };
    }
    update() { if (this.contactCooldown > 0) this.contactCooldown--; }
    canHit() { return this.contactCooldown <= 0; }
    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.contactCooldown = this.contactCooldownTime;
        this.applyScaling();
        this._onHitEffects(target, this.currentDamage, this.owner.color);
        WB.Audio.weaponHit(this.hitCount, this.type);
    }
    applyScaling() {
        this.damageResist = Math.min(0.15, this.hitCount * 0.01);
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.15);
        this.scalingStat.value = Math.round(this.damageResist * 100) + '%';
    }
    draw() {
        var B = WB.GLBatch;
        if (this.damageResist > 0) {
            B.setAlpha(0.1 + this.damageResist * 0.2);
            B.strokeCircle(this.owner.x, this.owner.y, this.owner.radius + 3, '#666', 2);
            B.restoreAlpha();
        }
    }
}
WB.WeaponRegistry.register('new-hampshire', NewHampshireWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  30. NEW JERSEY — AoE toxic pulse (fastest rate). Gravity field.
//  Every 1.5 sec pulse. +1% downward pull per hit near NJ.
// ═══════════════════════════════════════════════════════════════
class NewJerseyWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'new-jersey', baseDamage: 5, rotationSpeed: 0, reach: 0, scalingName: 'Density', superThreshold: NO_SUPER, canParry: false });
        this.pulseTimer = 0;
        this.pulseRate = 35;
        this.pulseRadius = 80;
        this.gravPull = 2;
        this.contactCooldown = 0;
        this.contactAura = 0;
        this.scalingStat.value = this.gravPull.toFixed(0);
    }
    update() {
        if (this.contactCooldown > 0) this.contactCooldown--;
        this.pulseTimer++;
        if (this.pulseTimer >= this.pulseRate) { this.pulseTimer = 0; this._toxicPulse(); }
        // Gravity pull
        if (this.gravPull > 0 && WB.Game && WB.Game.balls) {
            for (var i = 0; i < WB.Game.balls.length; i++) {
                var t = WB.Game.balls[i];
                if (t === this.owner || !t.isAlive) continue;
                var dx = t.x - this.owner.x, dy = t.y - this.owner.y;
                var dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120 && dist > 0) {
                    var nx = -dx / dist, ny = -dy / dist;
                    t.vx += nx * this.gravPull * 0.03;
                    t.vy += ny * this.gravPull * 0.03;
                }
            }
        }
    }
    _toxicPulse() {
        if (!WB.Game || !WB.Game.balls) return;
        for (var i = 0; i < WB.Game.balls.length; i++) {
            var t = WB.Game.balls[i];
            if (t === this.owner || !t.isAlive || t.side === this.owner.side) continue;
            var dx = t.x - this.owner.x, dy = t.y - this.owner.y;
            if (Math.sqrt(dx * dx + dy * dy) < this.pulseRadius) {
                t.takeDamage(this.currentDamage);
                this.hitCount++;
                this.applyScaling();
                if (WB.GLEffects) WB.GLEffects.spawnDamageNumber(t.x, t.y, this.currentDamage, '#FFD700');
            }
        }
    }
    canHit() { return false; }
    onHit() {}
    applyScaling() {
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.7);
        this.gravPull = Math.min(10, 2 + this.hitCount);
        this.pulseRadius = Math.min(120, 80 + this.hitCount * 3);
        this.scalingStat.value = this.gravPull.toFixed(0);
    }
    draw() {
        var B = WB.GLBatch;
        B.setAlpha(0.06);
        B.fillCircle(this.owner.x, this.owner.y, this.pulseRadius, '#7CFC00');
        B.restoreAlpha();
        B.setAlpha(0.25);
        B.strokeCircle(this.owner.x, this.owner.y, this.pulseRadius, '#FFD700', 1.5);
        B.restoreAlpha();
    }
}
WB.WeaponRegistry.register('new-jersey', NewJerseyWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  31. NEW MEXICO — Projectile (chile peppers). Burn DOT.
//  Heat level +1 per hit. Color shifts green→red→white.
// ═══════════════════════════════════════════════════════════════
class NewMexicoWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'new-mexico', baseDamage: 3, rotationSpeed: 0.04, reach: 50, scalingName: 'Heat', superThreshold: NO_SUPER, isRanged: true });
        this.fireTimer = 0;
        this.fireRate = 110;
        this.heatLevel = 0;
        this.scalingStat.value = this.heatLevel;
    }
    update() {
        super.update();
        this.fireTimer++;
        if (this.fireTimer >= this.fireRate) { this.fireTimer = 0; this._fireChile(); }
    }
    _fireChile() {
        if (!WB.Game || !WB.Game.projectiles) return;
        var angle = this.angle;
        if (WB.Game.balls) {
            for (var i = 0; i < WB.Game.balls.length; i++) {
                var b = WB.Game.balls[i];
                if (b !== this.owner && b.isAlive && b.side !== this.owner.side) {
                    angle = Math.atan2(b.y - this.owner.y, b.x - this.owner.x); break;
                }
            }
        }
        var chileColor = this.heatLevel < 3 ? '#228B22' : this.heatLevel < 8 ? '#FF4500' : '#FFFFFF';
        var spd = 6 + this.heatLevel * 0.3;
        WB.Game.projectiles.push(new WB.Projectile({
            x: this.owner.x + Math.cos(angle) * (this.owner.radius + 6),
            y: this.owner.y + Math.sin(angle) * (this.owner.radius + 6),
            vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
            damage: this.currentDamage, owner: this.owner, ownerWeapon: this,
            radius: 3, lifespan: 100, bounces: 0, color: chileColor, shape: 'spiked'
        }));
        WB.Audio.projectileFire();
    }
    onProjectileHit(proj, target) {
        // Burn DOT — cap at 2 active burn stacks
        if (!target.debuffs.burn || target.debuffs.burn.length < 2) {
            var burnDmg = 1 + Math.floor(this.heatLevel * 0.2);
            target.debuffs.burn.push({ damage: burnDmg, remaining: 120, tickRate: 60, timer: 0 });
        }
    }
    applyScaling() {
        this.heatLevel++;
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.3);
        this.scalingStat.value = this.heatLevel;
    }
    onHit() {}
    draw() {
        var B = WB.GLBatch;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        B.fillRect(this.owner.radius, -2, 25, 4, '#8B7355');
        var chileColor = this.heatLevel < 3 ? '#228B22' : this.heatLevel < 8 ? '#FF4500' : '#FFFFFF';
        B.fillCircle(this.reach - 3, 0, 5, chileColor);
        B.strokeCircle(this.reach - 3, 0, 5, '#333', 1);
        B.popTransform();
    }
}
WB.WeaponRegistry.register('new-mexico', NewMexicoWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  32. NEW YORK — Projectile (Art Deco darts). Heavy, bouncing.
//  Darts that miss spawn skyscraper terrain hazards (DOT zones).
//  +5% mass per hit (heavier knockback). Every 4 hits: +1 dmg.
// ═══════════════════════════════════════════════════════════════
class NewYorkWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'new-york', baseDamage: 3, rotationSpeed: 0.04, reach: 50, scalingName: 'Towers', superThreshold: NO_SUPER, isRanged: true });
        this.fireTimer = 0;
        this.fireRate = 90;
        this.taxiMass = 1.0;
        this.dartsFired = 0;
        this.scalingStat.value = this.dartsFired;
    }
    update() {
        super.update();
        this.fireTimer++;
        if (this.fireTimer >= this.fireRate) { this.fireTimer = 0; this._fireDart(); }
    }
    _fireDart() {
        if (!WB.Game || !WB.Game.projectiles) return;
        this.dartsFired++;
        var angle = this.angle;
        if (WB.Game.balls) {
            for (var i = 0; i < WB.Game.balls.length; i++) {
                var b = WB.Game.balls[i];
                if (b !== this.owner && b.isAlive && b.side !== this.owner.side) {
                    angle = Math.atan2(b.y - this.owner.y, b.x - this.owner.x); break;
                }
            }
        }
        var self = this;
        WB.Game.projectiles.push(new WB.Projectile({
            x: this.owner.x + Math.cos(angle) * (this.owner.radius + 8),
            y: this.owner.y + Math.sin(angle) * (this.owner.radius + 8),
            vx: Math.cos(angle) * 7, vy: Math.sin(angle) * 7,
            damage: this.currentDamage, owner: this.owner, ownerWeapon: this,
            radius: 5, lifespan: 100, bounces: 1, color: '#FFD700',
            shape: 'sprite', spriteKey: 'newyork-dart',
            onMiss: function(x, y) {
                // Skyscraper grows where dart lands
                if (WB.Game && WB.Game.hazards) {
                    WB.Game.hazards.push(new WB.Hazard({
                        x: x, y: y, radius: 15, damage: 1, tickRate: 45,
                        lifespan: 300, color: '#B8860B',
                        owner: self.owner, ownerWeapon: self,
                        spriteKey: 'newyork-terrain'
                    }));
                }
            }
        }));
        WB.Audio.projectileFire();
    }
    onProjectileHit(proj, target) {
        // Heavy knockback
        var dx = target.x - this.owner.x, dy = target.y - this.owner.y;
        var d = Math.sqrt(dx * dx + dy * dy) || 1;
        var kb = 3 + this.taxiMass;
        target.vx += (dx / d) * kb;
        target.vy += (dy / d) * kb;
    }
    applyScaling() {
        this.taxiMass = 1.0 + this.hitCount * 0.05;
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount / 4);
        this.scalingStat.value = this.dartsFired;
    }
    onHit() {}
    draw() {
        // New York dart SVG is used on projectiles, not the launcher arm
        var B = WB.GLBatch;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        B.fillRect(this.owner.radius, -3, 28, 6, '#555');
        B.fillRect(this.reach - 10, -5, 10, 10, '#FFD700');
        B.strokeRect(this.reach - 10, -5, 10, 10, '#B8860B', 1.5);
        B.popTransform();
    }
}
WB.WeaponRegistry.register('new-york', NewYorkWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  33. NORTH CAROLINA — Body slam with GLIDE.
//  Floats horizontally at bounce apex. Glide extends per hit.
// ═══════════════════════════════════════════════════════════════
class NorthCarolinaWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'north-carolina', baseDamage: 2, rotationSpeed: 0, reach: 0, scalingName: 'Glide', superThreshold: NO_SUPER, canParry: false });
        this.glideDuration = 20;
        this.glideSpeed = 2;
        this.gliding = false;
        this.glideTimer = 0;
        this.contactCooldown = 0;
        this.contactCooldownTime = 70;
        this.contactAura = 2;
        this.scalingStat.value = this.glideDuration;
    }
    update() {
        if (this.contactCooldown > 0) this.contactCooldown--;
        // Detect apex (vy changes sign or very small)
        if (!this.gliding && Math.abs(this.owner.vy) < 0.5 && this.owner.vy < this._lastVy) {
            this.gliding = true;
            this.glideTimer = this.glideDuration;
        }
        this._lastVy = this.owner.vy;
        if (this.gliding) {
            this.owner.vy = 0;
            this.owner.vx += (this.owner.vx > 0 ? 1 : -1) * 0.1;
            this.glideTimer--;
            if (this.glideTimer <= 0) this.gliding = false;
        }
    }
    canHit() { return this.contactCooldown <= 0; }
    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.contactCooldown = this.contactCooldownTime;
        this.applyScaling();
        this._onHitEffects(target, this.currentDamage, this.owner.color);
        WB.Audio.weaponHit(this.hitCount, this.type);
    }
    applyScaling() {
        this.glideDuration = Math.min(35, 20 + Math.floor(this.hitCount * 0.5));
        this.glideSpeed = Math.min(3, 2 + this.hitCount * 0.05);
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.2);
        this.scalingStat.value = this.glideDuration;
    }
    draw() {
        if (this.gliding) {
            var B = WB.GLBatch;
            B.setAlpha(0.15);
            // Wing lines
            B.line(this.owner.x - 15, this.owner.y, this.owner.x - 25, this.owner.y - 8, '#4B9CD3', 2);
            B.line(this.owner.x + 15, this.owner.y, this.owner.x + 25, this.owner.y - 8, '#4B9CD3', 2);
            B.restoreAlpha();
        }
    }
}
WB.WeaponRegistry.register('north-carolina', NorthCarolinaWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  34. NORTH DAKOTA — Projectile (oil globs). Create oil slicks.
//  Slicks reduce friction. Flammable (fire dmg ignites them).
// ═══════════════════════════════════════════════════════════════
class NorthDakotaWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'north-dakota', baseDamage: 4, rotationSpeed: 0.04, reach: 50, scalingName: 'Slicks', superThreshold: NO_SUPER, isRanged: true });
        this.fireTimer = 0;
        this.fireRate = 90;
        this.globSize = 4;
        this.slickCount = 0;
        this.scalingStat.value = this.slickCount;
    }
    update() {
        super.update();
        this.fireTimer++;
        if (this.fireTimer >= this.fireRate) { this.fireTimer = 0; this._fireGlob(); }
    }
    _fireGlob() {
        if (!WB.Game || !WB.Game.projectiles) return;
        var angle = this.angle;
        if (WB.Game.balls) {
            for (var i = 0; i < WB.Game.balls.length; i++) {
                var b = WB.Game.balls[i];
                if (b !== this.owner && b.isAlive && b.side !== this.owner.side) {
                    angle = Math.atan2(b.y - this.owner.y, b.x - this.owner.x); break;
                }
            }
        }
        var self = this;
        WB.Game.projectiles.push(new WB.Projectile({
            x: this.owner.x + Math.cos(angle) * (this.owner.radius + 6),
            y: this.owner.y + Math.sin(angle) * (this.owner.radius + 6),
            vx: Math.cos(angle) * 5, vy: Math.sin(angle) * 5,
            damage: this.currentDamage, owner: this.owner, ownerWeapon: this,
            radius: this.globSize, lifespan: 100, bounces: 0, color: '#222',
            gravityAffected: true,
            onMiss: function(x, y) {
                self.slickCount++;
                self.scalingStat.value = self.slickCount;
                if (WB.Game && WB.Game.hazards) {
                    WB.Game.hazards.push(new WB.Hazard({
                        x: x, y: y, radius: 15, damage: 0, tickRate: 999, lifespan: 180,
                        color: '#333', owner: self.owner, ownerWeapon: self
                    }));
                }
            }
        }));
        WB.Audio.projectileFire();
    }
    applyScaling() {
        this.globSize = 4 + Math.floor(this.hitCount * 0.2);
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount / 4);
        this.scalingStat.value = this.slickCount;
    }
    onHit() {}
    draw() {
        var B = WB.GLBatch;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        B.fillRect(this.owner.radius, -3, 25, 6, '#555');
        B.fillCircle(this.reach - 3, 0, this.globSize, '#222');
        B.popTransform();
    }
}
WB.WeaponRegistry.register('north-dakota', NorthDakotaWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  35. OHIO — Melee spin (wrench). Compound scaling.
//  +1 dmg every 3 hits AND scaling rate itself increases 5%.
// ═══════════════════════════════════════════════════════════════
class OhioWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'ohio', baseDamage: 3, rotationSpeed: 0, reach: 0, scalingName: 'Rate', superThreshold: NO_SUPER, canParry: false });
        this.scalingRate = 1.0;
        // Charge cycle: pause → aim → charge → punt tumble
        this.chargeSpeed = 6;
        this.chargeDuration = 80;
        this.pauseDuration = 55;
        this.chargeTimer = 0;
        this.charging = false;
        this.pausing = false;
        this.chargeAngle = 0;
        this.contactCooldown = 0;
        this.contactCooldownTime = 45;
        this.contactAura = 2;
        this._tumbleSpin = 0;      // current tumble rotation angle
        this._tumbleSpeed = 0;     // rad/frame — spikes on hit, decays over time
        this.scalingStat.value = this.scalingRate.toFixed(2);
    }
    update() {
        if (this.contactCooldown > 0) this.contactCooldown--;
        this.chargeTimer++;
        // Tumble spin: fast after punt, decays toward zero
        this._tumbleSpin += this._tumbleSpeed;
        if (this._tumbleSpeed > 0.02) {
            this._tumbleSpeed *= 0.97; // gradual decay
        } else {
            this._tumbleSpeed = 0;
        }
        if (this.pausing) {
            this.owner.vx *= 0.85; this.owner.vy *= 0.85;
            if (this.chargeTimer >= this.pauseDuration) { this._startCharge(); }
        } else if (this.charging) {
            this.owner.vx = Math.cos(this.chargeAngle) * this.chargeSpeed;
            this.owner.vy = Math.sin(this.chargeAngle) * this.chargeSpeed;
            // Wall detection — if stuck against wall mid-charge, punt and re-aim
            var a = WB.Config.ARENA, o = this.owner;
            var atWall = (o.x - o.radius <= a.x + 2) || (o.x + o.radius >= a.x + a.width - 2) ||
                         (o.y - o.radius <= a.y + 2) || (o.y + o.radius >= a.y + a.height - 2);
            if (atWall && this.chargeTimer > 10) {
                this._tumbleSpeed = 0.3; // punt tumble off the wall
                this.pausing = true; this.charging = false; this.chargeTimer = 0;
            }
            if (this.chargeTimer >= this.chargeDuration) { this.pausing = true; this.charging = false; this.chargeTimer = 0; }
        } else {
            this._startCharge();
        }
    }
    _startCharge() {
        this.charging = true; this.pausing = false; this.chargeTimer = 0;
        this._tumbleSpeed = 0; // stop tumbling when lining up new charge
        if (WB.Game && WB.Game.balls) {
            for (var i = 0; i < WB.Game.balls.length; i++) {
                var b = WB.Game.balls[i];
                if (b !== this.owner && b.isAlive && b.side !== this.owner.side) {
                    this.chargeAngle = Math.atan2(b.y - this.owner.y, b.x - this.owner.x);
                    return;
                }
            }
        }
        this.chargeAngle = WB.random() * Math.PI * 2;
    }
    canHit() { return this.contactCooldown <= 0 && this.charging; }
    onHit(target) {
        // Directional check: only deal damage if target is in front of the football
        // (within ~120° cone of charge direction)
        var dx = target.x - this.owner.x, dy = target.y - this.owner.y;
        var angleToTarget = Math.atan2(dy, dx);
        var diff = angleToTarget - this.chargeAngle;
        // Normalize to [-PI, PI]
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) > Math.PI * 0.33) {
            // Target is behind the football — no damage, just bounce off
            this.contactCooldown = 15; // short cooldown to prevent spam
            return;
        }
        var speed = this.owner.getSpeed();
        var dmg = Math.round(this.currentDamage + speed * 0.08);
        target.takeDamage(dmg);
        this.hitCount++;
        this.contactCooldown = this.contactCooldownTime;
        this.applyScaling();
        // Knockback on hit
        var d = Math.sqrt(dx * dx + dy * dy) || 1;
        var kb = Math.min(5, 2 + this.scalingRate * 0.5);
        target.vx += (dx / d) * kb;
        target.vy += (dy / d) * kb;
        // Punt! Football goes tumbling after the hit
        this._tumbleSpeed = 0.4 + WB.random() * 0.2; // fast wild spin
        this.charging = false;
        this.pausing = true;
        this.chargeTimer = 0;
        this._onHitEffects(target, dmg, this.owner.color);
        WB.Audio.weaponHit(this.hitCount, this.type);
    }
    applyScaling() {
        // Compound: scaling_rate = 1.05 ^ hit_count (Ohio's signature)
        this.scalingRate = Math.pow(1.05, this.hitCount);
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount / 3 * this.scalingRate);
        this.chargeSpeed = Math.min(9, 6 + this.hitCount * 0.15);
        this.scalingStat.value = this.scalingRate.toFixed(2);
    }
    draw() {
        var B = WB.GLBatch;
        var S = WB.WeaponSprites;
        // Render football sprite centered on ball
        if (S && S.hasSprite('ohio-football')) {
            B.flush();
            var size = this.owner.radius * 1.7;
            var angle;
            if (this._tumbleSpeed > 0.02) {
                // Punted! Wild tumble spin
                angle = this._tumbleSpin;
            } else if (this.charging) {
                // Charging: football points toward target
                angle = this.chargeAngle;
            } else {
                // Pausing/idle: point along velocity
                var spd = this.owner.getSpeed();
                if (spd > 1) {
                    angle = Math.atan2(this.owner.vy, this.owner.vx);
                } else {
                    angle = this.chargeAngle;
                }
            }
            S.drawSprite('ohio-football', this.owner.x, this.owner.y, angle, size, size, 1.0, 1.0);
        }
        // Speed streaks when charging
        if (this.charging) {
            var speed = this.owner.getSpeed();
            if (speed > 3) {
                var trailAlpha = Math.min(0.3, (speed - 3) * 0.05);
                var ma = Math.atan2(-this.owner.vy, -this.owner.vx);
                B.setAlpha(trailAlpha);
                for (var i = 0; i < 3; i++) {
                    var off = (i - 1) * 0.3;
                    var lx = this.owner.x + Math.cos(ma + off) * (this.owner.radius + 3);
                    var ly = this.owner.y + Math.sin(ma + off) * (this.owner.radius + 3);
                    B.line(lx, ly, lx + Math.cos(ma) * (4 + speed), ly + Math.sin(ma) * (4 + speed), '#E03C31', 2);
                }
                B.restoreAlpha();
            }
        }
    }
}
WB.WeaponRegistry.register('ohio', OhioWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  36. OKLAHOMA — Melee spin (storm chaser blade). Tornado chance.
//  Cumulative 5% tornado chance per hit. Tornado pulls both balls.
// ═══════════════════════════════════════════════════════════════
class OklahomaWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'oklahoma', baseDamage: 4, rotationSpeed: 0.05, reach: 80, scalingName: 'Tornado%', superThreshold: NO_SUPER });
        this.tornadoChance = 0.10;
        this.scalingStat.value = Math.round(this.tornadoChance * 100) + '%';
    }
    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this._onHitEffects(target, this.currentDamage, this.owner.color);
        WB.Audio.weaponHit(this.hitCount, this.type);
        // Tornado check
        if (WB.random() < this.tornadoChance) {
            this._spawnTornado();
            this.tornadoChance = 0.10; // reset after trigger
        }
    }
    _spawnTornado() {
        if (!WB.Game || !WB.Game.hazards) return;
        WB.Game.hazards.push(new WB.Hazard({
            x: this.owner.x, y: this.owner.y, radius: 40, damage: 1, tickRate: 30, lifespan: 120,
            color: '#7B1113', owner: this.owner, ownerWeapon: this
        }));
        // Pull both balls toward tornado
        if (WB.Game.balls) {
            for (var i = 0; i < WB.Game.balls.length; i++) {
                var b = WB.Game.balls[i];
                if (b === this.owner || !b.isAlive) continue;
                var dx = this.owner.x - b.x, dy = this.owner.y - b.y;
                var d = Math.sqrt(dx * dx + dy * dy) || 1;
                b.vx += (dx / d) * 3;
                b.vy += (dy / d) * 3;
            }
        }
        WB.Renderer.triggerShake(6);
        if (WB.Game.particles) WB.Game.particles.explode(this.owner.x, this.owner.y, 10, '#7B1113');
    }
    applyScaling() {
        this.tornadoChance += 0.03;
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.3);
        this.scalingStat.value = Math.round(this.tornadoChance * 100) + '%';
    }
    draw() { if (drawWeaponSprite(this, 'oklahoma-turbine')) return; drawMeleeWeapon(this, 'rect'); }
}
WB.WeaponRegistry.register('oklahoma', OklahomaWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  37. OREGON — Melee spin (Douglas fir log). Gets longer, slower.
//  +10% length, -3% rotation speed per hit. Every 3 hits: +1 dmg.
// ═══════════════════════════════════════════════════════════════
class OregonWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'oregon', baseDamage: 3, rotationSpeed: 0.045, reach: 80, scalingName: 'Length', superThreshold: NO_SUPER });
        this.scalingStat.value = Math.round(this.reach);
    }
    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this._onHitEffects(target, this.currentDamage, this.owner.color);
        WB.Audio.weaponHit(this.hitCount, this.type);
    }
    applyScaling() {
        this.reach = Math.min(120, 80 + this.hitCount * 3);
        this.rotationSpeed = Math.max(0.02, 0.045 - this.hitCount * 0.002);
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount / 4);
        this.scalingStat.value = Math.round(this.reach);
    }
    draw() {
        if (drawWeaponSprite(this, 'oregon-log')) return;
        var B = WB.GLBatch;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        var r = this.owner.radius;
        // Thick log
        B.fillRect(r, -5, this.reach - r - 4, 10, '#5C3317');
        B.strokeRect(r, -5, this.reach - r - 4, 10, '#3B1F0E', 1.5);
        // Rings at regular intervals
        for (var i = r + 15; i < this.reach - 10; i += 20) {
            B.line(i, -5, i, 5, '#7B4B2A', 1);
        }
        B.popTransform();
    }
}
WB.WeaponRegistry.register('oregon', OregonWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  38. PENNSYLVANIA — Melee spin (liberty bell). Shockwave rings.
//  Each hit: expanding ring that damages on pass-through. +5% ring radius.
// ═══════════════════════════════════════════════════════════════
class PennsylvaniaWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'pennsylvania', baseDamage: 5, rotationSpeed: 0.03, reach: 70, scalingName: 'Rings', superThreshold: NO_SUPER });
        this.rings = [];
        this.ringExpansion = 60;
        this.scalingStat.value = this.rings.length;
    }
    update() {
        super.update();
        // Update expanding rings
        for (var i = this.rings.length - 1; i >= 0; i--) {
            var ring = this.rings[i];
            ring.radius += 1;
            ring.life--;
            // Check damage
            if (WB.Game && WB.Game.balls) {
                for (var j = 0; j < WB.Game.balls.length; j++) {
                    var t = WB.Game.balls[j];
                    if (t === this.owner || !t.isAlive || t.side === this.owner.side) continue;
                    var dx = t.x - ring.x, dy = t.y - ring.y;
                    var dist = Math.sqrt(dx * dx + dy * dy);
                    if (Math.abs(dist - ring.radius) < t.radius && !ring.hitTargets.has(t)) {
                        t.takeDamage(1);
                        ring.hitTargets.add(t);
                        if (WB.GLEffects) WB.GLEffects.spawnDamageNumber(t.x, t.y, 1, '#002244');
                    }
                }
            }
            if (ring.life <= 0) this.rings.splice(i, 1);
        }
    }
    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        // Spawn ring
        this.rings.push({ x: target.x, y: target.y, radius: 5, life: this.ringExpansion, hitTargets: new Set() });
        this.applyScaling();
        this._onHitEffects(target, this.currentDamage, this.owner.color);
        WB.Audio.weaponHit(this.hitCount, this.type);
    }
    applyScaling() {
        this.ringExpansion = 60 + Math.floor(this.hitCount * 3);
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.3);
        this.scalingStat.value = this.rings.length;
    }
    draw() {
        var B = WB.GLBatch;
        // Draw rings
        for (var i = 0; i < this.rings.length; i++) {
            var ring = this.rings[i];
            var alpha = ring.life / this.ringExpansion * 0.3;
            B.setAlpha(alpha);
            B.strokeCircle(ring.x, ring.y, ring.radius, '#002244', 2);
            B.restoreAlpha();
        }
        if (drawWeaponSprite(this, 'pennsylvania-bell')) return;
        // Bell weapon
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        var r = this.owner.radius;
        B.fillRect(r, -2.5, this.reach - r - 10, 5, '#8B7355');
        // Bell shape — trapezoid
        B.fillTriangle(this.reach - 10, -8, this.reach, 0, this.reach - 10, 8, '#B8860B');
        B.fillRect(this.reach - 12, -4, 4, 8, '#B8860B');
        B.strokeCircle(this.reach - 2, 0, 2, '#333', 1);
        B.popTransform();
    }
}
WB.WeaponRegistry.register('pennsylvania', PennsylvaniaWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  39. RHODE ISLAND — Melee spin (anchor). Bounce coefficient.
//  +3% bounce coefficient per hit. Gains speed from wall bounces.
// ═══════════════════════════════════════════════════════════════
class RhodeIslandWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'rhode-island', baseDamage: 4, rotationSpeed: 0.06, reach: 75, scalingName: 'Bounce', superThreshold: NO_SUPER });
        this.bounceCoeff = 1.1;
        this.scalingStat.value = this.bounceCoeff.toFixed(2);
    }
    update() {
        super.update();
        // Detect wall bounce without calling bounceOffWalls (ball.js already handles that)
        var a = WB.Config.ARENA;
        var o = this.owner;
        var atWall = (o.x - o.radius <= a.x + 1) || (o.x + o.radius >= a.x + a.width - 1) ||
                     (o.y - o.radius <= a.y + 1) || (o.y + o.radius >= a.y + a.height - 1);
        if (atWall && !this._wasAtWall && this.bounceCoeff > 1.0) {
            var boost = this.bounceCoeff - 1.0;
            this.owner.vx *= (1 + boost * 0.3);
            this.owner.vy *= (1 + boost * 0.3);
        }
        this._wasAtWall = atWall;
    }
    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this._onHitEffects(target, this.currentDamage, this.owner.color);
        WB.Audio.weaponHit(this.hitCount, this.type);
    }
    applyScaling() {
        this.bounceCoeff = 1.1 + this.hitCount * 0.05;
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.5);
        this.scalingStat.value = this.bounceCoeff.toFixed(2);
    }
    draw() {
        if (drawWeaponSprite(this, 'rhodeisland-anchor')) return;
        var B = WB.GLBatch;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        var r = this.owner.radius;
        // Anchor shaft
        B.fillRect(r, -2, this.reach - r - 8, 4, '#666');
        // Anchor flukes
        B.line(this.reach - 8, 0, this.reach, -8, '#003DA5', 2.5);
        B.line(this.reach - 8, 0, this.reach, 8, '#003DA5', 2.5);
        B.fillCircle(this.reach - 8, 0, 3, '#003DA5');
        // Ring at top
        B.strokeCircle(r + 5, 0, 4, '#003DA5', 1.5);
        B.popTransform();
    }
}
WB.WeaponRegistry.register('rhode-island', RhodeIslandWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  40. SOUTH CAROLINA — Melee spin (palmetto frond). Growing arc.
//  Sweep arc +5 degrees per hit (starts at ~30°). Grows to 360°.
// ═══════════════════════════════════════════════════════════════
class SouthCarolinaWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'south-carolina', baseDamage: 4, rotationSpeed: 0.06, reach: 80, scalingName: 'Arc', superThreshold: NO_SUPER });
        this.sweepArc = 45; // degrees
        this.scalingStat.value = this.sweepArc + '°';
    }
    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this._onHitEffects(target, this.currentDamage, this.owner.color);
        WB.Audio.weaponHit(this.hitCount, this.type);
    }
    applyScaling() {
        this.sweepArc = Math.min(360, 45 + this.hitCount * 8);
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.5);
        this.scalingStat.value = this.sweepArc + '°';
    }
    draw() {
        if (drawWeaponSprite(this, 'southcarolina-frond')) return;
        var B = WB.GLBatch;
        var r = this.owner.radius;
        var arcRad = this.sweepArc * Math.PI / 180;
        var bladeCount = Math.max(1, Math.ceil(arcRad / 0.5));
        for (var i = 0; i < bladeCount; i++) {
            var a = this.angle - arcRad / 2 + (arcRad * i / Math.max(bladeCount - 1, 1));
            B.pushTransform(this.owner.x, this.owner.y, a);
            B.fillRect(r, -1.5, this.reach - r - 4, 3, '#2E5E1E');
            B.popTransform();
        }
        // Main blade thicker
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        B.fillRect(r, -3, this.reach - r - 4, 6, '#3A7D2C');
        B.strokeRect(r, -3, this.reach - r - 4, 6, '#1B4E14', 1);
        B.popTransform();
    }
}
WB.WeaponRegistry.register('south-carolina', SouthCarolinaWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  41. SOUTH DAKOTA — Body slam (Mount Rushmore). Damage reflect.
//  Every 2 hits: +1 contact dmg. 10% damage reflection (increases).
// ═══════════════════════════════════════════════════════════════
class SouthDakotaWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'south-dakota', baseDamage: 2, rotationSpeed: 0, reach: 0, scalingName: 'Reflect', superThreshold: NO_SUPER, canParry: false });
        this.reflectPct = 0.03;
        this.contactCooldown = 0;
        this.contactCooldownTime = 63;
        this.contactAura = 2;
        this.scalingStat.value = Math.round(this.reflectPct * 100) + '%';
        // Reflect damage
        var self = this;
        var origTakeDamage = this.owner.takeDamage.bind(this.owner);
        this.owner.takeDamage = function(dmg) {
            origTakeDamage(dmg);
            // Reflect back
            var reflected = Math.round(dmg * self.reflectPct);
            if (reflected > 0 && WB.Game && WB.Game.balls) {
                for (var i = 0; i < WB.Game.balls.length; i++) {
                    var b = WB.Game.balls[i];
                    if (b !== self.owner && b.isAlive && b.side !== self.owner.side) {
                        b.takeDamage(reflected);
                        if (WB.GLEffects) WB.GLEffects.spawnDamageNumber(b.x, b.y, reflected, '#777');
                    }
                }
            }
        };
    }
    update() { if (this.contactCooldown > 0) this.contactCooldown--; }
    canHit() { return this.contactCooldown <= 0; }
    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.contactCooldown = this.contactCooldownTime;
        this.applyScaling();
        this._onHitEffects(target, this.currentDamage, this.owner.color);
        WB.Audio.weaponHit(this.hitCount, this.type);
    }
    applyScaling() {
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.15);
        this.reflectPct = Math.min(0.12, 0.03 + this.hitCount * 0.010);
        this.scalingStat.value = Math.round(this.reflectPct * 100) + '%';
    }
    draw() {
        var B = WB.GLBatch;
        if (this.reflectPct > 0.05) {
            B.setAlpha(0.1);
            B.strokeCircle(this.owner.x, this.owner.y, this.owner.radius + 4, '#888', 2);
            B.restoreAlpha();
        }
    }
}
WB.WeaponRegistry.register('south-dakota', SouthDakotaWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  42. TENNESSEE — AoE sound wave pulse. Knockback scales.
//  Alternates close (small, 2x dmg) and far (large, base dmg).
// ═══════════════════════════════════════════════════════════════
class TennesseeWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'tennessee', baseDamage: 5, rotationSpeed: 0, reach: 0, scalingName: 'Bass', superThreshold: NO_SUPER, canParry: false });
        this.pulseTimer = 0;
        this.basePulseRate = 38;
        this.pulseRate = 38;
        this.knockback = 4;
        this.pulseClose = true; // alternates close/long
        this.contactCooldown = 0;
        this.contactAura = 0;
        this.scalingStat.value = this.knockback.toFixed(1);
    }
    update() {
        if (this.contactCooldown > 0) this.contactCooldown--;
        this.pulseTimer++;
        if (this.pulseTimer >= this.pulseRate) { this.pulseTimer = 0; this._soundPulse(); this.pulseClose = !this.pulseClose; }
    }
    _soundPulse() {
        if (!WB.Game || !WB.Game.balls) return;
        var radius = this.pulseClose ? 65 : 115;
        var dmg = this.pulseClose ? Math.round(this.currentDamage * 2) : this.currentDamage;
        for (var i = 0; i < WB.Game.balls.length; i++) {
            var t = WB.Game.balls[i];
            if (t === this.owner || !t.isAlive || t.side === this.owner.side) continue;
            var dx = t.x - this.owner.x, dy = t.y - this.owner.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < radius && dist > 0) {
                t.takeDamage(dmg);
                this.hitCount++;
                this.applyScaling();
                // Knockback
                t.vx += (dx / dist) * this.knockback;
                t.vy += (dy / dist) * this.knockback;
                if (WB.GLEffects) WB.GLEffects.spawnDamageNumber(t.x, t.y, dmg, '#FF6B00');
            }
        }
        if (WB.GLEffects) WB.GLEffects.spawnImpact(this.owner.x, this.owner.y, '#FF6B00', radius * 0.4);
    }
    canHit() { return false; }
    onHit() {}
    applyScaling() {
        // Knockback: +5% multiplicative per hit
        this.knockback = Math.min(9, 3.5 + this.hitCount * 0.3);
        // Alternation speed increases with hits — pulse gets faster (min 20 frames)
        this.pulseRate = Math.max(20, Math.round(this.basePulseRate * Math.pow(0.97, this.hitCount)));
        // Damage scaling
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.6);
        this.scalingStat.value = this.knockback.toFixed(1);
    }
    draw() {
        var B = WB.GLBatch;
        var progress = this.pulseTimer / this.pulseRate;
        var radius = this.pulseClose ? 50 : 100;
        var drawR = radius * progress;
        if (drawR > 5) {
            B.setAlpha(0.15 * (1 - progress));
            B.strokeCircle(this.owner.x, this.owner.y, drawR, '#FF6B00', 2);
            B.restoreAlpha();
        }
    }
}
WB.WeaponRegistry.register('tennessee', TennesseeWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  43. TEXAS — Melee spin (lone star blade). Just gets bigger.
//  1.2x starting size. Every 2 hits: +1 dmg, +2% size/mass.
// ═══════════════════════════════════════════════════════════════
class TexasWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'texas', baseDamage: 7, rotationSpeed: 0.06, reach: 85, scalingName: 'Size', superThreshold: NO_SUPER });
        this.owner.radius = Math.round(WB.Config.BALL_RADIUS * 1.2);
        this.owner.mass = (this.owner.radius / WB.Config.BALL_RADIUS) * WB.Config.BALL_MASS * 1.2;
        this.scalingStat.value = this.owner.radius;
    }
    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this._onHitEffects(target, this.currentDamage, this.owner.color);
        WB.Audio.weaponHit(this.hitCount, this.type);
    }
    applyScaling() {
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount / 2);
        this.owner.radius = Math.round(WB.Config.BALL_RADIUS * (1.2 + this.hitCount * 0.02));
        this.owner.mass = (this.owner.radius / WB.Config.BALL_RADIUS) * WB.Config.BALL_MASS * (1.2 + this.hitCount * 0.02);
        this.scalingStat.value = this.owner.radius;
    }
    draw() {
        if (drawWeaponSprite(this, 'texas-spur')) return;
        var B = WB.GLBatch;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        var r = this.owner.radius;
        // Lone star blade — wide, heavy
        B.fillRect(r, -4, this.reach - r - 6, 8, '#BF0A30');
        B.strokeRect(r, -4, this.reach - r - 6, 8, '#8B0000', 1.5);
        // Star at tip
        var tx = this.reach - 3;
        var pts = [];
        for (var si = 0; si < 10; si++) {
            var sa = si * Math.PI / 5 - Math.PI / 2;
            var sr = si % 2 === 0 ? 6 : 3;
            pts.push(tx + Math.cos(sa) * sr);
            pts.push(Math.sin(sa) * sr);
        }
        B.fillPolygon(pts, '#FFF');
        B.popTransform();
    }
}
WB.WeaponRegistry.register('texas', TexasWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  44. UTAH — Melee spin (salt crystal blade). Crystal deposits.
//  Each hit creates crystal deposit at impact. Deposits grow into walls.
// ═══════════════════════════════════════════════════════════════
class UtahWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'utah', baseDamage: 1, rotationSpeed: 0.05, reach: 75, scalingName: 'Crystals', superThreshold: NO_SUPER });
        this.crystalCount = 0;
        this.scalingStat.value = this.crystalCount;
    }
    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        // Crystal deposit at impact point
        if (WB.Game && WB.Game.hazards) {
            this.crystalCount++;
            var growTime = 120 + Math.min(this.crystalCount, 6) * 10;
            WB.Game.hazards.push(new WB.Hazard({
                x: target.x, y: target.y, radius: Math.min(10, 6 + this.crystalCount), damage: 1, tickRate: 100, lifespan: growTime,
                color: '#F0E68C', owner: this.owner, ownerWeapon: this
            }));
        }
        this.applyScaling();
        this._onHitEffects(target, this.currentDamage, this.owner.color);
        WB.Audio.weaponHit(this.hitCount, this.type);
    }
    applyScaling() {
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount / 3);
        this.scalingStat.value = this.crystalCount;
    }
    draw() {
        if (drawWeaponSprite(this, 'utah-crystal')) return;
        var B = WB.GLBatch;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        var r = this.owner.radius;
        B.fillRect(r, -2.5, this.reach - r - 8, 5, '#D2B48C');
        // Crystal tip — hexagonal
        var tx = this.reach - 4;
        var pts = [];
        for (var i = 0; i < 6; i++) {
            var a = i * Math.PI / 3;
            pts.push(tx + Math.cos(a) * 6);
            pts.push(Math.sin(a) * 6);
        }
        B.fillPolygon(pts, '#F0E68C');
        for (var j = 0; j < 6; j++) {
            var nj = (j + 1) % 6;
            B.line(pts[j*2], pts[j*2+1], pts[nj*2], pts[nj*2+1], '#B8A63C', 1);
        }
        B.popTransform();
    }
}
WB.WeaponRegistry.register('utah', UtahWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  45. VERMONT — Projectile (syrup globs). Adds mass to target.
//  Slow, arcing. Miss → sticky floor patch (10% slow). +5% size/hit.
// ═══════════════════════════════════════════════════════════════
class VermontWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'vermont', baseDamage: 2, rotationSpeed: 0.04, reach: 50, scalingName: 'Globs', superThreshold: NO_SUPER, isRanged: true });
        this.fireTimer = 0;
        this.fireRate = 90;
        this.globSize = 4;
        this.scalingStat.value = this.globSize;
    }
    update() {
        super.update();
        this.fireTimer++;
        if (this.fireTimer >= this.fireRate) { this.fireTimer = 0; this._fireGlob(); }
    }
    _fireGlob() {
        if (!WB.Game || !WB.Game.projectiles) return;
        var angle = this.angle;
        if (WB.Game.balls) {
            for (var i = 0; i < WB.Game.balls.length; i++) {
                var b = WB.Game.balls[i];
                if (b !== this.owner && b.isAlive && b.side !== this.owner.side) {
                    angle = Math.atan2(b.y - this.owner.y, b.x - this.owner.x); break;
                }
            }
        }
        var self = this;
        WB.Game.projectiles.push(new WB.Projectile({
            x: this.owner.x + Math.cos(angle) * (this.owner.radius + 6),
            y: this.owner.y + Math.sin(angle) * (this.owner.radius + 6),
            vx: Math.cos(angle) * 6, vy: Math.sin(angle) * 6,
            damage: this.currentDamage, owner: this.owner, ownerWeapon: this,
            radius: this.globSize, lifespan: 120, bounces: 0, color: '#8B6914',
            gravityAffected: true,
            onMiss: function(x, y) {
                if (WB.Game && WB.Game.hazards) {
                    WB.Game.hazards.push(new WB.Hazard({
                        x: x, y: y, radius: 12, damage: 0, tickRate: 999, lifespan: 180,
                        color: '#8B6914', owner: self.owner, ownerWeapon: self
                    }));
                }
            }
        }));
        WB.Audio.projectileFire();
    }
    onProjectileHit(proj, target) {
        target.mass += target.mass * 0.04;
    }
    applyScaling() {
        this.globSize = 4 + Math.floor(this.hitCount * 0.25);
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount / 3);
        this.scalingStat.value = this.globSize;
    }
    onHit() {}
    draw() {
        var B = WB.GLBatch;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        B.fillRect(this.owner.radius, -2, 20, 4, '#5C3317');
        B.fillCircle(this.reach - 3, 0, this.globSize, '#8B6914');
        B.popTransform();
    }
}
WB.WeaponRegistry.register('vermont', VermontWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  46. VIRGINIA — Melee spin (saber). Hit streak multiplier.
//  Every 3 hits: +1 dmg, +5% rotation speed. Getting hit resets streak ×2.
// ═══════════════════════════════════════════════════════════════
class VirginiaWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'virginia', baseDamage: 4, rotationSpeed: 0.045, reach: 80, scalingName: 'Streak', superThreshold: NO_SUPER });
        this.streak = 0;
        this.streakMult = 1.0;
        this.scalingStat.value = this.streak;
        // Track taking damage to reset streak
        var self = this;
        var origTakeDamage = this.owner.takeDamage.bind(this.owner);
        this.owner.takeDamage = function(dmg) {
            origTakeDamage(dmg);
            self.streak = 0;
            self.streakMult = 1.0;
            self.scalingStat.value = self.streak;
        };
    }
    onHit(target) {
        this.streak++;
        // Every 3 consecutive hits without taking damage: streak bonus
        this.streakMult = 1.0 + Math.floor(this.streak / 3) * 0.5;
        var dmg = Math.round(this.currentDamage * this.streakMult);
        target.takeDamage(dmg);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this._onHitEffects(target, dmg, this.owner.color);
        WB.Audio.weaponHit(this.hitCount, this.type);
    }
    applyScaling() {
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount / 3);
        this.rotationSpeed = 0.045 + this.hitCount * 0.00225;
        this.scalingStat.value = this.streak;
    }
    draw() {
        if (drawWeaponSprite(this, 'virginia-saber')) return;
        var B = WB.GLBatch;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        var r = this.owner.radius;
        // Saber — thin, elegant
        B.fillRect(r, -1.5, this.reach - r - 4, 3, '#C0C0C0');
        B.strokeRect(r, -1.5, this.reach - r - 4, 3, '#888', 1);
        // Guard
        B.fillRect(r + 3, -5, 3, 10, '#B8860B');
        // Tip
        B.fillTriangle(this.reach - 4, -2, this.reach + 2, 0, this.reach - 4, 2, '#DDD');
        B.popTransform();
    }
}
WB.WeaponRegistry.register('virginia', VirginiaWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  47. WASHINGTON — Projectile (coffee beans). Fastest fire rate.
//  +2% move speed, +1% fire rate per hit. Vibration jitter grows.
// ═══════════════════════════════════════════════════════════════
class WashingtonWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'washington', baseDamage: 3, rotationSpeed: 0.04, reach: 50, scalingName: 'Caffeine', superThreshold: NO_SUPER, isRanged: true });
        this.fireTimer = 0;
        this.fireRate = 60;
        this.jitter = 0;
        this.scalingStat.value = this.jitter.toFixed(1);
    }
    update() {
        super.update();
        this.fireTimer++;
        if (this.fireTimer >= this.fireRate) { this.fireTimer = 0; this._fireBeans(); }
        // Jitter — random position offset
        if (this.jitter > 0) {
            this.owner.x += (WB.random() - 0.5) * this.jitter * 0.3;
            this.owner.y += (WB.random() - 0.5) * this.jitter * 0.3;
        }
    }
    _fireBeans() {
        if (!WB.Game || !WB.Game.projectiles) return;
        var angle = this.angle;
        if (WB.Game.balls) {
            for (var i = 0; i < WB.Game.balls.length; i++) {
                var b = WB.Game.balls[i];
                if (b !== this.owner && b.isAlive && b.side !== this.owner.side) {
                    angle = Math.atan2(b.y - this.owner.y, b.x - this.owner.x); break;
                }
            }
        }
        // Jitter affects aim
        angle += (WB.random() - 0.5) * this.jitter * 0.05;
        WB.Game.projectiles.push(new WB.Projectile({
            x: this.owner.x + Math.cos(angle) * (this.owner.radius + 5),
            y: this.owner.y + Math.sin(angle) * (this.owner.radius + 5),
            vx: Math.cos(angle) * 8, vy: Math.sin(angle) * 8,
            damage: this.currentDamage, owner: this.owner, ownerWeapon: this,
            radius: 2, lifespan: 70, bounces: 0, color: '#5C3317'
        }));
        WB.Audio.projectileFire();
    }
    applyScaling() {
        this.owner.maxSpeed = WB.Config.BALL_MAX_SPEED * (1 + this.hitCount * 0.02);
        this.fireRate = Math.max(15, 60 - Math.floor(this.hitCount * 0.6));
        this.jitter += 1;
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount / 5);
        this.scalingStat.value = this.jitter.toFixed(0);
    }
    onHit() {}
    draw() {
        var B = WB.GLBatch;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        B.fillRect(this.owner.radius, -2, 20, 4, '#3A2410');
        B.fillCircle(this.reach - 2, 0, 3, '#5C3317');
        B.popTransform();
    }
}
WB.WeaponRegistry.register('washington', WashingtonWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  48. WEST VIRGINIA — Melee spin (pickaxe). Digs pits.
//  Each hit: pit at impact point. Balls over pits lose momentum.
// ═══════════════════════════════════════════════════════════════
class WestVirginiaWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'west-virginia', baseDamage: 1, rotationSpeed: 0.035, reach: 70, scalingName: 'Pits', superThreshold: NO_SUPER });
        this.pitCount = 0;
        this.scalingStat.value = this.pitCount;
    }
    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        // Dig pit
        if (WB.Game && WB.Game.hazards) {
            this.pitCount++;
            WB.Game.hazards.push(new WB.Hazard({
                x: target.x, y: target.y, radius: Math.min(16, 10 + this.pitCount), damage: 1, tickRate: 90,
                lifespan: 300,
                color: '#444', owner: this.owner, ownerWeapon: this
            }));
        }
        this.applyScaling();
        this._onHitEffects(target, this.currentDamage, this.owner.color);
        WB.Audio.weaponHit(this.hitCount, this.type);
    }
    applyScaling() {
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount / 4);
        this.scalingStat.value = this.pitCount;
    }
    draw() {
        if (drawWeaponSprite(this, 'westvirginia-pickaxe')) return;
        var B = WB.GLBatch;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        var r = this.owner.radius;
        // Pickaxe handle
        B.fillRect(r, -2, this.reach - r - 10, 4, '#8B7355');
        // Pickaxe head — triangular
        B.fillTriangle(this.reach - 10, 0, this.reach, -8, this.reach, 8, '#666');
        B.line(this.reach - 10, 0, this.reach, -8, '#333', 1.5);
        B.line(this.reach - 10, 0, this.reach, 8, '#333', 1.5);
        B.popTransform();
    }
}
WB.WeaponRegistry.register('west-virginia', WestVirginiaWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  49. WISCONSIN — Projectile (cheese wheels). Bouncing.
//  2 bounces, 90% velocity retention. Walls leave sticky smears.
// ═══════════════════════════════════════════════════════════════
class WisconsinWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'wisconsin', baseDamage: 4, rotationSpeed: 0.04, reach: 50, scalingName: 'Wheels', superThreshold: NO_SUPER, isRanged: true });
        this.fireTimer = 0;
        this.fireRate = 120;
        this.wheelSize = 4;
        this.scalingStat.value = this.wheelSize;
    }
    update() {
        super.update();
        this.fireTimer++;
        if (this.fireTimer >= this.fireRate) { this.fireTimer = 0; this._fireWheel(); }
    }
    _fireWheel() {
        if (!WB.Game || !WB.Game.projectiles) return;
        var angle = this.angle;
        if (WB.Game.balls) {
            for (var i = 0; i < WB.Game.balls.length; i++) {
                var b = WB.Game.balls[i];
                if (b !== this.owner && b.isAlive && b.side !== this.owner.side) {
                    angle = Math.atan2(b.y - this.owner.y, b.x - this.owner.x); break;
                }
            }
        }
        WB.Game.projectiles.push(new WB.Projectile({
            x: this.owner.x + Math.cos(angle) * (this.owner.radius + 6),
            y: this.owner.y + Math.sin(angle) * (this.owner.radius + 6),
            vx: Math.cos(angle) * 6, vy: Math.sin(angle) * 6,
            damage: this.currentDamage, owner: this.owner, ownerWeapon: this,
            radius: this.wheelSize, lifespan: 120, bounces: 2, color: '#FFD700',
            damageFalloff: 0.1
        }));
        WB.Audio.projectileFire();
    }
    applyScaling() {
        this.wheelSize = 4 + Math.floor(this.hitCount * 0.25);
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount / 4);
        this.scalingStat.value = this.wheelSize;
    }
    onHit() {}
    draw() {
        var B = WB.GLBatch;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        B.fillRect(this.owner.radius, -2, 25, 4, '#8B7355');
        B.fillCircle(this.reach - 3, 0, this.wheelSize, '#FFD700');
        B.strokeCircle(this.reach - 3, 0, this.wheelSize, '#B8860B', 1);
        B.popTransform();
    }
}
WB.WeaponRegistry.register('wisconsin', WisconsinWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  50. WYOMING — Body slam (Yellowstone geysers). Weakest start.
//  0.8x speed/size/mass. Each hit triggers geyser (upward force).
//  +3% all base stats per hit. Periodic random geysers.
// ═══════════════════════════════════════════════════════════════
class WyomingWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'wyoming', baseDamage: 3, rotationSpeed: 0, reach: 0, scalingName: 'Geysers', superThreshold: NO_SUPER, canParry: false });
        this.owner.radius = Math.round(WB.Config.BALL_RADIUS * 0.9);
        this.owner.maxSpeed = WB.Config.BALL_MAX_SPEED * 0.9;
        this.owner.mass = (this.owner.radius / WB.Config.BALL_RADIUS) * WB.Config.BALL_MASS * 0.9;
        this.geyserTimer = 0;
        this.geyserForce = 3;
        this.contactCooldown = 0;
        this.contactCooldownTime = 88;
        this.contactAura = 2;
        this.scalingStat.value = this.geyserForce.toFixed(1);
    }
    update() {
        if (this.contactCooldown > 0) this.contactCooldown--;
        this.geyserTimer++;
        // Periodic random geysers every 3 seconds
        if (this.geyserTimer >= 180) {
            this.geyserTimer = 0;
            this._randomGeyser();
        }
    }
    _randomGeyser() {
        var a = WB.Config.ARENA;
        var gx = a.x + WB.random() * a.width;
        var gy = a.y + a.height; // bottom of arena
        // Push all balls upward near geyser — displacement only, no damage
        if (WB.Game && WB.Game.balls) {
            for (var i = 0; i < WB.Game.balls.length; i++) {
                var b = WB.Game.balls[i];
                if (!b.isAlive) continue;
                var dx = b.x - gx;
                if (Math.abs(dx) < 50) {
                    b.vy -= this.geyserForce;
                }
            }
        }
        if (WB.Game.particles) WB.Game.particles.emit(gx, gy - 10, 6, '#87CEEB');
    }
    canHit() { return this.contactCooldown <= 0; }
    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.contactCooldown = this.contactCooldownTime;
        // Trigger geyser at impact
        target.vy -= this.geyserForce;
        this.applyScaling();
        this._onHitEffects(target, this.currentDamage, this.owner.color);
        WB.Audio.weaponHit(this.hitCount, this.type);
        if (WB.Game.particles) WB.Game.particles.emit(target.x, target.y, 5, '#87CEEB');
    }
    applyScaling() {
        // No stat boost scaling — Wyoming stays small and relies on geyser disruption
        this.geyserForce = Math.min(5, 3 + this.hitCount * 0.15);
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.2);
        this.scalingStat.value = this.geyserForce.toFixed(1);
    }
    draw() {
        var B = WB.GLBatch;
        // Geyser timer indicator
        var progress = this.geyserTimer / 180;
        if (progress > 0.7) {
            B.setAlpha(0.15);
            B.strokeCircle(this.owner.x, this.owner.y, this.owner.radius + 5, '#87CEEB', 2);
            B.restoreAlpha();
        }
    }
}
WB.WeaponRegistry.register('wyoming', WyomingWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  TERRITORIES — placeholders (basic melee)
// ═══════════════════════════════════════════════════════════════
var TERRITORIES = ['dc','puerto-rico','guam','usvi','american-samoa','northern-mariana'];
for (var ti = 0; ti < TERRITORIES.length; ti++) {
    (function(key) {
        var TerritoryClass = class extends WB.Weapon {
            constructor(owner) {
                super(owner, { type: key, baseDamage: 3, rotationSpeed: 0.05, reach: 75, scalingName: 'Damage', superThreshold: NO_SUPER });
                this.scalingStat.value = this.baseDamage;
            }
            applyScaling() { this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.5); this.scalingStat.value = this.currentDamage; }
            draw() { drawMeleeWeapon(this, 'circle'); }
        };
        WB.WeaponRegistry.register(key, TerritoryClass, 'states');
    })(TERRITORIES[ti]);
}

})();
