window.WB = window.WB || {};

WB.Game = {
    canvas: null,
    state: 'MENU', // MENU | COUNTDOWN | BATTLE | RESULT | SIM_RESULTS | BEST_OF
    balls: [],
    projectiles: [],
    particles: null,
    countdownTimer: 0,
    countdownText: '',
    winner: null,
    _playAgainBtn: null,

    init() {
        this.canvas = document.getElementById('gameCanvas');
        this.canvas.width = WB.Config.CANVAS_WIDTH;
        this.canvas.height = WB.Config.CANVAS_HEIGHT;

        // Initialize WebGL2
        if (!WB.GL.init(this.canvas)) {
            console.error('Failed to init WebGL2');
            return;
        }
        this.particles = new WB.ParticleSystem();

        WB.Audio.init();
        WB.UI.init();

        // Scroll handler for menu + simulation results
        this.canvas.addEventListener('wheel', (e) => {
            if (this.state === 'MENU') {
                e.preventDefault();
                WB.UI.handleMenuScroll(e.deltaY > 0 ? 'down' : 'up');
            } else if (this.state === 'SIM_RESULTS' || this.state === 'BEST_OF') {
                e.preventDefault();
                WB.SimUI.handleScroll(e.deltaY > 0 ? 'down' : 'up');
            }
        }, { passive: false });

        // Click handler
        this.canvas.addEventListener('click', (e) => {
            WB.Audio.resume(); // Resume audio context on first click
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const mx = (e.clientX - rect.left) * scaleX;
            const my = (e.clientY - rect.top) * scaleY;
            this.handleClick(mx, my);
        });

        this.loop();
    },

    handleClick(mx, my) {
        switch (this.state) {
            case 'MENU': {
                const result = WB.UI.handleMenuClick(mx, my);
                if (result === 'fight') {
                    this.startCountdown();
                } else if (result === 'simulate') {
                    WB.SimUI.runSimulation(WB.UI.selectedLeft, WB.UI.selectedRight);
                    this.state = 'SIM_RESULTS';
                } else if (result === 'bestof') {
                    WB.SimUI.scrollOffset = 0;
                    this.state = 'BEST_OF';
                }
                break;
            }
            case 'SIM_RESULTS': {
                WB.SimUI.handleResultsClick(mx, my);
                break;
            }
            case 'BEST_OF': {
                WB.SimUI.handleBestOfClick(mx, my);
                break;
            }
            case 'RESULT': {
                if (this._playAgainBtn) {
                    const btn = this._playAgainBtn;
                    if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
                        if (WB.SimUI.isReplaying) {
                            const returnState = WB.SimUI.onReplayEnd();
                            this.state = returnState;
                        } else {
                            this.state = 'MENU';
                        }
                        // Restore arena modifiers (e.g. Dionysus wall shift)
                        const wallShift = WB.ArenaModifiers.getModifier('wallshift');
                        if (wallShift && wallShift.restore) wallShift.restore();
                        WB.ArenaModifiers.clear();
                        this._restoreMenuSize();
                        this._playAgainBtn = null;
                    }
                }
                break;
            }
        }
    },

    // Menu-size constants (original canvas dimensions)
    _MENU_WIDTH: 540,
    _MENU_HEIGHT: 960,

    _applyStageSize() {
        const preset = WB.Config.STAGE_PRESETS[WB.Config.STAGE_SIZE_INDEX];
        WB.Config.ARENA.width = preset.width;
        WB.Config.ARENA.height = preset.height;
        WB.Config.ARENA.x = 20;
        WB.Config.ARENA.y = 70;
        // Recalculate canvas to fit arena with margins
        const cw = preset.width + 40;
        const ch = preset.height + 180;
        WB.Config.CANVAS_WIDTH = cw;
        WB.Config.CANVAS_HEIGHT = ch;
        this.canvas.width = cw;
        this.canvas.height = ch;
        WB.GL.resize(cw, ch);
    },

    _restoreMenuSize() {
        const w = this._MENU_WIDTH;
        const h = this._MENU_HEIGHT;
        WB.Config.CANVAS_WIDTH = w;
        WB.Config.CANVAS_HEIGHT = h;
        WB.Config.ARENA.x = 20;
        WB.Config.ARENA.y = 70;
        WB.Config.ARENA.width = 500;
        WB.Config.ARENA.height = 780;
        this.canvas.width = w;
        this.canvas.height = h;
        WB.GL.resize(w, h);
    },

    startCountdown() {
        this.state = 'COUNTDOWN';
        this.countdownTimer = 0;
        this.projectiles = [];
        this.hazards = [];
        this.particles = new WB.ParticleSystem();
        this.winner = null;
        this._excitement = new WB.Excitement();
        WB.ArenaModifiers.clear();

        // Apply selected stage size & friction
        this._applyStageSize();
        WB.Config.BALL_FRICTION = WB.Config.FRICTION_PRESETS[WB.Config.FRICTION_INDEX].value;

        // Create balls
        const arena = WB.Config.ARENA;
        const b1x = arena.x + arena.width * 0.25;
        const b2x = arena.x + arena.width * 0.75;
        const cy = arena.y + arena.height / 2;

        this.balls = [
            new WB.Ball(b1x, cy, WB.UI.selectedLeft, 'left'),
            new WB.Ball(b2x, cy, WB.UI.selectedRight, 'right'),
        ];
        // Zero velocity during countdown
        this.balls[0].vx = 0; this.balls[0].vy = 0;
        this.balls[1].vx = 0; this.balls[1].vy = 0;
    },

    startBattle() {
        this.state = 'BATTLE';
        // Give balls initial random velocity - EXPLOSIVE START
        for (const ball of this.balls) {
            ball.vx = (WB.random() - 0.5) * 22;
            ball.vy = (WB.random() - 0.5) * 22;
            // Launch particles from each ball
            if (this.particles) {
                this.particles.emit(ball.x, ball.y, 12, ball.color, {
                    speed: 5, life: 15, size: 2.5
                });
            }
        }
        // Ball clack sound on launch
        WB.Audio.ballClack(8);
    },

    loop() {
        WB.GL.beginFrame();

        switch (this.state) {
            case 'MENU':
                WB.UI.drawMenu();
                break;
            case 'COUNTDOWN':
                this.updateCountdown();
                break;
            case 'BATTLE':
                this.updateBattle();
                break;
            case 'SIM_RESULTS':
                WB.SimUI.drawResults();
                break;
            case 'BEST_OF':
                WB.SimUI.drawBestOf();
                break;
            case 'RESULT':
                this.drawResult();
                break;
        }

        WB.GLText.flush();
        WB.GL.endFrame();
        requestAnimationFrame(() => this.loop());
    },

    updateCountdown() {
        this.countdownTimer++;
        const phase = Math.floor(this.countdownTimer / 60); // 1 second per phase
        const progress = (this.countdownTimer % 60) / 60;

        let text = '';
        if (phase === 0) text = '3';
        else if (phase === 1) text = '2';
        else if (phase === 2) text = '1';
        else if (phase === 3) text = 'FIGHT!';
        else {
            this.startBattle();
            return;
        }

        // Play escalating countdown clack at phase transition
        if (this.countdownTimer % 60 === 1 && phase < 4) {
            WB.Audio.countdownClack(phase);
            // Screen shake escalates: mild on 3, MASSIVE on FIGHT!
            if (phase < 3) {
                WB.Renderer.triggerShake(4 + phase * 3);
                // Subtle deformation even during countdown
                if (WB.GLEffects && phase >= 1) {
                    WB.GLEffects.triggerChromatic(0.1 + phase * 0.1);
                }
            } else {
                // FIGHT! — THE BIG MOMENT
                WB.Renderer.triggerShake(18);
                if (WB.GLEffects) {
                    WB.GLEffects.triggerSuperFlash('#FFD700');
                    WB.GLEffects.triggerChromatic(0.6);
                    WB.GLEffects.triggerBarrel(0.3);
                    WB.GLEffects.triggerArenaPulse('#FFD700');
                    // Shockwave from arena center
                    const arena = WB.Config.ARENA;
                    WB.GLEffects.triggerShockwave(
                        arena.x + arena.width / 2,
                        arena.y + arena.height / 2,
                        0.5
                    );
                }
                // FIGHT! explosion particles
                if (this.particles) {
                    const arena = WB.Config.ARENA;
                    const cx = arena.x + arena.width / 2;
                    const cy = arena.y + arena.height / 2;
                    this.particles.explode(cx, cy, 25, '#FFD700');
                    this.particles.spark(cx, cy, 15);
                }
            }
        }

        // Update effects so FIGHT! flash/pulse/particles decay properly
        WB.GLEffects.update();
        this.particles.update();

        // Draw the arena with frozen balls
        WB.Renderer.drawFrame(this);
        WB.Renderer.drawCountdown(text, progress);
    },

    updateBattle() {
        // 0. Update effects (always, even during hit stop)
        WB.GLEffects.update();

        // Hit stop — skip physics but still render
        if (WB.GLEffects.isHitStopped()) {
            WB.Renderer.drawFrame(this);
            return;
        }

        // 0b. Update arena modifiers (before ball physics — may shift arena bounds)
        WB.ArenaModifiers.update();

        // 1. Update balls
        for (const ball of this.balls) {
            if (ball.isAlive) {
                ball.update();
            }
        }

        // 1b. Weapon tip wall bounce
        if (WB.Config.WEAPON_WALL_BOUNCE) {
            for (const ball of this.balls) {
                if (!ball.isAlive) continue;
                const wallHit = WB.Physics.weaponWallBounce(ball, WB.Config.ARENA);
                if (wallHit) {
                    const s = ball.getSpeed();
                    WB.Audio.wallClack(s * 0.5);
                    if (WB.GLEffects) {
                        const tipX = ball.weapon.getTipX();
                        const tipY = ball.weapon.getTipY();
                        const a = WB.Config.ARENA;
                        const wx = Math.max(a.x, Math.min(a.x + a.width, tipX));
                        const wy = Math.max(a.y, Math.min(a.y + a.height, tipY));
                        WB.GLEffects.spawnWallImpact(wx, wy, s * 0.4, ball.color);
                        if (s >= 3) {
                            WB.Renderer.triggerShake(1 + s * 0.3);
                            if (this.particles) this.particles.spark(wx, wy, Math.floor(s * 1.5));
                        }
                    }
                }
            }
        }

        // 2. Ball-ball collision (pairwise for N balls)
        for (let i = 0; i < this.balls.length; i++) {
            const ba = this.balls[i];
            if (!ba.isAlive) continue;
            for (let j = i + 1; j < this.balls.length; j++) {
                const bb = this.balls[j];
                if (!bb.isAlive) continue;
                if (WB.Physics.circleCircle(ba.x, ba.y, ba.radius, bb.x, bb.y, bb.radius)) {
                    const speed = Math.sqrt(
                        Math.pow(ba.vx - bb.vx, 2) + Math.pow(ba.vy - bb.vy, 2)
                    );
                    WB.Physics.separateCircles(ba, bb);
                    WB.Physics.resolveCircleCircle(ba, bb);
                    WB.Audio.ballClack(speed);

                    // Ball collision visual effects — CRANKED TO 11/10
                    if (WB.GLEffects) {
                        const midX = (ba.x + bb.x) / 2;
                        const midY = (ba.y + bb.y) / 2;
                        WB.GLEffects.spawnImpact(midX, midY, '#FFF', 25 + speed * 5);
                        // EVERY collision is impactful — no threshold for basic effects
                        if (speed >= 2) {
                            WB.GLEffects.triggerCollisionFlash('#FFF');
                            WB.Renderer.triggerShake(2 + speed * 0.6);
                            WB.GLEffects.spawnClashSparks(midX, midY, Math.floor(speed * 2), '#FFF');
                            WB.GLEffects.triggerChromatic(speed * 0.04);
                        }
                        if (speed >= 5) {
                            WB.GLEffects.triggerHitStop(2 + Math.floor(speed / 5));
                            WB.GLEffects.triggerShockwave(midX, midY, speed * 0.05);
                            WB.GLEffects.triggerChromatic(speed * 0.07);
                            WB.GLEffects.triggerArenaPulse('#FFF');
                        }
                        if (speed >= 8) {
                            WB.GLEffects.triggerBarrel(speed * 0.02);
                        }
                    }
                    // Ball collision particles — ALWAYS spark on contact
                    if (this.particles) {
                        const midX = (ba.x + bb.x) / 2;
                        const midY = (ba.y + bb.y) / 2;
                        this.particles.spark(midX, midY, Math.max(3, Math.floor(speed * 2.5)));
                    }

                    // Body-contact weapons deal damage (only cross-side)
                    if (ba.side !== bb.side) {
                        for (const [attacker, target] of [[ba, bb], [bb, ba]]) {
                            const w = attacker.weapon;
                            if (w.reach === 0 && w.canHit && w.canHit() && target.isAlive) {
                                w.onHit(target);
                                WB.Renderer.triggerShake(4 + w.currentDamage * 0.5);
                                if (this._excitement) this._excitement.recordHit();
                            }
                        }
                    }
                }
            }
        }

        // 2b. Body-contact proximity check (for weapons like Duplicator with contactAura)
        for (let i = 0; i < this.balls.length; i++) {
            const ba = this.balls[i];
            if (!ba.isAlive) continue;
            for (let j = i + 1; j < this.balls.length; j++) {
                const bb = this.balls[j];
                if (!bb.isAlive || ba.side === bb.side) continue;
                // Only check if at least one has a contactAura
                const auraA = ba.weapon.contactAura || 0;
                const auraB = bb.weapon.contactAura || 0;
                if (auraA === 0 && auraB === 0) continue;
                // Already handled by exact collision above?
                if (WB.Physics.circleCircle(ba.x, ba.y, ba.radius, bb.x, bb.y, bb.radius)) continue;
                // Proximity check with aura
                const dx = ba.x - bb.x;
                const dy = ba.y - bb.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const auraDistA = ba.radius + bb.radius + auraA;
                const auraDistB = ba.radius + bb.radius + auraB;
                for (const [attacker, target, auraDist] of [[ba, bb, auraDistA], [bb, ba, auraDistB]]) {
                    const w = attacker.weapon;
                    if (w.reach === 0 && w.contactAura && dist < auraDist && w.canHit && w.canHit() && target.isAlive) {
                        w.onHit(target);
                        WB.Renderer.triggerShake(4 + w.currentDamage * 0.5);
                        if (this._excitement) this._excitement.recordHit();
                    }
                }
            }
        }

        // 3. Weapon-ball collision (melee weapons)
        // Use line-segment vs circle for the outer half of the weapon
        for (const attacker of this.balls) {
            if (!attacker.isAlive) continue;
            const weapon = attacker.weapon;
            // Skip weapons with no reach, ranged-only, or that can't hit right now
            if (weapon.reach === 0 || !weapon.canHit() || weapon.isRanged) continue;

            for (const target of this.balls) {
                if (target === attacker || !target.isAlive || target.side === attacker.side) continue;

                // Check outer portion of weapon line against target ball
                const midX = attacker.x + Math.cos(weapon.angle) * weapon.reach * 0.4;
                const midY = attacker.y + Math.sin(weapon.angle) * weapon.reach * 0.4;
                const tipX = weapon.getTipX();
                const tipY = weapon.getTipY();

                if (WB.Physics.lineCircle(midX, midY, tipX, tipY, target.x, target.y, target.radius)) {
                    weapon.onHit(target);
                    WB.Renderer.triggerShake(4 + weapon.currentDamage * 0.5);
                    if (this._excitement) this._excitement.recordHit();
                }
            }
        }

        // 4. Weapon-weapon parry check (cross-side pairs)
        for (let i = 0; i < this.balls.length; i++) {
            const ba = this.balls[i];
            if (!ba.isAlive) continue;
            for (let j = i + 1; j < this.balls.length; j++) {
                const bb = this.balls[j];
                if (!bb.isAlive || ba.side === bb.side) continue;
                const w1 = ba.weapon;
                const w2 = bb.weapon;
                if (w1.canParry && w2.canParry && !w1.unparryable && !w2.unparryable) {
                    const tipDist = WB.Physics.distanceSq(
                        w1.getTipX(), w1.getTipY(),
                        w2.getTipX(), w2.getTipY()
                    );
                    if (tipDist < 225) {
                        w1.angle += (WB.random() - 0.3) * Math.PI * 0.4;
                        w2.angle -= (WB.random() - 0.3) * Math.PI * 0.4;
                        w1.cooldown = Math.max(w1.cooldown, 10);
                        w2.cooldown = Math.max(w2.cooldown, 10);
                        const sparkX = (w1.getTipX() + w2.getTipX()) / 2;
                        const sparkY = (w1.getTipY() + w2.getTipY()) / 2;
                        this.particles.spark(sparkX, sparkY, 25);
                        WB.Audio.parry();
                        WB.Renderer.triggerShake(6);
                        // Parry clash effects — ULTRA CLACKY
                        if (WB.GLEffects) {
                            WB.GLEffects.spawnImpact(sparkX, sparkY, '#FFD700', 50);
                            WB.GLEffects.spawnClashSparks(sparkX, sparkY, 20, '#FFD700');
                            WB.GLEffects.triggerHitStop(4);
                            WB.GLEffects.triggerArenaPulse('#FFD700');
                            WB.GLEffects.triggerChromatic(0.3);
                            WB.GLEffects.triggerShockwave(sparkX, sparkY, 0.15);
                        }
                    }
                }
            }
        }

        // 5. Update and check projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            proj.update();

            if (proj.alive) {
                for (const target of this.balls) {
                    if (proj.checkHit(target)) {
                        WB.Renderer.triggerShake(3);
                        if (this._excitement) this._excitement.recordHit();
                        break;
                    }
                }
            }

            if (!proj.alive) {
                this.projectiles.splice(i, 1);
            }
        }

        // 5b. Update and check hazards
        for (let i = this.hazards.length - 1; i >= 0; i--) {
            const h = this.hazards[i];
            h.update(this.balls);
            if (!h.alive) {
                this.hazards.splice(i, 1);
            }
        }

        // 6. Record excitement metrics (use first two original balls)
        if (this._excitement && this.balls.length >= 2) {
            this._excitement.recordFrame(this.balls[0], this.balls[1]);
        }

        // 7. Update particles
        this.particles.update();

        // 8. Check win condition
        this._checkWinCondition();

        // 9. Render
        WB.Renderer.drawFrame(this);
    },

    _checkWinCondition() {
        if (this.state !== 'BATTLE') return;

        const leftAlive = this.balls.filter(b => b.side === 'left' && b.isAlive);
        const rightAlive = this.balls.filter(b => b.side === 'right' && b.isAlive);

        // Check if an original (king) duplicator ball was killed
        const leftOriginal = this.balls.find(b => b.side === 'left' && b.isOriginal);
        const rightOriginal = this.balls.find(b => b.side === 'right' && b.isOriginal);
        const leftKingDead = leftOriginal && !leftOriginal.isAlive;
        const rightKingDead = rightOriginal && !rightOriginal.isAlive;

        const leftDead = leftAlive.length === 0 || leftKingDead;
        const rightDead = rightAlive.length === 0 || rightKingDead;

        if (!leftDead && !rightDead) return; // no winner yet

        // Double KO — both sides dead in the same frame
        if (leftDead && rightDead) {
            // Pick higher HP ball, or coin-flip
            const b1 = this.balls[0];
            const b2 = this.balls[1];
            this.winner = b1.hp >= b2.hp ? b1 : b2;
            this._isDraw = true;
        } else {
            const winnerSide = leftDead ? 'right' : 'left';
            this.winner = this.balls.find(b => b.side === winnerSide && b.isOriginal && b.isAlive)
                       || this.balls.find(b => b.side === winnerSide && b.isAlive);
            this._isDraw = false;
        }

        if (this.winner) {
            const loserSide = this.winner.side === 'left' ? 'right' : 'left';
            WB.Audio.death();
            WB.Audio.victoryFanfare();
            // MASSIVE victory screen shake + flash
            WB.Renderer.triggerShake(25);
            if (WB.GLEffects) {
                WB.GLEffects.triggerSuperFlash(this.winner.color);
                WB.GLEffects.triggerHitStop(10);
                // EXTREME screen deformation on victory
                WB.GLEffects.triggerShockwave(this.winner.x, this.winner.y, 1.0);
                WB.GLEffects.triggerChromatic(1.2);
                WB.GLEffects.triggerBarrel(0.7);
            }
            // Explode all dead balls on loser side — MASSIVE explosions
            for (const b of this.balls) {
                if (b.side === loserSide && !b.isAlive) {
                    this.particles.explode(b.x, b.y, 40, b.color);
                    this.particles.spark(b.x, b.y, 25);
                }
            }
            // Also explode any alive losers (king was killed)
            for (const b of this.balls) {
                if (b.side === loserSide && b.isAlive) {
                    b.isAlive = false;
                    this.particles.explode(b.x, b.y, 40, b.color);
                    this.particles.spark(b.x, b.y, 25);
                }
            }
            // On draw, explode both sides
            if (this._isDraw) {
                for (const b of this.balls) {
                    this.particles.explode(b.x, b.y, 40, b.color);
                    this.particles.spark(b.x, b.y, 25);
                }
            }
            // Victory particle burst from winner
            this.particles.explode(this.winner.x, this.winner.y, 30, this.winner.color);
            this.particles.spark(this.winner.x, this.winner.y, 20);
            this.state = 'RESULT';
        }
    },

    drawResult() {
        // Rapidly decay screen effects so they don't obscure the result
        WB.GLEffects.update();
        WB.GLEffects.update();
        WB.GLEffects.update();

        // Keep rendering the frozen arena
        WB.Renderer.drawFrame(this);
        // Update particles (death explosion continues)
        this.particles.update();
        // Draw result overlay
        if (this.winner) {
            WB.Renderer.drawResult(this.winner, this);
        }
    }
};

// Start on load
window.addEventListener('load', () => {
    WB.Game.init();
});
