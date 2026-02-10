window.WB = window.WB || {};

WB.SimUI = {
    results: null,
    scrollOffset: 0,
    visibleRows: 12,
    simCount: 500,
    isReplaying: false,
    _replaySeed: null,
    _replaySource: null, // 'sim' or 'bestof'

    // ─── Best-of localStorage ───────────────────────────
    _STORAGE_KEY: 'wb_bestof',

    saveBestOf(result) {
        const saved = this.loadBestOf();
        if (saved.some(s => s.seed === result.seed && s.weaponLeft === result.weaponLeft && s.weaponRight === result.weaponRight)) {
            return false;
        }
        saved.push({
            seed: result.seed,
            weaponLeft: result.weaponLeft,
            weaponRight: result.weaponRight,
            winner: result.winner,
            winnerWeapon: result.winnerWeapon,
            winnerHp: result.winnerHp,
            score: result.score,
            frames: result.frames,
            savedAt: Date.now(),
        });
        saved.sort((a, b) => b.score.total - a.score.total);
        try {
            localStorage.setItem(this._STORAGE_KEY, JSON.stringify(saved));
        } catch (e) { /* storage full */ }
        return true;
    },

    loadBestOf() {
        try {
            const raw = localStorage.getItem(this._STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    },

    removeBestOf(seed, weaponLeft, weaponRight) {
        let saved = this.loadBestOf();
        saved = saved.filter(s => !(s.seed === seed && s.weaponLeft === weaponLeft && s.weaponRight === weaponRight));
        localStorage.setItem(this._STORAGE_KEY, JSON.stringify(saved));
    },

    isSaved(result) {
        const saved = this.loadBestOf();
        return saved.some(s => s.seed === result.seed && s.weaponLeft === result.weaponLeft && s.weaponRight === result.weaponRight);
    },

    // ─── Simulation ─────────────────────────────────────
    runSimulation(weaponLeft, weaponRight) {
        this.results = WB.Simulator.runBatch(weaponLeft, weaponRight, this.simCount);
        this.scrollOffset = 0;
    },

    // ─── Draw Simulation Results ────────────────────────
    drawResults() {
        this._drawTable(this.results, 'SIMULATION RESULTS', false);
    },

    // ─── Draw Best-Of List ──────────────────────────────
    drawBestOf() {
        const saved = this.loadBestOf();
        this._drawTable(saved, 'BEST OF', true);
    },

    // ─── Shared Table Renderer ──────────────────────────
    _drawTable(data, title, isBestOf) {
        const c = WB.Config;
        const cx = c.CANVAS_WIDTH / 2;
        const B = WB.GLBatch;
        const T = WB.GLText;

        // Background
        B.fillRect(0, 0, c.CANVAS_WIDTH, c.CANVAS_HEIGHT, '#FFF8E7');

        if (!data || data.length === 0) {
            T.drawText(title, cx, 40, 'bold 28px "Courier New", monospace', '#333', 'center', 'alphabetic');
            T.drawText(isBestOf ? 'No saved battles yet.' : 'No results.', cx, c.CANVAS_HEIGHT / 2,
                '16px "Courier New", monospace', '#999', 'center', 'alphabetic');
            T.flush();
            this._drawBackBtn();
            return;
        }

        const r = data[0];
        const nameL = WB.Config.WEAPON_NAMES[r.weaponLeft] || r.weaponLeft;
        const nameR = WB.Config.WEAPON_NAMES[r.weaponRight] || r.weaponRight;

        // Title
        T.drawText(title, cx, 40, 'bold 28px "Courier New", monospace', '#333', 'center', 'alphabetic');

        if (!isBestOf) {
            T.drawText(nameL, cx - 20, 68, 'bold 18px "Courier New", monospace',
                WB.Config.COLORS[r.weaponLeft], 'right', 'alphabetic');
            T.drawText('vs', cx, 68, 'bold 18px "Courier New", monospace', '#333', 'center', 'alphabetic');
            T.drawText(nameR, cx + 20, 68, 'bold 18px "Courier New", monospace',
                WB.Config.COLORS[r.weaponRight], 'left', 'alphabetic');
            T.drawText(`${data.length} battles simulated`, cx, 88,
                '14px "Courier New", monospace', '#888', 'center', 'alphabetic');
        } else {
            T.drawText(`${data.length} saved battle${data.length !== 1 ? 's' : ''}`, cx, 68,
                '14px "Courier New", monospace', '#888', 'center', 'alphabetic');
        }

        // Table header
        const tableX = 30;
        const tableY = isBestOf ? 90 : 110;
        const rowH = 38;

        let hx = tableX;
        T.drawText('#', hx, tableY, 'bold 12px "Courier New", monospace', '#999', 'left', 'alphabetic'); hx += 30;
        T.drawText('SCORE', hx, tableY, 'bold 12px "Courier New", monospace', '#999', 'left', 'alphabetic'); hx += 60;
        if (isBestOf) {
            T.drawText('MATCHUP', hx, tableY, 'bold 12px "Courier New", monospace', '#999', 'left', 'alphabetic'); hx += 160;
        }
        T.drawText('WINNER', hx, tableY, 'bold 12px "Courier New", monospace', '#999', 'left', 'alphabetic'); hx += 100;
        T.drawText('HP', hx, tableY, 'bold 12px "Courier New", monospace', '#999', 'left', 'alphabetic'); hx += 45;
        T.drawText('TIME', hx, tableY, 'bold 12px "Courier New", monospace', '#999', 'left', 'alphabetic');

        T.flush();

        // Separator
        B.line(tableX, tableY + 8, c.CANVAS_WIDTH - 30, tableY + 8, '#DDD', 1);

        // Table rows
        const startIdx = this.scrollOffset;
        const endIdx = Math.min(data.length, startIdx + this.visibleRows);

        for (let i = startIdx; i < endIdx; i++) {
            const row = data[i];
            const y = tableY + 28 + (i - startIdx) * rowH;
            const winnerName = WB.Config.WEAPON_NAMES[row.winnerWeapon] || row.winnerWeapon || 'Draw';
            const winnerColor = row.winnerWeapon ? WB.Config.COLORS[row.winnerWeapon] : '#888';
            const timeStr = (row.frames / 60).toFixed(1) + 's';

            // Row background (alternating)
            if (i % 2 === 0) {
                B.fillRect(tableX - 5, y - 14, c.CANVAS_WIDTH - 50, rowH, '#F5F0E0');
            }

            // Top 3 highlight
            if (!isBestOf && i < 3) {
                const hlColor = i === 0 ? 'rgba(255,215,0,0.15)' : i === 1 ? 'rgba(192,192,192,0.12)' : 'rgba(205,127,50,0.1)';
                B.fillRect(tableX - 5, y - 14, c.CANVAS_WIDTH - 50, rowH, hlColor);
            }

            B.flush();

            let rx = tableX;

            // Rank
            T.drawText(`${i + 1}`, rx, y, 'bold 13px "Courier New", monospace',
                (!isBestOf && i < 3) ? '#B8860B' : '#666', 'left', 'alphabetic'); rx += 30;

            // Score
            T.drawText(row.score.total.toFixed(1), rx, y, 'bold 13px "Courier New", monospace',
                '#333', 'left', 'alphabetic'); rx += 60;

            // Matchup (best-of only)
            if (isBestOf) {
                const mL = WB.Config.WEAPON_NAMES[row.weaponLeft] || row.weaponLeft;
                const mR = WB.Config.WEAPON_NAMES[row.weaponRight] || row.weaponRight;
                T.drawText(`${mL} v ${mR}`, rx, y, '11px "Courier New", monospace',
                    '#777', 'left', 'alphabetic'); rx += 160;
            }

            // Winner
            T.drawText(winnerName, rx, y, 'bold 13px "Courier New", monospace',
                winnerColor, 'left', 'alphabetic'); rx += 100;

            // HP
            T.drawText(`${row.winnerHp}`, rx, y, 'bold 13px "Courier New", monospace',
                '#555', 'left', 'alphabetic'); rx += 45;

            // Time
            T.drawText(timeStr, rx, y, 'bold 13px "Courier New", monospace',
                '#555', 'left', 'alphabetic');

            // Save star (sim) or Remove X (best-of)
            const actionX = c.CANVAS_WIDTH - 55;
            if (!isBestOf) {
                const saved = this.isSaved(row);
                T.drawText('★', actionX, y + 1, '16px "Courier New", monospace',
                    saved ? '#FFD700' : '#DDD', 'center', 'alphabetic');
            } else {
                T.drawText('✕', actionX, y + 1, 'bold 14px "Courier New", monospace',
                    '#C44', 'center', 'alphabetic');
            }

            // Click hint
            T.drawText('▶ replay', c.CANVAS_WIDTH - 70, y, '10px "Courier New", monospace',
                '#CCC', 'right', 'alphabetic');
        }

        T.flush();

        // Scroll indicators
        if (this.scrollOffset > 0) {
            T.drawText('▲ scroll up', cx, tableY + 20, '14px "Courier New", monospace',
                '#999', 'center', 'alphabetic');
        }
        if (endIdx < data.length) {
            T.drawText(`▼ ${data.length - endIdx} more`, cx, c.CANVAS_HEIGHT - 55,
                '14px "Courier New", monospace', '#999', 'center', 'alphabetic');
        }

        // Score breakdown (sim results only)
        if (!isBestOf && data.length > 0) {
            const topScore = data[0].score;
            const breakdownY = c.CANVAS_HEIGHT - 38;
            T.drawText(
                `Top: Close ${topScore.breakdown.closeness} | Lead ${topScore.breakdown.leadChanges} | ` +
                `Comeback ${topScore.breakdown.comeback} | Crit ${topScore.breakdown.criticalZone} | ` +
                `Action ${topScore.breakdown.actionDensity} | Dur ${topScore.breakdown.duration} | ` +
                `Super ${topScore.breakdown.supers}`,
                cx, breakdownY, '11px "Courier New", monospace', '#AAA', 'center', 'alphabetic');
        }

        T.flush();
        this._drawBackBtn();
    },

    _drawBackBtn() {
        const backBtn = this._getBackBtn();
        const B = WB.GLBatch;
        const T = WB.GLText;

        B.fillRect(backBtn.x, backBtn.y, backBtn.w, backBtn.h, '#AAA');
        B.strokeRect(backBtn.x, backBtn.y, backBtn.w, backBtn.h, '#888', 2);
        B.flush();
        T.drawText('BACK', backBtn.x + backBtn.w / 2, backBtn.y + backBtn.h / 2,
            'bold 14px "Courier New", monospace', '#FFF', 'center', 'middle');
    },

    _getBackBtn() {
        return { x: 20, y: WB.Config.CANVAS_HEIGHT - 55, w: 80, h: 35 };
    },

    _getRowBounds(visibleIndex) {
        const tableX = 30;
        const tableY = 110;
        const rowH = 38;
        const y = tableY + 14 + visibleIndex * rowH;
        return { x: tableX - 5, y: y, w: WB.Config.CANVAS_WIDTH - 50, h: rowH };
    },

    // ─── Click Handling ─────────────────────────────────
    handleResultsClick(mx, my) {
        this._handleTableClick(mx, my, this.results, false);
    },

    handleBestOfClick(mx, my) {
        const saved = this.loadBestOf();
        this._handleTableClick(mx, my, saved, true);
    },

    _handleTableClick(mx, my, data, isBestOf) {
        // Back button
        const backBtn = this._getBackBtn();
        if (mx >= backBtn.x && mx <= backBtn.x + backBtn.w && my >= backBtn.y && my <= backBtn.y + backBtn.h) {
            WB.Game.state = 'MENU';
            if (!isBestOf) this.results = null;
            this.scrollOffset = 0;
            return;
        }

        if (!data || data.length === 0) return;

        // Row clicks
        const tableY = isBestOf ? 90 : 110;
        const rowH = 38;
        const startRow = tableY + 14;
        const endRow = startRow + this.visibleRows * rowH;
        const c = WB.Config;

        if (my >= startRow && my < endRow && mx >= 25 && mx <= c.CANVAS_WIDTH - 25) {
            const visIdx = Math.floor((my - startRow) / rowH);
            const dataIdx = visIdx + this.scrollOffset;
            if (dataIdx >= 0 && dataIdx < data.length) {
                const row = data[dataIdx];
                const actionX = c.CANVAS_WIDTH - 55;

                if (mx >= actionX - 15 && mx <= actionX + 15) {
                    if (!isBestOf) {
                        if (this.isSaved(row)) {
                            this.removeBestOf(row.seed, row.weaponLeft, row.weaponRight);
                        } else {
                            this.saveBestOf(row);
                        }
                    } else {
                        this.removeBestOf(row.seed, row.weaponLeft, row.weaponRight);
                    }
                    return;
                }

                this._replaySource = isBestOf ? 'bestof' : 'sim';
                this.replayBattle(row);
            }
        }
    },

    handleScroll(direction) {
        if (direction === 'up' && this.scrollOffset > 0) {
            this.scrollOffset--;
        } else if (direction === 'down') {
            let len = 0;
            if (WB.Game.state === 'BEST_OF') {
                len = this.loadBestOf().length;
            } else if (this.results) {
                len = this.results.length;
            }
            if (this.scrollOffset + this.visibleRows < len) {
                this.scrollOffset++;
            }
        }
    },

    replayBattle(result) {
        this.isReplaying = true;
        this._replaySeed = result.seed;
        WB.RNG.seed(result.seed);
        WB.UI.selectedLeft = result.weaponLeft;
        WB.UI.selectedRight = result.weaponRight;
        WB.Game.startCountdown();
    },

    onReplayEnd() {
        const returnState = this._replaySource === 'bestof' ? 'BEST_OF' : 'SIM_RESULTS';
        this.isReplaying = false;
        this._replaySource = null;
        WB.RNG.unseed();
        return returnState;
    }
};
