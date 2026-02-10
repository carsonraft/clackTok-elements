window.WB = window.WB || {};

WB.UI = {
    selectedLeft: null,
    selectedRight: null,
    hoveredBtn: null,
    weaponTypes: [],
    menuScroll: 0,       // Scroll offset for weapon grid
    maxScroll: 0,        // Computed max scroll

    init() {
        this.weaponTypes = WB.WeaponRegistry.getTypes();
        // Default selections
        this.selectedLeft = this.weaponTypes[0] || 'sword';
        this.selectedRight = this.weaponTypes[1] || 'dagger';
        this._computeMaxScroll();
    },

    _computeMaxScroll() {
        const layout = this._getLayout();
        const rows = Math.ceil(this.weaponTypes.length / layout.cols);
        // Two grids stacked vertically
        const singleGridH = rows * (layout.btnH + layout.gap);
        const totalHeight = singleGridH * 2 + layout.gridGap;
        const visibleHeight = layout.gridBottom - layout.gridTop;
        this.maxScroll = Math.max(0, totalHeight - visibleHeight);
    },

    handleMenuScroll(direction) {
        const step = 50;
        if (direction === 'down') {
            this.menuScroll = Math.min(this.maxScroll, this.menuScroll + step);
        } else {
            this.menuScroll = Math.max(0, this.menuScroll - step);
        }
    },

    handleMenuClick(mx, my) {
        const c = WB.Config;
        const layout = this._getLayout();

        // Check left panel buttons (Player 1)
        for (let i = 0; i < this.weaponTypes.length; i++) {
            const btn = this._getBtnRect('left', i, layout);
            if (btn.y + btn.h < layout.gridTop || btn.y > layout.gridBottom) continue;
            if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
                this.selectedLeft = this.weaponTypes[i];
                WB.Audio.menuClack();
                return;
            }
        }

        // Check right panel buttons (Player 2)
        for (let i = 0; i < this.weaponTypes.length; i++) {
            const btn = this._getBtnRect('right', i, layout);
            if (btn.y + btn.h < layout.gridTop || btn.y > layout.gridBottom) continue;
            if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
                this.selectedRight = this.weaponTypes[i];
                WB.Audio.menuClack();
                return;
            }
        }

        // Check toggle buttons
        const toggleBtns = this._getToggleBtns(layout);
        for (const tb of toggleBtns) {
            if (mx >= tb.x && mx <= tb.x + tb.w && my >= tb.y && my <= tb.y + tb.h) {
                WB.Config[tb.key] = !WB.Config[tb.key];
                // Inelastic mode: swap restitution values
                if (tb.key === 'INELASTIC_MODE') {
                    if (WB.Config.INELASTIC_MODE) {
                        WB.Config.BALL_RESTITUTION = WB.Config.INELASTIC_BALL_RESTITUTION;
                        WB.Config.WALL_RESTITUTION = WB.Config.INELASTIC_WALL_RESTITUTION;
                    } else {
                        WB.Config.BALL_RESTITUTION = 1.0;
                        WB.Config.WALL_RESTITUTION = 1.0;
                    }
                }
                // DMG BOUNCE requires TIP BOUNCE — auto-enable it
                if (tb.key === 'WEAPON_WALL_DMG_BOUNCE' && WB.Config.WEAPON_WALL_DMG_BOUNCE) {
                    WB.Config.WEAPON_WALL_BOUNCE = true;
                }
                WB.Audio.menuClack();
                return;
            }
        }

        // Check FIGHT button
        if (this.selectedLeft && this.selectedRight) {
            const fBtn = layout.fightBtn;
            if (mx >= fBtn.x && mx <= fBtn.x + fBtn.w && my >= fBtn.y && my <= fBtn.y + fBtn.h) {
                WB.Audio.menuClack();
                return 'fight';
            }
        }

        // Check SIMULATE button
        if (this.selectedLeft && this.selectedRight) {
            const sBtn = layout.simBtn;
            if (mx >= sBtn.x && mx <= sBtn.x + sBtn.w && my >= sBtn.y && my <= sBtn.y + sBtn.h) {
                WB.Audio.menuClack();
                return 'simulate';
            }
        }

        // Check Random button
        const rBtn = layout.randomBtn;
        if (mx >= rBtn.x && mx <= rBtn.x + rBtn.w && my >= rBtn.y && my <= rBtn.y + rBtn.h) {
            this.selectedLeft = this.weaponTypes[Math.floor(Math.random() * this.weaponTypes.length)];
            this.selectedRight = this.weaponTypes[Math.floor(Math.random() * this.weaponTypes.length)];
            WB.Audio.menuClack();
            return;
        }

        // Check sim count selector
        const scBtn = layout.simCountBtn;
        if (mx >= scBtn.x && mx <= scBtn.x + scBtn.w && my >= scBtn.y && my <= scBtn.y + scBtn.h) {
            const presets = [100, 500, 1000, 2000];
            const curIdx = presets.indexOf(WB.SimUI.simCount);
            WB.SimUI.simCount = presets[(curIdx + 1) % presets.length];
            WB.Audio.menuClack();
            return;
        }

        // Check BEST OF button
        const boBtn = layout.bestOfBtn;
        if (mx >= boBtn.x && mx <= boBtn.x + boBtn.w && my >= boBtn.y && my <= boBtn.y + boBtn.h) {
            WB.Audio.menuClack();
            return 'bestof';
        }

        return null;
    },

    _getLayout() {
        const c = WB.Config;
        const cx = c.CANVAS_WIDTH / 2;
        const pad = 15;
        const panelW = c.CANVAS_WIDTH - pad * 2;
        return {
            leftStart: pad,
            rightStart: pad,
            panelWidth: panelW,
            gridTop: 155,
            gridBottom: c.CANVAS_HEIGHT - 170,   // shrunk 30px for toggle row
            gridGap: 36,   // gap between P1 and P2 grids (includes header)
            cols: 4,
            btnH: 30,
            gap: 3,
            toggleY: c.CANVAS_HEIGHT - 162,
            fightBtn: { x: pad, y: c.CANVAS_HEIGHT - 65, w: panelW / 2 - 5, h: 48 },
            simBtn:   { x: cx + 5, y: c.CANVAS_HEIGHT - 65, w: panelW / 2 - 5, h: 48 },
            randomBtn: { x: cx - 50, y: c.CANVAS_HEIGHT - 118, w: 100, h: 30 },
            simCountBtn: { x: cx - 50, y: c.CANVAS_HEIGHT - 85, w: 100, h: 22 },
            bestOfBtn: { x: pad, y: c.CANVAS_HEIGHT - 25, w: 100, h: 22 },
        };
    },

    _getToggleBtns(layout) {
        const c = WB.Config;
        const pad = 15;
        const toggleH = 24;
        const toggleGap = 6;
        const count = 4;
        const totalGaps = (count - 1) * toggleGap;
        const toggleW = Math.floor((c.CANVAS_WIDTH - pad * 2 - totalGaps) / count);
        const startX = pad;
        const y = layout.toggleY;
        return [
            { x: startX, y, w: toggleW, h: toggleH, key: 'INELASTIC_MODE', label: 'INELASTIC' },
            { x: startX + (toggleW + toggleGap), y, w: toggleW, h: toggleH, key: 'GRAVITY_MODE', label: 'GRAVITY' },
            { x: startX + 2 * (toggleW + toggleGap), y, w: toggleW, h: toggleH, key: 'WEAPON_WALL_BOUNCE', label: 'TIP BOUNCE' },
            { x: startX + 3 * (toggleW + toggleGap), y, w: toggleW, h: toggleH, key: 'WEAPON_WALL_DMG_BOUNCE', label: 'DMG BOUNCE' },
        ];
    },

    _getBtnRect(side, index, layout) {
        const col = index % layout.cols;
        const row = Math.floor(index / layout.cols);
        const btnW = (layout.panelWidth - (layout.cols - 1) * layout.gap) / layout.cols;
        const rows = Math.ceil(this.weaponTypes.length / layout.cols);
        const singleGridH = rows * (layout.btnH + layout.gap);

        // Player 1 grid starts at gridTop, Player 2 starts after P1 grid + gap
        const gridStartY = side === 'left'
            ? layout.gridTop
            : layout.gridTop + singleGridH + layout.gridGap;

        return {
            x: layout.leftStart + col * (btnW + layout.gap),
            y: gridStartY + row * (layout.btnH + layout.gap) - this.menuScroll,
            w: btnW,
            h: layout.btnH,
        };
    },

    drawMenu() {
        const c = WB.Config;
        const cx = c.CANVAS_WIDTH / 2;
        const layout = this._getLayout();
        const B = WB.GLBatch;
        const T = WB.GLText;

        // Background
        B.fillRect(0, 0, c.CANVAS_WIDTH, c.CANVAS_HEIGHT, '#FFF8E7');

        // Draw weapon grids first (both use full width, stacked vertically)
        this._drawGrid('left', layout);
        this._drawGrid('right', layout);

        // Clip mask — cover overflow above and below grid area
        B.fillRect(0, 0, c.CANVAS_WIDTH, layout.gridTop - 2, '#FFF8E7');
        B.fillRect(0, layout.gridBottom + 1, c.CANVAS_WIDTH, c.CANVAS_HEIGHT - layout.gridBottom, '#FFF8E7');
        B.flush();

        // Title (drawn AFTER clip mask so it's not hidden)
        T.drawText('WEAPON BALL', cx, 45, 'bold 32px "Courier New", monospace', '#333', 'center', 'alphabetic');
        T.drawText('Choose your fighters', cx, 67, '12px "Courier New", monospace', '#888', 'center', 'alphabetic');

        // Section labels above grids
        const rows = Math.ceil(this.weaponTypes.length / layout.cols);
        const singleGridH = rows * (layout.btnH + layout.gap);

        // P1 selection indicator
        if (this.selectedLeft) {
            const col = WB.Config.COLORS[this.selectedLeft];
            const name = WB.Config.WEAPON_NAMES[this.selectedLeft] || this.selectedLeft;
            T.drawText('P1  ' + name, layout.leftStart + 2, layout.gridTop - 8,
                'bold 11px "Courier New", monospace', col, 'left', 'alphabetic');
        } else {
            T.drawText('Player 1', layout.leftStart + 2, layout.gridTop - 8,
                'bold 11px "Courier New", monospace', '#555', 'left', 'alphabetic');
        }

        // P2 label — show on right side of same line
        if (this.selectedRight) {
            const col = WB.Config.COLORS[this.selectedRight];
            const name = WB.Config.WEAPON_NAMES[this.selectedRight] || this.selectedRight;
            T.drawText('P2  ' + name, layout.leftStart + layout.panelWidth - 2, layout.gridTop - 8,
                'bold 11px "Courier New", monospace', col, 'right', 'alphabetic');
        } else {
            T.drawText('Player 2', layout.leftStart + layout.panelWidth - 2, layout.gridTop - 8,
                'bold 11px "Courier New", monospace', '#555', 'right', 'alphabetic');
        }
        T.flush();

        // Scroll indicators
        if (this.maxScroll > 0) {
            if (this.menuScroll > 0) {
                T.drawText('▲', cx, layout.gridTop + 6,
                    '10px "Courier New", monospace', '#AAA', 'center', 'alphabetic');
            }
            if (this.menuScroll < this.maxScroll) {
                T.drawText('▼', cx, layout.gridBottom - 2,
                    '10px "Courier New", monospace', '#AAA', 'center', 'alphabetic');
            }
            T.flush();

            // Mini scrollbar
            const trackH = layout.gridBottom - layout.gridTop;
            const thumbH = Math.max(20, trackH * (trackH / (trackH + this.maxScroll)));
            const thumbY = layout.gridTop + (this.menuScroll / this.maxScroll) * (trackH - thumbH);
            B.fillRect(c.CANVAS_WIDTH - 8, layout.gridTop, 4, trackH, '#EEE');
            B.fillRect(c.CANVAS_WIDTH - 8, thumbY, 4, thumbH, '#BBB');
        }

        // Physics modifier toggles
        const toggleBtns = this._getToggleBtns(layout);
        for (const tb of toggleBtns) {
            const isOn = WB.Config[tb.key];
            const bg = isOn ? '#5DAA8F' : '#DDD';
            const border = isOn ? '#4A8A76' : '#BBB';
            const textColor = isOn ? '#FFF' : '#888';

            B.fillRect(tb.x, tb.y, tb.w, tb.h, bg);
            B.strokeRect(tb.x, tb.y, tb.w, tb.h, border, 1.5);

            // Checkbox square
            const ckX = tb.x + 10;
            const ckY = tb.y + tb.h / 2 - 5;
            B.fillRect(ckX, ckY, 10, 10, isOn ? '#FFF' : '#F8F8F8');
            B.strokeRect(ckX, ckY, 10, 10, isOn ? '#4A8A76' : '#AAA', 1);
            if (isOn) {
                // Checkmark
                B.line(ckX + 2, ckY + 5, ckX + 4, ckY + 8, '#4A8A76', 2);
                B.line(ckX + 4, ckY + 8, ckX + 8, ckY + 2, '#4A8A76', 2);
            }
            B.flush();

            T.drawText(tb.label, tb.x + 26, tb.y + tb.h / 2,
                'bold 11px "Courier New", monospace', textColor, 'left', 'middle');
        }
        T.flush();

        // VS badge between preview balls
        const previewY = c.CANVAS_HEIGHT - 125;
        if (this.selectedLeft) {
            this._drawPreview(this.selectedLeft, 60, previewY);
        }
        if (this.selectedRight) {
            this._drawPreview(this.selectedRight, c.CANVAS_WIDTH - 60, previewY);
        }
        if (this.selectedLeft && this.selectedRight) {
            T.drawText('VS', cx, previewY + 4,
                'bold 16px "Courier New", monospace', '#999', 'center', 'middle');
        }

        // Random button
        const rBtn = layout.randomBtn;
        B.fillRect(rBtn.x, rBtn.y, rBtn.w, rBtn.h, '#AAA');
        B.strokeRect(rBtn.x, rBtn.y, rBtn.w, rBtn.h, '#888', 2);
        B.flush();
        T.drawText('RANDOM', rBtn.x + rBtn.w / 2, rBtn.y + rBtn.h / 2,
            'bold 12px "Courier New", monospace', '#FFF', 'center', 'middle');

        // Sim count selector
        const scBtn = layout.simCountBtn;
        B.fillRect(scBtn.x, scBtn.y, scBtn.w, scBtn.h, '#E8E0D0');
        B.strokeRect(scBtn.x, scBtn.y, scBtn.w, scBtn.h, '#CCC', 1.5);
        B.flush();
        T.drawText(`Sims: ${WB.SimUI.simCount}`, scBtn.x + scBtn.w / 2, scBtn.y + scBtn.h / 2,
            '10px "Courier New", monospace', '#888', 'center', 'middle');

        // FIGHT button
        if (this.selectedLeft && this.selectedRight) {
            const fBtn = layout.fightBtn;
            B.fillRect(fBtn.x, fBtn.y, fBtn.w, fBtn.h, '#E85D75');
            B.strokeRect(fBtn.x, fBtn.y, fBtn.w, fBtn.h, '#333', 3);
            B.flush();
            T.drawText('FIGHT!', fBtn.x + fBtn.w / 2, fBtn.y + fBtn.h / 2,
                'bold 20px "Courier New", monospace', '#FFF', 'center', 'middle');

            // SIMULATE button
            const sBtn = layout.simBtn;
            B.fillRect(sBtn.x, sBtn.y, sBtn.w, sBtn.h, '#6BB5E0');
            B.strokeRect(sBtn.x, sBtn.y, sBtn.w, sBtn.h, '#333', 3);
            B.flush();
            T.drawText('SIMULATE', sBtn.x + sBtn.w / 2, sBtn.y + sBtn.h / 2,
                'bold 16px "Courier New", monospace', '#FFF', 'center', 'middle');
        }

        // BEST OF button (bottom)
        const boBtn = layout.bestOfBtn;
        const savedCount = WB.SimUI.loadBestOf().length;
        B.fillRect(boBtn.x, boBtn.y, boBtn.w, boBtn.h, savedCount > 0 ? '#D4A853' : '#CCC');
        B.strokeRect(boBtn.x, boBtn.y, boBtn.w, boBtn.h, savedCount > 0 ? '#B8860B' : '#AAA', 1.5);
        B.flush();
        T.drawText(`BEST OF (${savedCount})`, boBtn.x + boBtn.w / 2, boBtn.y + boBtn.h / 2,
            'bold 10px "Courier New", monospace', '#FFF', 'center', 'middle');
    },

    _drawGrid(side, layout) {
        const selected = side === 'left' ? this.selectedLeft : this.selectedRight;
        const B = WB.GLBatch;
        const T = WB.GLText;

        // Draw divider before P2 grid
        if (side === 'right') {
            const rows = Math.ceil(this.weaponTypes.length / layout.cols);
            const singleGridH = rows * (layout.btnH + layout.gap);
            const divY = layout.gridTop + singleGridH + 2 - this.menuScroll;
            if (divY > layout.gridTop && divY < layout.gridBottom) {
                B.setAlpha(0.4);
                B.line(layout.leftStart + 5, divY, layout.leftStart + layout.panelWidth - 5, divY, '#999', 1);
                B.restoreAlpha();
            }
        }

        for (let i = 0; i < this.weaponTypes.length; i++) {
            const type = this.weaponTypes[i];
            const btn = this._getBtnRect(side, i, layout);

            // Clip: skip buttons entirely outside visible grid area
            if (btn.y + btn.h < layout.gridTop || btn.y > layout.gridBottom) continue;

            const isSelected = selected === type;
            const color = WB.Config.COLORS[type];

            // Button background
            B.fillRect(btn.x, btn.y, btn.w, btn.h, isSelected ? color : '#EDEDED');

            // Border
            B.strokeRect(btn.x, btn.y, btn.w, btn.h, isSelected ? '#333' : '#CCC', isSelected ? 2.5 : 1.5);

            // Icon (centered in compact buttons)
            B.flush();
            WB.Renderer.drawWeaponIcon(type, btn.x + btn.w / 2, btn.y + btn.h / 2, isSelected ? '#FFF' : color);
        }
        T.flush();
    },

    _drawPreview(type, x, y) {
        const color = WB.Config.COLORS[type];
        const B = WB.GLBatch;
        const T = WB.GLText;

        // Small preview ball
        B.fillCircle(x, y, 16, color);
        B.strokeCircle(x, y, 16, '#333', 2);
        B.flush();

        T.drawText('100', x, y + 4, 'bold 10px "Courier New", monospace', '#FFF', 'center', 'alphabetic');

        // Name below
        const name = WB.Config.WEAPON_NAMES[type] || type;
        T.drawText(name, x, y + 26,
            'bold 9px "Courier New", monospace', color, 'center', 'alphabetic');
    }
};
