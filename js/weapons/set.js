window.WB = window.WB || {};

// Set — God of Chaos: Khopesh (curved sword) melee spin.
// Every 2 seconds, rotation speed/direction randomize, plus random movement impulse.
// Scaling: Each hit increases MAGNITUDE of all randomization by +10%.
// Super (12 hits): Random impulses also apply to arena gravity direction
// (gravity angle shifts ±30 degrees every 2 seconds, affecting both balls).
class SetWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'set',
            baseDamage: 7,
            rotationSpeed: 0.065,
            reach: 90,
            scalingName: 'Chaos',
            superThreshold: 10,
        });
        this.chaosTimer = 0;
        this.chaosInterval = 90; // 1.5 seconds at 60fps
        this.chaosMagnitude = 1.0;
        this.baseRotSpeed = 0.065;
        this.baseImpulse = 5.5;
        this.visualTimer = 0;
        this._savedGravityAngle = Math.PI / 2; // default gravity
        this.scalingStat.value = this.chaosMagnitude.toFixed(1) + 'x';
    }

    update() {
        const dir = (this.owner.debuffs && this.owner.debuffs.weaponReversed > 0) ? -1 : 1;
        this.angle += this.rotationSpeed * dir;
        if (this.cooldown > 0) this.cooldown--;
        this.visualTimer++;

        // Chaos pulse every 2 seconds
        this.chaosTimer++;
        if (this.chaosTimer >= this.chaosInterval) {
            this.chaosTimer = 0;
            this._chaosPulse();
        }
    }

    _chaosPulse() {
        // Randomize rotation speed and direction
        const speedRange = this.baseRotSpeed * this.chaosMagnitude;
        this.rotationSpeed = (WB.random() * 2 - 1) * speedRange;
        // Ensure some minimum rotation
        if (Math.abs(this.rotationSpeed) < 0.01) {
            this.rotationSpeed = (WB.random() < 0.5 ? -1 : 1) * 0.01;
        }

        // Random movement impulse
        const impulseStrength = this.baseImpulse * this.chaosMagnitude;
        const impulseAngle = WB.random() * Math.PI * 2;
        this.owner.vx += Math.cos(impulseAngle) * impulseStrength;
        this.owner.vy += Math.sin(impulseAngle) * impulseStrength;

        // Super: shift global gravity angle
        if (this.superActive) {
            const maxShift = (30 * Math.PI / 180) * Math.min(2, this.chaosMagnitude); // ±30 degrees, scales
            const shift = (WB.random() * 2 - 1) * maxShift;
            WB.Config.GRAVITY_ANGLE += shift;
        }

        // Visual chaos burst
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.emit(this.owner.x, this.owner.y, 3, '#C2452D');
        }
    }

    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.cooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);

        this._onHitEffects(target, this.currentDamage, '#C2452D');

        // Sand/chaos particles
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.emit(target.x, target.y, 5, '#C2452D');
            WB.Game.particles.emit(target.x, target.y, 3, '#DEB887');
        }
    }

    applyScaling() {
        this.currentDamage = this.baseDamage + Math.floor(this.hitCount * 0.6);
        // Each hit increases chaos magnitude by +10%
        this.chaosMagnitude = 1 + this.hitCount * 0.1;
        this.scalingStat.value = this.chaosMagnitude.toFixed(1) + 'x';
    }

    activateSuper() {
        // Gravity manipulation begins (handled in _chaosPulse)
        // Massive chaos burst — push everything
        if (WB.Game && WB.Game.balls) {
            for (const target of WB.Game.balls) {
                if (target === this.owner || !target.isAlive) continue;
                const impulse = 5;
                const angle = WB.random() * Math.PI * 2;
                target.vx += Math.cos(angle) * impulse;
                target.vy += Math.sin(angle) * impulse;
            }
        }

        // Visual chaos explosion
        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.explode(this.owner.x, this.owner.y, 25, '#C2452D');
            WB.Game.particles.explode(this.owner.x, this.owner.y, 15, '#DEB887');
        }
    }

    draw() {
        const B = WB.GLBatch;
        const r = this.owner.radius;

        // Chaos aura — sand swirl that intensifies with chaos magnitude
        const chaosIntensity = Math.min(1, (this.chaosMagnitude - 1) / 3);
        if (chaosIntensity > 0) {
            // Swirling sand particles
            for (let i = 0; i < 3; i++) {
                const swirl = this.visualTimer * 0.04 + i * Math.PI * 2 / 3;
                const swirlR = r + 5 + chaosIntensity * 8;
                const sx = this.owner.x + Math.cos(swirl) * swirlR;
                const sy = this.owner.y + Math.sin(swirl) * swirlR;
                B.setAlpha(0.15 + chaosIntensity * 0.1);
                B.fillCircle(sx, sy, 2, '#DEB887');
                B.restoreAlpha();
            }
        }

        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        // Khopesh — curved sword
        // Handle
        B.fillRect(r - 2, -4, 12, 8, '#5C3A1E');

        // Curved blade — using a series of points to approximate the sickle shape
        const bladePoints = [];
        const curveSegments = 8;
        for (let i = 0; i <= curveSegments; i++) {
            const t = i / curveSegments;
            const x = r + 12 + t * (this.reach - r - 12);
            // Sickle curve — bows outward then hooks inward at tip
            const curve = Math.sin(t * Math.PI) * 10 * (1 - t * 0.5);
            bladePoints.push([x, -curve]);
        }
        // Return path (thin edge)
        for (let i = curveSegments; i >= 0; i--) {
            const t = i / curveSegments;
            const x = r + 12 + t * (this.reach - r - 12);
            const curve = Math.sin(t * Math.PI) * 4 * (1 - t * 0.3);
            bladePoints.push([x, curve]);
        }
        B.fillPolygon(bladePoints, '#B8451D');
        B.strokePolygon(bladePoints, '#8B3015', 1);

        // Edge highlight
        for (let i = 0; i < curveSegments; i++) {
            const t = i / curveSegments;
            const x = r + 12 + t * (this.reach - r - 12);
            const curve = Math.sin(t * Math.PI) * 10 * (1 - t * 0.5);
            const nx = r + 12 + (i + 1) / curveSegments * (this.reach - r - 12);
            const ncurve = Math.sin((i + 1) / curveSegments * Math.PI) * 10 * (1 - (i + 1) / curveSegments * 0.5);
            B.setAlpha(0.3);
            B.line(x, -curve, nx, -ncurve, '#FF6B4A', 1);
            B.restoreAlpha();
        }

        B.popTransform();

        // Super: gravity distortion indicator
        if (this.superActive) {
            // Show current gravity direction as a subtle arrow
            const ga = WB.Config.GRAVITY_ANGLE;
            const arrowLen = 15;
            const ax = this.owner.x + Math.cos(ga) * (r + 8);
            const ay = this.owner.y + Math.sin(ga) * (r + 8);
            const aex = ax + Math.cos(ga) * arrowLen;
            const aey = ay + Math.sin(ga) * arrowLen;
            B.setAlpha(0.2);
            B.line(ax, ay, aex, aey, '#DEB887', 2);
            B.fillCircle(aex, aey, 3, '#DEB887');
            B.restoreAlpha();

            const pulse = Math.sin(this.visualTimer * 0.08) * 0.04;
            B.setAlpha(0.1 + pulse);
            B.strokeCircle(this.owner.x, this.owner.y, r + 10, '#C2452D', 2);
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('set', SetWeapon, 'egyptian');
