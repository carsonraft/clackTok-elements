window.WB = window.WB || {};

// ─── US States & Territories Weapon Pack (Season 3) ─────────────
// 50 unique state weapons + 6 territory placeholders.
// Global rules: No supers. 100 HP. All damage whole numbers.
// Scaling IS the progression — superThreshold set to 9999.

(function() {
'use strict';
var NO_SUPER = 9999;

// ═══════════════════════════════════════════════════════════════
//  HELPER: Sprite draw for weapons that have PNG icons
//  Returns true if sprite was drawn, false if fallback needed.
//  Positions sprite between ball edge and weapon reach tip.
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
        super(owner, { type: 'alabama', baseDamage: 7, rotationSpeed: 0.04, reach: 50, scalingName: 'Thrust', superThreshold: NO_SUPER, isRanged: true });
        this.fireTimer = 0;
        this.fireRate = 120; // ~2 seconds
        this.rocketSpeed = 7;
        this.recoilStrength = 5; // how hard the ball kicks backward on fire
        this.scalingStat.value = this.recoilStrength;
    }
    update() {
        super.update();
        this.fireTimer++;
        if (this.fireTimer >= this.fireRate) { this.fireRocket(); this.fireTimer = 0; }
    }
    fireRocket() {
        if (!WB.Game || !WB.Game.projectiles) return;
        // Aim at enemy
        var angle = this.angle;
        if (WB.Game.balls) {
            for (var i = 0; i < WB.Game.balls.length; i++) {
                var b = WB.Game.balls[i];
                if (b !== this.owner && b.isAlive && b.side !== this.owner.side) {
                    angle = Math.atan2(b.y - this.owner.y, b.x - this.owner.x);
                    angle += (WB.random() - 0.5) * 0.15;
                    break;
                }
            }
        }
        // Fire rocket forward
        WB.Game.projectiles.push(new WB.Projectile({
            x: this.owner.x + Math.cos(angle) * (this.owner.radius + 8),
            y: this.owner.y + Math.sin(angle) * (this.owner.radius + 8),
            vx: Math.cos(angle) * this.rocketSpeed,
            vy: Math.sin(angle) * this.rocketSpeed,
            damage: Math.round(this.currentDamage), owner: this.owner, ownerWeapon: this,
            radius: 8, lifespan: 120, bounces: 0, color: '#990000',
            shape: 'sprite', spriteKey: 'alabama-rocket'
        }));
        // Recoil: push ball backward (opposite of fire direction)
        var recoilX = -Math.cos(angle) * this.recoilStrength;
        var recoilY = -Math.sin(angle) * this.recoilStrength;
        this.owner.vx += recoilX;
        this.owner.vy += recoilY;
        WB.Audio.projectileFire();
    }
    applyScaling() {
        this.rocketSpeed = Math.min(12, 7 + this.hitCount * 0.4);
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.6);
        this.recoilStrength = Math.min(9, 5 + this.hitCount * 0.4);
        this.scalingStat.value = Math.round(this.recoilStrength * 10) / 10;
    }
    onHit() {} // ranged only
    draw() {
        // No weapon visual — rockets fire from the ball, recoil is the feedback
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
        var B = WB.GLBatch;
        B.setAlpha(0.15);
        B.strokeCircle(this.owner.x, this.owner.y, this.owner.radius + 4, '#003366', 2);
        B.restoreAlpha();
        // Harpoon sprite overlay on the ball
        var S = WB.WeaponSprites;
        if (S && S.hasSprite('alaska-harpoon')) {
            B.flush();
            var size = this.owner.radius * 0.85;
            S.drawSprite('alaska-harpoon', this.owner.x, this.owner.y, 0, size, size, 0.9, 1.0);
        }
    }
}
WB.WeaponRegistry.register('alaska', AlaskaWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  3. ARIZONA — Flaming phoenix projectile. Burn DOT.
//  Fires phoenix that flies straight (no bounce, no homing). Inflicts burn.
//  Scaling: burn damage, fire rate, projectile speed.
// ═══════════════════════════════════════════════════════════════
class ArizonaWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'arizona', baseDamage: 6, rotationSpeed: 0.04, reach: 50, scalingName: 'Heat', superThreshold: NO_SUPER, isRanged: true, canParry: false });
        this.fireTimer = 0;
        this.fireRate = 80;
        this.phoenixSpeed = 9;
        this.burnDamage = 2;
        this.burnDuration = 120;
        this.scalingStat.value = this.burnDamage;
    }
    update() {
        super.update();
        this.fireTimer++;
        if (this.fireTimer >= this.fireRate) { this.fireTimer = 0; this._firePhoenix(); }
    }
    _firePhoenix() {
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
            vx: Math.cos(angle) * this.phoenixSpeed,
            vy: Math.sin(angle) * this.phoenixSpeed,
            damage: this.currentDamage, owner: this.owner, ownerWeapon: this,
            radius: 10, lifespan: 150, bounces: 0, color: '#FF6B35',
            shape: 'sprite', spriteKey: 'az-phoenix'
        }));
        WB.Audio.projectileFire();
    }
    onProjectileHit(proj, target) {
        // Burn DOT — reuses Apollo/NewMexico burn system in ball.js
        if (!target.debuffs.burn) target.debuffs.burn = [];
        if (target.debuffs.burn.length < 2) {
            target.debuffs.burn.push({
                damage: this.burnDamage,
                remaining: this.burnDuration,
                tickRate: 15,
                timer: 0
            });
        }
    }
    applyScaling() {
        this.burnDamage = 2 + Math.floor(this.hitCount * 0.3);
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.5);
        this.fireRate = Math.max(55, 80 - this.hitCount * 2);
        this.phoenixSpeed = Math.min(12, 9 + this.hitCount * 0.2);
        this.scalingStat.value = this.burnDamage;
    }
    onHit() {}
    draw() {
        if (drawWeaponSprite(this, 'az-phoenix')) return;
        // Procedural fallback — orange triangle
        var B = WB.GLBatch;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        var tip = this.reach;
        B.fillPolygon([tip, 0, tip - 12, -6, tip - 12, 6], '#FF6B35');
        B.popTransform();
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
                radius: 6, lifespan: 90, bounces: 0, color: '#A0522D',
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
        var B = WB.GLBatch;
        var S = WB.WeaponSprites;
        var ox = this.owner.x, oy = this.owner.y;
        var orbitR = this.owner.radius + 12;
        var spriteSize = 14;
        // Orbiting diamond sprites — number matches shardCount (1-4)
        for (var i = 0; i < this.shardCount; i++) {
            var da = this.angle + (i * Math.PI * 2 / this.shardCount);
            var dx = ox + Math.cos(da) * orbitR;
            var dy = oy + Math.sin(da) * orbitR;
            if (S && S.hasSprite('arkansas-shard')) {
                B.flush();
                S.drawSprite('arkansas-shard', dx, dy, da, spriteSize, spriteSize, 1.0, 1.0);
            } else {
                // Fallback: colored diamond
                B.fillTriangle(dx - 6, dy, dx, dy - 8, dx + 6, dy, '#A0522D');
                B.fillTriangle(dx - 6, dy, dx, dy + 8, dx + 6, dy, '#A0522D');
            }
        }
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
        // Big knockback on every hit — California earthquake blade
        var kbAngle = Math.atan2(target.y - this.owner.y, target.x - this.owner.x);
        var kbForce = 7 + this.seismicEnergy * 0.3; // scales with seismic energy
        target.vx += Math.cos(kbAngle) * kbForce;
        target.vy += Math.sin(kbAngle) * kbForce;
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
        // Custom big sword draw — square sprite, no distortion
        var S = WB.WeaponSprites;
        if (S && S.hasSprite('california-sword')) {
            WB.GLBatch.flush();
            var r = this.owner.radius;
            // Big square sprite — PNG is 128x128, keep aspect ratio 1:1
            var size = this.reach * 0.9;      // ~72px half-extent = 144px total
            var offset = r + size * 0.45;     // center the sprite so blade extends past ball edge
            var cx = this.owner.x + Math.cos(this.angle) * offset;
            var cy = this.owner.y + Math.sin(this.angle) * offset;
            S.drawSprite('california-sword', cx, cy, this.angle, size, size, 1.0, 1.0);
        } else {
            drawMeleeWeapon(this, 'rect');
        }
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
        var S = WB.WeaponSprites;
        if (S && S.hasSprite('colorado-boulder')) {
            B.flush();
            var size = this.owner.radius * 0.85;
            S.drawSprite('colorado-boulder', this.owner.x, this.owner.y, 0, size, size, 0.9, 1.0);
        }
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
        if (drawWeaponSprite(this, 'connecticut-briefcase')) return;
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
        // Shell sprite overlay
        var S = WB.WeaponSprites;
        if (S && S.hasSprite('delaware-shell')) {
            B.flush();
            var size = this.owner.radius * 0.85;
            S.drawSprite('delaware-shell', this.owner.x, this.owner.y, 0, size, size, 0.9, 1.0);
        }
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
//  9. FLORIDA — Projectile (whole gator throw)
//  Throws the entire gator at the enemy. No bounce — flies off
//  screen if it misses. Big damage, slow fire rate.
//  Scaling: gators (+1/3 hits), damage scales, speed increases.
// ═══════════════════════════════════════════════════════════════
class FloridaWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'florida', baseDamage: 8, rotationSpeed: 0.04, reach: 50, scalingName: 'Gators', superThreshold: NO_SUPER, isRanged: true });
        this.fireTimer = 0;
        this.fireRate = 120;
        this.gatorCount = 1;
        this.scalingStat.value = this.gatorCount;
    }
    update() {
        super.update();
        this.fireTimer++;
        if (this.fireTimer >= this.fireRate) { this.fireTimer = 0; this._throwGators(); }
    }
    _throwGators() {
        if (!WB.Game || !WB.Game.projectiles) return;
        // Aim at nearest enemy
        var baseAngle = this.angle;
        if (WB.Game.balls) {
            for (var i = 0; i < WB.Game.balls.length; i++) {
                var b = WB.Game.balls[i];
                if (b !== this.owner && b.isAlive && b.side !== this.owner.side) {
                    baseAngle = Math.atan2(b.y - this.owner.y, b.x - this.owner.x); break;
                }
            }
        }
        for (var k = 0; k < this.gatorCount; k++) {
            // Small spread for multi-gator volleys
            var a = baseAngle + (this.gatorCount > 1 ? (k - (this.gatorCount - 1) / 2) * 0.2 : 0);
            var spd = 5 + this.hitCount * 0.15;
            WB.Game.projectiles.push(new WB.Projectile({
                x: this.owner.x + Math.cos(a) * (this.owner.radius + 8),
                y: this.owner.y + Math.sin(a) * (this.owner.radius + 8),
                vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
                damage: this.currentDamage, owner: this.owner, ownerWeapon: this,
                radius: 12, lifespan: 200, bounces: 0, color: '#2E8B57',
                shape: 'sprite', spriteKey: 'florida-jaw'
            }));
        }
        WB.Audio.projectileFire();
        if (WB.Game.particles) WB.Game.particles.emit(this.owner.x, this.owner.y, 4, '#2E8B57');
    }
    onHit() {}
    applyScaling() {
        this.gatorCount = Math.min(4, 1 + Math.floor(this.hitCount / 3));
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.7);
        this.fireRate = Math.max(70, 120 - this.hitCount * 3);
        this.scalingStat.value = this.gatorCount;
    }
    draw() {
        if (drawWeaponSprite(this, 'florida-jaw')) return;
        var B = WB.GLBatch;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        var r = this.owner.radius;
        // Gator launcher arm
        B.fillRect(r, -3, 20, 6, '#2E8B57');
        B.strokeRect(r, -3, 20, 6, '#1B5E3A', 1);
        // Mini gator at tip
        var tx = this.reach - 2;
        B.fillRect(tx - 8, -5, 16, 10, '#2E8B57');
        B.strokeRect(tx - 8, -5, 16, 10, '#1B5E3A', 1.5);
        // Gator eye
        B.fillCircle(tx + 4, -3, 2, '#FFD700');
        B.fillCircle(tx + 4, -3, 1, '#222');
        // Gator teeth
        B.fillTriangle(tx + 7, -2, tx + 11, 0, tx + 7, 2, '#FFF');
        B.popTransform();
    }
}
WB.WeaponRegistry.register('florida', FloridaWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  10. GEORGIA — Melee (Coke bottle)
//  Swings a glass Coke bottle. On hit, fizz splash knocks back.
//  Scaling: fizz (+1/hit) → more knockback, bigger splash.
// ═══════════════════════════════════════════════════════════════
class GeorgiaWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'georgia', baseDamage: 6, rotationSpeed: 0.06, reach: 78, scalingName: 'Fizz', superThreshold: NO_SUPER });
        this.fizz = 0;
        this.knockback = 3;
        this.scalingStat.value = this.fizz;
    }
    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this._onHitEffects(target, this.currentDamage, this.owner.color);
        WB.Audio.weaponHit(this.hitCount, this.type);
        // Fizz knockback splash
        var dx = target.x - this.owner.x, dy = target.y - this.owner.y;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        target.vx += (dx / dist) * this.knockback;
        target.vy += (dy / dist) * this.knockback;
        if (WB.Game.particles) WB.Game.particles.explode(target.x, target.y, 5, '#8B4513');
    }
    applyScaling() {
        this.fizz++;
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.5);
        this.knockback = Math.min(7, 3 + this.fizz * 0.3);
        this.scalingStat.value = this.fizz;
    }
    draw() {
        if (drawWeaponSprite(this, 'georgia-fizz')) return;
        var B = WB.GLBatch;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        var r = this.owner.radius;
        // Bottle body — tapered shape
        B.fillRect(r, -4, this.reach - r - 12, 8, '#2D5A27');
        B.strokeRect(r, -4, this.reach - r - 12, 8, '#1A3A16', 1.5);
        // Bottle neck
        B.fillRect(this.reach - 14, -2.5, 12, 5, '#2D5A27');
        B.strokeRect(this.reach - 14, -2.5, 12, 5, '#1A3A16', 1);
        // Cap
        B.fillRect(this.reach - 3, -3, 4, 6, '#C0C0C0');
        // Label
        B.fillRect(r + 8, -3, 14, 6, '#CC0000');
        B.popTransform();
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
        // Lava sprite on ball
        var S = WB.WeaponSprites;
        if (S && S.hasSprite('hawaii-lava')) {
            B.flush();
            var size = this.owner.radius * 0.9;
            S.drawSprite('hawaii-lava', this.owner.x, this.owner.y, 0, size, size, 0.85, 1.0);
        }
    }
}
WB.WeaponRegistry.register('hawaii', HawaiiWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  12. IDAHO — Projectile (popcorn kernels that POP)
//  Fires golden kernels that travel ~35 frames then "pop" into
//  a burst of 3-4 white popcorn pieces that scatter in all
//  directions. Kernel does low damage; popcorn pieces do more.
//  Scaling: +kernels per volley, +popcorn pieces per pop.
// ═══════════════════════════════════════════════════════════════
class IdahoWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'idaho', baseDamage: 2, rotationSpeed: 0.04, reach: 50, scalingName: 'Kernels', superThreshold: NO_SUPER, isRanged: true });
        this.fireTimer = 0;
        this.fireRate = 110;
        this.kernelCount = 1;
        this.popPieces = 3;
        this.popTime = 35; // frames before kernel pops
        this._kernels = []; // track live kernels for pop timing
        this.scalingStat.value = this.kernelCount;
    }
    update() {
        super.update();
        this.fireTimer++;
        if (this.fireTimer >= this.fireRate) { this.fireTimer = 0; this._fireKernels(); }
        // Check kernels for pop timing
        for (var i = this._kernels.length - 1; i >= 0; i--) {
            var k = this._kernels[i];
            if (!k.alive) { this._kernels[i] = this._kernels[this._kernels.length - 1]; this._kernels.pop(); continue; }
            if (k._age >= this.popTime) {
                this._popKernel(k);
                k.alive = false;
                this._kernels[i] = this._kernels[this._kernels.length - 1]; this._kernels.pop();
            }
        }
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
            var spd = 5 + this.hitCount * 0.15;
            var kernel = new WB.Projectile({
                x: this.owner.x + Math.cos(a) * (this.owner.radius + 5),
                y: this.owner.y + Math.sin(a) * (this.owner.radius + 5),
                vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
                damage: this.currentDamage, owner: this.owner, ownerWeapon: this,
                radius: 4, lifespan: 120, bounces: 0, color: '#C5A253',
                shape: 'sprite', spriteKey: 'idaho-kernel'
            });
            WB.Game.projectiles.push(kernel);
            this._kernels.push(kernel);
        }
        WB.Audio.projectileFire();
    }
    _popKernel(kernel) {
        // Kernel pops into scattered popcorn pieces
        if (!WB.Game || !WB.Game.projectiles) return;
        var popDmg = this.currentDamage + 1;
        for (var p = 0; p < this.popPieces; p++) {
            var a = (p / this.popPieces) * Math.PI * 2 + WB.random() * 0.5;
            var spd = 3 + WB.random() * 3;
            WB.Game.projectiles.push(new WB.Projectile({
                x: kernel.x, y: kernel.y,
                vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
                damage: popDmg, owner: this.owner, ownerWeapon: this,
                radius: 5, lifespan: 60, bounces: 1, color: '#FFFFF0',
                shape: 'sprite', spriteKey: 'idaho-popcorn'
            }));
        }
        if (WB.Game.particles) WB.Game.particles.explode(kernel.x, kernel.y, 6, '#FFFFF0');
        WB.Audio.projectileFire();
    }
    applyScaling() {
        this.kernelCount = Math.min(4, 1 + Math.floor(this.hitCount / 4));
        this.popPieces = Math.min(6, 3 + Math.floor(this.hitCount / 5));
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount / 4);
        this.scalingStat.value = this.kernelCount;
    }
    onHit() {}
    draw() {
        if (drawWeaponSprite(this, 'idaho-kernel')) return;
        var B = WB.GLBatch;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        B.fillRect(this.owner.radius, -3, 25, 6, '#8B7355');
        // Kernel at tip
        B.fillCircle(this.reach - 2, 0, 5, '#C5A253');
        B.strokeCircle(this.reach - 2, 0, 5, '#8B6914', 1);
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
        // Tire sprite overlay
        var S = WB.WeaponSprites;
        if (S && S.hasSprite('indiana-tire')) {
            B.flush();
            var size = this.owner.radius * 0.85;
            S.drawSprite('indiana-tire', this.owner.x, this.owner.y, 0, size, size, 0.9, 1.0);
        }
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
//  18. LOUISIANA — Mardi Gras clone spawner.
//  Spawns mask-wearing clones. Clones take damage from enemies.
//  When destroyed, clones explode into bead projectiles (1 dmg each).
//  Bead count scales with hits. No contact damage from ball or clones.
// ═══════════════════════════════════════════════════════════════
class LouisianaWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'louisiana', baseDamage: 0, rotationSpeed: 0, reach: 0, scalingName: 'Beads', superThreshold: NO_SUPER, isRanged: true, canParry: false });
        this._clones = [];
        this._cloneTimer = 0;
        this._cloneRate = 130;
        this._maxClones = 3;
        this._beadCount = 3;
        this._maskCycle = 0;
        this._masks = ['la-mask1', 'la-mask2', 'la-mask3', 'la-mask4'];
        this._beads = ['la-bead-purple', 'la-bead-gold', 'la-bead-green'];
        this.scalingStat.value = this._beadCount;
    }
    update() {
        // Spawn timer
        this._cloneTimer++;
        if (this._cloneTimer >= this._cloneRate && this._clones.length < this._maxClones) {
            this._cloneTimer = 0;
            this._spawnClone();
        }
        // Process clones — check if enemy balls touch them
        if (!WB.Game || !WB.Game.balls) return;
        for (var c = this._clones.length - 1; c >= 0; c--) {
            var clone = this._clones[c];
            if (clone.hitCooldown > 0) clone.hitCooldown--;
            clone.angle += 0.01;
            for (var i = 0; i < WB.Game.balls.length; i++) {
                var ball = WB.Game.balls[i];
                if (ball === this.owner || !ball.isAlive || ball.side === this.owner.side) continue;
                if (clone.hitCooldown > 0) continue;
                var dx = ball.x - clone.x, dy = ball.y - clone.y;
                var dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < clone.radius + ball.radius) {
                    clone.hp -= 1;
                    clone.hitCooldown = 20;
                    if (WB.GLEffects) WB.GLEffects.spawnImpact(clone.x, clone.y, '#FFD700', 15);
                    if (clone.hp <= 0) {
                        this._explodeClone(clone);
                        this._clones.splice(c, 1);
                        break;
                    }
                }
            }
        }
    }
    _spawnClone() {
        var a = WB.Config.ARENA;
        var margin = 30;
        var cx = a.x + margin + WB.random() * (a.width - margin * 2);
        var cy = a.y + margin + WB.random() * (a.height - margin * 2);
        var maskKey = this._masks[this._maskCycle % 4];
        this._maskCycle++;
        this._clones.push({
            x: cx, y: cy, hp: 5, maxHp: 5, radius: 20,
            spriteKey: maskKey, angle: WB.random() * Math.PI * 2,
            hitCooldown: 0
        });
        if (WB.Game.particles) WB.Game.particles.emit(cx, cy, 5, '#FFD700');
        WB.Audio.projectileFire();
    }
    _explodeClone(clone) {
        if (!WB.Game || !WB.Game.projectiles) return;
        var beadCount = this._beadCount;
        for (var i = 0; i < beadCount; i++) {
            var a = (i / beadCount) * Math.PI * 2 + WB.random() * 0.3;
            var beadKey = this._beads[i % 3];
            WB.Game.projectiles.push(new WB.Projectile({
                x: clone.x, y: clone.y,
                vx: Math.cos(a) * 6, vy: Math.sin(a) * 6,
                damage: 1, owner: this.owner, ownerWeapon: this,
                radius: 5, lifespan: 80, bounces: 1, color: '#FFD700',
                shape: 'sprite', spriteKey: beadKey
            }));
        }
        if (WB.Game.particles) WB.Game.particles.explode(clone.x, clone.y, 8, '#FFD700');
        WB.Audio.projectileFire();
    }
    canHit() { return false; }
    onHit() {}
    applyScaling() {
        this._beadCount = Math.min(8, 3 + Math.floor(this.hitCount / 2));
        this._cloneRate = Math.max(80, 130 - this.hitCount * 3);
        this._maxClones = Math.min(5, 3 + Math.floor(this.hitCount / 5));
        this.scalingStat.value = this._beadCount;
    }
    draw() {
        var S = WB.WeaponSprites;
        var B = WB.GLBatch;
        // Draw active clones
        for (var i = 0; i < this._clones.length; i++) {
            var clone = this._clones[i];
            if (S && S.hasSprite(clone.spriteKey)) {
                B.flush();
                S.drawSprite(clone.spriteKey, clone.x, clone.y, clone.angle,
                    clone.radius * 1.3, clone.radius * 1.3, 0.9, 1.0);
            } else {
                B.setAlpha(0.7);
                B.fillCircle(clone.x, clone.y, clone.radius, '#9B59B6');
                B.restoreAlpha();
            }
            // HP indicator bar above damaged clones
            if (clone.hp < clone.maxHp) {
                var barW = clone.radius * 1.5;
                var hpRatio = clone.hp / clone.maxHp;
                B.fillRect(clone.x - barW / 2, clone.y - clone.radius - 6, barW * hpRatio, 3, '#4ade80');
                B.strokeRect(clone.x - barW / 2, clone.y - clone.radius - 6, barW, 3, '#222', 1);
            }
        }
        // Faint mask overlay on owner ball
        if (S && S.hasSprite('la-mask1')) {
            B.flush();
            var r = this.owner.radius * 0.85;
            S.drawSprite('la-mask1', this.owner.x, this.owner.y, 0, r, r, 0.6, 1.0);
        }
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
        this.clawSize = 8;
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
        this.clawSize = 8 + Math.floor(this.hitCount * 0.4);
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount / 3);
        this.scalingStat.value = this.clawSize;
    }
    onHit() {}
    draw() {
        var B = WB.GLBatch;
        var S = WB.WeaponSprites;
        var ox = this.owner.x, oy = this.owner.y;
        var orbitR = this.owner.radius + 14;
        var spriteSize = Math.max(18, this.clawSize * 2);
        // Orbiting lobster sprite
        var da = this.angle;
        var dx = ox + Math.cos(da) * orbitR;
        var dy = oy + Math.sin(da) * orbitR;
        if (S && S.hasSprite('maine-claw')) {
            B.flush();
            S.drawSprite('maine-claw', dx, dy, da, spriteSize, spriteSize, 1.0, 1.0);
        } else {
            // Fallback: red claw shape
            B.fillTriangle(dx - 5, dy - 6, dx + 7, dy, dx - 5, dy + 6, '#CC0000');
        }
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
//  21. MASSACHUSETTS — Magic hex hazard spawner
//  Places hex zones at weapon tip. Enemies take damage passing through.
//  Scaling: fire rate decreases, hex radius grows, hex damage grows.
// ═══════════════════════════════════════════════════════════════
class MassachusettsWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'massachusetts', baseDamage: 2, rotationSpeed: 0.04, reach: 50, scalingName: 'Hexes', superThreshold: NO_SUPER, isRanged: true, canParry: false });
        this.fireTimer = 0;
        this.fireRate = 120;
        this.hexRadius = 28;
        this.hexDamage = 2;
        this.hexTickRate = 45;
        this.hexLifespan = 360;
        this.hexesPlaced = 0;
        this.scalingStat.value = this.hexesPlaced;
    }
    update() {
        super.update();
        this.fireTimer++;
        if (this.fireTimer >= this.fireRate) { this.fireTimer = 0; this._placeHex(); }
    }
    _placeHex() {
        if (!WB.Game || !WB.Game.hazards) return;
        // Place hex at weapon tip position
        var hx = this.owner.x + Math.cos(this.angle) * this.reach;
        var hy = this.owner.y + Math.sin(this.angle) * this.reach;
        WB.Game.hazards.push(new WB.Hazard({
            x: hx, y: hy,
            radius: this.hexRadius,
            damage: this.hexDamage,
            tickRate: this.hexTickRate,
            lifespan: this.hexLifespan,
            color: '#6B3FA0',
            owner: this.owner,
            ownerWeapon: this,
            spriteKey: 'massachusetts-hex'
        }));
        this.hexesPlaced++;
        this.scalingStat.value = this.hexesPlaced;
        if (WB.Game.particles) WB.Game.particles.emit(hx, hy, 6, '#6B3FA0');
        WB.Audio.projectileFire();
    }
    applyScaling() {
        this.fireRate = Math.max(50, 120 - Math.floor(this.hitCount * 5));
        this.hexRadius = 28 + this.hitCount * 0.5;
        this.hexDamage = 2 + Math.floor(this.hitCount / 4);
        this.currentDamage = this.hexDamage;
        this.scalingStat.value = this.hexesPlaced;
    }
    onHit() {}
    draw() {
        var S = WB.WeaponSprites;
        if (S && S.hasSprite('massachusetts-hex')) {
            WB.GLBatch.flush();
            var size = this.owner.radius * 0.85;
            var rot = Date.now() * 0.002;
            S.drawSprite('massachusetts-hex', this.owner.x, this.owner.y, rot, size, size, 0.8, 1.0);
        } else {
            var B = WB.GLBatch;
            var t = Date.now() * 0.003;
            var r = 8;
            B.setAlpha(0.5);
            for (var i = 0; i < 6; i++) {
                var a1 = t + i * Math.PI / 3;
                var a2 = t + (i + 1) * Math.PI / 3;
                B.line(
                    this.owner.x + Math.cos(a1) * r, this.owner.y + Math.sin(a1) * r,
                    this.owner.x + Math.cos(a2) * r, this.owner.y + Math.sin(a2) * r,
                    '#6B3FA0', 2
                );
            }
            B.restoreAlpha();
        }
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
            radius: 6, lifespan: 90, bounces: 2, color: '#222',
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
        var B = WB.GLBatch;
        var S = WB.WeaponSprites;
        var ox = this.owner.x, oy = this.owner.y;
        var spriteSize = 18 + this.antlerPoints * 2;
        var spread = 0.5; // angle offset from weapon direction
        // Two antler racks — left and right of weapon heading
        if (S && S.hasSprite('montana-antler')) {
            var dist = this.owner.radius + spriteSize * 0.35;
            // Left antler
            var aL = this.angle - spread;
            B.flush();
            S.drawSprite('montana-antler', ox + Math.cos(aL) * dist, oy + Math.sin(aL) * dist, this.angle - 0.3, spriteSize, spriteSize, 1.0, 1.0);
            // Right antler (mirrored vertically via negative Y scale)
            var aR = this.angle + spread;
            B.flush();
            S.drawSprite('montana-antler', ox + Math.cos(aR) * dist, oy + Math.sin(aR) * dist, this.angle + 0.3, spriteSize, -spriteSize, 1.0, 1.0);
        } else {
            // Fallback: branching lines
            var r = this.owner.radius;
            for (var p = 0; p < Math.min(this.antlerPoints, 8); p++) {
                var branchAngle = this.angle + (p - this.antlerPoints / 2) * 0.15;
                var branchLen = this.reach * (0.7 + p * 0.04);
                B.pushTransform(ox, oy, branchAngle);
                B.fillRect(r, -1.5, branchLen - r - 4, 3, '#CD853F');
                B.fillCircle(branchLen - 2, 0, 3, '#FFF8DC');
                B.popTransform();
            }
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
        // Horns sprite — faces charge direction
        var S = WB.WeaponSprites;
        if (S && S.hasSprite('nebraska-horns')) {
            B.flush();
            var hornAngle = this.charging ? this.chargeAngle : Math.atan2(this.owner.vy, this.owner.vx);
            var size = this.owner.radius * 0.9;
            S.drawSprite('nebraska-horns', this.owner.x, this.owner.y, hornAngle, size, size, 1.0, 1.0);
        }
        // Charge trail
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
//  29. NEW HAMPSHIRE — Boulder projectile. Huge knockback.
//  Throws granite boulders that slam enemies away. Big scaling.
// ═══════════════════════════════════════════════════════════════
class NewHampshireWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'new-hampshire', baseDamage: 8, rotationSpeed: 0.04, reach: 50, scalingName: 'Force', superThreshold: NO_SUPER, isRanged: true, canParry: false });
        this.fireTimer = 0;
        this.fireRate = 90;
        this.boulderSpeed = 5;
        this.boulderKnockback = 7;
        this.scalingStat.value = this.boulderKnockback;
    }
    update() {
        super.update();
        this.fireTimer++;
        if (this.fireTimer >= this.fireRate) { this.fireTimer = 0; this._fireBoulder(); }
    }
    _fireBoulder() {
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
            x: this.owner.x + Math.cos(angle) * (this.owner.radius + 10),
            y: this.owner.y + Math.sin(angle) * (this.owner.radius + 10),
            vx: Math.cos(angle) * this.boulderSpeed,
            vy: Math.sin(angle) * this.boulderSpeed,
            damage: this.currentDamage, owner: this.owner, ownerWeapon: this,
            radius: 12, lifespan: 120, bounces: 0, color: '#808080',
            shape: 'sprite', spriteKey: 'nh-boulder'
        }));
        WB.Audio.projectileFire();
    }
    onProjectileHit(proj, target) {
        // Massive knockback — slam target away from boulder direction
        var angle = Math.atan2(target.y - proj.y, target.x - proj.x);
        target.vx += Math.cos(angle) * this.boulderKnockback;
        target.vy += Math.sin(angle) * this.boulderKnockback;
    }
    applyScaling() {
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.8);
        this.boulderKnockback = Math.min(12, 7 + this.hitCount * 0.4);
        this.boulderSpeed = Math.min(8, 5 + this.hitCount * 0.2);
        this.fireRate = Math.max(65, 90 - this.hitCount * 2);
        this.scalingStat.value = Math.round(this.boulderKnockback);
    }
    onHit() {}
    draw() {
        if (drawWeaponSprite(this, 'nh-boulder')) return;
        var B = WB.GLBatch;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        B.fillCircle(this.reach - 6, 0, 10, '#808080');
        B.strokeCircle(this.reach - 6, 0, 10, '#555', 2);
        B.popTransform();
    }
}
WB.WeaponRegistry.register('new-hampshire', NewHampshireWeapon, 'states');

