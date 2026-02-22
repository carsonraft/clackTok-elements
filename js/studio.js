window.WB = window.WB || {};

// ─── Content Studio ────────────────────────────────────────────
// Screen for managing saved battles, adding custom intro dialogue,
// previewing, and recording TikTok-ready clips.
WB.Studio = {
    scrollOffset: 0,
    selectedIndex: -1,
    _isPreview: false,
    _isRecording: false,

    _DIALOGUE_KEY: 'wb_studio_dialogues',
    _ROW_HEIGHT: 42,
    _LIST_TOP: 70,
    _LIST_BOTTOM: 520,

    // ─── Drawing ──────────────────────────────────────────

    draw() {
        const c = WB.Config;
        const B = WB.GLBatch;
        const T = WB.GLText;

        WB.GL.beginFrame();
        B.fillRect(0, 0, c.CANVAS_WIDTH, c.CANVAS_HEIGHT, '#F5F0E6');

        const cx = c.CANVAS_WIDTH / 2;
        const saved = WB.SimUI.loadBestOf();

        // Title
        T.drawTextWithStroke('CONTENT STUDIO', cx, 28,
            'bold 28px "Courier New", monospace', '#1A1A1A', '#F5F0E6', 'center', 'middle');

        // Subtitle
        T.drawText(saved.length + ' saved battle' + (saved.length !== 1 ? 's' : ''), cx, 50,
            '14px "Courier New", monospace', '#888', 'center', 'middle');

        // Battle list
        this._drawBattleList(saved, B, T, cx);

        // Selected battle detail
        if (this.selectedIndex >= 0 && this.selectedIndex < saved.length) {
            this._drawSelectedDetail(saved[this.selectedIndex], B, T, cx);
        }

        // Back button
        const backBtn = this._getBackBtn();
        B.fillRect(backBtn.x, backBtn.y, backBtn.w, backBtn.h, '#AAA');
        B.strokeRect(backBtn.x, backBtn.y, backBtn.w, backBtn.h, '#888', 1.5);
        B.flush();
        T.drawText('\u2190 BACK', backBtn.x + backBtn.w / 2, backBtn.y + backBtn.h / 2,
            'bold 14px "Courier New", monospace', '#FFF', 'center', 'middle');

        T.flush();
    },

    _drawBattleList(saved, B, T, cx) {
        const c = WB.Config;
        const listH = this._LIST_BOTTOM - this._LIST_TOP;
        const visibleRows = Math.floor(listH / this._ROW_HEIGHT);

        if (saved.length === 0) {
            T.drawText('No saved battles yet.', cx, this._LIST_TOP + 40,
                '14px "Courier New", monospace', '#999', 'center', 'middle');
            T.drawText('Play battles and click \u2605 SAVE on the result screen!', cx, this._LIST_TOP + 60,
                '11px "Courier New", monospace', '#AAA', 'center', 'middle');
            return;
        }

        // Clamp scroll
        const maxScroll = Math.max(0, saved.length - visibleRows);
        if (this.scrollOffset > maxScroll) this.scrollOffset = maxScroll;
        if (this.scrollOffset < 0) this.scrollOffset = 0;

        // Draw rows
        const pad = 15;
        const rowW = c.CANVAS_WIDTH - pad * 2;

        for (let i = 0; i < visibleRows && (i + this.scrollOffset) < saved.length; i++) {
            const idx = i + this.scrollOffset;
            const battle = saved[idx];
            const rowY = this._LIST_TOP + i * this._ROW_HEIGHT;

            // Highlight selected
            if (idx === this.selectedIndex) {
                B.fillRect(pad - 2, rowY, rowW + 4, this._ROW_HEIGHT - 2, '#E0D8C8');
                B.strokeRect(pad - 2, rowY, rowW + 4, this._ROW_HEIGHT - 2, '#B8A888', 1.5);
            } else {
                B.fillRect(pad, rowY + 1, rowW, this._ROW_HEIGHT - 4, 'rgba(0,0,0,0.03)');
            }

            // Left color dot
            const leftColor = WB.Config.COLORS[battle.weaponLeft] || '#888';
            B.fillCircle(pad + 12, rowY + this._ROW_HEIGHT / 2 - 1, 5, leftColor);

            // Weapon names
            const nameL = (WB.Config.WEAPON_NAMES[battle.weaponLeft] || battle.weaponLeft).toUpperCase();
            const nameR = (WB.Config.WEAPON_NAMES[battle.weaponRight] || battle.weaponRight).toUpperCase();
            T.drawText(nameL + '  vs  ' + nameR, pad + 26, rowY + this._ROW_HEIGHT / 2 - 1,
                '12px "Courier New", monospace', '#333', 'left', 'middle');

            // Right color dot
            const rightColor = WB.Config.COLORS[battle.weaponRight] || '#888';
            B.fillCircle(pad + rowW - 55, rowY + this._ROW_HEIGHT / 2 - 1, 5, rightColor);

            // Score badge
            const scoreTotal = battle.score && battle.score.total ? Math.round(battle.score.total) : 0;
            const scoreBadgeColor = scoreTotal >= 70 ? '#D4A853' : (scoreTotal >= 40 ? '#AAA' : '#CCC');
            T.drawText(scoreTotal + '', pad + rowW - 30, rowY + this._ROW_HEIGHT / 2 - 1,
                'bold 12px "Courier New", monospace', scoreBadgeColor, 'center', 'middle');

            // Dialogue indicator
            const dKey = this._dialogueKey(battle);
            const dialogue = this._loadDialogue(dKey);
            if (dialogue && dialogue.lines && dialogue.lines.length > 0) {
                T.drawText('\uD83D\uDCDD', pad + rowW - 8, rowY + this._ROW_HEIGHT / 2 - 1,
                    '11px "Courier New", monospace', '#6B48C7', 'right', 'middle');
            }
        }

        B.flush();

        // Scroll indicator
        if (saved.length > visibleRows) {
            const scrollPct = this.scrollOffset / maxScroll;
            const trackH = listH - 10;
            const thumbH = Math.max(20, trackH * (visibleRows / saved.length));
            const thumbY = this._LIST_TOP + 5 + scrollPct * (trackH - thumbH);
            B.fillRect(c.CANVAS_WIDTH - 8, thumbY, 4, thumbH, 'rgba(0,0,0,0.15)');
            B.flush();
        }
    },

    _drawSelectedDetail(battle, B, T, cx) {
        const c = WB.Config;
        const detailY = 530;

        // Separator
        B.line(20, detailY - 5, c.CANVAS_WIDTH - 20, detailY - 5, 'rgba(0,0,0,0.1)', 1);
        B.flush();

        // Weapon names with colors
        const nameL = (WB.Config.WEAPON_NAMES[battle.weaponLeft] || battle.weaponLeft).toUpperCase();
        const nameR = (WB.Config.WEAPON_NAMES[battle.weaponRight] || battle.weaponRight).toUpperCase();
        const leftColor = WB.Config.COLORS[battle.weaponLeft] || '#888';
        const rightColor = WB.Config.COLORS[battle.weaponRight] || '#888';

        T.drawTextWithStroke(nameL, cx - 50, detailY + 12,
            'bold 18px "Courier New", monospace', leftColor, '#F5F0E6', 'right', 'middle');
        T.drawText('vs', cx, detailY + 12,
            '14px "Courier New", monospace', '#999', 'center', 'middle');
        T.drawTextWithStroke(nameR, cx + 50, detailY + 12,
            'bold 18px "Courier New", monospace', rightColor, '#F5F0E6', 'left', 'middle');

        // Stats line
        const score = battle.score && battle.score.total ? Math.round(battle.score.total) : 0;
        const frames = battle.frames || (battle.score && battle.score.meta ? battle.score.meta.frames : 0);
        const dur = (frames / 60).toFixed(1);
        const winnerSide = battle.winner === 'left' ? 'Left' : 'Right';
        const statsText = 'Score: ' + score + '/100  \u00B7  Duration: ' + dur + 's  \u00B7  Winner: ' + winnerSide;
        T.drawText(statsText, cx, detailY + 38,
            '11px "Courier New", monospace', '#777', 'center', 'middle');

        // Dialogue line count
        const dKey = this._dialogueKey(battle);
        const dialogue = this._loadDialogue(dKey);
        const lineCount = dialogue && dialogue.lines ? dialogue.lines.length : 0;
        const dialogueText = lineCount > 0 ? 'Dialogue: ' + lineCount + ' line' + (lineCount > 1 ? 's' : '') : 'Dialogue: None';
        T.drawText(dialogueText, cx, detailY + 56,
            '11px "Courier New", monospace', lineCount > 0 ? '#6B48C7' : '#AAA', 'center', 'middle');

        // Action buttons: EDIT INTRO | PREVIEW | RECORD
        const btns = this._getActionBtns();
        const btnLabels = ['EDIT INTRO', 'PREVIEW', 'RECORD'];
        const btnColors = ['#6B48C7', '#2E8B57', '#CC3333'];
        const btnBorders = ['#4A2E8F', '#1E6B3F', '#992222'];

        for (let i = 0; i < 3; i++) {
            const btn = btns[i];
            B.fillRect(btn.x, btn.y, btn.w, btn.h, btnColors[i]);
            B.strokeRect(btn.x, btn.y, btn.w, btn.h, btnBorders[i], 1.5);
            B.flush();
            T.drawText(btnLabels[i], btn.x + btn.w / 2, btn.y + btn.h / 2,
                'bold 12px "Courier New", monospace', '#FFF', 'center', 'middle');
        }

        // DELETE button (smaller, red outline)
        const delBtn = this._getDeleteBtn();
        B.fillRect(delBtn.x, delBtn.y, delBtn.w, delBtn.h, 'rgba(204,51,51,0.08)');
        B.strokeRect(delBtn.x, delBtn.y, delBtn.w, delBtn.h, '#CC3333', 1);
        B.flush();
        T.drawText('DELETE', delBtn.x + delBtn.w / 2, delBtn.y + delBtn.h / 2,
            '11px "Courier New", monospace', '#CC3333', 'center', 'middle');

        // SET IMAGE buttons for left/right balls
        if (WB.BallImages) {
            const imgBtns = this._getImageBtns();
            for (let i = 0; i < 2; i++) {
                const btn = imgBtns[i];
                const side = i === 0 ? 'left' : 'right';
                const hasImg = WB.BallImages.hasImage(side);
                const label = hasImg ? (side === 'left' ? 'L IMG \u2713' : 'R IMG \u2713') : (side === 0 ? 'L IMAGE' : 'R IMAGE');
                const sideLabel = i === 0 ? 'L IMAGE' : 'R IMAGE';
                B.fillRect(btn.x, btn.y, btn.w, btn.h, hasImg ? '#2E6B3F' : '#555');
                B.strokeRect(btn.x, btn.y, btn.w, btn.h, hasImg ? '#1E4B2F' : '#444', 1);
                B.flush();
                T.drawText(hasImg ? sideLabel + ' \u2713' : sideLabel, btn.x + btn.w / 2, btn.y + btn.h / 2,
                    '10px "Courier New", monospace', '#FFF', 'center', 'middle');
            }
            // CLEAR IMAGES button
            if (WB.BallImages.hasImage('left') || WB.BallImages.hasImage('right')) {
                const clrBtn = this._getClearImgBtn();
                B.fillRect(clrBtn.x, clrBtn.y, clrBtn.w, clrBtn.h, 'rgba(0,0,0,0.05)');
                B.strokeRect(clrBtn.x, clrBtn.y, clrBtn.w, clrBtn.h, '#AAA', 1);
                B.flush();
                T.drawText('CLEAR IMGS', clrBtn.x + clrBtn.w / 2, clrBtn.y + clrBtn.h / 2,
                    '10px "Courier New", monospace', '#999', 'center', 'middle');
            }
        }
    },

    // ─── Click Handling ──────────────────────────────────

    handleClick(mx, my) {
        const saved = WB.SimUI.loadBestOf();

        // Back button
        const backBtn = this._getBackBtn();
        if (mx >= backBtn.x && mx <= backBtn.x + backBtn.w && my >= backBtn.y && my <= backBtn.y + backBtn.h) {
            WB.Audio.menuClack();
            WB.Game.state = 'MENU';
            return;
        }

        // Battle list click
        if (my >= this._LIST_TOP && my < this._LIST_BOTTOM && saved.length > 0) {
            const rowIdx = Math.floor((my - this._LIST_TOP) / this._ROW_HEIGHT);
            const actualIdx = rowIdx + this.scrollOffset;
            if (actualIdx >= 0 && actualIdx < saved.length) {
                WB.Audio.menuClack();
                this.selectedIndex = actualIdx;
                return;
            }
        }

        // Action buttons (only when a battle is selected)
        if (this.selectedIndex >= 0 && this.selectedIndex < saved.length) {
            const battle = saved[this.selectedIndex];

            // Action buttons
            const btns = this._getActionBtns();

            // EDIT INTRO
            if (this._hitTest(mx, my, btns[0])) {
                WB.Audio.menuClack();
                this._editDialogue(battle);
                return;
            }

            // PREVIEW
            if (this._hitTest(mx, my, btns[1])) {
                WB.Audio.menuClack();
                this._preview(battle);
                return;
            }

            // RECORD
            if (this._hitTest(mx, my, btns[2])) {
                WB.Audio.menuClack();
                this._startRecording(battle);
                return;
            }

            // DELETE
            const delBtn = this._getDeleteBtn();
            if (this._hitTest(mx, my, delBtn)) {
                WB.Audio.menuClack();
                WB.SimUI.removeBestOf(battle.seed, battle.weaponLeft, battle.weaponRight);
                // Also remove dialogue data
                const dKey = this._dialogueKey(battle);
                this._removeDialogue(dKey);
                // Adjust selection
                const remaining = WB.SimUI.loadBestOf();
                if (this.selectedIndex >= remaining.length) {
                    this.selectedIndex = remaining.length - 1;
                }
                return;
            }

            // SET IMAGE buttons
            if (WB.BallImages) {
                const imgBtns = this._getImageBtns();
                for (let i = 0; i < 2; i++) {
                    if (this._hitTest(mx, my, imgBtns[i])) {
                        WB.Audio.menuClack();
                        this._pendingImageSide = i === 0 ? 'left' : 'right';
                        this._openImagePicker();
                        return;
                    }
                }

                // CLEAR IMAGES
                const clrBtn = this._getClearImgBtn();
                if (this._hitTest(mx, my, clrBtn)) {
                    WB.Audio.menuClack();
                    WB.BallImages.clear('left');
                    WB.BallImages.clear('right');
                    return;
                }
            }
        }
    },

    handleScroll(dir) {
        if (dir === 'down') this.scrollOffset++;
        else if (dir === 'up') this.scrollOffset--;
        if (this.scrollOffset < 0) this.scrollOffset = 0;
    },

    // ─── Dialogue CRUD ──────────────────────────────────

    _dialogueKey(battle) {
        return battle.seed + '_' + battle.weaponLeft + '_' + battle.weaponRight;
    },

    _loadAllDialogues() {
        try {
            const raw = localStorage.getItem(this._DIALOGUE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    },

    _loadDialogue(key) {
        const all = this._loadAllDialogues();
        return all[key] || null;
    },

    _saveDialogue(key, data) {
        const all = this._loadAllDialogues();
        all[key] = data;
        try {
            localStorage.setItem(this._DIALOGUE_KEY, JSON.stringify(all));
        } catch (e) { /* storage full */ }
    },

    _removeDialogue(key) {
        const all = this._loadAllDialogues();
        delete all[key];
        try {
            localStorage.setItem(this._DIALOGUE_KEY, JSON.stringify(all));
        } catch (e) { /* ignore */ }
    },

    // ─── Dialogue Editor (prompt-based) ──────────────────

    _editDialogue(battle) {
        const dKey = this._dialogueKey(battle);
        let dialogue = this._loadDialogue(dKey) || { lines: [], updatedAt: 0 };

        const lineCount = dialogue.lines.length;
        const action = prompt(
            'You have ' + lineCount + ' intro line' + (lineCount !== 1 ? 's' : '') + '.\n\n' +
            'Type ADD to add a line\n' +
            'Type CLEAR to remove all lines\n' +
            'Type LIST to see current lines\n' +
            'Or press Cancel to go back.'
        );

        if (!action) return;
        const cmd = action.trim().toUpperCase();

        if (cmd === 'CLEAR') {
            dialogue.lines = [];
            dialogue.updatedAt = Date.now();
            this._saveDialogue(dKey, dialogue);
            return;
        }

        if (cmd === 'LIST') {
            if (dialogue.lines.length === 0) {
                alert('No dialogue lines yet.');
            } else {
                let listing = '';
                for (let i = 0; i < dialogue.lines.length; i++) {
                    listing += (i + 1) + '. [' + dialogue.lines[i].voice + '] ' + dialogue.lines[i].text + '\n';
                }
                alert(listing);
            }
            // Re-open editor after listing
            setTimeout(() => this._editDialogue(battle), 100);
            return;
        }

        if (cmd === 'ADD') {
            const text = prompt('Enter dialogue text:');
            if (!text || !text.trim()) return;

            const voiceInput = prompt(
                'Voice preset:\n' +
                'narrator, epic, hype, villain, whisper,\n' +
                'robot, excited, dramatic, chipmunk, god\n\n' +
                '(default: narrator)'
            );
            const voice = (voiceInput && voiceInput.trim()) ? voiceInput.trim().toLowerCase() : 'narrator';

            dialogue.lines.push({ text: text.trim(), voice: voice });
            dialogue.updatedAt = Date.now();
            this._saveDialogue(dKey, dialogue);

            // Ask if they want to add another
            setTimeout(() => this._editDialogue(battle), 100);
            return;
        }

        // Unknown command — treat as text to add with narrator voice
        dialogue.lines.push({ text: action.trim(), voice: 'narrator' });
        dialogue.updatedAt = Date.now();
        this._saveDialogue(dKey, dialogue);
    },

    // ─── Cutscene Script Builder ─────────────────────────

    _buildCutsceneScript(dialogueData, battle) {
        const script = [
            { type: 'letterbox', height: 50 },
            { type: 'camera', target: 'arena', preset: 'wide', duration: 30 },
        ];

        for (const line of dialogueData.lines) {
            script.push({
                type: 'narrate',
                text: line.text,
                voice: line.voice || 'narrator',
                speed: 1.5,
                hold: 45,
            });
        }

        script.push(
            { type: 'letterbox', active: false },
            { type: 'wait', frames: 20 },
        );

        return script;
    },

    // ─── Preview ──────────────────────────────────────────

    _preview(battle) {
        this._isPreview = true;
        this._isRecording = false;

        // Set weapons
        WB.UI.selectedLeft = battle.weaponLeft;
        WB.UI.selectedRight = battle.weaponRight;

        // Restore toggles
        if (battle.toggles && WB.SimUI._restoreToggles) {
            WB.SimUI._restoreToggles(battle.toggles);
        }

        // Seed RNG
        WB.RNG.seed(battle.seed);

        // Check for custom dialogue
        const dKey = this._dialogueKey(battle);
        const dialogue = this._loadDialogue(dKey);

        if (dialogue && dialogue.lines && dialogue.lines.length > 0 && WB.Cutscene) {
            const script = this._buildCutsceneScript(dialogue, battle);
            WB.Game.startCountdown();
            // Override state to play cutscene first
            WB.Cutscene.playCutscene(script, () => {
                // Cutscene done — now the countdown/battle is already set up
                // Just need to start the battle
                WB.Game.startBattle();
            });
            WB.Game.state = 'PRE_BATTLE_CUTSCENE';
        } else {
            WB.Game.startCountdown();
        }
    },

    // ─── Recording (placeholder for Phase 3) ─────────────

    _startRecording(battle) {
        if (!WB.Recorder) {
            alert('Recorder not yet available. Coming soon!');
            return;
        }

        this._isRecording = true;
        this._isPreview = false;

        // Set weapons
        WB.UI.selectedLeft = battle.weaponLeft;
        WB.UI.selectedRight = battle.weaponRight;

        // Restore toggles
        if (battle.toggles && WB.SimUI._restoreToggles) {
            WB.SimUI._restoreToggles(battle.toggles);
        }

        // Seed RNG
        WB.RNG.seed(battle.seed);

        // Start recorder
        WB.Recorder.start();

        // Check for dialogue
        const dKey = this._dialogueKey(battle);
        const dialogue = this._loadDialogue(dKey);

        if (dialogue && dialogue.lines && dialogue.lines.length > 0 && WB.Cutscene) {
            const script = this._buildCutsceneScript(dialogue, battle);
            WB.Game.startCountdown();
            WB.Cutscene.playCutscene(script, () => {
                WB.Game.startBattle();
            });
            WB.Game.state = 'PRE_BATTLE_CUTSCENE';
        } else {
            WB.Game.startCountdown();
        }
    },

    // ─── Layout Helpers ──────────────────────────────────

    _getActionBtns() {
        const cx = WB.Config.CANVAS_WIDTH / 2;
        const btnW = 145;
        const btnH = 34;
        const gap = 8;
        const totalW = btnW * 3 + gap * 2;
        const startX = cx - totalW / 2;
        const y = 610;
        return [
            { x: startX, y: y, w: btnW, h: btnH },
            { x: startX + btnW + gap, y: y, w: btnW, h: btnH },
            { x: startX + (btnW + gap) * 2, y: y, w: btnW, h: btnH },
        ];
    },

    _getDeleteBtn() {
        const cx = WB.Config.CANVAS_WIDTH / 2;
        return { x: cx - 40, y: 660, w: 80, h: 28 };
    },

    _getImageBtns() {
        const cx = WB.Config.CANVAS_WIDTH / 2;
        const btnW = 90;
        const gap = 10;
        return [
            { x: cx - btnW - gap / 2, y: 696, w: btnW, h: 26 },
            { x: cx + gap / 2, y: 696, w: btnW, h: 26 },
        ];
    },

    _getClearImgBtn() {
        const cx = WB.Config.CANVAS_WIDTH / 2;
        return { x: cx - 50, y: 726, w: 100, h: 22 };
    },

    _pendingImageSide: null,

    _openImagePicker() {
        const input = document.getElementById('ballImageInput');
        if (!input) return;

        // Remove old listener, add new one
        const handler = (e) => {
            input.removeEventListener('change', handler);
            const file = e.target.files && e.target.files[0];
            if (!file || !this._pendingImageSide) return;

            const reader = new FileReader();
            reader.onload = (ev) => {
                WB.BallImages.loadImage(this._pendingImageSide, ev.target.result);
                this._pendingImageSide = null;
            };
            reader.readAsDataURL(file);
            input.value = ''; // Reset for re-use
        };
        input.addEventListener('change', handler);
        input.click();
    },

    _getBackBtn() {
        const cx = WB.Config.CANVAS_WIDTH / 2;
        return { x: cx - 50, y: WB.Config.CANVAS_HEIGHT - 45, w: 100, h: 32 };
    },

    _hitTest(mx, my, btn) {
        return mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h;
    },
};
