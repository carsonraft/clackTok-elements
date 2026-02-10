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
        const totalHeight = rows * (layout.btnH + layout.gap);
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

        // Check left panel buttons
        for (let i = 0; i < this.weaponTypes.length; i++) {
            const btn = this._getBtnRect('left', i, layout);
            // Skip buttons outside visible grid
            if (btn.y + btn.h < layout.gridTop || btn.y > layout.gridBottom) continue;
            if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
                this.selectedLeft = this.weaponTypes[i];
                WB.Audio.menuClack();
                return;
            }
        }

        // Check right panel buttons
        for (let i = 0; i < this.weaponTypes.length; i++) {
            const btn = this._getBtnRect('right', i, layout);
            // Skip buttons outside visible grid
            if (btn.y + btn.h < layout.gridTop || btn.y > layout.gridBottom) continue;
            if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
                this.selectedRight = this.weaponTypes[i];
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
        return {
            leftStart: 40,
            rightStart: cx + 20,
            panelWidth: cx - 60,
            gridTop: 190,
            gridBottom: c.CANVAS_HEIGHT - 160, // clip weapon grid above buttons
            cols: 2,
            btnH: 36,
            gap: 5,
            fightBtn: { x: cx - 170, y: c.CANVAS_HEIGHT - 80, w: 155, h: 55 },
            simBtn:   { x: cx + 15,  y: c.CANVAS_HEIGHT - 80, w: 155, h: 55 },
            randomBtn: { x: cx - 65, y: c.CANVAS_HEIGHT - 145, w: 130, h: 35 },
            simCountBtn: { x: cx - 65, y: c.CANVAS_HEIGHT - 105, w: 130, h: 28 },
            bestOfBtn: { x: 30, y: c.CANVAS_HEIGHT - 35, w: 120, h: 28 },
        };
    },

    _getBtnRect(side, index, layout) {
        const col = index % layout.cols;
        const row = Math.floor(index / layout.cols);
        const btnW = (layout.panelWidth - (layout.cols - 1) * layout.gap) / layout.cols;
        const startX = side === 'left' ? layout.leftStart : layout.rightStart;
        return {
            x: startX + col * (btnW + layout.gap),
            y: layout.gridTop + row * (layout.btnH + layout.gap) - this.menuScroll,
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

        // Title
        T.drawText('WEAPON BALL', cx, 70, 'bold 44px "Courier New", monospace', '#333', 'center', 'alphabetic');
        T.drawText('Choose your fighters', cx, 100, '16px "Courier New", monospace', '#888', 'center', 'alphabetic');

        // Divider line
        B.line(cx, 140, cx, c.CANVAS_HEIGHT - 170, '#DDD', 1);

        // Panel headers
        T.drawText('Player 1', layout.leftStart + layout.panelWidth / 2, 165,
            'bold 18px "Courier New", monospace', '#555', 'center', 'alphabetic');
        T.drawText('Player 2', layout.rightStart + layout.panelWidth / 2, 165,
            'bold 18px "Courier New", monospace', '#555', 'center', 'alphabetic');

        T.flush();

        // Draw weapon grids
        this._drawGrid('left', layout);
        this._drawGrid('right', layout);

        // Scroll indicators (fade hints at top/bottom of grid)
        if (this.maxScroll > 0) {
            if (this.menuScroll > 0) {
                // Top fade — more items above
                B.setAlpha(0.5);
                B.fillRect(layout.leftStart, layout.gridTop - 16, layout.panelWidth, 16, '#FFF8E7');
                B.fillRect(layout.rightStart, layout.gridTop - 16, layout.panelWidth, 16, '#FFF8E7');
                B.restoreAlpha();
                T.drawText('▲ scroll up ▲', cx, layout.gridTop - 4,
                    '11px "Courier New", monospace', '#AAA', 'center', 'alphabetic');
            }
            if (this.menuScroll < this.maxScroll) {
                // Bottom fade — more items below
                B.setAlpha(0.5);
                B.fillRect(layout.leftStart, layout.gridBottom, layout.panelWidth, 16, '#FFF8E7');
                B.fillRect(layout.rightStart, layout.gridBottom, layout.panelWidth, 16, '#FFF8E7');
                B.restoreAlpha();
                T.drawText('▼ scroll down ▼', cx, layout.gridBottom + 13,
                    '11px "Courier New", monospace', '#AAA', 'center', 'alphabetic');
            }
            T.flush();

            // Mini scrollbar on the right edge
            const trackH = layout.gridBottom - layout.gridTop;
            const thumbH = Math.max(20, trackH * (trackH / (trackH + this.maxScroll)));
            const thumbY = layout.gridTop + (this.menuScroll / this.maxScroll) * (trackH - thumbH);
            B.fillRect(c.CANVAS_WIDTH - 14, layout.gridTop, 6, trackH, '#EEE');
            B.fillRect(c.CANVAS_WIDTH - 14, thumbY, 6, thumbH, '#BBB');
        }

        // Selected preview balls
        if (this.selectedLeft) {
            this._drawPreview(this.selectedLeft, 140, c.CANVAS_HEIGHT - 140);
        }
        if (this.selectedRight) {
            this._drawPreview(this.selectedRight, c.CANVAS_WIDTH - 140, c.CANVAS_HEIGHT - 140);
        }

        // Random button
        const rBtn = layout.randomBtn;
        B.fillRect(rBtn.x, rBtn.y, rBtn.w, rBtn.h, '#AAA');
        B.strokeRect(rBtn.x, rBtn.y, rBtn.w, rBtn.h, '#888', 2);
        B.flush();
        T.drawText('RANDOM', rBtn.x + rBtn.w / 2, rBtn.y + rBtn.h / 2,
            'bold 14px "Courier New", monospace', '#FFF', 'center', 'middle');

        // Sim count selector
        const scBtn = layout.simCountBtn;
        B.fillRect(scBtn.x, scBtn.y, scBtn.w, scBtn.h, '#E8E0D0');
        B.strokeRect(scBtn.x, scBtn.y, scBtn.w, scBtn.h, '#CCC', 1.5);
        B.flush();
        T.drawText(`Sims: ${WB.SimUI.simCount}`, scBtn.x + scBtn.w / 2, scBtn.y + scBtn.h / 2,
            '12px "Courier New", monospace', '#888', 'center', 'middle');

        // FIGHT button
        if (this.selectedLeft && this.selectedRight) {
            const fBtn = layout.fightBtn;
            B.fillRect(fBtn.x, fBtn.y, fBtn.w, fBtn.h, '#E85D75');
            B.strokeRect(fBtn.x, fBtn.y, fBtn.w, fBtn.h, '#333', 3);
            B.flush();
            T.drawText('FIGHT!', fBtn.x + fBtn.w / 2, fBtn.y + fBtn.h / 2,
                'bold 24px "Courier New", monospace', '#FFF', 'center', 'middle');

            // SIMULATE button
            const sBtn = layout.simBtn;
            B.fillRect(sBtn.x, sBtn.y, sBtn.w, sBtn.h, '#6BB5E0');
            B.strokeRect(sBtn.x, sBtn.y, sBtn.w, sBtn.h, '#333', 3);
            B.flush();
            T.drawText('SIMULATE', sBtn.x + sBtn.w / 2, sBtn.y + sBtn.h / 2,
                'bold 20px "Courier New", monospace', '#FFF', 'center', 'middle');
        }

        // BEST OF button (bottom)
        const boBtn = layout.bestOfBtn;
        const savedCount = WB.SimUI.loadBestOf().length;
        B.fillRect(boBtn.x, boBtn.y, boBtn.w, boBtn.h, savedCount > 0 ? '#D4A853' : '#CCC');
        B.strokeRect(boBtn.x, boBtn.y, boBtn.w, boBtn.h, savedCount > 0 ? '#B8860B' : '#AAA', 1.5);
        B.flush();
        T.drawText(`BEST OF (${savedCount})`, boBtn.x + boBtn.w / 2, boBtn.y + boBtn.h / 2,
            'bold 12px "Courier New", monospace', '#FFF', 'center', 'middle');
    },

    _drawGrid(side, layout) {
        const selected = side === 'left' ? this.selectedLeft : this.selectedRight;
        const B = WB.GLBatch;
        const T = WB.GLText;

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

            // Icon
            B.flush();
            WB.Renderer.drawWeaponIcon(type, btn.x + 15, btn.y + btn.h / 2, isSelected ? '#FFF' : color);

            // Name
            const name = WB.Config.WEAPON_NAMES[type] || type;
            T.drawText(name, btn.x + 30, btn.y + btn.h / 2 + 4,
                'bold 12px "Courier New", monospace', isSelected ? '#FFF' : '#555', 'left', 'alphabetic');
        }
        T.flush();
    },

    _drawPreview(type, x, y) {
        const color = WB.Config.COLORS[type];
        const B = WB.GLBatch;
        const T = WB.GLText;

        // Small preview ball
        B.fillCircle(x, y, 18, color);
        B.strokeCircle(x, y, 18, '#333', 2);
        B.flush();

        T.drawText('100', x, y + 4, 'bold 12px "Courier New", monospace', '#FFF', 'center', 'alphabetic');
    }
};
