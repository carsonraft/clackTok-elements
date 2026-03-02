window.WB = window.WB || {};

WB.Game = {
    canvas: null,
    state: 'MENU', // MENU | COUNTDOWN | BATTLE | RESULT | SIM_RESULTS | BEST_OF | STUDIO | PRE_BATTLE_CUTSCENE | POST_BATTLE_CUTSCENE
    balls: [],
    projectiles: [],
    particles: null,
    countdownTimer: 0,
    countdownText: '',
    winner: null,
    _playAgainBtn: null,
    _resultTimer: 0,
    _lastFrameTime: 0,       // timestamp of last processed frame
    _frameInterval: 1000 / 60, // target 60fps (~16.67ms)
    _prerenderActive: false,  // true during offline prerender (pauses rAF loop)

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
        WB.Audio.loadAllSounds(); // Fire-and-forget: loads state weapon MP3s (~2.4MB)
        if (WB.Cutscene) WB.Cutscene.init();
        if (WB.BallImages) {
            WB.BallImages.init();
            WB.BallImages.loadFlags();  // Preload state flag textures
        }
        if (WB.WeaponSprites) WB.WeaponSprites.init();
        if (WB.StatesIcons) WB.StatesIcons.init();
        // Load sprite editor overrides from localStorage
        try { WB._spriteConfig = JSON.parse(localStorage.getItem('wb_sprite_config')) || null; } catch(e) { WB._spriteConfig = null; }
        try { WB._weaponStatConfig = JSON.parse(localStorage.getItem('wb_weapon_config')) || null; } catch(e) { WB._weaponStatConfig = null; }
        WB.UI.init();

        // Scroll handler for menu + simulation results
        this.canvas.addEventListener('wheel', (e) => {
            if (this.state === 'MENU') {
                e.preventDefault();
                WB.UI.handleMenuScroll(e.deltaY > 0 ? 'down' : 'up');
            } else if (this.state === 'SIM_RESULTS' || this.state === 'BEST_OF') {
                e.preventDefault();
                WB.SimUI.handleScroll(e.deltaY > 0 ? 'down' : 'up');
            } else if (this.state === 'STUDIO' && WB.Studio) {
                e.preventDefault();
                WB.Studio.handleScroll(e.deltaY > 0 ? 'down' : 'up');
            }
        }, { passive: false });

        // Click handler — map CSS click position to logical game coordinates
        this.canvas.addEventListener('click', (e) => {
            WB.Audio.resume(); // Resume audio context on first click
            const rect = this.canvas.getBoundingClientRect();
            // Use logical dimensions (not canvas.width which is DPR-scaled)
            const scaleX = WB.Config.CANVAS_WIDTH / rect.width;
            const scaleY = WB.Config.CANVAS_HEIGHT / rect.height;
            const mx = (e.clientX - rect.left) * scaleX;
            const my = (e.clientY - rect.top) * scaleY;
            this.handleClick(mx, my);
        });

        this._lastFrameTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    },

    handleClick(mx, my) {
        // Click-to-cancel during prerender
        if (WB.Prerender && WB.Prerender.isActive) {
            WB.Prerender.cancel();
            return;
        }

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
                } else if (result === 'studio') {
                    if (WB.Studio) {
                        WB.Studio.scrollOffset = 0;
                        WB.Studio.selectedIndex = -1;
                        this.state = 'STUDIO';
                    }
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
            case 'STUDIO': {
                if (WB.Studio) WB.Studio.handleClick(mx, my);
                break;
            }
            case 'RESULT': {
                // Check if clicking the ★ SAVE button
                if (this._favBtn) {
                    const btn = this._favBtn;
                    if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
                        const resultObj = WB.Renderer._buildBattleResult(this);
                        if (resultObj) {
                            if (WB.SimUI.isSaved(resultObj)) {
                                WB.SimUI.removeBestOf(resultObj.seed, resultObj.weaponLeft, resultObj.weaponRight);
                            } else {
                                WB.SimUI.saveBestOf(resultObj);
                            }
                            // Reset timer so user sees the state change
                            this._resultTimer = 180;
                        }
                        break;
                    }
                }
                // Click elsewhere to return
                this._returnFromResult();
                break;
            }
            case 'PRE_BATTLE_CUTSCENE':
            case 'POST_BATTLE_CUTSCENE': {
                if (WB.Cutscene) WB.Cutscene.skip();
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

        // Per-preset physics overrides from StageTuner (localStorage + preset defaults)
        if (WB.StageTuner) {
            var ov = WB.StageTuner.getOverrides(preset.label);
            WB.Config.BALL_MAX_SPEED = ov.maxSpeed;
            WB.Config.WALL_RESTITUTION = ov.wallRestitution;
            WB.Config.GRAVITY = ov.gravity;
            WB.Config.BALL_RADIUS = ov.ballRadius;
        } else {
            WB.Config.BALL_MAX_SPEED = preset.maxSpeed || 14;
            WB.Config.WALL_RESTITUTION = preset.wallRestitution || 1.12;
            WB.Config.GRAVITY = preset.gravity || 0.15;
        }

        const sidePad = 20;
        // Minimum canvas width so small arenas still fill the screen nicely
        const minCanvasW = 380;
        const cw = Math.max(preset.width + sidePad * 2, minCanvasW);

        // Center arena horizontally within the (possibly wider) canvas
        WB.Config.ARENA.x = Math.round((cw - preset.width) / 2);

        // Reserve space: title area above arena, HUD below arena
        // HUD: 10 top gap + bar(24) + gap(6) + bar(24) + gap(12) + stats(18) + margin(12) = 106
        const titleH = 60;
        const hudH = 106;
        const naturalH = titleH + preset.height + hudH;

        const minH = Math.round(cw * 1.6);
        const ch = Math.max(naturalH, minH);

        // Distribute extra vertical space: 40% above arena, 60% below
        // This keeps the title snug and gives more breathing room to HUD
        const extraSpace = ch - titleH - preset.height - hudH;
        const topExtra = Math.round(extraSpace * 0.4);
        const arenaY = titleH + topExtra;

        WB.Config.ARENA.y = arenaY;
        WB.Config.CANVAS_WIDTH = cw;
        WB.Config.CANVAS_HEIGHT = ch;
        // GL.resize handles canvas.width/height (DPR-scaled) + CSS size
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
        // GL.resize handles canvas.width/height (DPR-scaled) + CSS size
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
        this._excitementScore = 0;
        WB.ArenaModifiers.clear();
        if (WB.GL) WB.GL.clearMotionBlurHistory();
        if (WB.StageTuner) WB.StageTuner.hide();

        // Seed live battles for replay (replays are already seeded by SimUI)
        if (!WB.RNG._seeded) {
            this._battleSeed = WB.RNG.generateSeed();
            WB.RNG.seed(this._battleSeed);
        }
        this._battleToggles = WB.SimUI._snapshotToggles();

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

        // Pre-battle cutscene (if enabled)
        if (WB.Cutscene && WB.Cutscene.enabled) {
            if (WB.Cutscene.startPreBattle(this.balls[0], this.balls[1])) {
                this.state = 'PRE_BATTLE_CUTSCENE';
                return;
            }
        }
    },

    startBattle() {
        this.state = 'BATTLE';
        if (WB.GL) WB.GL.clearMotionBlurHistory();
        // Give balls initial random velocity - EXPLOSIVE START
        for (const ball of this.balls) {
            ball.vx = (WB.random() - 0.5) * 22;
            ball.vy = (WB.random() - 0.5) * 22;
            // Launch particles from each ball
            if (this.particles) {
                this.particles.emit(ball.x, ball.y, 6, ball.color, {
                    speed: 5, life: 15, size: 2.5
                });
            }
        }
        // Ball clack sound on launch
        WB.Audio.ballClack(8);
    },

    loop(timestamp) {
        requestAnimationFrame((t) => this.loop(t));

        // Prerender drives its own frame loop — skip rAF rendering
        if (this._prerenderActive) return;

        // Debug pause: freeze game loop, allow single-stepping
        if (this._debugPaused && !this._debugStepQueued) return;
        if (this._debugStepQueued) {
            this._debugStepQueued = false;
            // Signal after this frame renders (at end of loop body)
            var stepResolve = this._debugStepResolve;
            this._debugStepResolve = null;
            if (stepResolve) {
                // Resolve after endFrame() via microtask so canvas is flushed
                var _resolve = stepResolve;
                var origEndFrame = WB.GL.endFrame;
                var self = this;
                WB.GL.endFrame = function() {
                    origEndFrame.call(WB.GL);
                    WB.GL.endFrame = origEndFrame;
                    _resolve();
                };
            }
        }

        // ── 60fps frame limiter ──────────────────────────────────
        // On 120Hz+ displays, requestAnimationFrame fires too fast.
        // Skip frames that arrive before the 16.67ms budget elapses
        // so physics/timers stay at the intended 60fps pace.
        const elapsed = timestamp - this._lastFrameTime;
        if (elapsed < this._frameInterval * 0.9) return; // 0.9 tolerance for timing jitter
        this._lastFrameTime = timestamp - (elapsed % this._frameInterval);

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
            case 'STUDIO':
                if (WB.Studio) WB.Studio.draw();
                break;
            case 'RESULT':
                this.drawResult();
                break;
            case 'PRE_BATTLE_CUTSCENE':
            case 'POST_BATTLE_CUTSCENE':
                if (WB.Cutscene) WB.Cutscene.update();
                break;
        }

        WB.GLText.flush();
        WB.GL.endFrame();
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
            if (phase < 3) {
                WB.Renderer.triggerShake(2 + phase * 2);
            } else {
                // FIGHT!
                WB.Renderer.triggerShake(10);
                if (WB.GLEffects) {
                    WB.GLEffects.triggerSuperFlash('#FFD700');
                    WB.GLEffects.triggerChromatic(0.2);
                    WB.GLEffects.triggerArenaPulse('#FFD700');
                    const arena = WB.Config.ARENA;
                    WB.GLEffects.triggerShockwave(
                        arena.x + arena.width / 2,
                        arena.y + arena.height / 2,
                        0.2
                    );
                }
                if (this.particles) {
                    const arena = WB.Config.ARENA;
                    const cx = arena.x + arena.width / 2;
                    const cy = arena.y + arena.height / 2;
                    this.particles.explode(cx, cy, 12, '#FFD700');
                    this.particles.spark(cx, cy, 8);
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
                    WB.Audio.wallClack(s * 0.5, ball.weapon ? ball.weapon.type : null);
                    if (WB.GLEffects) {
                        const tipX = ball.weapon.getTipX();
                        const tipY = ball.weapon.getTipY();
                        const a = WB.Config.ARENA;
                        const wx = Math.max(a.x, Math.min(a.x + a.width, tipX));
                        const wy = Math.max(a.y, Math.min(a.y + a.height, tipY));
                        WB.GLEffects.spawnWallImpact(wx, wy, s * 0.4, ball.color);
                        if (s >= 6) {
                            WB.Renderer.triggerShake(1 + s * 0.2);
                            if (this.particles) this.particles.spark(wx, wy, Math.floor(s));
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

                    // Ball collision visual effects — clean
                    if (WB.GLEffects) {
                        const midX = (ba.x + bb.x) / 2;
                        const midY = (ba.y + bb.y) / 2;
                        WB.GLEffects.spawnImpact(midX, midY, '#FFF', 15 + speed * 2);
                        if (speed >= 6) {
                            WB.Renderer.triggerShake(1 + speed * 0.3);
                        }
                        if (speed >= 10) {
                            WB.GLEffects.triggerHitStop(2);
                        }
                    }
                    // Ball collision particles — only on hard hits
                    if (this.particles && speed >= 6) {
                        const midX = (ba.x + bb.x) / 2;
                        const midY = (ba.y + bb.y) / 2;
                        this.particles.spark(midX, midY, Math.max(2, Math.floor(speed)));
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
        // Tip-to-tip + line-segment checks, with per-pair cooldown to prevent spam.
        for (let i = 0; i < this.balls.length; i++) {
            const ba = this.balls[i];
            if (!ba.isAlive) continue;
            for (let j = i + 1; j < this.balls.length; j++) {
                const bb = this.balls[j];
                if (!bb.isAlive || ba.side === bb.side) continue;
                const w1 = ba.weapon;
                const w2 = bb.weapon;
                if (w1.canParry && w2.canParry && !w1.unparryable && !w2.unparryable) {
                    // Per-weapon cooldown to prevent rapid re-parries
                    if (w1._parryCd > 0) w1._parryCd--;
                    if (w2._parryCd > 0) w2._parryCd--;
                    if (w1._parryCd > 0 || w2._parryCd > 0) continue;

                    const t1x = w1.getTipX(), t1y = w1.getTipY();
                    const t2x = w2.getTipX(), t2y = w2.getTipY();
                    const tipDist = WB.Physics.distanceSq(t1x, t1y, t2x, t2y);
                    // Shaft collision: check if one weapon's outer half crosses the other's tip
                    const m1x = w1.getMidX(), m1y = w1.getMidY();
                    const m2x = w2.getMidX(), m2y = w2.getMidY();
                    const parry = tipDist < 400 ||  // tips within 20px
                        WB.Physics.lineCircle(m1x, m1y, t1x, t1y, t2x, t2y, 10) ||
                        WB.Physics.lineCircle(m2x, m2y, t2x, t2y, t1x, t1y, 10);
                    if (parry) {
                        w1.angle += (WB.random() - 0.3) * Math.PI * 0.4;
                        w2.angle -= (WB.random() - 0.3) * Math.PI * 0.4;
                        w1.cooldown = Math.max(w1.cooldown, 10);
                        w2.cooldown = Math.max(w2.cooldown, 10);
                        w1._parryCd = 15;
                        w2._parryCd = 15;
                        // Reverse both weapons' spin direction on clash
                        w1._deflectReverse = 30;
                        w2._deflectReverse = 30;
                        const sparkX = (t1x + t2x) / 2;
                        const sparkY = (t1y + t2y) / 2;
                        this.particles.spark(sparkX, sparkY, 12);
                        WB.Audio.parry();
                        WB.Renderer.triggerShake(3);
                        if (WB.GLEffects) {
                            WB.GLEffects.spawnImpact(sparkX, sparkY, '#FFD700', 30);
                            WB.GLEffects.spawnClashSparks(sparkX, sparkY, 8, '#FFD700');
                            WB.GLEffects.triggerHitStop(3);
                        }
                    }
                }
            }
        }

        // 5. Update and check projectiles (cap at 40 to prevent FPS drops)
        if (this.projectiles.length > 40) {
            this.projectiles.splice(0, this.projectiles.length - 40);
        }
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
            // Compute excitement score for content pipeline
            if (this._excitement) {
                const winnerIdx = this.winner.side === 'left' ? 0 : 1;
                this._excitementScore = this._excitement.computeScore(winnerIdx, this.balls[0], this.balls[1]);
            }

            const loserSide = this.winner.side === 'left' ? 'right' : 'left';
            WB.Audio.death();
            WB.Audio.victoryFanfare();
            WB.Audio.victoryFireworks();
            WB.Renderer.triggerShake(12);
            if (WB.GLEffects) {
                WB.GLEffects.triggerSuperFlash(this.winner.color);
                WB.GLEffects.triggerHitStop(6);
                WB.GLEffects.triggerShockwave(this.winner.x, this.winner.y, 0.35);
                WB.GLEffects.triggerChromatic(0.4);
            }
            for (const b of this.balls) {
                if (b.side === loserSide && !b.isAlive) {
                    this.particles.explode(b.x, b.y, 20, b.color);
                    this.particles.spark(b.x, b.y, 10);
                }
            }
            for (const b of this.balls) {
                if (b.side === loserSide && b.isAlive) {
                    b.isAlive = false;
                    this.particles.explode(b.x, b.y, 20, b.color);
                    this.particles.spark(b.x, b.y, 10);
                }
            }
            if (this._isDraw) {
                for (const b of this.balls) {
                    this.particles.explode(b.x, b.y, 20, b.color);
                    this.particles.spark(b.x, b.y, 10);
                }
            }
            this.particles.explode(this.winner.x, this.winner.y, 15, this.winner.color);
            this.particles.spark(this.winner.x, this.winner.y, 10);

            // Post-battle cutscene (if enabled)
            if (WB.Cutscene && WB.Cutscene.enabled) {
                if (WB.Cutscene.startPostBattle(this.winner, this._isDraw, this.balls)) {
                    this.state = 'POST_BATTLE_CUTSCENE';
                    return;
                }
            }
            this.state = 'RESULT';
            this._resultTimer = 300; // ~5 seconds at 60fps (extra time for save button)
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

        // Layer additional fireworks bursts during result display
        if (this._resultTimer === 200) WB.Audio.victoryFireworks();
        if (this._resultTimer === 100) WB.Audio.victoryFireworks();

        // Auto-return to menu after timer
        if (this._resultTimer > 0) {
            this._resultTimer--;
            if (this._resultTimer <= 0) {
                this._returnFromResult();
            }
        }
    },

    _returnFromResult() {
        if (WB.GL) WB.GL.clearMotionBlurHistory();
        // Unseed RNG after live battles (replays unseed via SimUI.onReplayEnd)
        if (!WB.SimUI.isReplaying && WB.RNG._seeded) {
            WB.RNG.unseed();
        }
        if (WB.SimUI.isReplaying) {
            const returnState = WB.SimUI.onReplayEnd();
            this.state = returnState;
        } else if (WB.Studio && WB.Studio._isPreview) {
            WB.Studio._isPreview = false;
            this.state = 'STUDIO';
        } else if (WB.Studio && WB.Studio._isRecording) {
            WB.Studio._isRecording = false;
            if (WB.Recorder) WB.Recorder.stop();
            this.state = 'STUDIO';
        } else {
            this.state = 'MENU';
        }
        const wallShift = WB.ArenaModifiers.getModifier('wallshift');
        if (wallShift && wallShift.restore) wallShift.restore();
        WB.ArenaModifiers.clear();
        this._restoreMenuSize();
        this._playAgainBtn = null;
    }
};

// ═══════════════════════════════════════════════════════════════
//  DEBUG / TESTING UTILITIES
//  Console helpers for rapid testing. Persist across reloads.
//  Usage (from browser console or automation):
//
//    testFight('louisiana', 'arizona')       — instant battle
//    testFight('florida', 'new-york', 123)   — seeded for replay
//    listWeapons()                            — show all weapon types
//    listWeapons('states')                    — filter by pack
// ═══════════════════════════════════════════════════════════════

/**
 * Launch a battle instantly, skipping menu & countdown.
 * @param {string} left  — weapon type for P1 (e.g. 'louisiana', 'zeus')
 * @param {string} right — weapon type for P2
 * @param {number} [seed] — optional RNG seed for deterministic replay
 * @returns {string} description of launched fight
 */
window.testFight = function(left, right, seed) {
    if (!WB.Game || !WB.UI) return 'Game not initialized';
    WB.UI.selectedLeft = left;
    WB.UI.selectedRight = right;
    if (seed !== undefined) {
        WB.RNG.seed(seed);
        WB.RNG._seeded = true;
    }
    WB.Game.startCountdown();
    setTimeout(function() { WB.Game.startBattle(); }, 100);
    return left + ' vs ' + right + (seed !== undefined ? ' (seed: ' + seed + ')' : '');
};

/**
 * List all registered weapon types, optionally filtered by pack.
 * @param {string} [pack] — 'classic', 'elemental', 'pantheon', 'egyptian', 'states'
 * @returns {string[]} array of weapon type strings
 */
window.listWeapons = function(pack) {
    var reg = WB.WeaponRegistry;
    if (!reg || !reg._weapons) return 'Registry not loaded';
    var types = Object.keys(reg._weapons);
    if (pack) {
        types = types.filter(function(t) { return reg._weapons[t].pack === pack; });
    }
    console.table(types.map(function(t) {
        return { type: t, pack: reg._weapons[t].pack };
    }));
    return types;
};

/**
 * Run N headless sim battles between two weapons. Returns win rate.
 * @param {string} left  — weapon type for P1
 * @param {string} right — weapon type for P2
 * @param {number} [n=20] — number of battles
 * @returns {string} summary with win counts
 */
window.testSim = function(left, right, n) {
    n = n || 20;
    if (!WB.Simulator) return 'Simulator not loaded';
    var leftWins = 0, rightWins = 0, errors = 0;
    for (var i = 0; i < n; i++) {
        try {
            var r = WB.Simulator.runBattle(left, right);
            if (r.winner === 'left') leftWins++;
            else rightWins++;
        } catch(e) {
            errors++;
        }
    }
    var result = left + ' ' + leftWins + 'W vs ' + right + ' ' + rightWins + 'W';
    if (errors > 0) result += ' (' + errors + ' errors)';
    result += ' (' + n + ' battles)';
    console.log(result);
    return result;
};

/**
 * Advance exactly one game-loop tick. Returns a Promise that resolves
 * after the loop processes the step (not just the next rAF, but the
 * actual game-loop iteration).
 */
window.debugStep = function() {
    return new Promise(function(resolve) {
        WB.Game._debugStepResolve = resolve;
        WB.Game._debugStepQueued = true;
    });
};

/**
 * Capture N sequential frames from a live battle into window._capturedFrames.
 * Uses pause+step to guarantee exactly one physics tick per capture.
 *
 * Frames are stored as base64 data URLs in window._capturedFrames[].
 * Use downloadFrame(i) to save individual frames, or the companion
 * Python script to composite them:
 *   python3 tools/ghost-composite.py ~/Downloads/frame_*.png
 *
 * @param {number} [count=5]  — number of frames to capture
 * @param {number} [skip=4]   — frames to advance between captures (4 ≈ 67ms gaps)
 * @returns {Promise<string>} summary when done
 *
 * Usage:
 *   testFight('zeus','ares',42)
 *   // wait ~3s for action, then:
 *   (async()=>{ await sleep(3000); await captureFrames(); })()
 *   // download one at a time:
 *   downloadFrame(0); downloadFrame(1); ...etc
 */
window.captureFrames = async function(count, skip) {
    count = count || 5;
    skip = skip || 4;

    if (WB.Game.state !== 'BATTLE') return 'Not in BATTLE state — use testFight() first';

    var G = WB.Game;
    window._capturedFrames = [];
    window._captureSkip = skip;

    // Pause the game loop
    G._debugPaused = true;
    // Wait two rAF ticks to ensure the loop has stopped
    await new Promise(function(r) { requestAnimationFrame(function() { requestAnimationFrame(r); }); });

    for (var i = 0; i < count; i++) {
        // Advance `skip` frames between captures (0 for first frame = capture current state)
        var stepsNeeded = (i === 0) ? 0 : skip;
        for (var s = 0; s < stepsNeeded; s++) {
            await debugStep();
        }

        // Capture the current canvas
        var dataUrl = G.canvas.toDataURL('image/png');
        window._capturedFrames.push(dataUrl);
        console.log('Captured frame ' + i + '/' + (count - 1) +
            ' (' + Math.round(dataUrl.length / 1024) + 'KB)');
    }

    // Resume
    G._debugPaused = false;
    return 'Captured ' + count + ' frames (' + skip + '-frame gaps). ' +
        'Use downloadFrame(0)..downloadFrame(' + (count - 1) + ') to save, ' +
        'or downloadAllFrames() with delays.';
};

/**
 * Composite captured frames into a single ghost-overlay image and download it.
 * Earlier frames are more opaque; later frames fade out — showing motion trails.
 *
 * Modes:
 *   'ghost'  — alpha-blended overlay (default) — best for motion/trajectory
 *   'strip'  — horizontal side-by-side strip — best for comparing positions
 *   'diff'   — only changed pixels highlighted — best for seeing what moved
 *
 * @param {string} [mode='ghost'] — composite mode
 * @param {string} [filename]     — download filename (auto-generated if omitted)
 * @returns {Promise<string>}
 *
 * Full pipeline:
 *   testFight('florida','new-york',42)
 *   (async()=>{ await sleep(3000); await captureFrames(); await ghostComposite(); })()
 */
window.ghostComposite = async function(mode, filename) {
    mode = mode || 'ghost';
    if (!window._capturedFrames || window._capturedFrames.length < 2) {
        return 'Need >= 2 captured frames. Run captureFrames() first.';
    }

    var frames = window._capturedFrames;
    var n = frames.length;

    // Load all data URLs as Image objects
    var images = await Promise.all(frames.map(function(dataUrl) {
        return new Promise(function(resolve) {
            var img = new Image();
            img.onload = function() { resolve(img); };
            img.src = dataUrl;
        });
    }));

    var w = images[0].width;
    var h = images[0].height;

    var canvas, ctx;

    if (mode === 'strip') {
        // Side-by-side horizontal strip
        canvas = document.createElement('canvas');
        canvas.width = w * n;
        canvas.height = h;
        ctx = canvas.getContext('2d');
        ctx.fillStyle = '#1e1e1e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (var i = 0; i < n; i++) {
            ctx.drawImage(images[i], i * w, 0);
            // Frame label
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(i * w, 0, 50, 30);
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 18px monospace';
            ctx.fillText('F' + i, i * w + 8, 22);
        }
    } else if (mode === 'diff') {
        // Difference highlighting
        canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        ctx = canvas.getContext('2d');
        // Draw first frame as dim background
        ctx.globalAlpha = 0.3;
        ctx.drawImage(images[0], 0, 0);
        ctx.globalAlpha = 1.0;

        var tints = ['#FF5050', '#50FF50', '#5078FF', '#FFFF50', '#50FFFF'];
        for (var i = 1; i < n; i++) {
            // Get pixel data for previous and current
            var tmpA = document.createElement('canvas');
            tmpA.width = w; tmpA.height = h;
            var ctxA = tmpA.getContext('2d');
            ctxA.drawImage(images[i - 1], 0, 0);
            var dataA = ctxA.getImageData(0, 0, w, h);

            var tmpB = document.createElement('canvas');
            tmpB.width = w; tmpB.height = h;
            var ctxB = tmpB.getContext('2d');
            ctxB.drawImage(images[i], 0, 0);
            var dataB = ctxB.getImageData(0, 0, w, h);

            // Build diff mask
            var diffData = ctx.createImageData(w, h);
            var tint = tints[i % tints.length];
            var tr = parseInt(tint.slice(1, 3), 16);
            var tg = parseInt(tint.slice(3, 5), 16);
            var tb = parseInt(tint.slice(5, 7), 16);

            for (var p = 0; p < dataA.data.length; p += 4) {
                var dr = Math.abs(dataA.data[p] - dataB.data[p]);
                var dg = Math.abs(dataA.data[p + 1] - dataB.data[p + 1]);
                var db = Math.abs(dataA.data[p + 2] - dataB.data[p + 2]);
                var maxDiff = Math.max(dr, dg, db);
                if (maxDiff > 20) {
                    var alpha = Math.min(255, maxDiff * 3);
                    diffData.data[p] = tr;
                    diffData.data[p + 1] = tg;
                    diffData.data[p + 2] = tb;
                    diffData.data[p + 3] = alpha;
                }
            }
            ctx.putImageData(diffData, 0, 0);
        }
    } else {
        // Ghost mode (default): alpha-blended overlay
        canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        ctx = canvas.getContext('2d');
        // White background (matches game cream)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);

        for (var i = 0; i < n; i++) {
            // First frame fully opaque, last at 20%
            ctx.globalAlpha = 1.0 - (i * 0.8 / Math.max(n - 1, 1));
            ctx.drawImage(images[i], 0, 0);
        }
        ctx.globalAlpha = 1.0;
    }

    // Show the composite: overlay it on the page as a full-screen <img>
    // Click to dismiss. Also store as window._compositeDataUrl for download.
    var dataUrl = canvas.toDataURL('image/png');
    window._compositeDataUrl = dataUrl;

    var overlay = document.createElement('div');
    overlay.id = 'ghost-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;' +
        'background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;' +
        'justify-content:center;cursor:pointer;flex-direction:column;';
    var img = document.createElement('img');
    img.src = dataUrl;
    img.style.cssText = 'max-width:95%;max-height:90%;object-fit:contain;border:2px solid #FFD700;';
    var label = document.createElement('div');
    label.style.cssText = 'color:#FFD700;font:bold 14px monospace;margin-top:8px;';
    label.textContent = mode.toUpperCase() + ' — ' + n + ' frames, ' +
        (window._captureSkip || '?') + '-frame gaps — click to dismiss';
    overlay.appendChild(img);
    overlay.appendChild(label);
    overlay.addEventListener('click', function() { overlay.remove(); });
    document.body.appendChild(overlay);

    return mode + ' composite (' + w + 'x' + h + ', ' + n + ' frames). Click overlay to dismiss.';
};

/**
 * One-shot: start a fight, wait for action, capture frames, show ghost composite.
 * Returns a Promise. Use from console or preview_eval.
 *
 * @param {string} left   — weapon type for P1
 * @param {string} right  — weapon type for P2
 * @param {object} [opts] — { seed, wait, count, skip, mode }
 *   seed:  RNG seed (default: random)
 *   wait:  ms to let the battle run before capturing (default: 3000)
 *   count: number of frames (default: 5)
 *   skip:  frames between captures (default: 6)
 *   mode:  'ghost'|'strip'|'diff' (default: 'ghost')
 *
 * Example:
 *   ghostFight('california','texas',{seed:42,skip:8})
 */
window.ghostFight = async function(left, right, opts) {
    opts = opts || {};
    var seed = opts.seed;
    var wait = opts.wait || 3000;
    var count = opts.count || 5;
    var skip = opts.skip || 6;
    var mode = opts.mode || 'ghost';

    testFight(left, right, seed);
    await sleep(wait);
    await captureFrames(count, skip);
    return await ghostComposite(mode);
};

/**
 * Convenience: sleep for ms milliseconds. Use with await.
 */
window.sleep = function(ms) {
    return new Promise(function(r) { setTimeout(r, ms); });
};

// Start on load
window.addEventListener('load', () => {
    WB.Game.init();
});
