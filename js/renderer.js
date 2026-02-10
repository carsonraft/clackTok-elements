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
        const cx = c.CANVAS_WIDTH / 2;
        const b1 = game.balls[0];
        const b2 = game.balls[1];
        const name1 = WB.Config.WEAPON_NAMES[b1.weaponType] || b1.weaponType;
        const name2 = WB.Config.WEAPON_NAMES[b2.weaponType] || b2.weaponType;
        const font = 'bold 26px "Courier New", monospace';

        // Left weapon name (stroke + fill)
        T.drawTextWithStroke(name1, cx - 30, 55, font, b1.color, '#333', 3, 'right', 'alphabetic');

        // VS
        T.drawText('VS', cx, 55, 'bold 20px "Courier New", monospace', '#333', 'center', 'alphabetic');

        // Right weapon name
        T.drawTextWithStroke(name2, cx + 30, 55, font, b2.color, '#333', 3, 'left', 'alphabetic');

        // Draw small weapon icon shapes next to names
        T.flush();
        const nameWidth1 = T.measureText(name1, font);
        const nameWidth2 = T.measureText(name2, font);
        this.drawWeaponIcon(b1.weaponType, cx - 30 - nameWidth1 - 25, 45, b1.color);
        this.drawWeaponIcon(b2.weaponType, cx + 30 + nameWidth2 + 10, 45, b2.color);
    },

    drawStats(game) {
        const a = WB.Config.ARENA;
        const y = a.y + a.height + 28;
        const T = WB.GLText;
        const font = 'bold 18px "Courier New", monospace';

        // Left ball stat
        const leftText = game.balls[0].weapon.getScalingDisplay();
        T.drawTextWithStroke(leftText, a.x + 10, y, font, game.balls[0].color, '#333', 2.5, 'left', 'alphabetic');

        // Right ball stat
        const rightText = game.balls[1].weapon.getScalingDisplay();
        T.drawTextWithStroke(rightText, a.x + a.width - 10, y, font, game.balls[1].color, '#333', 2.5, 'right', 'alphabetic');
    },

    drawWeaponIcon(type, x, y, color) {
        const B = WB.GLBatch;
        B.pushTranslate(x, y);

        switch (type) {
            case 'sword':
                B.fillRect(-1, -8, 2, 16, '#C0C0C0');
                B.fillRect(-4, 4, 8, 2, '#DAA520');
                B.fillRect(-1, 6, 2, 4, '#8B5E3C');
                break;
            case 'dagger':
                B.fillTriangle(0, -6, -3, 2, 3, 2, '#C0C0C0');
                B.fillRect(-1, 2, 2, 5, '#8B5E3C');
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
            case 'spear':
                B.line(0, 8, 0, -4, '#8B6914', 2);
                B.fillTriangle(-3, -4, 0, -10, 3, -4, '#B0B0B0');
                break;
            case 'scythe':
                B.line(0, 8, 0, -4, '#5C3317', 2);
                B.drawQuadratic(0, -4, 8, -12, 2, -14, '#C0C0C0', 1.5);
                B.drawQuadratic(2, -14, 5, -10, 0, -4, '#888', 1);
                break;
            case 'unarmed':
                B.fillCircle(0, 0, 6, '#F5D5A0');
                B.strokeCircle(0, 0, 6, '#C9A55A', 1.5);
                B.line(-3, -2, -3, 2, '#C9A55A', 1);
                B.line(0, -3, 0, 2, '#C9A55A', 1);
                B.line(3, -2, 3, 2, '#C9A55A', 1);
                break;
            case 'lance':
                B.fillRect(-1, -2, 2, 14, '#B8860B');
                B.fillTriangle(-4, -2, 0, -10, 4, -2, '#C0C0C0');
                B.fillArc(0, 4, 5, 0, Math.PI, '#DAA520');
                break;
            case 'axe':
                B.fillRect(-1, -2, 2, 12, '#6B3A1F');
                B.fillPolygon([[-1, -6], [-7, -9], [-7, -2], [-1, 0]], '#999');
                B.fillPolygon([[1, -6], [7, -9], [7, -2], [1, 0]], '#999');
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
            case 'boomerang':
                B.drawQuadratic(-6, -4, 0, 0, 6, -4, '#B8860B', 3);
                B.drawQuadratic(-6, 4, 0, 0, 6, 4, '#B8860B', 3);
                break;
            case 'crossbow':
                B.fillRect(-2, -2, 8, 4, '#6B3A1F');
                B.drawQuadratic(-2, -8, 2, 0, -2, 8, '#555', 2);
                B.line(0, 0, 8, 0, '#7CB900', 1.5);
                break;
            case 'magnet':
                B.fillRect(-6, -8, 4, 8, '#DD3333');
                B.fillRect(2, -8, 4, 8, '#3355CC');
                B.fillRect(-6, -8, 12, 3, '#888');
                break;
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
            case 'duplicator':
                B.fillCircle(-3, 0, 6, '#00CC88');
                B.strokeCircle(-3, 0, 6, '#009966', 1.5);
                B.fillCircle(3, 0, 6, '#00CC88');
                B.strokeCircle(3, 0, 6, '#009966', 1.5);
                // Star on left
                {
                    const sr = 2.5;
                    const starPts = [];
                    for (let i = 0; i < 5; i++) {
                        const sa = -Math.PI / 2 + (i * 2 * Math.PI / 5);
                        const saI = sa + Math.PI / 5;
                        starPts.push([-3 + Math.cos(sa) * sr, Math.sin(sa) * sr]);
                        starPts.push([-3 + Math.cos(saI) * sr * 0.4, Math.sin(saI) * sr * 0.4]);
                    }
                    B.fillPolygon(starPts, 'rgba(255, 215, 0, 0.7)');
                }
                break;
            case 'goku':
                B.fillCircle(0, 2, 5, '#FF8C00');
                // Spiky hair
                B.fillTriangle(-5, 0, -3, -9, -1, -1, '#333');
                B.fillTriangle(-2, -1, 0, -11, 2, -1, '#333');
                B.fillTriangle(1, -1, 4, -8, 5, 0, '#333');
                // Ki blast dot
                B.fillCircle(0, 8, 2.5, '#FFDD44');
                break;
            case 'vegeta':
                B.fillCircle(0, 2, 5, '#6644FF');
                // Vegeta upswept flame hair (widow's peak)
                B.fillTriangle(-4, 0, -5, -10, -2, -1, '#333');
                B.fillTriangle(-2, -1, -1, -12, 1, -1, '#333');
                B.fillTriangle(1, -1, 2, -11, 4, 0, '#333');
                // Forehead point (widow's peak)
                B.fillTriangle(-1, -1, 0, -5, 1, -1, '#333');
                // Ki blast dot (purple)
                B.fillCircle(0, 8, 2.5, '#AA66FF');
                break;
            case 'ghost':
                // Translucent ghost circle
                B.setAlpha(0.5);
                B.fillCircle(0, 0, 7, '#88DDFF');
                B.restoreAlpha();
                B.setAlpha(0.8);
                B.strokeCircle(0, 0, 7, '#AAEEFF', 1.5);
                B.restoreAlpha();
                // Ghost eyes
                B.fillCircle(-2.5, -1, 1.5, '#FFF');
                B.fillCircle(2.5, -1, 1.5, '#FFF');
                // Wispy tail
                B.setAlpha(0.4);
                B.fillTriangle(-3, 5, 0, 3, 3, 5, '#88DDFF');
                B.fillTriangle(-5, 7, -2, 4, 0, 8, '#88DDFF');
                B.fillTriangle(0, 8, 2, 4, 5, 7, '#88DDFF');
                B.restoreAlpha();
                break;
            case 'muscle':
                // Big circle with angry face
                B.fillCircle(0, 0, 8, '#CC4422');
                B.strokeCircle(0, 0, 8, '#993311', 1.5);
                // Angry eyebrows
                B.line(-4, -3, -1, -1.5, '#333', 2);
                B.line(4, -3, 1, -1.5, '#333', 2);
                // Eyes
                B.fillCircle(-2, 0, 1, '#FFF');
                B.fillCircle(2, 0, 1, '#FFF');
                // Gritted teeth
                B.fillRect(-3, 2, 6, 2, '#FFF');
                B.line(-1, 2, -1, 4, '#CCC', 0.5);
                B.line(1, 2, 1, 4, '#CCC', 0.5);
                // Bicep bumps
                B.setAlpha(0.4);
                B.fillCircle(-7, -1, 3, '#CC4422');
                B.fillCircle(7, -1, 3, '#CC4422');
                B.restoreAlpha();
                break;
            case 'buu':
                // Pink blob with antenna
                B.fillCircle(0, 0, 7, '#FF69B4');
                B.strokeCircle(0, 0, 7, '#CC5599', 1.5);
                // Antenna
                B.line(0, -6, 2, -12, '#FF88CC', 2);
                B.fillCircle(2, -12, 2.5, '#FF88CC');
                // Eyes
                B.fillCircle(-2, -1, 1.5, '#FFF');
                B.fillCircle(2, -1, 1.5, '#FFF');
                B.fillCircle(-2, -1, 0.7, '#111');
                B.fillCircle(2, -1, 0.7, '#111');
                // Grin
                B.setAlpha(0.6);
                B.fillArc(0, 2, 3, 0, Math.PI, '#CC3366');
                B.restoreAlpha();
                break;
            case 'clacker':
                // Newton's Cradle — 3 steel balls on strings
                // Strings
                B.line(-5, -10, -5, 0, '#888', 1);
                B.line(0, -10, 0, 0, '#888', 1);
                B.line(5, -10, 5, 0, '#888', 1);
                // Steel balls
                B.fillCircle(-5, 3, 4, '#D4D4D4');
                B.strokeCircle(-5, 3, 4, '#999', 1);
                B.fillCircle(0, 3, 4, '#D4D4D4');
                B.strokeCircle(0, 3, 4, '#999', 1);
                B.fillCircle(5, 3, 4, '#D4D4D4');
                B.strokeCircle(5, 3, 4, '#999', 1);
                // Specular dots
                B.setAlpha(0.6);
                B.fillCircle(-6, 1.5, 1.2, '#FFF');
                B.fillCircle(-1, 1.5, 1.2, '#FFF');
                B.fillCircle(4, 1.5, 1.2, '#FFF');
                B.restoreAlpha();
                // Frame bar
                B.fillRect(-8, -11, 16, 2, '#666');
                break;
            case 'naruto':
                // Orange spiral + spiky hair
                B.fillCircle(0, 2, 6, '#FF8833');
                B.fillTriangle(-5, 0, -3, -8, -1, -1, '#FFD700');
                B.fillTriangle(-1, -1, 1, -10, 3, -1, '#FFD700');
                B.fillTriangle(2, -1, 4, -7, 6, 0, '#FFD700');
                // Rasengan
                B.fillCircle(0, 8, 3, '#44BBFF');
                B.setAlpha(0.5);
                B.strokeCircle(0, 8, 3, '#2299DD', 1);
                B.restoreAlpha();
                break;
            case 'sasuke':
                // Dark hair + Sharingan eye + Chidori
                B.fillCircle(0, 2, 6, '#6633CC');
                B.fillTriangle(-3, 0, -5, -8, -1, -1, '#222');
                B.fillTriangle(0, -1, 2, -10, 4, 0, '#222');
                // Sharingan dot
                B.fillCircle(0, 1, 2, '#FF0000');
                B.fillCircle(0, 1, 0.8, '#111');
                // Chidori
                B.fillCircle(0, 8, 2.5, '#4488FF');
                B.line(0, 8, 3, 6, '#AADDFF', 1);
                B.line(0, 8, -2, 5, '#AADDFF', 1);
                break;
            case 'luffy':
                // Straw hat + stretchy arm
                B.fillCircle(0, 2, 6, '#CC2222');
                B.strokeCircle(0, 2, 6, '#991111', 1.5);
                // Straw hat
                B.fillRect(-7, -4, 14, 3, '#FFD700');
                B.fillRect(-4, -7, 8, 4, '#FFD700');
                B.strokeRect(-7, -4, 14, 3, '#CC9900', 1);
                // Red band
                B.fillRect(-4, -5, 8, 2, '#CC2222');
                break;
            case 'zoro':
                // Three swords (crossed)
                B.fillRect(-1, -10, 2, 18, '#C0C0C0');
                B.strokeRect(-1, -10, 2, 18, '#888', 0.8);
                // Second sword (angled)
                B.pushTransform(0, 0, 0.5);
                B.fillRect(-1, -9, 2, 16, '#C0C0C0');
                B.popTransform();
                // Third sword (other angle)
                B.pushTransform(0, 0, -0.5);
                B.fillRect(-1, -9, 2, 16, '#C0C0C0');
                B.popTransform();
                // Bandana
                B.fillRect(-6, -2, 12, 3, '#2E8B2E');
                break;
            case 'ichigo':
                // Big cleaver sword (Zangetsu)
                B.fillCircle(0, 2, 5, '#FF6633');
                B.fillRect(-2, -10, 4, 14, '#C0C0C0');
                B.strokeRect(-2, -10, 4, 14, '#888', 0.8);
                // Handle
                B.fillRect(-2, 4, 4, 5, '#654321');
                // Guard
                B.fillRect(-4, 3, 8, 2, '#DAA520');
                break;
            case 'saitama':
                // Bald head + plain face + cape
                B.fillCircle(0, 0, 8, '#F5D5A0');
                B.strokeCircle(0, 0, 8, '#C9A55A', 1.5);
                // Bald shine
                B.setAlpha(0.4);
                B.fillCircle(-2, -3, 3, '#FFF');
                B.restoreAlpha();
                // Simple face
                B.fillCircle(-2, -1, 1, '#333');
                B.fillCircle(2, -1, 1, '#333');
                B.line(-1, 2, 1, 2, '#333', 1);
                // Cape
                B.setAlpha(0.5);
                B.fillTriangle(-5, 5, 0, 3, 5, 5, '#FFF');
                B.restoreAlpha();
                break;
            case 'frieza':
                // Purple/white alien with tail
                B.fillCircle(0, 0, 6, '#EECCFF');
                B.strokeCircle(0, 0, 6, '#CC88DD', 1.5);
                // Head dome
                B.fillRect(-3, -8, 6, 3, '#DDBBEE');
                // Horns (base form hint)
                B.line(-3, -7, -5, -10, '#CC88DD', 1.5);
                B.line(3, -7, 5, -10, '#CC88DD', 1.5);
                // Tail
                B.drawQuadratic(0, 5, 5, 8, 2, 10, '#CC88DD', 1.5);
                break;
            case 'jotaro':
                // Hat + Star Platinum ghost
                B.fillCircle(0, 2, 6, '#333');
                B.strokeCircle(0, 2, 6, '#222', 1.5);
                // Hat brim
                B.fillRect(-8, -1, 16, 3, '#333');
                // Hat fading into hair
                B.fillRect(-5, -4, 10, 4, '#333');
                // Star Platinum ghost behind
                B.setAlpha(0.3);
                B.fillCircle(0, 0, 9, '#8866CC');
                B.restoreAlpha();
                // Gold accent
                B.fillRect(-2, -1, 4, 1, '#FFD700');
                break;
            case 'piccolo':
                // Green Namekian with antenna + turban
                B.fillCircle(0, 2, 6, '#2E8B57');
                B.strokeCircle(0, 2, 6, '#1B5E3B', 1.5);
                // Turban
                B.fillCircle(0, -3, 5, '#FFF');
                B.fillCircle(0, -5, 3, '#FFF');
                // Antenna
                B.line(0, -7, 2, -12, '#2E8B57', 1.5);
                B.fillCircle(2, -12, 1.5, '#2E8B57');
                // Cape
                B.setAlpha(0.4);
                B.fillTriangle(-6, 6, 0, 3, 6, 6, '#EEEEFF');
                B.restoreAlpha();
                break;
            case 'tanjiro':
                // Checkered haori + sword
                B.fillCircle(0, 2, 6, '#44BBFF');
                B.strokeCircle(0, 2, 6, '#2288AA', 1.5);
                // Earring
                B.setAlpha(0.6);
                B.fillCircle(-4, 1, 2, '#AA0000');
                B.restoreAlpha();
                // Sword
                B.fillRect(4, -8, 2, 14, '#333');
                B.fillRect(3, 4, 4, 3, '#654321');
                // Scar
                B.line(-2, -3, 1, -5, '#880000', 1);
                break;
            case 'gunclacker':
                // Revolver icon
                B.fillRect(-2, -6, 10, 4, '#555'); // barrel
                B.strokeRect(-2, -6, 10, 4, '#333', 1);
                B.fillCircle(2, -4, 3, '#777'); // cylinder
                B.strokeCircle(2, -4, 3, '#555', 0.8);
                B.fillRect(-3, -3, 5, 6, '#8B4513'); // grip
                B.strokeRect(-3, -3, 5, 6, '#5C2D0A', 0.8);
                // Muzzle flash hint
                B.setAlpha(0.5);
                B.fillCircle(9, -4, 3, '#FFD700');
                B.restoreAlpha();
                break;
            case 'sailormoon':
                // Hair buns (odango)
                B.fillCircle(-5, -6, 3, '#FFD700');
                B.fillCircle(5, -6, 3, '#FFD700');
                // Pigtails
                B.line(-5, -4, -7, 6, '#FFD700', 2);
                B.line(5, -4, 7, 6, '#FFD700', 2);
                // Face
                B.fillCircle(0, 0, 5, '#FFB6C1');
                B.strokeCircle(0, 0, 5, '#DD8899', 1.2);
                // Crescent moon tiara
                B.fillCircle(0, -4, 2, '#FFD700');
                B.fillCircle(0.5, -4.2, 1.3, '#FFB6C1');
                // Eyes
                B.fillCircle(-2, -1, 1, '#4488FF');
                B.fillCircle(2, -1, 1, '#4488FF');
                // Sparkle
                B.setAlpha(0.6);
                B.line(-8, 4, -6, 2, '#FFD700', 1);
                B.line(-8, 2, -6, 4, '#FFD700', 1);
                B.restoreAlpha();
                break;
            case 'david':
                // Cyberpunk face
                B.fillCircle(0, 0, 6, '#00AACC');
                B.strokeCircle(0, 0, 6, '#008899', 1.5);
                // Jacket collar
                B.fillTriangle(-6, 3, -3, 0, -1, 5, '#DDDD44');
                B.fillTriangle(6, 3, 3, 0, 1, 5, '#DDDD44');
                // Cybernetic eye glow
                B.fillCircle(2, -1, 1.5, '#00FFFF');
                B.setAlpha(0.4);
                B.fillCircle(2, -1, 3, '#00FFFF');
                B.restoreAlpha();
                // Other eye
                B.fillCircle(-2, -1, 1, '#333');
                // Gorilla arm hint
                B.fillRect(6, -2, 4, 4, '#555');
                B.strokeRect(6, -2, 4, 4, '#00FFFF', 0.8);
                break;
            case 'vash':
                // Red coat
                B.fillCircle(0, 1, 6, '#CC0000');
                B.strokeCircle(0, 1, 6, '#880000', 1.5);
                // Yellow hair spike
                B.fillTriangle(-2, -4, 0, -12, 2, -4, '#FFE4B5');
                B.fillTriangle(2, -4, 4, -10, 5, -3, '#FFE4B5');
                // Sunglasses
                B.fillRect(-5, -2, 4, 2.5, '#FF8800');
                B.fillRect(1, -2, 4, 2.5, '#FF8800');
                B.line(-1, -1, 1, -1, '#FF8800', 0.8);
                // Revolver hint
                B.fillRect(5, 1, 6, 2, '#C0C0C0');
                B.strokeRect(5, 1, 6, 2, '#888', 0.6);
                // Red front sight
                B.fillRect(10, 0, 1, 2, '#FF0000');
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
        B.pushTransform(c.CANVAS_WIDTH / 2, c.CANVAS_HEIGHT / 2, 0, scale, scale);
        T.drawTextWithStroke(text, 0, 0, 'bold 80px "Courier New", monospace', '#FFF', '#333', 4, 'center', 'middle');
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
        const cy = c.CANVAS_HEIGHT / 2;
        const name = WB.Config.WEAPON_NAMES[winner.weaponType] || winner.weaponType;

        // Winner banner
        T.drawTextWithStroke(name.toUpperCase() + ' WINS!', cx, cy - 40,
            'bold 48px "Courier New", monospace', winner.color, '#333', 4, 'center', 'middle');

        // Stats
        T.drawText('Hits: ' + winner.weapon.hitCount + '  |  ' + winner.weapon.getScalingDisplay(),
            cx, cy + 10, '18px "Courier New", monospace', '#FFF', 'center', 'middle');

        T.flush();

        // Play again button
        const btnW = 200;
        const btnH = 50;
        const btnX = cx - btnW / 2;
        const btnY = cy + 50;

        B.fillRect(btnX, btnY, btnW, btnH, winner.color);
        B.strokeRect(btnX, btnY, btnW, btnH, '#333', 2);
        B.flush();

        T.drawText('PLAY AGAIN', cx, btnY + btnH / 2,
            'bold 22px "Courier New", monospace', '#FFF', 'center', 'middle');

        // Store button bounds for click detection
        game._playAgainBtn = { x: btnX, y: btnY, w: btnW, h: btnH };
    }
};
