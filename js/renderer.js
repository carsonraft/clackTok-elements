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

        // Background (drawn before shake so it covers full canvas)
        B.fillRect(-10, -10, c.CANVAS_WIDTH + 20, c.CANVAS_HEIGHT + 20, '#FFF8E7');

        // Apply screen shake via projection offset (arena content only)
        B.flush();
        if (this.shakeFrames > 0) {
            WB.GLEffects.applyShake(this.shakeX, this.shakeY);
            this.shakeX *= -0.7;
            this.shakeY *= -0.7;
            this.shakeFrames--;
        } else {
            WB.GLEffects.clearShake();
        }

        // Arena background
        B.fillRect(c.ARENA.x, c.ARENA.y, c.ARENA.width, c.ARENA.height, '#FFFDF5');

        // Draw arena modifiers (behind everything else — flood water, wall shift tint)
        WB.ArenaModifiers.draw();

        // Draw hazards (behind balls, on top of arena modifiers)
        if (game.hazards) {
            for (const h of game.hazards) {
                h.draw();
            }
        }

        // Draw projectiles (behind balls)
        for (const p of game.projectiles) {
            p.draw();
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

        // ── HUD layer (immune to shake / screen effects) ──
        B.flush();
        WB.GLEffects.clearShake();

        // Arena border — drawn after clearShake so it doesn't shift on bounces
        B.strokeRect(c.ARENA.x, c.ARENA.y, c.ARENA.width, c.ARENA.height, '#333', 3);

        // Hide HUD during cutscene (it would render zoomed/panned)
        if (!WB.Cutscene || !WB.Cutscene.isPlaying) {
            this.drawTitle(game);
            this.drawStats(game);
        }
    },

    // Pick a stroke color that contrasts with the fill (light bg assumed)
    _titleStroke(color) {
        const rgba = WB.GL.parseColor(color);
        // Relative luminance (approx) — 0=black, 1=white
        const lum = 0.299 * rgba[0] + 0.587 * rgba[1] + 0.114 * rgba[2];
        // Very dark fills (<0.2) get white stroke to pop off the cream bg
        // Mid fills (0.2-0.4) get light grey, bright fills get dark stroke
        if (lum < 0.2) return '#DDD';
        if (lum < 0.4) return '#999';
        return '#333';
    },

    drawTitle(game) {
        const c = WB.Config;
        const a = c.ARENA;
        const T = WB.GLText;
        // Center horizontally on canvas (= arena center since arena is centered)
        const cx = c.CANVAS_WIDTH / 2;
        // Center vertically in the gap above the arena
        const titleCenterY = Math.round(a.y / 2);
        const b1 = game.balls[0];
        const b2 = game.balls[1];
        const name1 = WB.Config.WEAPON_NAMES[b1.weaponType] || b1.weaponType;
        const name2 = WB.Config.WEAPON_NAMES[b2.weaponType] || b2.weaponType;
        // Bigger fonts for TikTok readability
        const fontSize = a.width < 400 ? 22 : 24;
        const font = `bold ${fontSize}px "Courier New", monospace`;
        const vsFont = `bold ${fontSize - 8}px "Courier New", monospace`;
        const pad = 8; // space between name and "vs"

        // Measure widths so the whole "Name1 vs Name2" unit is centered
        const w1 = T.measureText(name1, font);
        const wVs = T.measureText('vs', vsFont);
        const w2 = T.measureText(name2, font);
        const totalW = w1 + pad + wVs + pad + w2;
        const startX = cx - totalW / 2;

        // Adaptive stroke: dark stroke for bright colors, light stroke for dark colors
        const stroke1 = this._titleStroke(b1.color);
        const stroke2 = this._titleStroke(b2.color);

        // Left weapon name (left-aligned from computed start)
        T.drawTextWithStroke(name1, startX, titleCenterY, font, b1.color, stroke1, 2, 'left', 'middle');

        // VS
        T.drawText('vs', startX + w1 + pad + wVs / 2, titleCenterY, vsFont, '#888', 'center', 'middle');

        // Right weapon name (left-aligned after vs)
        T.drawTextWithStroke(name2, startX + w1 + pad + wVs + pad, titleCenterY, font, b2.color, stroke2, 2, 'left', 'middle');
    },

    drawStats(game) {
        const a = WB.Config.ARENA;
        const B = WB.GLBatch;
        const T = WB.GLText;

        // ── Super Meters — vertically stacked, centered under arena ──
        const meterH = 24;
        const meterGap = 6;
        // Fit within arena width: dot on left, 6px inset on right for stroke
        const dotR = 7;
        const dotGap = 8;
        const leftInset = dotR * 2 + dotGap;
        const rightInset = 6;
        const meterW = a.width - leftInset - rightInset;
        const meterX = a.x + leftInset;
        const pillR = meterH / 2;
        const hudTop = a.y + a.height + 10;

        for (let i = 0; i < 2; i++) {
            const ball = game.balls[i];
            const weapon = ball.weapon;
            const progress = weapon.superActive ? 1 : Math.min(1, weapon.hitCount / weapon.superThreshold);
            const my = hudTop + i * (meterH + meterGap);
            const mCenterY = my + meterH / 2;

            // Track background — dark pill shape
            B.fillCircle(meterX + pillR, mCenterY, pillR, '#1A1A2E');
            B.fillCircle(meterX + meterW - pillR, mCenterY, pillR, '#1A1A2E');
            B.fillRect(meterX + pillR, my, meterW - pillR * 2, meterH, '#1A1A2E');

            // Meter fill
            if (progress > 0) {
                const fillW = meterW * progress;
                const baseColor = weapon.superActive ? '#FFD700' : ball.color;

                // Fill left→right for both
                B.fillCircle(meterX + pillR, mCenterY, pillR - 2, baseColor);
                if (fillW > pillR * 2) {
                    B.fillRect(meterX + pillR, my + 2, fillW - pillR * 2, meterH - 4, baseColor);
                    if (fillW >= meterW - 1) {
                        B.fillCircle(meterX + meterW - pillR, mCenterY, pillR - 2, baseColor);
                    }
                }

                // Highlight stripe
                B.setAlpha(0.25);
                const glossW = Math.min(fillW - 4, meterW - 8);
                if (glossW > 0) {
                    B.fillRect(meterX + pillR, my + 3, glossW, 3, '#FFF');
                }
                B.restoreAlpha();

                // Leading edge glow
                if (progress < 1 && progress > 0.05) {
                    const endX = meterX + fillW;
                    B.setAlpha(0.5);
                    B.fillCircle(endX, mCenterY, 4, baseColor);
                    B.restoreAlpha();
                }

                // Super active — pulsing golden overlay
                if (weapon.superActive) {
                    const t = Date.now() * 0.005;
                    const pulse = 0.2 + Math.sin(t) * 0.12;
                    B.setAlpha(pulse);
                    B.fillCircle(meterX + pillR, mCenterY, pillR - 2, '#FFF');
                    B.fillCircle(meterX + meterW - pillR, mCenterY, pillR - 2, '#FFF');
                    B.fillRect(meterX + pillR, my + 2, meterW - pillR * 2, meterH - 4, '#FFF');
                    B.restoreAlpha();
                }
            }

            // Pill outline
            B.strokeCircle(meterX + pillR, mCenterY, pillR, '#444', 1.5);
            B.strokeCircle(meterX + meterW - pillR, mCenterY, pillR, '#444', 1.5);
            B.line(meterX + pillR, my, meterX + meterW - pillR, my, '#444', 1.5);
            B.line(meterX + pillR, my + meterH, meterX + meterW - pillR, my + meterH, '#444', 1.5);

            // Segment dividers
            const ticks = weapon.superThreshold;
            for (let t = 1; t < ticks; t++) {
                const tickX = meterX + (t / ticks) * meterW;
                B.setAlpha(0.2);
                B.line(tickX, my + 3, tickX, my + meterH - 3, '#AAA', 1);
                B.restoreAlpha();
            }

            // Ball color dot on the left as identifier
            const dotCx = a.x + dotR + 2;
            B.fillCircle(dotCx, mCenterY, dotR, ball.color);
            B.strokeCircle(dotCx, mCenterY, dotR, '#333', 1.5);
        }

        B.flush();

        // ── Meter labels ──
        const labelFont = 'bold 14px "Courier New", monospace';

        for (let i = 0; i < 2; i++) {
            const weapon = game.balls[i].weapon;
            const my = hudTop + i * (meterH + meterGap);
            const mCenterY = my + meterH / 2 + 1;
            const label = weapon.superActive ? 'SUPER!' : `${weapon.hitCount}/${weapon.superThreshold}`;
            const labelColor = weapon.superActive ? '#FFF' : '#CCC';
            T.drawTextWithStroke(label, meterX + meterW / 2, mCenterY, labelFont,
                labelColor, '#000', 2, 'center', 'middle');
        }

        // ── Scaling stats below meters ──
        const bar2Bottom = hudTop + 2 * meterH + meterGap;
        const statY = bar2Bottom + 18;
        const statFont = 'bold 16px "Courier New", monospace';

        const leftText = game.balls[0].weapon.getScalingDisplay();
        T.drawTextWithStroke(leftText, a.x + leftInset, statY, statFont, game.balls[0].color, '#333', 2, 'left', 'alphabetic');

        const rightText = game.balls[1].weapon.getScalingDisplay();
        T.drawTextWithStroke(rightText, a.x + a.width - rightInset, statY, statFont, game.balls[1].color, '#333', 2, 'right', 'alphabetic');
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
            case 'gravity':
                // Black hole with orbiting moon
                B.fillCircle(0, 0, 6, '#220044');
                B.strokeCircle(0, 0, 6, '#6622AA', 1);
                B.setAlpha(0.15);
                B.fillCircle(0, 0, 10, '#330066');
                B.restoreAlpha();
                B.fillCircle(6, -5, 3, '#CCCCBB');
                B.strokeCircle(6, -5, 3, '#999', 0.8);
                break;

            // ─── Pantheon weapons ───
            case 'zeus':
                // Lightning bolt — zigzag
                B.fillPolygon([[-1, -9], [3, -3], [1, -3], [5, 5], [0, 0], [2, 0], [-2, -9]], '#FFD700');
                B.strokePolygon([[-1, -9], [3, -3], [1, -3], [5, 5], [0, 0], [2, 0], [-2, -9]], '#CC9900', 1);
                // Glow
                B.setAlpha(0.2);
                B.fillCircle(2, -1, 5, '#FFD700');
                B.restoreAlpha();
                break;
            case 'poseidon':
                // Trident
                B.fillRect(-1, -2, 2, 14, '#2E8B8B');
                // Three prongs
                B.fillRect(-1, -9, 2, 8, '#00CED1');
                B.fillTriangle(-1, -10, 1, -10, 0, -13, '#00CED1');
                B.fillRect(-5, -7, 2, 6, '#00CED1');
                B.fillTriangle(-6, -8, -4, -8, -5, -11, '#00CED1');
                B.fillRect(3, -7, 2, 6, '#00CED1');
                B.fillTriangle(3, -8, 5, -8, 4, -11, '#00CED1');
                break;
            case 'hephaestus':
                // Forge hammer — dark iron
                B.fillRect(-1, -2, 2, 12, '#5C3317');
                B.fillRect(-5, -8, 10, 7, '#4A4A4A');
                B.strokeRect(-5, -8, 10, 7, '#333', 1);
                // Hot face
                B.setAlpha(0.4);
                B.fillRect(3, -7, 2, 5, '#FF6600');
                B.restoreAlpha();
                break;
            case 'artemis':
                // Moon bow — crescent + arrow
                B.drawQuadratic(3 + Math.cos(-Math.PI * 0.4) * 8, Math.sin(-Math.PI * 0.4) * 8,
                    3 + 8, 0,
                    3 + Math.cos(Math.PI * 0.4) * 8, Math.sin(Math.PI * 0.4) * 8,
                    '#2E5E2E', 2);
                B.line(3 + Math.cos(-Math.PI * 0.4) * 8, Math.sin(-Math.PI * 0.4) * 8,
                    0, 0, '#C0C0C0', 1);
                B.line(0, 0,
                    3 + Math.cos(Math.PI * 0.4) * 8, Math.sin(Math.PI * 0.4) * 8,
                    '#C0C0C0', 1);
                // Silver crescent moon
                B.setAlpha(0.3);
                B.fillCircle(6, -6, 3, '#C0C0C0');
                B.restoreAlpha();
                break;
            case 'apollo':
                // Sun — radiating circle
                B.fillCircle(0, 0, 5, '#FFA500');
                B.strokeCircle(0, 0, 5, '#CC6600', 1);
                for (let i = 0; i < 8; i++) {
                    const a = (i * Math.PI) / 4;
                    B.line(Math.cos(a) * 6, Math.sin(a) * 6, Math.cos(a) * 9, Math.sin(a) * 9, '#FFD700', 1.5);
                }
                B.fillCircle(0, 0, 2.5, '#FFD700');
                break;
            case 'ares':
                // War blade — crimson sword
                B.fillRect(-1, -9, 2, 12, '#B22222');
                B.strokeRect(-1, -9, 2, 12, '#8B0000', 1);
                B.fillRect(-4, 2, 8, 2, '#8B0000');
                B.fillRect(-1, 4, 2, 4, '#4A2020');
                // Blood drop
                B.setAlpha(0.5);
                B.fillCircle(3, -5, 1.5, '#DC143C');
                B.restoreAlpha();
                break;
            case 'hermes':
                // Winged sandal
                B.fillRect(-5, 2, 10, 4, '#87CEEB');
                B.strokeRect(-5, 2, 10, 4, '#5BA3C0', 1);
                // Wings
                B.fillTriangle(-6, 2, -10, -3, -7, 0, '#B0E0E6');
                B.fillTriangle(-6, 2, -12, -1, -8, 3, '#87CEEB');
                B.fillTriangle(6, 2, 10, -3, 7, 0, '#B0E0E6');
                B.fillTriangle(6, 2, 12, -1, 8, 3, '#87CEEB');
                break;
            case 'hades':
                // Skull icon
                B.fillCircle(0, -2, 6, '#2E0854');
                B.strokeCircle(0, -2, 6, '#6A0DAD', 1);
                // Eyes
                B.fillCircle(-2.5, -3, 1.5, '#9955DD');
                B.fillCircle(2.5, -3, 1.5, '#9955DD');
                // Jaw
                B.fillRect(-3, 2, 6, 3, '#2E0854');
                B.strokeRect(-3, 2, 6, 3, '#6A0DAD', 0.8);
                // Soul wisps
                B.setAlpha(0.3);
                B.fillCircle(-5, 4, 1.5, '#9955DD');
                B.fillCircle(5, 3, 1.5, '#9955DD');
                B.restoreAlpha();
                break;
            case 'athena':
                // Shield + spear
                // Shield (half circle)
                B.fillPolygon([[0, -7], [5, -4], [6, 1], [4, 5], [0, 7], [-4, 5], [-6, 1], [-5, -4]], '#B0B0B0');
                B.strokePolygon([[0, -7], [5, -4], [6, 1], [4, 5], [0, 7], [-4, 5], [-6, 1], [-5, -4]], '#808080', 1.5);
                // Shield emblem
                B.fillCircle(0, 0, 2, '#DAA520');
                // Spear behind
                B.line(7, -8, 7, 8, '#8B7355', 1.5);
                B.fillTriangle(5.5, -8, 8.5, -8, 7, -12, '#B0B0B0');
                break;
            case 'dionysus':
                // Grape vine
                B.line(0, 8, 0, -2, '#228B22', 2);
                B.line(0, -2, -3, -5, '#228B22', 1.5);
                B.line(0, -2, 3, -4, '#228B22', 1.5);
                // Grapes
                B.fillCircle(-1, -6, 3, '#6A0DAD');
                B.fillCircle(2, -5, 2.5, '#7722CC');
                B.fillCircle(-3, -4, 2, '#9933EE');
                B.fillCircle(0, -3, 2, '#8B00FF');
                // Leaf
                B.fillTriangle(3, -2, 6, -4, 5, 0, '#2E8B2E');
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

        // Dark dim overlay — high opacity for clean content-ready look
        B.fillRect(0, 0, c.CANVAS_WIDTH, c.CANVAS_HEIGHT, 'rgba(0,0,0,0.85)');
        B.flush();

        const cx = c.CANVAS_WIDTH / 2;
        const cy = c.ARENA.y + c.ARENA.height / 2;
        const name = WB.Config.WEAPON_NAMES[winner.weaponType] || winner.weaponType;
        const isDraw = game._isDraw;

        // Winner banner — clean white text, no stroke, no stats
        if (isDraw) {
            T.drawText('DRAW!', cx, cy - 20,
                'bold 48px "Courier New", monospace', '#FFF', 'center', 'middle');
        } else {
            T.drawText(name.toUpperCase() + ' WINS!', cx, cy - 20,
                'bold 44px "Courier New", monospace', '#FFF', 'center', 'middle');
        }

        T.flush();
    }
};
