window.WB = window.WB || {};

WB.Renderer = {
    shakeX: 0,
    shakeY: 0,
    shakeFrames: 0,

    triggerShake(intensity) {
        this.shakeFrames = 6;
        this.shakeX = (Math.random() - 0.5) * intensity;
        this.shakeY = (Math.random() - 0.5) * intensity;
    },

    drawFrame(game) {
        const c = WB.Config;
        const B = WB.GLBatch;
        const T = WB.GLText;

        // Apply screen shake via projection offset
        if (this.shakeFrames > 0) {
            WB.GLEffects.applyShake(this.shakeX, this.shakeY);
            this.shakeX *= -0.7;
            this.shakeY *= -0.7;
            this.shakeFrames--;
        } else {
            WB.GLEffects.clearShake();
        }

        // Background
        B.fillRect(-10, -10, c.CANVAS_WIDTH + 20, c.CANVAS_HEIGHT + 20, '#FFF8E7');

        // Title bar
        this.drawTitle(game);

        // Arena background
        B.fillRect(c.ARENA.x, c.ARENA.y, c.ARENA.width, c.ARENA.height, '#FFFDF5');

        // Arena border
        B.strokeRect(c.ARENA.x, c.ARENA.y, c.ARENA.width, c.ARENA.height, '#333', 3);

        // Draw projectiles (behind balls)
        for (const p of game.projectiles) {
            p.draw();
        }

        // Speed lines behind fast balls
        for (const ball of game.balls) {
            if (ball.isAlive) {
                WB.GLEffects.drawSpeedLines(ball);
            }
        }

        // Draw weapons behind balls, then balls on top
        for (const ball of game.balls) {
            if (ball.isAlive) {
                ball.weapon.draw();
            }
        }
        // Flush before text for proper draw order
        B.flush();

        for (const ball of game.balls) {
            if (ball.isAlive) {
                ball.draw();
            } else {
                ball.drawDead();
            }
        }

        // Draw particles on top
        game.particles.draw();

        // Draw fancy effects on top of everything
        WB.GLEffects.draw();

        // Stats below arena
        B.flush();
        this.drawStats(game);
    },

    drawTitle(game) {
        const c = WB.Config;
        const T = WB.GLText;
        const B = WB.GLBatch;
        const cx = c.CANVAS_WIDTH / 2;
        const b1 = game.balls[0];
        const b2 = game.balls[1];
        const name1 = WB.Config.WEAPON_NAMES[b1.weaponType] || b1.weaponType;
        const name2 = WB.Config.WEAPON_NAMES[b2.weaponType] || b2.weaponType;
        const font = 'bold 18px "Courier New", monospace';

        // Left weapon name (stroke + fill)
        T.drawTextWithStroke(name1, cx - 22, 48, font, b1.color, '#333', 3, 'right', 'alphabetic');

        // VS
        T.drawText('VS', cx, 48, 'bold 14px "Courier New", monospace', '#333', 'center', 'alphabetic');

        // Right weapon name
        T.drawTextWithStroke(name2, cx + 22, 48, font, b2.color, '#333', 3, 'left', 'alphabetic');

        // Draw small weapon icon shapes next to names
        T.flush();
        const nameWidth1 = T.measureText(name1, font);
        const nameWidth2 = T.measureText(name2, font);
        this.drawWeaponIcon(b1.weaponType, cx - 22 - nameWidth1 - 18, 40, b1.color);
        this.drawWeaponIcon(b2.weaponType, cx + 22 + nameWidth2 + 6, 40, b2.color);
    },

    drawStats(game) {
        const a = WB.Config.ARENA;
        const B = WB.GLBatch;
        const T = WB.GLText;

        // ── Modern Super Meters ──
        const meterY = a.y + a.height + 10;
        const meterH = 18;
        const meterGap = 8;
        const meterW = (a.width - meterGap) / 2;
        const pillR = meterH / 2; // radius for rounded ends

        for (let i = 0; i < 2; i++) {
            const ball = game.balls[i];
            const weapon = ball.weapon;
            const progress = weapon.superActive ? 1 : Math.min(1, weapon.hitCount / weapon.superThreshold);
            const mx = i === 0 ? a.x : a.x + meterW + meterGap;
            const mCenterY = meterY + meterH / 2;

            // Track background — dark pill shape
            B.fillCircle(mx + pillR, mCenterY, pillR, '#1A1A2E');
            B.fillCircle(mx + meterW - pillR, mCenterY, pillR, '#1A1A2E');
            B.fillRect(mx + pillR, meterY, meterW - pillR * 2, meterH, '#1A1A2E');

            // Inner shadow — slightly lighter inset
            B.setAlpha(0.3);
            B.fillCircle(mx + pillR, mCenterY, pillR - 1.5, '#0D0D1A');
            B.fillCircle(mx + meterW - pillR, mCenterY, pillR - 1.5, '#0D0D1A');
            B.fillRect(mx + pillR, meterY + 1.5, meterW - pillR * 2, meterH - 3, '#0D0D1A');
            B.restoreAlpha();

            // Meter fill
            if (progress > 0) {
                const fillW = meterW * progress;
                const baseColor = weapon.superActive ? '#FFD700' : ball.color;

                if (i === 0) {
                    // Left meter fills left→right
                    const endX = mx + fillW;
                    B.fillCircle(mx + pillR, mCenterY, pillR - 2, baseColor);
                    if (fillW > pillR * 2) {
                        B.fillRect(mx + pillR, meterY + 2, fillW - pillR * 2, meterH - 4, baseColor);
                        if (fillW >= meterW - 1) {
                            B.fillCircle(mx + meterW - pillR, mCenterY, pillR - 2, baseColor);
                        }
                    }

                    // Highlight stripe (top edge gloss)
                    B.setAlpha(0.25);
                    const glossW = Math.min(fillW - 4, meterW - 8);
                    if (glossW > 0) {
                        B.fillRect(mx + pillR, meterY + 3, glossW, 3, '#FFF');
                    }
                    B.restoreAlpha();

                    // Leading edge glow
                    if (progress < 1 && progress > 0.05) {
                        B.setAlpha(0.5);
                        B.fillCircle(endX, mCenterY, 4, baseColor);
                        B.restoreAlpha();
                        B.setAlpha(0.15);
                        B.fillCircle(endX, mCenterY, 8, baseColor);
                        B.restoreAlpha();
                    }
                } else {
                    // Right meter fills right→left
                    const startX = mx + meterW - fillW;
                    B.fillCircle(mx + meterW - pillR, mCenterY, pillR - 2, baseColor);
                    if (fillW > pillR * 2) {
                        B.fillRect(startX + pillR, meterY + 2, fillW - pillR * 2, meterH - 4, baseColor);
                        if (fillW >= meterW - 1) {
                            B.fillCircle(mx + pillR, mCenterY, pillR - 2, baseColor);
                        }
                    }

                    // Highlight stripe
                    B.setAlpha(0.25);
                    const glossW = Math.min(fillW - 4, meterW - 8);
                    if (glossW > 0) {
                        B.fillRect(mx + meterW - pillR - glossW, meterY + 3, glossW, 3, '#FFF');
                    }
                    B.restoreAlpha();

                    // Leading edge glow
                    if (progress < 1 && progress > 0.05) {
                        B.setAlpha(0.5);
                        B.fillCircle(startX, mCenterY, 4, baseColor);
                        B.restoreAlpha();
                        B.setAlpha(0.15);
                        B.fillCircle(startX, mCenterY, 8, baseColor);
                        B.restoreAlpha();
                    }
                }

                // Super active — pulsing golden overlay + outer glow
                if (weapon.superActive) {
                    const t = Date.now() * 0.005;
                    const pulse = 0.2 + Math.sin(t) * 0.12;
                    B.setAlpha(pulse);
                    B.fillCircle(mx + pillR, mCenterY, pillR - 2, '#FFF');
                    B.fillCircle(mx + meterW - pillR, mCenterY, pillR - 2, '#FFF');
                    B.fillRect(mx + pillR, meterY + 2, meterW - pillR * 2, meterH - 4, '#FFF');
                    B.restoreAlpha();

                    // Outer glow
                    B.setAlpha(0.08 + Math.sin(t * 1.3) * 0.04);
                    B.fillCircle(mx + meterW / 2, mCenterY, meterW / 2, '#FFD700');
                    B.restoreAlpha();
                }
            }

            // Pill outline
            B.strokeCircle(mx + pillR, mCenterY, pillR, '#444', 1.5);
            B.strokeCircle(mx + meterW - pillR, mCenterY, pillR, '#444', 1.5);
            B.line(mx + pillR, meterY, mx + meterW - pillR, meterY, '#444', 1.5);
            B.line(mx + pillR, meterY + meterH, mx + meterW - pillR, meterY + meterH, '#444', 1.5);

            // Segment dividers (subtle notches)
            const ticks = weapon.superThreshold;
            for (let t = 1; t < ticks; t++) {
                const tickX = i === 0
                    ? mx + (t / ticks) * meterW
                    : mx + meterW - (t / ticks) * meterW;
                B.setAlpha(0.2);
                B.line(tickX, meterY + 3, tickX, meterY + meterH - 3, '#AAA', 1);
                B.restoreAlpha();
            }
        }

        B.flush();

        // ── Meter labels ──
        const labelY = meterY + meterH / 2 + 1;
        const smallFont = 'bold 9px "Courier New", monospace';

        for (let i = 0; i < 2; i++) {
            const weapon = game.balls[i].weapon;
            const mx = i === 0 ? a.x : a.x + meterW + meterGap;
            const label = weapon.superActive ? 'SUPER!' : `${weapon.hitCount}/${weapon.superThreshold}`;
            const labelColor = weapon.superActive ? '#FFF' : '#CCC';
            T.drawTextWithStroke(label, mx + meterW / 2, labelY, smallFont,
                labelColor, '#000', 2, 'center', 'middle');
        }

        // ── Scaling stats below meters ──
        const statY = meterY + meterH + 14;
        const statFont = 'bold 13px "Courier New", monospace';

        const leftText = game.balls[0].weapon.getScalingDisplay();
        T.drawTextWithStroke(leftText, a.x + 5, statY, statFont, game.balls[0].color, '#333', 2, 'left', 'alphabetic');

        const rightText = game.balls[1].weapon.getScalingDisplay();
        T.drawTextWithStroke(rightText, a.x + a.width - 5, statY, statFont, game.balls[1].color, '#333', 2, 'right', 'alphabetic');
    },

    drawWeaponIcon(type, x, y, color) {
        const B = WB.GLBatch;
        B.pushTranslate(x, y);

        switch (type) {
            // ─── Generic weapons ───
            case 'sword':
                B.fillRect(-1, -8, 2, 16, '#C0C0C0');
                B.fillRect(-4, 4, 8, 2, '#DAA520');
                B.fillRect(-1, 6, 2, 4, '#8B5E3C');
                break;
            case 'bow':
                B.drawQuadratic(3 + Math.cos(-Math.PI * 0.4) * 8, Math.sin(-Math.PI * 0.4) * 8,
                    3 + 8, 0,
                    3 + Math.cos(Math.PI * 0.4) * 8, Math.sin(Math.PI * 0.4) * 8,
                    '#8B5A2B', 2);
                B.line(3 + Math.cos(-Math.PI * 0.4) * 8, Math.sin(-Math.PI * 0.4) * 8,
                    0, 0, '#DDD', 1);
                B.line(0, 0,
                    3 + Math.cos(Math.PI * 0.4) * 8, Math.sin(Math.PI * 0.4) * 8,
                    '#DDD', 1);
                break;
            case 'hammer':
                B.fillRect(-1, -2, 2, 12, '#7B4B2A');
                B.fillRect(-5, -7, 10, 6, '#777');
                break;
            case 'shuriken': {
                const pts = [];
                for (let i = 0; i < 8; i++) {
                    const a = (i * Math.PI) / 4;
                    const r = i % 2 === 0 ? 8 : 3;
                    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
                }
                B.fillPolygon(pts, '#777');
                B.fillCircle(0, 0, 2, '#333');
                break;
            }
            case 'sawblade': {
                const pts = [];
                for (let i = 0; i < 16; i++) {
                    const a = (i * Math.PI) / 8;
                    const r = i % 2 === 0 ? 8 : 5;
                    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
                }
                B.fillPolygon(pts, '#AAA');
                B.fillCircle(0, 0, 2, '#555');
                break;
            }
            case 'ghost':
                B.setAlpha(0.5);
                B.fillCircle(0, 0, 7, '#88DDFF');
                B.restoreAlpha();
                B.setAlpha(0.8);
                B.strokeCircle(0, 0, 7, '#AAEEFF', 1.5);
                B.restoreAlpha();
                B.fillCircle(-2.5, -1, 1.5, '#FFF');
                B.fillCircle(2.5, -1, 1.5, '#FFF');
                B.setAlpha(0.4);
                B.fillTriangle(-3, 5, 0, 3, 3, 5, '#88DDFF');
                B.fillTriangle(-5, 7, -2, 4, 0, 8, '#88DDFF');
                B.fillTriangle(0, 8, 2, 4, 5, 7, '#88DDFF');
                B.restoreAlpha();
                break;
            case 'clacker':
                B.line(-5, -10, -5, 0, '#888', 1);
                B.line(0, -10, 0, 0, '#888', 1);
                B.line(5, -10, 5, 0, '#888', 1);
                B.fillCircle(-5, 3, 4, '#D4D4D4');
                B.strokeCircle(-5, 3, 4, '#999', 1);
                B.fillCircle(0, 3, 4, '#D4D4D4');
                B.strokeCircle(0, 3, 4, '#999', 1);
                B.fillCircle(5, 3, 4, '#D4D4D4');
                B.strokeCircle(5, 3, 4, '#999', 1);
                B.setAlpha(0.6);
                B.fillCircle(-6, 1.5, 1.2, '#FFF');
                B.fillCircle(-1, 1.5, 1.2, '#FFF');
                B.fillCircle(4, 1.5, 1.2, '#FFF');
                B.restoreAlpha();
                B.fillRect(-8, -11, 16, 2, '#666');
                break;
            case 'gunclacker':
                B.fillRect(-2, -6, 10, 4, '#555');
                B.strokeRect(-2, -6, 10, 4, '#333', 1);
                B.fillCircle(2, -4, 3, '#777');
                B.strokeCircle(2, -4, 3, '#555', 0.8);
                B.fillRect(-3, -3, 5, 6, '#8B4513');
                B.strokeRect(-3, -3, 5, 6, '#5C2D0A', 0.8);
                B.setAlpha(0.5);
                B.fillCircle(9, -4, 3, '#FFD700');
                B.restoreAlpha();
                break;

            // ─── Elemental weapons ───
            case 'fire':
                // Flame icon — layered teardrops
                B.fillTriangle(-5, 6, 0, -8, 5, 6, '#FF4411');
                B.fillTriangle(-3, 6, 0, -4, 3, 6, '#FF8833');
                B.fillTriangle(-1.5, 6, 0, -1, 1.5, 6, '#FFCC22');
                // Ember sparks
                B.setAlpha(0.6);
                B.fillCircle(-4, -3, 1.5, '#FF6633');
                B.fillCircle(3, -1, 1, '#FFAA33');
                B.restoreAlpha();
                break;
            case 'ice':
                // Snowflake / crystal
                B.line(0, -8, 0, 8, '#66CCFF', 2);
                B.line(-7, -4, 7, 4, '#66CCFF', 2);
                B.line(-7, 4, 7, -4, '#66CCFF', 2);
                // Branch tips
                B.line(0, -8, -2, -6, '#AAEEFF', 1);
                B.line(0, -8, 2, -6, '#AAEEFF', 1);
                B.line(0, 8, -2, 6, '#AAEEFF', 1);
                B.line(0, 8, 2, 6, '#AAEEFF', 1);
                // Center gem
                B.fillCircle(0, 0, 2, '#DDEEFF');
                break;
            case 'spark':
                // Lightning bolt
                B.fillPolygon([[0, -9], [3, -2], [1, -2], [4, 5], [-1, 0], [1, 0], [-2, -9]], '#FFE333');
                B.strokePolygon([[0, -9], [3, -2], [1, -2], [4, 5], [-1, 0], [1, 0], [-2, -9]], '#CCAA00', 1);
                // Spark dots
                B.setAlpha(0.5);
                B.fillCircle(-3, 3, 1, '#FFE333');
                B.fillCircle(5, -4, 1, '#FFE333');
                B.restoreAlpha();
                break;
            case 'stone':
                // Boulder — chunky polygon
                B.fillPolygon([[-6, -4], [-2, -8], [4, -7], [7, -2], [6, 5], [1, 8], [-5, 6], [-8, 1]], '#8B7355');
                B.strokePolygon([[-6, -4], [-2, -8], [4, -7], [7, -2], [6, 5], [1, 8], [-5, 6], [-8, 1]], '#6B5335', 1.5);
                // Crack lines
                B.line(-2, -3, 1, 2, '#5A4030', 1);
                B.line(2, -5, 3, 1, '#5A4030', 1);
                break;
            case 'wind':
                // Swirling gusts
                B.drawQuadratic(-7, -2, 0, -6, 7, -2, '#AADDCC', 2);
                B.drawQuadratic(-5, 1, 0, -2, 5, 1, '#88CCBB', 1.5);
                B.drawQuadratic(-6, 4, 0, 1, 6, 4, '#AADDCC', 1.5);
                // Tiny leaf
                B.setAlpha(0.6);
                B.fillTriangle(3, -4, 5, -5, 4, -3, '#88CC88');
                B.restoreAlpha();
                break;
            case 'water':
                // Wave / droplet
                B.fillCircle(0, 2, 6, '#3388DD');
                B.strokeCircle(0, 2, 6, '#2266AA', 1.5);
                // Droplet top
                B.fillTriangle(-3, 0, 0, -8, 3, 0, '#3388DD');
                // Highlight
                B.setAlpha(0.4);
                B.fillCircle(-2, 0, 2, '#88CCFF');
                B.restoreAlpha();
                break;
            case 'poison':
                // Skull & crossbones vibe — toxic circle with drip
                B.fillCircle(0, -1, 6, '#66CC33');
                B.strokeCircle(0, -1, 6, '#44AA11', 1.5);
                // Skull face
                B.fillCircle(-2, -2, 1.5, '#224400');
                B.fillCircle(2, -2, 1.5, '#224400');
                B.fillTriangle(-1, 1, 0, 0, 1, 1, '#224400');
                // Drip
                B.fillTriangle(-1, 5, 0, 8, 1, 5, '#44CC11');
                break;
            case 'light':
                // Radiating star burst
                for (let i = 0; i < 8; i++) {
                    const a = (i * Math.PI) / 4;
                    B.line(0, 0, Math.cos(a) * 8, Math.sin(a) * 8, '#FFEE88', 1.5);
                }
                // Center glow
                B.fillCircle(0, 0, 4, '#FFEE88');
                B.fillCircle(0, 0, 2, '#FFF');
                break;
            case 'shadow':
                // Dark crescent with eye
                B.fillCircle(0, 0, 7, '#553388');
                B.fillCircle(2, -1, 5, '#2A1544');
                // Glowing eye
                B.fillCircle(-2, 0, 2, '#AA66FF');
                B.fillCircle(-2, 0, 0.8, '#FFF');
                // Wisp
                B.setAlpha(0.4);
                B.fillTriangle(2, 5, 5, 3, 4, 7, '#7744BB');
                B.restoreAlpha();
                break;
            case 'nature':
                // Leaf / vine
                B.fillPolygon([[-1, 8], [-6, 2], [-5, -4], [0, -8], [5, -4], [6, 2], [1, 8]], '#33AA44');
                B.strokePolygon([[-1, 8], [-6, 2], [-5, -4], [0, -8], [5, -4], [6, 2], [1, 8]], '#228833', 1);
                // Leaf vein
                B.line(0, -6, 0, 6, '#228833', 1);
                B.line(0, -2, -3, 0, '#228833', 0.8);
                B.line(0, 1, 3, 3, '#228833', 0.8);
                break;
            case 'crystal':
                // Faceted gem shape
                B.fillPolygon([[0, -9], [5, -3], [4, 4], [0, 8], [-4, 4], [-5, -3]], '#CC66FF');
                B.strokePolygon([[0, -9], [5, -3], [4, 4], [0, 8], [-4, 4], [-5, -3]], '#9944CC', 1.5);
                // Facet lines
                B.line(0, -9, -4, 4, '#BB55EE', 0.8);
                B.line(0, -9, 4, 4, '#BB55EE', 0.8);
                // Shine
                B.setAlpha(0.4);
                B.fillTriangle(-2, -5, 0, -3, -3, -1, '#EECCFF');
                B.restoreAlpha();
                break;
            case 'magma':
                // Volcanic rock with lava cracks
                B.fillCircle(0, 0, 7, '#553322');
                B.strokeCircle(0, 0, 7, '#331100', 1.5);
                // Lava cracks (bright lines)
                B.line(-4, -3, 0, 1, '#FF6622', 1.5);
                B.line(0, 1, 4, -1, '#FF4400', 1.5);
                B.line(-1, 3, 3, 5, '#FF6622', 1.5);
                // Hot core glow
                B.setAlpha(0.4);
                B.fillCircle(0, 0, 3, '#FF8844');
                B.restoreAlpha();
                break;
            case 'storm':
                // Thunder cloud + bolt
                B.fillCircle(-3, -3, 5, '#7744CC');
                B.fillCircle(3, -2, 4, '#6633BB');
                B.fillCircle(0, -4, 4, '#8855DD');
                // Mini lightning bolt below
                B.fillPolygon([[0, 1], [2, 4], [0, 4], [2, 8]], '#FFE333');
                B.line(0, 1, 2, 4, '#FFE333', 1.5);
                B.line(2, 4, 0, 4, '#FFE333', 1.5);
                B.line(0, 4, 2, 8, '#FFE333', 1.5);
                break;
            case 'metal':
                // Shield shape
                B.fillPolygon([[0, -8], [7, -4], [7, 2], [0, 8], [-7, 2], [-7, -4]], '#AABBCC');
                B.strokePolygon([[0, -8], [7, -4], [7, 2], [0, 8], [-7, 2], [-7, -4]], '#889AAA', 1.5);
                // Cross rivets
                B.fillCircle(-3, -2, 1.2, '#778899');
                B.fillCircle(3, -2, 1.2, '#778899');
                B.fillCircle(0, 3, 1.2, '#778899');
                // Shine
                B.setAlpha(0.3);
                B.fillTriangle(-4, -5, -1, -6, -3, -2, '#DDEEFF');
                B.restoreAlpha();
                break;
        }
        B.popTransform();
    },

    // Countdown overlay
    drawCountdown(text, progress) {
        const c = WB.Config;
        const B = WB.GLBatch;
        const T = WB.GLText;

        B.flush();
        T.flush();

        B.fillRect(0, 0, c.CANVAS_WIDTH, c.CANVAS_HEIGHT, 'rgba(0,0,0,0.3)');

        const scale = 1 + (1 - progress) * 0.5;
        const cy = c.ARENA.y + c.ARENA.height / 2;
        B.pushTransform(c.CANVAS_WIDTH / 2, cy, 0, scale, scale);
        T.drawTextWithStroke(text, 0, 0, 'bold 64px "Courier New", monospace', '#FFF', '#333', 4, 'center', 'middle');
        B.popTransform();
    },

    // Result screen overlay
    drawResult(winner, game) {
        const c = WB.Config;
        const B = WB.GLBatch;
        const T = WB.GLText;

        B.flush();
        T.flush();

        // Dim background
        B.fillRect(0, 0, c.CANVAS_WIDTH, c.CANVAS_HEIGHT, 'rgba(0,0,0,0.5)');
        B.flush();

        const cx = c.CANVAS_WIDTH / 2;
        const cy = c.ARENA.y + c.ARENA.height / 2;
        const name = WB.Config.WEAPON_NAMES[winner.weaponType] || winner.weaponType;

        // Winner banner
        T.drawTextWithStroke(name.toUpperCase() + ' WINS!', cx, cy - 40,
            'bold 36px "Courier New", monospace', winner.color, '#333', 4, 'center', 'middle');

        // Stats
        T.drawText('Hits: ' + winner.weapon.hitCount + '  |  ' + winner.weapon.getScalingDisplay(),
            cx, cy + 10, '14px "Courier New", monospace', '#FFF', 'center', 'middle');

        T.flush();

        // Play again button
        const btnW = 180;
        const btnH = 46;
        const btnX = cx - btnW / 2;
        const btnY = cy + 50;

        B.fillRect(btnX, btnY, btnW, btnH, winner.color);
        B.strokeRect(btnX, btnY, btnW, btnH, '#333', 2);
        B.flush();

        T.drawText('PLAY AGAIN', cx, btnY + btnH / 2,
            'bold 18px "Courier New", monospace', '#FFF', 'center', 'middle');

        // Store button bounds for click detection
        game._playAgainBtn = { x: btnX, y: btnY, w: btnW, h: btnH };
    }
};
