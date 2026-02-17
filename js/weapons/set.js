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
        if (this._deflectReverse > 0) this._deflectReverse--;
        this.angle += this.rotationSpeed * this.getDir();
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

        // Chaos intensity 0→1 (chaosMagnitude starts at 1, +0.1 per hit)
        const chaosIntensity = Math.min(1, (this.chaosMagnitude - 1) / 3);

        // Sand orbit dots — MORE dots and LARGER as chaos builds
        if (chaosIntensity > 0) {
            const dotCount = 3 + Math.floor(chaosIntensity * 3); // 3→6
            const dotRadius = 2 + chaosIntensity * 1.5; // 2→3.5
            for (let i = 0; i < dotCount; i++) {
                const swirl = this.visualTimer * 0.04 + i * Math.PI * 2 / dotCount;
                const swirlR = r + 5 + chaosIntensity * 8;
                const sx = this.owner.x + Math.cos(swirl) * swirlR;
                const sy = this.owner.y + Math.sin(swirl) * swirlR;
                B.setAlpha(0.2 + chaosIntensity * 0.15);
                B.fillCircle(sx, sy, dotRadius, '#DEB887');
                B.restoreAlpha();
            }
        }

        B.pushTransform(this.owner.x, this.owner.y, this.angle);

        // Khopesh — curved sword
        // Handle — wider
        B.fillRect(r - 2, -5, 12, 10, '#5C3A1E');

        // Blade color shifts: bronze #B8451D → violent red #FF2200 as chaos builds
        const blR = Math.round(184 + (255 - 184) * chaosIntensity);
        const blG = Math.round(69 + (34 - 69) * chaosIntensity);
        const blB = Math.round(29 + (0 - 29) * chaosIntensity);
        const bladeColor = `rgb(${blR},${blG},${blB})`;
        // Stroke also shifts
        const stR = Math.round(139 + (200 - 139) * chaosIntensity);
        const stG = Math.round(48 + (20 - 48) * chaosIntensity);
        const stB = Math.round(21 + (0 - 21) * chaosIntensity);
        const strokeColor = `rgb(${stR},${stG},${stB})`;

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
        B.fillPolygon(bladePoints, bladeColor);
        B.strokePolygon(bladePoints, strokeColor, 1.5);

        // Edge highlight
        for (let i = 0; i < curveSegments; i++) {
            const t = i / curveSegments;
            const x = r + 12 + t * (this.reach - r - 12);
            const curve = Math.sin(t * Math.PI) * 10 * (1 - t * 0.5);
            const nx = r + 12 + (i + 1) / curveSegments * (this.reach - r - 12);
            const ncurve = Math.sin((i + 1) / curveSegments * Math.PI) * 10 * (1 - (i + 1) / curveSegments * 0.5);
            B.setAlpha(0.3);
            B.line(x, -curve, nx, -ncurve, '#FF6B4A', 1.5);
            B.restoreAlpha();
        }

        B.popTransform();

        // Super: gravity distortion indicator — VISIBLE arrow showing gravity direction
        if (this.superActive) {
            const ga = WB.Config.GRAVITY_ANGLE;
            const arrowLen = 18;
            const ax = this.owner.x + Math.cos(ga) * (r + 6);
            const ay = this.owner.y + Math.sin(ga) * (r + 6);
            const aex = ax + Math.cos(ga) * arrowLen;
            const aey = ay + Math.sin(ga) * arrowLen;
            // Arrow shaft — prominent red
            B.setAlpha(0.5);
            B.line(ax, ay, aex, aey, '#FF4444', 2.5);
            // Arrowhead triangle
            const headSize = 5;
            const perpX = -Math.sin(ga) * headSize;
            const perpY = Math.cos(ga) * headSize;
            B.fillTriangle(
                aex + Math.cos(ga) * headSize, aey + Math.sin(ga) * headSize,
                aex + perpX, aey + perpY,
                aex - perpX, aey - perpY,
                '#FF4444'
            );
            B.restoreAlpha();
        }
    }
}

WB.WeaponRegistry.register('set', SetWeapon, 'egyptian');
