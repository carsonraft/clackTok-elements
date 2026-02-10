window.WB = window.WB || {};

// Duplicator: Periodically splits all copies on its side. Kill the original (starred) to win.
// Deals 1 damage on body contact. Every 8 seconds, all alive copies duplicate.
class DuplicatorWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'duplicator',
            baseDamage: 1,
            rotationSpeed: 0,
            reach: 0,
            scalingName: 'Copies',
            superThreshold: 12,
            isRanged: false,
            canParry: false,
        });
        this.splitInterval = 480; // 8 seconds at 60fps
        this.splitTimer = 0;
        this.copyCount = 1;
        this.superBonusHP = 0;
        this.contactCooldown = 0;
        this.contactAura = 8; // extra pixels beyond ball radius for reliable contact hits
        this.scalingStat.value = this.copyCount;
    }

    update() {
        if (this.contactCooldown > 0) this.contactCooldown--;

        // Only the original ball tracks the split timer
        if (this.owner.isOriginal) {
            this.splitTimer++;
            if (this.splitTimer >= this.splitInterval) {
                this.doSplit();
                this.splitTimer = 0;
            }
        }
    }

    doSplit() {
        if (!WB.Game || !WB.Game.balls) return;
        const side = this.owner.side;

        // Collect all alive balls on our side
        const allies = WB.Game.balls.filter(b => b.side === side && b.isAlive);

        for (const parent of allies) {
            // Calculate clone properties
            const cloneHP = Math.max(5, Math.floor(parent.hp / 2));
            const cloneRadius = Math.max(10, Math.floor(parent.radius * 0.75));

            // Parent keeps half HP too
            parent.hp = Math.max(5, Math.floor(parent.hp / 2));

            // Apply super bonus HP
            const bonusHP = this.superBonusHP;

            // Spawn clone with slight random offset
            const offsetX = (WB.random() - 0.5) * parent.radius * 2;
            const offsetY = (WB.random() - 0.5) * parent.radius * 2;

            const clone = new WB.Ball(
                parent.x + offsetX,
                parent.y + offsetY,
                'duplicator',
                side,
                { radius: cloneRadius, hp: cloneHP + bonusHP, isOriginal: false }
            );
            clone.color = this._getCloneColor(side);
            clone.vx = (WB.random() - 0.5) * 6;
            clone.vy = (WB.random() - 0.5) * 6;

            WB.Game.balls.push(clone);
        }

        // Update copy count
        this.copyCount = WB.Game.balls.filter(b => b.side === side && b.isAlive).length;
        this.scalingStat.value = this.copyCount;
    }

    _getCloneColor(side) {
        // Slightly different shade for clones
        const base = WB.Config.COLORS['duplicator'];
        return base;
    }

    canHit() {
        return this.contactCooldown <= 0;
    }

    onHit(target) {
        target.takeDamage(this.currentDamage);
        this.hitCount++;
        this.contactCooldown = WB.Config.WEAPON_HIT_COOLDOWN;
        this.applyScaling();
        this.checkSuper();
        WB.Audio.weaponHit(this.hitCount, this.type);

        if (WB.Game && WB.Game.particles) {
            WB.Game.particles.emit(target.x, target.y, 6, this.owner.color);
        }
    }

    applyScaling() {
        // Update copy count display
        if (WB.Game && WB.Game.balls) {
            this.copyCount = WB.Game.balls.filter(b => b.side === this.owner.side && b.isAlive).length;
        }
        this.scalingStat.value = this.copyCount;
    }

    activateSuper() {
        // Next split gives copies +10 bonus HP
        this.superBonusHP = 10;
    }

    draw() {
        const B = WB.GLBatch;
        // No weapon visual — duplicator is body-contact
        // Draw a subtle "mitosis" ring effect when close to splitting
        if (this.splitTimer > this.splitInterval - 60) {
            const progress = (this.splitTimer - (this.splitInterval - 60)) / 60;
            B.setAlpha(progress * 0.4);

            // Outer expanding ring
            B.strokeCircle(this.owner.x, this.owner.y, this.owner.radius + 5 + progress * 8, '#00FFAA', 2);

            // Second ring offset (partial arc)
            B.fillArc(this.owner.x, this.owner.y, this.owner.radius + 2, Math.PI * progress, Math.PI * (1 + progress), '#00FFAA');

            B.restoreAlpha();
        }

        if (this.superActive) {
            B.strokeCircleGlow(this.owner.x, this.owner.y, this.owner.radius + 1, '#00FFAA', 1.5, 10);
            B.strokeCircle(this.owner.x, this.owner.y, this.owner.radius + 1, '#00FFAA', 1.5);
        }
    }
}

WB.WeaponRegistry.register('duplicator', DuplicatorWeapon);
