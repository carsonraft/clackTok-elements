window.WB = window.WB || {};

WB.UI = {
    selectedLeft: null,
    selectedRight: null,
    hoveredBtn: null,
    weaponTypes: [],
    selectedPack: 'elemental',  // Default pack tab (switches to 'pantheon' once gods are added)
    menuScroll: 0,       // Scroll offset for weapon grid
    maxScroll: 0,        // Computed max scroll

    init() {
        this._switchPack(this.selectedPack);
    },

    _switchPack(pack) {
        this.selectedPack = pack;
        this.weaponTypes = WB.WeaponRegistry.getTypes(pack);
        // Reset selections if current picks aren't in this pack
        if (this.selectedLeft && this.weaponTypes.indexOf(this.selectedLeft) === -1) {
            this.selectedLeft = null;
        }
        if (this.selectedRight && this.weaponTypes.indexOf(this.selectedRight) === -1) {
            this.selectedRight = null;
        }
        // Auto-select first two if nothing selected
        if (!this.selectedLeft) this.selectedLeft = this.weaponTypes[0] || null;
        if (!this.selectedRight) this.selectedRight = this.weaponTypes[1] || this.weaponTypes[0] || null;
        this.menuScroll = 0;
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

        // Check pack tabs first (above all other elements)
        const packTabs = this._getPackTabs(layout);
        for (const tab of packTabs) {
            if (mx >= tab.x && mx <= tab.x + tab.w && my >= tab.y && my <= tab.y + tab.h) {
                if (this.selectedPack !== tab.pack) {
                    this._switchPack(tab.pack);
                    WB.Audio.menuClack();
                }
                return;
            }
        }

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

        // Check stage size selector
        const ssBtn = layout.stageSizeBtn;
        if (mx >= ssBtn.x && mx <= ssBtn.x + ssBtn.w && my >= ssBtn.y && my <= ssBtn.y + ssBtn.h) {
            const presets = WB.Config.STAGE_PRESETS;
            WB.Config.STAGE_SIZE_INDEX = (WB.Config.STAGE_SIZE_INDEX + 1) % presets.length;
            WB.Audio.menuClack();
            return;
        }

        // Check friction selector
        const frBtn = layout.frictionBtn;
        if (mx >= frBtn.x && mx <= frBtn.x + frBtn.w && my >= frBtn.y && my <= frBtn.y + frBtn.h) {
            const presets = WB.Config.FRICTION_PRESETS;
            WB.Config.FRICTION_INDEX = (WB.Config.FRICTION_INDEX + 1) % presets.length;
            WB.Config.BALL_FRICTION = presets[WB.Config.FRICTION_INDEX].value;
            WB.Audio.menuClack();
            return;
        }

        // Check BEST OF button
        const boBtn = layout.bestOfBtn;
        if (mx >= boBtn.x && mx <= boBtn.x + boBtn.w && my >= boBtn.y && my <= boBtn.y + boBtn.h) {
            WB.Audio.menuClack();
            return 'bestof';
        }

        // Check STUDIO button
        const stBtn = layout.studioBtn;
        if (mx >= stBtn.x && mx <= stBtn.x + stBtn.w && my >= stBtn.y && my <= stBtn.y + stBtn.h) {
            WB.Audio.menuClack();
            return 'studio';
        }

        return null;
    },

    // ─── Layout ──────────────────────────────────────────
    // Bottom panel (below grids):
    //   Row 1: P1 preview  ─  RANDOM  ─  P2 preview    (previewRow)
    //   Row 2: toggles (5 across)                        (toggleY)
    //   Row 3: Stage | Sims | Friction                   (selectorsY)
    //   Row 4: [ FIGHT! ]  [ SIMULATE ]                  (fightBtn)
    //   Row 5: BEST OF                                   (bestOfBtn)

    _getLayout() {
        const c = WB.Config;
        const cx = c.CANVAS_WIDTH / 2;
        const pad = 15;
        const panelW = c.CANVAS_WIDTH - pad * 2;

        // Bottom panel starts from the bottom and stacks upward
        const bottomPad = 8;
        const bestOfH = 22;
        const fightH  = 44;
        const selectorH = 24;
        const toggleH = 24;
        const previewH = 55;  // ball (28diam) + name label + padding
        const rowGap = 8;

        const bestOfY    = c.CANVAS_HEIGHT - bottomPad - bestOfH;
        const fightY     = bestOfY - rowGap - fightH;
        const selectorsY = fightY - rowGap - selectorH;
        const toggleY    = selectorsY - rowGap - toggleH;
        const previewY   = toggleY - rowGap - previewH;
        const gridBottom = previewY - 8;

        const selectorW = Math.floor((panelW - 12) / 3);  // 3 selectors with 6px gaps

        return {
            leftStart: pad,
            rightStart: pad,
            panelWidth: panelW,
            gridTop: 96,
            gridBottom: gridBottom,
            gridGap: 30,
            cols: 4,
            btnH: 28,
            gap: 3,
            previewY: previewY,
            toggleY: toggleY,
            selectorsY: selectorsY,
            fightBtn:    { x: pad, y: fightY, w: panelW / 2 - 4, h: fightH },
            simBtn:      { x: cx + 4, y: fightY, w: panelW / 2 - 4, h: fightH },
            randomBtn:   { x: cx - 40, y: previewY + previewH / 2 - 13, w: 80, h: 26 },
            simCountBtn: { x: pad + selectorW + 6, y: selectorsY, w: selectorW, h: selectorH },
            stageSizeBtn:{ x: pad, y: selectorsY, w: selectorW, h: selectorH },
            frictionBtn: { x: pad + (selectorW + 6) * 2, y: selectorsY, w: selectorW, h: selectorH },
            bestOfBtn:   { x: pad, y: bestOfY, w: 100, h: bestOfH },
            studioBtn:   { x: pad + 106, y: bestOfY, w: 100, h: bestOfH },
        };
    },

    _getPackTabs(layout) {
        const c = WB.Config;
        // Use config PACKS keys so all tabs show even before weapons are registered
        const packs = Object.keys(WB.Config.PACKS || {});
        const packNames = WB.Config.PACKS || {};
        const pad = 15;
        const tabH = 20;
        const tabGap = 4;
        const totalW = c.CANVAS_WIDTH - pad * 2;
        const tabW = Math.floor((totalW - (packs.length - 1) * tabGap) / packs.length);
        const y = 66;
        return packs.map((pack, i) => ({
            x: pad + i * (tabW + tabGap),
            y,
            w: tabW,
            h: tabH,
            pack,
            label: (packNames[pack] && packNames[pack].name) || pack.toUpperCase(),
            color: (packNames[pack] && packNames[pack].color) || '#888',
        }));
    },

    _getToggleBtns(layout) {
        const c = WB.Config;
        const pad = 15;
        const toggleH = 22;
        const toggleGap = 4;
        const count = 7;
        const totalGaps = (count - 1) * toggleGap;
        const toggleW = Math.floor((c.CANVAS_WIDTH - pad * 2 - totalGaps) / count);
        const startX = pad;
        const y = layout.toggleY;
        return [
            { x: startX, y, w: toggleW, h: toggleH, key: 'INELASTIC_MODE', label: 'INELSTC' },
            { x: startX + (toggleW + toggleGap), y, w: toggleW, h: toggleH, key: 'GRAVITY_MODE', label: 'GRAVITY' },
            { x: startX + 2 * (toggleW + toggleGap), y, w: toggleW, h: toggleH, key: 'WEAPON_WALL_BOUNCE', label: 'TIP BNC' },
            { x: startX + 3 * (toggleW + toggleGap), y, w: toggleW, h: toggleH, key: 'WEAPON_WALL_DMG_BOUNCE', label: 'DMG BNC' },
            { x: startX + 4 * (toggleW + toggleGap), y, w: toggleW, h: toggleH, key: 'SUPERS_ENABLED', label: 'SUPERS' },
            { x: startX + 5 * (toggleW + toggleGap), y, w: toggleW, h: toggleH, key: 'CUTSCENE_ENABLED', label: 'SCENES' },
            { x: startX + 6 * (toggleW + toggleGap), y, w: toggleW, h: toggleH, key: 'MOTION_BLUR_ENABLED', label: 'MBLUR' },
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

    // ─── Draw ────────────────────────────────────────────
    drawMenu() {
        const c = WB.Config;
        const cx = c.CANVAS_WIDTH / 2;
        const layout = this._getLayout();
        const B = WB.GLBatch;
        const T = WB.GLText;
        const hiDpi = WB.GL.dpr >= 1.5;

        // Background
        B.fillRect(0, 0, c.CANVAS_WIDTH, c.CANVAS_HEIGHT, '#FFF8E7');

        // Draw weapon grids first (both use full width, stacked vertically)
        this._drawGrid('left', layout);
        this._drawGrid('right', layout);

        // Clip mask — cover overflow above and below grid area
        B.fillRect(0, 0, c.CANVAS_WIDTH, layout.gridTop - 2, '#FFF8E7');
        B.fillRect(0, layout.gridBottom + 1, c.CANVAS_WIDTH, c.CANVAS_HEIGHT - layout.gridBottom, '#FFF8E7');
        B.flush();

        // Title
        T.drawText('WEAPON BALL', cx, 38, 'bold 32px "Courier New", monospace', '#333', 'center', 'alphabetic');
        T.drawText('Choose your fighters', cx, 58, '13px "Courier New", monospace', '#888', 'center', 'alphabetic');
        T.flush();

        // Pack tabs
        const packTabs = this._getPackTabs(layout);
        for (const tab of packTabs) {
            const isActive = this.selectedPack === tab.pack;
            B.fillRect(tab.x, tab.y, tab.w, tab.h, isActive ? tab.color : '#E8E0D0');
            B.strokeRect(tab.x, tab.y, tab.w, tab.h, isActive ? '#333' : '#C8B8A0', isActive ? (hiDpi ? 2 : 1.5) : (hiDpi ? 1.5 : 1));
            B.flush();
            T.drawText(tab.label, tab.x + tab.w / 2, tab.y + tab.h / 2,
                'bold 11px "Courier New", monospace', isActive ? '#FFF' : '#999', 'center', 'middle');
        }
        T.flush();

        // P1 / P2 selection labels
        if (this.selectedLeft) {
            const col = WB.Config.COLORS[this.selectedLeft];
            const name = WB.Config.WEAPON_NAMES[this.selectedLeft] || this.selectedLeft;
            T.drawText('P1  ' + name, layout.leftStart + 2, layout.gridTop - 6,
                'bold 13px "Courier New", monospace', col, 'left', 'alphabetic');
        } else {
            T.drawText('Player 1', layout.leftStart + 2, layout.gridTop - 6,
                'bold 13px "Courier New", monospace', '#555', 'left', 'alphabetic');
        }
        if (this.selectedRight) {
            const col = WB.Config.COLORS[this.selectedRight];
            const name = WB.Config.WEAPON_NAMES[this.selectedRight] || this.selectedRight;
            T.drawText('P2  ' + name, layout.leftStart + layout.panelWidth - 2, layout.gridTop - 6,
                'bold 13px "Courier New", monospace', col, 'right', 'alphabetic');
        } else {
            T.drawText('Player 2', layout.leftStart + layout.panelWidth - 2, layout.gridTop - 6,
                'bold 13px "Courier New", monospace', '#555', 'right', 'alphabetic');
        }
        T.flush();

        // Scroll indicators
        if (this.maxScroll > 0) {
            if (this.menuScroll > 0) {
                T.drawText('▲', cx, layout.gridTop + 6,
                    '12px "Courier New", monospace', '#AAA', 'center', 'alphabetic');
            }
            if (this.menuScroll < this.maxScroll) {
                T.drawText('▼', cx, layout.gridBottom - 2,
                    '12px "Courier New", monospace', '#AAA', 'center', 'alphabetic');
            }
            T.flush();

            // Mini scrollbar
            const trackH = layout.gridBottom - layout.gridTop;
            const thumbH = Math.max(20, trackH * (trackH / (trackH + this.maxScroll)));
            const thumbY = layout.gridTop + (this.menuScroll / this.maxScroll) * (trackH - thumbH);
            B.fillRect(c.CANVAS_WIDTH - 8, layout.gridTop, 4, trackH, '#EEE');
            B.fillRect(c.CANVAS_WIDTH - 8, thumbY, 4, thumbH, '#BBB');
        }

        // ─── Bottom panel ────────────────────────────────

        // Subtle separator line
        B.setAlpha(0.3);
        B.line(layout.leftStart + 10, layout.gridBottom + 4, layout.leftStart + layout.panelWidth - 10, layout.gridBottom + 4, '#999', 1);
        B.restoreAlpha();

        // Row 1: Preview balls + RANDOM
        const previewCenterY = layout.previewY + 20;  // center of ball within preview row
        if (this.selectedLeft) {
            this._drawPreview(this.selectedLeft, 50, previewCenterY);
        }
        if (this.selectedRight) {
            this._drawPreview(this.selectedRight, c.CANVAS_WIDTH - 50, previewCenterY);
        }

        // VS label
        T.drawText('VS', cx, previewCenterY,
            'bold 14px "Courier New", monospace', '#CCC', 'center', 'middle');

        const rBtn = layout.randomBtn;
        B.fillRect(rBtn.x, rBtn.y, rBtn.w, rBtn.h, '#AAA');
        B.strokeRect(rBtn.x, rBtn.y, rBtn.w, rBtn.h, '#888', hiDpi ? 2 : 1.5);
        B.flush();
        T.drawText('RANDOM', rBtn.x + rBtn.w / 2, rBtn.y + rBtn.h / 2,
            'bold 12px "Courier New", monospace', '#FFF', 'center', 'middle');

        // Row 2: Toggles
        const toggleBtns = this._getToggleBtns(layout);
        for (const tb of toggleBtns) {
            const isOn = WB.Config[tb.key];
            const bg = isOn ? '#5DAA8F' : '#DDD';
            const border = isOn ? '#4A8A76' : '#BBB';
            const textColor = isOn ? '#FFF' : '#888';

            B.fillRect(tb.x, tb.y, tb.w, tb.h, bg);
            B.strokeRect(tb.x, tb.y, tb.w, tb.h, border, 1);
            B.flush();

            T.drawText(tb.label, tb.x + tb.w / 2, tb.y + tb.h / 2,
                'bold 11px "Courier New", monospace', textColor, 'center', 'middle');
        }
        T.flush();

        // Row 3: Stage | Sims | Friction selectors
        this._drawSelector(layout.stageSizeBtn, 'Stage: ' + WB.Config.STAGE_PRESETS[WB.Config.STAGE_SIZE_INDEX].label);
        this._drawSelector(layout.simCountBtn, 'Sims: ' + WB.SimUI.simCount);
        this._drawSelector(layout.frictionBtn, 'Fric: ' + WB.Config.FRICTION_PRESETS[WB.Config.FRICTION_INDEX].label);

        // Row 4: FIGHT + SIMULATE
        if (this.selectedLeft && this.selectedRight) {
            const btnBorder = hiDpi ? 3 : 2.5;
            const fBtn = layout.fightBtn;
            B.fillRect(fBtn.x, fBtn.y, fBtn.w, fBtn.h, '#E85D75');
            B.strokeRect(fBtn.x, fBtn.y, fBtn.w, fBtn.h, '#333', btnBorder);
            B.flush();
            T.drawText('FIGHT!', fBtn.x + fBtn.w / 2, fBtn.y + fBtn.h / 2,
                'bold 20px "Courier New", monospace', '#FFF', 'center', 'middle');

            const sBtn = layout.simBtn;
            B.fillRect(sBtn.x, sBtn.y, sBtn.w, sBtn.h, '#6BB5E0');
            B.strokeRect(sBtn.x, sBtn.y, sBtn.w, sBtn.h, '#333', btnBorder);
            B.flush();
            T.drawText('SIMULATE', sBtn.x + sBtn.w / 2, sBtn.y + sBtn.h / 2,
                'bold 16px "Courier New", monospace', '#FFF', 'center', 'middle');
        }

        // Row 5: BEST OF + STUDIO
        const boBtn = layout.bestOfBtn;
        const savedCount = WB.SimUI.loadBestOf().length;
        B.fillRect(boBtn.x, boBtn.y, boBtn.w, boBtn.h, savedCount > 0 ? '#D4A853' : '#CCC');
        B.strokeRect(boBtn.x, boBtn.y, boBtn.w, boBtn.h, savedCount > 0 ? '#B8860B' : '#AAA', 1);
        B.flush();
        T.drawText(`BEST OF (${savedCount})`, boBtn.x + boBtn.w / 2, boBtn.y + boBtn.h / 2,
            'bold 11px "Courier New", monospace', '#FFF', 'center', 'middle');

        const stBtn = layout.studioBtn;
        B.fillRect(stBtn.x, stBtn.y, stBtn.w, stBtn.h, savedCount > 0 ? '#6B48C7' : '#999');
        B.strokeRect(stBtn.x, stBtn.y, stBtn.w, stBtn.h, savedCount > 0 ? '#4A2E8F' : '#777', 1);
        B.flush();
        T.drawText('STUDIO', stBtn.x + stBtn.w / 2, stBtn.y + stBtn.h / 2,
            'bold 11px "Courier New", monospace', '#FFF', 'center', 'middle');
    },

    _drawSelector(btn, label) {
        const B = WB.GLBatch;
        const T = WB.GLText;
        B.fillRect(btn.x, btn.y, btn.w, btn.h, '#E8E0D0');
        B.strokeRect(btn.x, btn.y, btn.w, btn.h, '#C8B8A0', 1);
        B.flush();
        T.drawText(label, btn.x + btn.w / 2, btn.y + btn.h / 2,
            '12px "Courier New", monospace', '#776655', 'center', 'middle');
        T.flush();
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

            // Border — thicker on HiDPI
            const hiDpi = WB.GL.dpr >= 1.5;
            B.strokeRect(btn.x, btn.y, btn.w, btn.h, isSelected ? '#333' : '#CCC', isSelected ? (hiDpi ? 3 : 2.5) : (hiDpi ? 2 : 1.5));

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

        // Small preview ball — thicker outline on HiDPI
        B.fillCircle(x, y, 14, color);
        B.strokeCircle(x, y, 14, '#333', WB.GL.dpr >= 1.5 ? 2 : 1.5);
        B.flush();

        T.drawText('100', x, y + 3, 'bold 11px "Courier New", monospace', '#FFF', 'center', 'alphabetic');

        // Name below
        const name = WB.Config.WEAPON_NAMES[type] || type;
        T.drawText(name, x, y + 24,
            'bold 10px "Courier New", monospace', color, 'center', 'alphabetic');
        T.flush();
    }
};