// ═══════════════════════════════════════════════════════════════
//  30. NEW JERSEY — Projectile (pills)
//  Throws pills in random directions at intervals. Pills do scaling
//  damage AND heal NJ on hit. More pills per volley as hits scale.
// ═══════════════════════════════════════════════════════════════
class NewJerseyWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'new-jersey', baseDamage: 3, rotationSpeed: 0.04, reach: 50, scalingName: 'Scripts', superThreshold: NO_SUPER, isRanged: true });
        this.fireTimer = 0;
        this.fireRate = 90;
        this.pillCount = 1;
        this.healPerHit = 2;
        this.scalingStat.value = this.pillCount;
    }
    update() {
        super.update();
        this.fireTimer++;
        if (this.fireTimer >= this.fireRate) { this.fireTimer = 0; this._throwPills(); }
    }
    _throwPills() {
        if (!WB.Game || !WB.Game.projectiles) return;
        for (var k = 0; k < this.pillCount; k++) {
            // Random direction — pills scatter chaotically
            var a = WB.random() * Math.PI * 2;
            var spd = 5 + WB.random() * 3;
            var colors = ['#FF4444', '#4488FF', '#44CC44', '#FFAA00', '#CC44CC'];
            var pillColor = colors[Math.floor(WB.random() * colors.length)];
            WB.Game.projectiles.push(new WB.Projectile({
                x: this.owner.x + Math.cos(a) * (this.owner.radius + 5),
                y: this.owner.y + Math.sin(a) * (this.owner.radius + 5),
                vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
                damage: this.currentDamage, owner: this.owner, ownerWeapon: this,
                radius: 6, lifespan: 100, bounces: 1, color: pillColor,
                shape: 'sprite', spriteKey: 'newjersey-pill'
            }));
        }
        WB.Audio.projectileFire();
    }
    onProjectileHit(proj, target) {
        // Heal NJ on each pill hit
        this.owner.hp = Math.min(this.owner.maxHp, this.owner.hp + this.healPerHit);
        if (WB.GLEffects) WB.GLEffects.spawnDamageNumber(this.owner.x, this.owner.y - 15, '+' + this.healPerHit, '#44FF44');
    }
    onHit() {}
    applyScaling() {
        this.pillCount = Math.min(5, 1 + Math.floor(this.hitCount / 3));
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.5);
        this.healPerHit = Math.min(5, 2 + Math.floor(this.hitCount / 4));
        this.fireRate = Math.max(55, 90 - this.hitCount * 2);
        this.scalingStat.value = this.pillCount;
    }
    draw() {
        if (drawWeaponSprite(this, 'newjersey-pill')) return;
        var B = WB.GLBatch;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        // Pill dispenser arm
        B.fillRect(this.owner.radius, -3, 22, 6, '#888');
        B.strokeRect(this.owner.radius, -3, 22, 6, '#555', 1);
        // Pill at tip — capsule shape
        var tx = this.reach - 4;
        B.fillCircle(tx - 4, 0, 4, '#FF4444');
        B.fillCircle(tx + 4, 0, 4, '#FFFFFF');
        B.fillRect(tx - 4, -4, 8, 8, '#FF8888');
        B.popTransform();
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
            radius: 9, lifespan: 100, bounces: 0, color: chileColor,
            shape: 'sprite', spriteKey: 'newmexico-chile'
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
        // Chile sprite overlay
        var S = WB.WeaponSprites;
        if (S && S.hasSprite('newmexico-chile')) {
            B.flush();
            var size = this.owner.radius * 0.85;
            S.drawSprite('newmexico-chile', this.owner.x, this.owner.y, 0, size, size, 0.9, 1.0);
        }
        // Heat level indicator ring on ball
        if (this.heatLevel > 0) {
            var heatColor = this.heatLevel < 3 ? '#228B22' : this.heatLevel < 8 ? '#FF4500' : '#FFFFFF';
            B.setAlpha(0.2 + this.heatLevel * 0.03);
            B.strokeCircle(this.owner.x, this.owner.y, this.owner.radius + 4, heatColor, 2);
            B.restoreAlpha();
        }
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
            radius: 8, lifespan: 100, bounces: 1, color: '#FFD700',
            shape: 'sprite', spriteKey: 'newyork-dart',
            onMiss: function(x, y) {
                // Skyscraper grows at wall where dart lands
                if (WB.Game && WB.Game.hazards) {
                    var a = WB.Config.ARENA;
                    var bldgR = 25;
                    var bx = x, by = y, bAngle = 0;
                    // Snap to nearest wall and orient building base toward it
                    var dLeft = x - a.x, dRight = (a.x + a.width) - x;
                    var dTop = y - a.y, dBot = (a.y + a.height) - y;
                    var minD = Math.min(dLeft, dRight, dTop, dBot);
                    if (minD === dLeft) { bx = a.x + bldgR; bAngle = Math.PI / 2; }
                    else if (minD === dRight) { bx = a.x + a.width - bldgR; bAngle = -Math.PI / 2; }
                    else if (minD === dTop) { by = a.y + bldgR; bAngle = Math.PI; }
                    else { by = a.y + a.height - bldgR; bAngle = 0; }
                    WB.Game.hazards.push(new WB.Hazard({
                        x: bx, y: by, radius: bldgR, damage: 1, tickRate: 45,
                        lifespan: 300, color: '#B8860B',
                        owner: self.owner, ownerWeapon: self,
                        spriteKey: 'newyork-terrain',
                        _wallAngle: bAngle
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
        if (drawWeaponSprite(this, 'newyork-dart')) return;
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
        var B = WB.GLBatch;
        var S = WB.WeaponSprites;
        if (S && S.hasSprite('northcarolina-prop')) {
            B.flush();
            var size = this.owner.radius * 0.85;
            S.drawSprite('northcarolina-prop', this.owner.x, this.owner.y, 0, size, size, 0.9, 1.0);
        }
        if (this.gliding) {
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
        this.globSize = 7;
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
            gravityAffected: true, shape: 'sprite', spriteKey: 'northdakota-oil',
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
        this.globSize = 7 + Math.floor(this.hitCount * 0.2);
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount / 4);
        this.scalingStat.value = this.slickCount;
    }
    onHit() {}
    draw() {
        if (drawWeaponSprite(this, 'northdakota-oil')) return;
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
//  36. OKLAHOMA — Projectile (turbine blade shurikens). Tornado chance.
//  Throws spinning turbine blades. Cumulative tornado chance per hit.
//  Tornado pulls both balls. Blades orbit ball between throws.
// ═══════════════════════════════════════════════════════════════
class OklahomaWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'oklahoma', baseDamage: 4, rotationSpeed: 0.04, reach: 50, scalingName: 'Tornado%', superThreshold: NO_SUPER, isRanged: true });
        this.fireTimer = 0;
        this.fireRate = 100;
        this.bladeCount = 3;
        this.tornadoChance = 0.10;
        this.scalingStat.value = Math.round(this.tornadoChance * 100) + '%';
    }
    update() {
        super.update();
        this.fireTimer++;
        if (this.fireTimer >= this.fireRate) { this.fireTimer = 0; this._fireBlade(); }
    }
    _fireBlade() {
        if (!WB.Game || !WB.Game.projectiles) return;
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
            vx: Math.cos(angle) * 6, vy: Math.sin(angle) * 6,
            damage: this.currentDamage, owner: this.owner, ownerWeapon: this,
            radius: 7, lifespan: 110, bounces: 0, color: '#7B1113',
            shape: 'sprite', spriteKey: 'oklahoma-turbine'
        }));
        WB.Audio.projectileFire();
    }
    onProjectileHit(proj, target) {
        // Tornado check on hit
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
        // Pull enemy balls toward tornado
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
    onHit() {} // ranged only
    draw() {
        var B = WB.GLBatch;
        var S = WB.WeaponSprites;
        var ox = this.owner.x, oy = this.owner.y;
        var orbitR = this.owner.radius + 14;
        var spriteSize = 16;
        // Orbiting turbine blades
        for (var i = 0; i < this.bladeCount; i++) {
            var da = this.angle * 2 + (i * Math.PI * 2 / this.bladeCount);
            var dx = ox + Math.cos(da) * orbitR;
            var dy = oy + Math.sin(da) * orbitR;
            if (S && S.hasSprite('oklahoma-turbine')) {
                B.flush();
                S.drawSprite('oklahoma-turbine', dx, dy, da * 3, spriteSize, spriteSize, 0.85, 1.0);
            } else {
                // Fallback: spinning star
                var pts = [];
                for (var j = 0; j < 6; j++) {
                    var a2 = da * 3 + (j / 6) * Math.PI * 2;
                    var dist = (j % 2 === 0) ? 6 : 3;
                    pts.push(dx + Math.cos(a2) * dist);
                    pts.push(dy + Math.sin(a2) * dist);
                }
                B.fillPolygon(pts, '#7B1113');
            }
        }
    }
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
//  41. SOUTH DAKOTA — Melee (chisel). Presidential bust hazards.
//  Each hit drops a bust at impact. Cycles through presidents:
//  Washington(1dmg), Jefferson(2), Roosevelt(3), Lincoln(4).
// ═══════════════════════════════════════════════════════════════
class SouthDakotaWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'south-dakota', baseDamage: 5, rotationSpeed: 0.055, reach: 72, scalingName: 'Busts', superThreshold: NO_SUPER });
        // Cycle through presidents: Washington(1), Jefferson(2), Roosevelt(3), Lincoln(4)
        this._presidents = [
            { name: 'Washington', damage: 1, color: '#B8B0A0', spriteKey: 'southdakota-washington' },
            { name: 'Jefferson',  damage: 2, color: '#A89888', spriteKey: 'southdakota-jefferson' },
            { name: 'Roosevelt',  damage: 3, color: '#988878', spriteKey: 'southdakota-roosevelt' },
            { name: 'Lincoln',    damage: 4, color: '#887868', spriteKey: 'southdakota-lincoln' }
        ];
        this._nextPres = 0;
        this.bustCount = 0;
        this.bustLifespan = 300; // ~5 seconds
        this.scalingStat.value = this.bustCount;
    }
    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this._onHitEffects(target, this.currentDamage, this.owner.color);
        WB.Audio.weaponHit(this.hitCount, this.type);
        // Drop a presidential bust hazard at the hit location
        this._dropBust(target.x, target.y);
    }
    _dropBust(x, y) {
        if (!WB.Game || !WB.Game.hazards) return;
        var pres = this._presidents[this._nextPres];
        this._nextPres = (this._nextPres + 1) % 4;
        this.bustCount++;
        WB.Game.hazards.push(new WB.Hazard({
            x: x, y: y,
            radius: 18,
            damage: pres.damage,
            tickRate: 30,
            lifespan: this.bustLifespan,
            color: pres.color,
            owner: this.owner,
            ownerWeapon: this,
            spriteKey: pres.spriteKey
        }));
        this.scalingStat.value = this.bustCount;
    }
    applyScaling() {
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.4);
        this.bustLifespan = Math.min(480, 300 + this.hitCount * 10);
    }
    draw() {
        var B = WB.GLBatch;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        var r = this.owner.radius;
        // Chisel arm
        B.fillRect(r, -2, this.reach - r - 10, 4, '#8B7355');
        B.strokeRect(r, -2, this.reach - r - 10, 4, '#5C4A32', 1);
        // Chisel tip
        B.fillTriangle(this.reach - 10, -4, this.reach, 0, this.reach - 10, 4, '#C0C0C0');
        B.strokeRect(this.reach - 10, -4, 10, 8, '#888', 0.5);
        B.popTransform();
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
        // Banjo sprite overlay
        var S = WB.WeaponSprites;
        if (S && S.hasSprite('tennessee-banjo')) {
            B.flush();
            var size = this.owner.radius * 0.85;
            S.drawSprite('tennessee-banjo', this.owner.x, this.owner.y, 0, size, size, 0.9, 1.0);
        }
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
//  45. VERMONT — Broken syrup bottle. 1 dmg/tick + slow.
//  Throws bottle projectiles that shatter into sticky hazard zones on miss.
//  Direct hits also apply slow. Scaling: fire rate, hazard duration.
// ═══════════════════════════════════════════════════════════════
class VermontWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'vermont', baseDamage: 3, rotationSpeed: 0.04, reach: 50, scalingName: 'Spills', superThreshold: NO_SUPER, isRanged: true });
        this.fireTimer = 0;
        this.fireRate = 100;
        this.hazardLifespan = 240;
        this.spillCount = 0;
        this.scalingStat.value = this.spillCount;
    }
    update() {
        super.update();
        this.fireTimer++;
        if (this.fireTimer >= this.fireRate) { this.fireTimer = 0; this._fireBottle(); }
    }
    _fireBottle() {
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
            radius: 8, lifespan: 120, bounces: 0, color: '#8B6914',
            gravityAffected: true, shape: 'sprite', spriteKey: 'vt-broken-bottle',
            onMiss: function(x, y) {
                // Shatter into sticky hazard zone
                if (WB.Game && WB.Game.hazards) {
                    self.spillCount++;
                    WB.Game.hazards.push(new WB.Hazard({
                        x: x, y: y, radius: 25, damage: 1, tickRate: 20,
                        lifespan: self.hazardLifespan,
                        color: '#8B6914', owner: self.owner, ownerWeapon: self,
                        spriteKey: 'vt-broken-bottle'
                    }));
                    if (WB.Game.particles) WB.Game.particles.emit(x, y, 5, '#8B6914');
                }
            }
        }));
        WB.Audio.projectileFire();
    }
    onProjectileHit(proj, target) {
        // Direct hit applies slow debuff (reuses Poseidon slow system in ball.js)
        target.debuffs.slowFactor = 0.35;
        target.debuffs.slowTimer = Math.max(target.debuffs.slowTimer || 0, 75);
        this.spillCount++;
    }
    applyScaling() {
        this.fireRate = Math.max(60, 100 - Math.floor(this.hitCount * 3));
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount / 3);
        this.hazardLifespan = Math.min(360, 240 + this.hitCount * 10);
        this.scalingStat.value = this.spillCount;
    }
    onHit() {}
    draw() {
        if (drawWeaponSprite(this, 'vt-broken-bottle')) return;
        var B = WB.GLBatch;
        B.pushTransform(this.owner.x, this.owner.y, this.angle);
        B.fillRect(this.owner.radius, -2, 20, 4, '#5C3317');
        B.fillCircle(this.reach - 3, 0, 8, '#8B6914');
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
        super(owner, { type: 'washington', baseDamage: 2, rotationSpeed: 0.04, reach: 50, scalingName: 'Beans', superThreshold: NO_SUPER, isRanged: true });
        this.fireTimer = 0;
        this.fireRate = 65;
        this.beanCount = 4;
        this.scalingStat.value = this.beanCount;
    }
    update() {
        super.update();
        this.fireTimer++;
        if (this.fireTimer >= this.fireRate) { this.fireTimer = 0; this._fireBeans(); }
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
        // Volley of beans — spray pattern
        var spreadAngle = 0.5;
        for (var n = 0; n < this.beanCount; n++) {
            var beanAngle = angle + (WB.random() - 0.5) * spreadAngle;
            var speed = 5.5 + WB.random() * 2.5;
            WB.Game.projectiles.push(new WB.Projectile({
                x: this.owner.x + Math.cos(beanAngle) * (this.owner.radius + 5),
                y: this.owner.y + Math.sin(beanAngle) * (this.owner.radius + 5),
                vx: Math.cos(beanAngle) * speed, vy: Math.sin(beanAngle) * speed,
                damage: this.currentDamage, owner: this.owner, ownerWeapon: this,
                radius: 6, lifespan: 55, bounces: 0, color: '#5C3317',
                shape: 'sprite', spriteKey: 'washington-bean'
            }));
        }
        WB.Audio.projectileFire();
    }
    applyScaling() {
        this.beanCount = 4 + Math.min(5, Math.floor(this.hitCount / 3)); // 4→9 beans
        this.fireRate = Math.max(40, 65 - Math.floor(this.hitCount * 0.2));
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount / 5);
        this.scalingStat.value = this.beanCount;
    }
    onHit() {}
    draw() {
        // Bean sprite overlay on ball
        var S = WB.WeaponSprites;
        if (S && S.hasSprite('washington-bean')) {
            WB.GLBatch.flush();
            var size = this.owner.radius * 0.85;
            S.drawSprite('washington-bean', this.owner.x, this.owner.y, 0, size, size, 0.9, 1.0);
        }
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
//  49. WISCONSIN — Projectile (cheese wheels). Fattening!
//  Cheese hits make the enemy bigger and slower. Bounces 2x.
//  Scaling: +cheese size per hit, enemy grows more per cheese.
// ═══════════════════════════════════════════════════════════════
class WisconsinWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, { type: 'wisconsin', baseDamage: 4, rotationSpeed: 0.04, reach: 50, scalingName: 'Cheese', superThreshold: NO_SUPER, isRanged: true });
        this.fireTimer = 0;
        this.fireRate = 110;
        this.cheeseHits = 0;
        this.scalingStat.value = this.cheeseHits;
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
            x: this.owner.x + Math.cos(angle) * (this.owner.radius + 8),
            y: this.owner.y + Math.sin(angle) * (this.owner.radius + 8),
            vx: Math.cos(angle) * 5.5, vy: Math.sin(angle) * 5.5,
            damage: this.currentDamage, owner: this.owner, ownerWeapon: this,
            radius: 10, lifespan: 120, bounces: 2, color: '#FFD700',
            damageFalloff: 0.1,
            shape: 'sprite', spriteKey: 'wisconsin-cheese'
        }));
        WB.Audio.projectileFire();
    }
    onProjectileHit(proj, target) {
        this.cheeseHits++;
        // Fatten the enemy — bigger radius, more mass, slower
        var growFactor = 1 + this.cheeseHits * 0.03; // 3% bigger per cheese hit
        var maxGrow = 1.6; // cap at 60% growth
        if (growFactor > maxGrow) growFactor = maxGrow;
        target.radius = Math.round(WB.Config.BALL_RADIUS * growFactor);
        target.mass = (target.radius / WB.Config.BALL_RADIUS) * WB.Config.BALL_MASS * growFactor;
        // Slow them down
        var slowFactor = Math.max(0.6, 1.0 - this.cheeseHits * 0.02); // 2% slower per hit, floor 60%
        target.maxSpeed = WB.Config.BALL_MAX_SPEED * slowFactor;
        this.scalingStat.value = this.cheeseHits;
    }
    applyScaling() {
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount / 4);
    }
    onHit() {}
    draw() {
        var B = WB.GLBatch;
        // Cheese sprite overlay
        var S = WB.WeaponSprites;
        if (S && S.hasSprite('wisconsin-cheese')) {
            B.flush();
            var size = this.owner.radius * 0.85;
            S.drawSprite('wisconsin-cheese', this.owner.x, this.owner.y, 0, size, size, 0.9, 1.0);
        }
        if (this.cheeseHits > 0) {
            B.setAlpha(0.15);
            B.strokeCircle(this.owner.x, this.owner.y, this.owner.radius + 4, '#FFD700', 2);
            B.restoreAlpha();
        }
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
        // Geyser sprite overlay
        var S = WB.WeaponSprites;
        if (S && S.hasSprite('wyoming-geyser')) {
            B.flush();
            var size = this.owner.radius * 0.85;
            S.drawSprite('wyoming-geyser', this.owner.x, this.owner.y, 0, size, size, 0.9, 1.0);
        }
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
