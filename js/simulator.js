window.WB = window.WB || {};

// Headless battle simulation engine.
// Runs battles without rendering/audio for batch excitement scoring.
WB.Simulator = {
    // Run a single headless battle. Returns result object.
    runBattle(weaponLeft, weaponRight, seed) {
        WB.RNG.seed(seed);

        // Save real modules and install no-op stubs
        const realGame = WB.Game;
        const realAudio = WB.Audio;
        const realRenderer = WB.Renderer;
        const realGLEffects = WB.GLEffects;
        WB.Audio = this._noopAudio;
        WB.Renderer = this._noopRenderer;
        WB.GLEffects = this._noopGLEffects;

        // Create sim game state (weapons access WB.Game.balls etc.)
        const simGame = this._createSimGame(weaponLeft, weaponRight);
        WB.Game = simGame;

        // Set up excitement tracker
        const excitement = new WB.Excitement();
        simGame._excitement = excitement;

        // Initial velocities (same as startBattle)
        for (const ball of simGame.balls) {
            ball.vx = (WB.random() - 0.5) * 14;
            ball.vy = (WB.random() - 0.5) * 14;
        }

        // Run simulation
        const MAX_FRAMES = 7200; // 2 minutes safety cap
        let winner = null;
        let frame = 0;

        while (frame < MAX_FRAMES) {
            this._stepFrame(simGame, excitement);
            frame++;

            // Check win condition: all balls on a side dead, or original (king) dead
            const leftAlive = simGame.balls.filter(b => b.side === 'left' && b.isAlive);
            const rightAlive = simGame.balls.filter(b => b.side === 'right' && b.isAlive);
            const leftOrig = simGame.balls.find(b => b.side === 'left' && b.isOriginal);
            const rightOrig = simGame.balls.find(b => b.side === 'right' && b.isOriginal);
            const leftKingDead = leftOrig && !leftOrig.isAlive;
            const rightKingDead = rightOrig && !rightOrig.isAlive;

            const leftDead = leftAlive.length === 0 || leftKingDead;
            const rightDead = rightAlive.length === 0 || rightKingDead;

            if (leftDead || rightDead) {
                if (leftDead && rightDead) {
                    // Simultaneous death — coin flip
                    winner = WB.random() < 0.5 ? simGame.balls[0] : simGame.balls[1];
                } else {
                    const winnerSide = leftDead ? 'right' : 'left';
                    winner = simGame.balls.find(b => b.side === winnerSide && b.isOriginal && b.isAlive)
                          || simGame.balls.find(b => b.side === winnerSide && b.isAlive);
                }
                break;
            }
        }

        // If no winner by timeout, award to the ball with more HP (no draws)
        if (!winner && simGame.balls.length >= 2) {
            const b1 = simGame.balls[0];
            const b2 = simGame.balls[1];
            if (b1.isAlive && b2.isAlive) {
                if (b1.hp !== b2.hp) {
                    winner = b1.hp > b2.hp ? b1 : b2;
                } else {
                    // True tie — more hits landed wins; coin flip if still tied
                    const h1 = b1.weapon.hitCount;
                    const h2 = b2.weapon.hitCount;
                    winner = h1 !== h2 ? (h1 > h2 ? b1 : b2) : (WB.random() < 0.5 ? b1 : b2);
                }
            } else {
                winner = b1.isAlive ? b1 : (b2.isAlive ? b2 : null);
            }
        }

        // Compute score — winnerIdx is 0 (left side) or 1 (right side)
        const winnerIdx = winner ? (winner.side === 'left' ? 0 : 1) : -1;
        const score = winnerIdx >= 0
            ? excitement.computeScore(winnerIdx, simGame.balls[0], simGame.balls[1])
            : { total: 0, breakdown: {}, meta: { frames: frame, totalHits: excitement.totalHits } };

        // Restore real modules
        WB.Game = realGame;
        WB.Audio = realAudio;
        WB.Renderer = realRenderer;
        WB.GLEffects = realGLEffects;
        WB.RNG.unseed();

        return {
            seed,
            weaponLeft,
            weaponRight,
            winner: winner ? winner.side : 'draw',
            winnerWeapon: winner ? winner.weaponType : null,
            winnerHp: winner ? Math.ceil(winner.hp) : 0,
            score,
            frames: frame,
        };
    },

    // Run N battles and return results sorted by excitement.
    runBatch(weaponLeft, weaponRight, count) {
        const results = [];
        for (let i = 0; i < count; i++) {
            const seed = WB.RNG.generateSeed();
            results.push(this.runBattle(weaponLeft, weaponRight, seed));
        }
        results.sort((a, b) => b.score.total - a.score.total);
        return results;
    },

    _createSimGame(weaponLeft, weaponRight) {
        const arena = WB.Config.ARENA;
        const b1x = arena.x + arena.width * 0.25;
        const b2x = arena.x + arena.width * 0.75;
        const cy = arena.y + arena.height / 2;

        const noopParticles = {
            particles: [],
            emit() {},
            explode() {},
            spark() {},
            update() {},
            draw() {}
        };

        const balls = [
            new WB.Ball(b1x, cy, weaponLeft, 'left'),
            new WB.Ball(b2x, cy, weaponRight, 'right'),
        ];
        balls[0].vx = 0; balls[0].vy = 0;
        balls[1].vx = 0; balls[1].vy = 0;

        return {
            balls,
            projectiles: [],
            particles: noopParticles,
            state: 'BATTLE',
            _excitement: null,
        };
    },

    // One frame of battle simulation — mirrors updateBattle() exactly.
    _stepFrame(game, excitement) {
        // 1. Update balls
        for (const ball of game.balls) {
            if (ball.isAlive) ball.update();
        }

        // 1b. Weapon tip wall bounce
        if (WB.Config.WEAPON_WALL_BOUNCE) {
            for (const ball of game.balls) {
                if (!ball.isAlive) continue;
                WB.Physics.weaponWallBounce(ball, WB.Config.ARENA);
            }
        }

        // 2. Ball-ball collision (pairwise for N balls)
        for (let i = 0; i < game.balls.length; i++) {
            const ba = game.balls[i];
            if (!ba.isAlive) continue;
            for (let j = i + 1; j < game.balls.length; j++) {
                const bb = game.balls[j];
                if (!bb.isAlive) continue;
                if (WB.Physics.circleCircle(ba.x, ba.y, ba.radius, bb.x, bb.y, bb.radius)) {
                    WB.Physics.separateCircles(ba, bb);
                    WB.Physics.resolveCircleCircle(ba, bb);
                    // Body-contact weapons (only cross-side)
                    if (ba.side !== bb.side) {
                        for (const [attacker, target] of [[ba, bb], [bb, ba]]) {
                            const w = attacker.weapon;
                            if (w.reach === 0 && w.canHit && w.canHit() && target.isAlive) {
                                w.onHit(target);
                                excitement.recordHit();
                            }
                        }
                    }
                }
            }
        }

        // 3. Melee weapon collision
        for (const attacker of game.balls) {
            if (!attacker.isAlive) continue;
            const weapon = attacker.weapon;
            if (weapon.reach === 0 || !weapon.canHit() || weapon.isRanged) continue;

            for (const target of game.balls) {
                if (target === attacker || !target.isAlive || target.side === attacker.side) continue;
                const midX = attacker.x + Math.cos(weapon.angle) * weapon.reach * 0.4;
                const midY = attacker.y + Math.sin(weapon.angle) * weapon.reach * 0.4;
                const tipX = weapon.getTipX();
                const tipY = weapon.getTipY();

                if (WB.Physics.lineCircle(midX, midY, tipX, tipY, target.x, target.y, target.radius)) {
                    weapon.onHit(target);
                    excitement.recordHit();
                }
            }
        }

        // 4. Weapon-weapon parry (cross-side pairs)
        for (let i = 0; i < game.balls.length; i++) {
            const ba = game.balls[i];
            if (!ba.isAlive) continue;
            for (let j = i + 1; j < game.balls.length; j++) {
                const bb = game.balls[j];
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
                    }
                }
            }
        }

        // 5. Projectiles
        for (let i = game.projectiles.length - 1; i >= 0; i--) {
            const proj = game.projectiles[i];
            proj.update();

            if (proj.alive) {
                for (const target of game.balls) {
                    if (proj.checkHit(target)) {
                        excitement.recordHit();
                        break;
                    }
                }
            }

            if (!proj.alive) {
                game.projectiles.splice(i, 1);
            }
        }

        // 6. Record frame metrics (use first two original balls)
        if (game.balls.length >= 2) {
            excitement.recordFrame(game.balls[0], game.balls[1]);
        }
    },

    // No-op stubs
    _noopAudio: {
        init() {}, resume() {}, wallClack() {}, ballClack() {},
        weaponHit() {}, parry() {}, projectileFire() {},
        death() {}, superActivate() {}, poisonTick() {},
        comboClack() {}, victoryFanfare() {}, countdownClack() {}, menuClack() {},
        gunClack() {}
    },
    _noopRenderer: {
        shakeX: 0, shakeY: 0, shakeFrames: 0,
        triggerShake() {},
        drawFrame() {}, drawCountdown() {}, drawResult() {},
        drawWeaponIcon() {}, drawTitle() {}, drawStats() {}
    },
    _noopGLEffects: {
        _impacts: [], _dmgNumbers: [], _wallImpacts: [],
        _combo: { left: 0, right: 0, leftTimer: 0, rightTimer: 0, leftDisplay: 0, rightDisplay: 0 },
        _superFlash: 0, _arenaPulse: 0, _hitStop: 0, _collisionFlash: 0,
        _chromatic: 0, _barrel: 0, _shockwaves: [], _clashSparks: [],
        init() {}, resetFrame() {}, update() {}, draw() {},
        applyShake() {}, clearShake() {},
        spawnImpact() {}, spawnDamageNumber() {}, spawnWallImpact() {},
        triggerSuperFlash() {}, triggerArenaPulse() {},
        triggerHitStop() {}, triggerCollisionFlash() {},
        triggerChromatic() {}, triggerBarrel() {},
        triggerShockwave() {}, spawnClashSparks() {},
        incrementCombo() {}, getCombo() { return 0; },
        drawSpeedLines() {}, drawImpacts() {},
        drawDamageNumbers() {}, drawVignette() {},
        drawSuperFlash() {}, drawArenaPulse() {},
        drawComboCounters() {}, drawWallImpacts() {},
        drawCollisionFlash() {}, drawChromatic() {},
        drawBarrel() {}, drawShockwaves() {},
        drawClashSparks() {},
        isHitStopped() { return false; },
    }
};
