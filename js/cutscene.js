window.WB = window.WB || {};

// ─── Cutscene System ─────────────────────────────────────────
// Camera zoom/pan + voice narration + typewriter dialogue.
// Hooks into pre-battle intros and post-battle victories.
// Can also play arbitrary scripted cutscenes standalone.
//
// SEE: CUTSCENE-API.md for full documentation & examples.
WB.Cutscene = {
    get enabled() { return WB.Config.CUTSCENE_ENABLED; },
    set enabled(v) { WB.Config.CUTSCENE_ENABLED = v; },
    isPlaying: false,
    _type: null,          // 'pre' | 'post' | 'custom'
    _script: [],
    _stepIndex: 0,
    _stepTimer: 0,
    _parallelSteps: [],
    _balls: null,         // Reference to game balls during cutscene
    _winner: null,

    // ── Camera ───────────────────────────────────────────────
    _camera: {
        x: 0, y: 0, zoom: 1.0, rotation: 0,
        targetX: 0, targetY: 0, targetZoom: 1.0, targetRotation: 0,
        easeSpeed: 0.04,
        // Cinematic pan state
        panActive: false,
        panStartX: 0, panStartY: 0,
        panEndX: 0, panEndY: 0,
        panProgress: 0, panSpeed: 0,
        // Dolly zoom state
        dollyActive: false,
        dollyStartZoom: 1.0, dollyEndZoom: 1.0,
        dollyProgress: 0, dollySpeed: 0,
    },

    // ── Dialogue display ─────────────────────────────────────
    _dialogue: {
        fullText: '',
        revealedChars: 0,
        revealRate: 1.5,
        accum: 0,
        isActive: false,
        holdTimer: 0,
        boxAlpha: 0,
        speaker: 'NARRATOR',
    },

    // ── Letterbox (cinematic black bars) ─────────────────────
    _letterbox: {
        active: false,
        current: 0,   // current bar height (px)
        target: 0,    // target bar height
        speed: 0.06,
    },

    // ── Title overlay ────────────────────────────────────────
    _title: {
        text: '',
        subtext: '',
        alpha: 0,
        targetAlpha: 0,
        timer: 0,
        duration: 0,
        color: '#FFF',
    },

    // ── Speech (Web Speech API) ──────────────────────────────
    _speech: {
        synth: null,
        voices: {},       // Named voice presets: { narrator: Voice, ... }
        voiceList: [],    // All available browser voices
        currentVoice: null,
        defaultRate: 1.1,
        defaultPitch: 0.8,
        isSpeaking: false,
        _fallbackTimer: 0,
    },

    // ── Voice presets (name → { rate, pitch, volume, voiceSearch }) ──
    // voiceSearch: array of substrings to match against browser voice names
    _voicePresets: {
        narrator:   { rate: 1.1, pitch: 0.8,  volume: 0.8, voiceSearch: ['Google UK English Male', 'Daniel', 'Alex', 'Microsoft David'] },
        epic:       { rate: 0.85, pitch: 0.5, volume: 0.9, voiceSearch: ['Google UK English Male', 'Daniel', 'Alex'] },
        hype:       { rate: 1.4, pitch: 1.2,  volume: 0.9, voiceSearch: ['Google US English', 'Samantha', 'Karen'] },
        villain:    { rate: 0.9, pitch: 0.3,  volume: 0.85, voiceSearch: ['Google UK English Male', 'Daniel', 'Microsoft David'] },
        whisper:    { rate: 0.8, pitch: 0.6,  volume: 0.4, voiceSearch: ['Google UK English Female', 'Samantha', 'Fiona'] },
        robot:      { rate: 1.3, pitch: 0.1,  volume: 0.7, voiceSearch: ['Google US English', 'Alex'] },
        excited:    { rate: 1.6, pitch: 1.5,  volume: 1.0, voiceSearch: ['Google US English', 'Samantha', 'Karen'] },
        dramatic:   { rate: 0.7, pitch: 0.4,  volume: 0.9, voiceSearch: ['Google UK English Male', 'Daniel'] },
        chipmunk:   { rate: 1.8, pitch: 2.0,  volume: 0.8, voiceSearch: ['Google US English', 'Samantha'] },
        god:        { rate: 0.6, pitch: 0.2,  volume: 1.0, voiceSearch: ['Google UK English Male', 'Daniel', 'Alex'] },
    },

    // ── Camera presets (shorthand names for common camera moves) ──
    _cameraPresets: {
        // Extreme close-ups
        'extreme-closeup':  { zoom: 5.0, ease: 0.08 },
        'closeup':          { zoom: 3.0, ease: 0.06 },
        'medium':           { zoom: 2.0, ease: 0.05 },
        'wide':             { zoom: 1.0, ease: 0.04 },
        'ultra-wide':       { zoom: 0.7, ease: 0.03 },

        // Dramatic moves
        'slam-zoom':        { zoom: 4.0, ease: 0.15 },    // Very fast zoom in
        'slow-push':        { zoom: 2.5, ease: 0.015 },   // Slow creeping zoom
        'pull-back':        { zoom: 0.8, ease: 0.03 },    // Slow zoom out past normal
        'snap-to':          { zoom: 3.0, ease: 1.0 },     // Instant cut (ease=1 = immediate)

        // Dutch angles (rotation)
        'dutch-left':       { rotation: -0.15, ease: 0.05 },
        'dutch-right':      { rotation: 0.15, ease: 0.05 },
        'level':            { rotation: 0, ease: 0.05 },
    },

    // Monkey-patch originals
    _origApplyShake: null,
    _origClearShake: null,

    // ═══════════════════════════════════════════════════════════
    //  INIT
    // ═══════════════════════════════════════════════════════════
    init() {
        this._initSpeech();
    },

    _initSpeech() {
        const s = this._speech;
        s.synth = window.speechSynthesis || null;
        if (!s.synth) return;

        const loadVoices = () => {
            const voices = s.synth.getVoices();
            if (!voices.length) return;
            s.voiceList = voices;

            // Build voice presets by searching for matching browser voices
            for (const [presetName, preset] of Object.entries(this._voicePresets)) {
                for (const search of preset.voiceSearch) {
                    const v = voices.find(v => v.name.includes(search));
                    if (v) { s.voices[presetName] = v; break; }
                }
                // Fallback: any English voice
                if (!s.voices[presetName]) {
                    const eng = voices.find(v => v.lang.startsWith('en'));
                    if (eng) s.voices[presetName] = eng;
                }
            }
            // Default current voice = narrator
            s.currentVoice = s.voices.narrator || s.voiceList[0] || null;
        };
        loadVoices();
        if (s.synth.onvoiceschanged !== undefined) {
            s.synth.onvoiceschanged = loadVoices;
        }
    },

    // ═══════════════════════════════════════════════════════════
    //  PUBLIC API
    // ═══════════════════════════════════════════════════════════

    /**
     * List all available browser TTS voices. Call from console:
     *   WB.Cutscene.listVoices()
     */
    listVoices() {
        const s = this._speech;
        if (!s.synth) { console.log('Speech synthesis not available'); return; }
        const voices = s.synth.getVoices();
        console.table(voices.map((v, i) => ({
            index: i, name: v.name, lang: v.lang, local: v.localService
        })));
        console.log('\n── Voice Presets ──');
        for (const [name, voice] of Object.entries(s.voices)) {
            console.log(`  ${name}: ${voice.name} (${voice.lang})`);
        }
        return voices;
    },

    /**
     * Preview a voice preset. Call from console:
     *   WB.Cutscene.previewVoice('villain', 'I will destroy you.')
     */
    previewVoice(presetName, text) {
        text = text || 'The quick brown fox jumped over the lazy dog.';
        const preset = this._voicePresets[presetName];
        if (!preset) {
            console.log('Available presets:', Object.keys(this._voicePresets).join(', '));
            return;
        }
        this._speak(text, {
            voice: presetName,
            rate: preset.rate,
            pitch: preset.pitch,
            volume: preset.volume,
        });
        console.log(`Playing "${presetName}" preset: rate=${preset.rate}, pitch=${preset.pitch}`);
    },

    /**
     * List all camera presets. Call from console:
     *   WB.Cutscene.listCameraPresets()
     */
    listCameraPresets() {
        console.table(this._cameraPresets);
        return Object.keys(this._cameraPresets);
    },

    startPreBattle(ball1, ball2) {
        if (WB.SimUI && WB.SimUI.isReplaying) return false;
        this._balls = WB.Game.balls;
        this._type = 'pre';
        const script = this._buildPreBattleScript(ball1, ball2);
        this._play(script);
        return true;
    },

    startPostBattle(winner, isDraw, balls) {
        if (WB.SimUI && WB.SimUI.isReplaying) return false;
        this._balls = balls;
        this._winner = winner;
        this._type = 'post';
        const script = this._buildPostBattleScript(winner, isDraw);
        this._play(script);
        return true;
    },

    /**
     * Play any cutscene script. The primary public API.
     *   WB.Cutscene.playCutscene(script, onComplete)
     *
     * @param {Array} script - Array of step objects (see CUTSCENE-API.md)
     * @param {Function} onComplete - Optional callback when cutscene finishes
     */
    playCutscene(script, onComplete) {
        this._balls = WB.Game.balls;
        this._winner = WB.Game.winner;
        this._type = 'custom';
        this._onComplete = onComplete || null;
        this._play(script);
    },

    skip() {
        this._cancelSpeech();
        this._dialogue.isActive = false;
        this._dialogue.boxAlpha = 0;

        // Reset camera instantly
        const w = WB.GL.width, h = WB.GL.height;
        this._camera.x = this._camera.targetX = w / 2;
        this._camera.y = this._camera.targetY = h / 2;
        this._camera.zoom = this._camera.targetZoom = 1.0;
        this._camera.rotation = this._camera.targetRotation = 0;
        this._camera.panActive = false;
        this._camera.dollyActive = false;

        // Reset letterbox & title
        this._letterbox.active = false;
        this._letterbox.current = 0;
        this._title.targetAlpha = 0;
        this._title.alpha = 0;

        this._unhookShake();
        this.isPlaying = false;

        if (this._type === 'pre') {
            WB.Game.state = 'COUNTDOWN';
        } else if (this._type === 'post') {
            WB.Game.state = 'RESULT';
            WB.Game._resultTimer = 180;
        } else {
            if (this._onComplete) this._onComplete();
            WB.Game.state = 'MENU';
        }
    },

    // ═══════════════════════════════════════════════════════════
    //  INTERNAL — PLAYBACK ENGINE
    // ═══════════════════════════════════════════════════════════

    _onComplete: null,

    _play(script) {
        this._script = script;
        this._stepIndex = 0;
        this._stepTimer = 0;
        this._parallelSteps = [];
        this.isPlaying = true;

        // Reset camera to center
        const w = WB.GL.width, h = WB.GL.height;
        this._camera.x = this._camera.targetX = w / 2;
        this._camera.y = this._camera.targetY = h / 2;
        this._camera.zoom = this._camera.targetZoom = 1.0;
        this._camera.rotation = this._camera.targetRotation = 0;
        this._camera.easeSpeed = 0.04;
        this._camera.panActive = false;
        this._camera.dollyActive = false;

        this._dialogue.isActive = false;
        this._dialogue.boxAlpha = 0;

        this._letterbox.current = 0;
        this._letterbox.active = false;
        this._title.alpha = 0;
        this._title.targetAlpha = 0;

        this._hookShake();
    },

    _finish() {
        this._cancelSpeech();
        this._dialogue.isActive = false;

        // Smoothly reset camera
        const w = WB.GL.width, h = WB.GL.height;
        this._camera.targetX = w / 2;
        this._camera.targetY = h / 2;
        this._camera.targetZoom = 1.0;
        this._camera.targetRotation = 0;
        this._camera.easeSpeed = 0.08;
        this._camera.panActive = false;
        this._camera.dollyActive = false;

        this._letterbox.active = false;
        this._title.targetAlpha = 0;

        this._unhookShake();
        this.isPlaying = false;

        if (this._type === 'pre') {
            WB.Game.state = 'COUNTDOWN';
        } else if (this._type === 'post') {
            WB.Game.state = 'RESULT';
            WB.Game._resultTimer = 180;
        } else {
            if (this._onComplete) this._onComplete();
        }
    },

    // ═══════════════════════════════════════════════════════════
    //  UPDATE (called every frame from game loop)
    // ═══════════════════════════════════════════════════════════

    update() {
        if (!this.isPlaying) return;

        // Camera lerp
        const cam = this._camera;

        // Cinematic pan (linear interpolation along a path)
        if (cam.panActive) {
            cam.panProgress = Math.min(1, cam.panProgress + cam.panSpeed);
            // Smooth easing (ease-in-out)
            const t = cam.panProgress < 0.5
                ? 2 * cam.panProgress * cam.panProgress
                : 1 - Math.pow(-2 * cam.panProgress + 2, 2) / 2;
            cam.targetX = cam.panStartX + (cam.panEndX - cam.panStartX) * t;
            cam.targetY = cam.panStartY + (cam.panEndY - cam.panStartY) * t;
            if (cam.panProgress >= 1) cam.panActive = false;
        }

        // Dolly zoom (zoom interpolation)
        if (cam.dollyActive) {
            cam.dollyProgress = Math.min(1, cam.dollyProgress + cam.dollySpeed);
            const t = cam.dollyProgress < 0.5
                ? 2 * cam.dollyProgress * cam.dollyProgress
                : 1 - Math.pow(-2 * cam.dollyProgress + 2, 2) / 2;
            cam.targetZoom = cam.dollyStartZoom + (cam.dollyEndZoom - cam.dollyStartZoom) * t;
            if (cam.dollyProgress >= 1) cam.dollyActive = false;
        }

        cam.x += (cam.targetX - cam.x) * cam.easeSpeed;
        cam.y += (cam.targetY - cam.y) * cam.easeSpeed;
        cam.zoom += (cam.targetZoom - cam.zoom) * cam.easeSpeed;
        cam.rotation += (cam.targetRotation - cam.rotation) * cam.easeSpeed;

        // Letterbox animation
        const lb = this._letterbox;
        if (lb.active) {
            lb.current += (lb.target - lb.current) * lb.speed;
        } else {
            lb.current += (0 - lb.current) * lb.speed;
        }

        // Title fade
        const tt = this._title;
        if (tt.duration > 0) {
            tt.timer++;
            tt.alpha += (tt.targetAlpha - tt.alpha) * 0.08;
            if (tt.timer > tt.duration) {
                tt.targetAlpha = 0;
                tt.alpha += (0 - tt.alpha) * 0.06;
                if (tt.alpha < 0.01) { tt.alpha = 0; tt.duration = 0; }
            }
        } else {
            tt.alpha += (tt.targetAlpha - tt.alpha) * 0.06;
        }

        // Dialogue typewriter
        this._updateDialogue();

        // Speech fallback timeout
        if (this._speech.isSpeaking) {
            this._speech._fallbackTimer--;
            if (this._speech._fallbackTimer <= 0) {
                this._speech.isSpeaking = false;
            }
        }

        // Script advancement
        if (this._stepIndex >= this._script.length) {
            this._finish();
            return;
        }

        const step = this._script[this._stepIndex];
        this._stepTimer++;

        let complete = this._processStep(step, this._stepTimer);

        if (complete) {
            this._stepIndex++;
            this._stepTimer = 0;
            this._parallelSteps = [];
        }

        // Render
        WB.GLEffects.update();
        if (WB.Game.particles) WB.Game.particles.update();
        WB.Renderer.drawFrame(WB.Game);
        WB.GLBatch.flush();

        // Reset projection to screen-space for overlay
        if (this._origClearShake) {
            this._origClearShake.call(WB.GLEffects);
        }

        this._drawLetterbox();
        this._drawDialogue();
        this._drawTitle();
        this._drawSkipHint();
    },

    _processStep(step, timer) {
        switch (step.type) {
            case 'camera':
                if (timer === 1) this._execCamera(step);
                return timer >= (step.duration || 60);

            case 'cut':
                // Instant camera cut — no easing, immediate
                if (timer === 1) this._execCut(step);
                return true;

            case 'pan':
                // Cinematic pan from A to B
                if (timer === 1) this._execPan(step);
                return timer >= (step.duration || 120);

            case 'dolly':
                // Dolly zoom (zoom change over time, separate from position)
                if (timer === 1) this._execDolly(step);
                return timer >= (step.duration || 90);

            case 'orbit':
                // Orbit/sweep around a target point
                if (timer === 1) this._execOrbit(step);
                return timer >= (step.duration || 120);

            case 'narrate':
                if (timer === 1) {
                    this._showDialogue(step.text, step);
                    this._speak(step.text, step);
                }
                return this._dialogue.revealedChars >= this._dialogue.fullText.length &&
                       this._dialogue.holdTimer <= 0 &&
                       !this._speech.isSpeaking;

            case 'dialogue':
                if (timer === 1) this._showDialogue(step.text, step);
                return this._dialogue.revealedChars >= this._dialogue.fullText.length &&
                       this._dialogue.holdTimer <= 0;

            case 'speak':
                if (timer === 1) this._speak(step.text, step);
                return !this._speech.isSpeaking;

            case 'wait':
                return timer >= (step.frames || 60);

            case 'effect':
                if (timer === 1) this._execEffect(step);
                return true;

            case 'letterbox':
                if (timer === 1) this._execLetterbox(step);
                return true; // instant — animation happens over time

            case 'title':
                if (timer === 1) this._execTitle(step);
                return timer >= (step.duration || 120);

            case 'parallel':
                if (timer === 1) {
                    this._parallelSteps = step.steps.map(s => ({
                        ...s, _timer: 0, _done: false
                    }));
                }
                let allDone = true;
                for (const ps of this._parallelSteps) {
                    if (ps._done) continue;
                    ps._timer++;
                    ps._done = this._processStep(ps, ps._timer);
                    if (!ps._done) allDone = false;
                }
                return allDone;

            case 'callback':
                if (timer === 1 && step.fn) {
                    step.fn({ balls: this._balls, winner: this._winner, cutscene: this });
                }
                return true;

            default:
                return true;
        }
    },

    // ═══════════════════════════════════════════════════════════
    //  STEP EXECUTORS
    // ═══════════════════════════════════════════════════════════

    _execCamera(step) {
        // Support preset names: { type: 'camera', target: 'ball1', preset: 'slam-zoom' }
        let zoom = step.zoom;
        let ease = step.ease;
        let rotation = step.rotation;
        if (step.preset && this._cameraPresets[step.preset]) {
            const p = this._cameraPresets[step.preset];
            if (zoom === undefined) zoom = p.zoom;
            if (ease === undefined) ease = p.ease;
            if (rotation === undefined) rotation = p.rotation;
        }

        const pos = this._resolveTarget(step.target);
        this._camera.targetX = pos.x;
        this._camera.targetY = pos.y;
        if (zoom !== undefined) this._camera.targetZoom = zoom;
        this._camera.easeSpeed = ease || 0.04;
        if (rotation !== undefined) this._camera.targetRotation = rotation;
    },

    _execCut(step) {
        // Instant camera position change — no interpolation
        const pos = this._resolveTarget(step.target);
        this._camera.x = this._camera.targetX = pos.x;
        this._camera.y = this._camera.targetY = pos.y;
        if (step.zoom !== undefined) {
            this._camera.zoom = this._camera.targetZoom = step.zoom;
        }
        if (step.rotation !== undefined) {
            this._camera.rotation = this._camera.targetRotation = step.rotation;
        }
    },

    _execPan(step) {
        // Cinematic pan from current position (or 'from') to 'target'
        const cam = this._camera;
        if (step.from) {
            const fromPos = this._resolveTarget(step.from);
            cam.x = cam.targetX = fromPos.x;
            cam.y = cam.targetY = fromPos.y;
            cam.panStartX = fromPos.x;
            cam.panStartY = fromPos.y;
        } else {
            cam.panStartX = cam.x;
            cam.panStartY = cam.y;
        }
        const toPos = this._resolveTarget(step.target);
        cam.panEndX = toPos.x;
        cam.panEndY = toPos.y;
        cam.panProgress = 0;
        cam.panSpeed = 1 / (step.duration || 120);
        cam.panActive = true;

        if (step.zoom !== undefined) this._camera.targetZoom = step.zoom;
        if (step.ease !== undefined) this._camera.easeSpeed = step.ease;
    },

    _execDolly(step) {
        // Dolly zoom — change zoom level smoothly over duration
        const cam = this._camera;
        cam.dollyStartZoom = step.fromZoom !== undefined ? step.fromZoom : cam.zoom;
        cam.dollyEndZoom = step.zoom || 1.0;
        cam.dollyProgress = 0;
        cam.dollySpeed = 1 / (step.duration || 90);
        cam.dollyActive = true;

        // Optionally set position target too
        if (step.target) {
            const pos = this._resolveTarget(step.target);
            cam.targetX = pos.x;
            cam.targetY = pos.y;
            cam.easeSpeed = step.ease || 0.04;
        }
    },

    _execOrbit(step) {
        // Not a true continuous orbit (would need per-frame update).
        // Instead, set up a cinematic pan along an arc by computing start/end.
        const center = this._resolveTarget(step.target || 'arena');
        const radius = step.radius || 50;
        const startAngle = step.startAngle || 0;
        const endAngle = step.endAngle || Math.PI;
        const duration = step.duration || 120;

        // We approximate the orbit as a pan between two arc positions
        const cam = this._camera;
        cam.panStartX = center.x + Math.cos(startAngle) * radius;
        cam.panStartY = center.y + Math.sin(startAngle) * radius;
        cam.panEndX = center.x + Math.cos(endAngle) * radius;
        cam.panEndY = center.y + Math.sin(endAngle) * radius;
        cam.x = cam.targetX = cam.panStartX;
        cam.y = cam.targetY = cam.panStartY;
        cam.panProgress = 0;
        cam.panSpeed = 1 / duration;
        cam.panActive = true;

        if (step.zoom !== undefined) cam.targetZoom = step.zoom;
        if (step.ease !== undefined) cam.easeSpeed = step.ease;
    },

    _execEffect(step) {
        switch (step.name) {
            case 'shake':
                WB.Renderer.triggerShake(step.intensity || 5);
                break;
            case 'flash':
                if (WB.GLEffects) WB.GLEffects.triggerSuperFlash(step.color || '#FFD700');
                break;
            case 'shockwave':
                if (WB.GLEffects) {
                    const p = this._resolveTarget(step.target || 'arena');
                    WB.GLEffects.triggerShockwave(p.x, p.y, step.intensity || 0.2);
                }
                break;
            case 'chromatic':
                if (WB.GLEffects) WB.GLEffects.triggerChromatic(step.intensity || 0.2);
                break;
            case 'particles':
                if (WB.Game.particles) {
                    const p = this._resolveTarget(step.target || 'arena');
                    const color = step.color || '#FFD700';
                    WB.Game.particles.explode(p.x, p.y, step.count || 12, color);
                }
                break;
        }
    },

    _execLetterbox(step) {
        this._letterbox.active = step.active !== false; // default true
        this._letterbox.target = step.height || 50;
        if (step.speed) this._letterbox.speed = step.speed;
    },

    _execTitle(step) {
        this._title.text = step.text || '';
        this._title.subtext = step.subtext || '';
        this._title.targetAlpha = 1.0;
        this._title.alpha = 0;
        this._title.timer = 0;
        this._title.duration = step.duration || 120;
        this._title.color = step.color || '#FFF';
    },

    _resolveTarget(target) {
        const a = WB.Config.ARENA;
        if (target === 'arena' || target === 'center') {
            return { x: a.x + a.width / 2, y: a.y + a.height / 2 };
        }
        if (target === 'ball1' && this._balls && this._balls[0]) {
            return { x: this._balls[0].x, y: this._balls[0].y };
        }
        if (target === 'ball2' && this._balls && this._balls[1]) {
            return { x: this._balls[1].x, y: this._balls[1].y };
        }
        if (target === 'winner' && this._winner) {
            return { x: this._winner.x, y: this._winner.y };
        }
        if (target === 'top') {
            return { x: a.x + a.width / 2, y: a.y + a.height * 0.2 };
        }
        if (target === 'bottom') {
            return { x: a.x + a.width / 2, y: a.y + a.height * 0.8 };
        }
        if (target === 'left') {
            return { x: a.x + a.width * 0.2, y: a.y + a.height / 2 };
        }
        if (target === 'right') {
            return { x: a.x + a.width * 0.8, y: a.y + a.height / 2 };
        }
        if (Array.isArray(target)) {
            return { x: target[0], y: target[1] };
        }
        // Fallback: arena center
        return { x: a.x + a.width / 2, y: a.y + a.height / 2 };
    },

    // ═══════════════════════════════════════════════════════════
    //  CAMERA — PROJECTION MATRIX MONKEY-PATCH
    // ═══════════════════════════════════════════════════════════

    _hookShake() {
        const self = this;
        this._origApplyShake = WB.GLEffects.applyShake;
        this._origClearShake = WB.GLEffects.clearShake;

        WB.GLEffects.applyShake = function(sx, sy) {
            const cam = self._camera;
            const w = WB.GL.width;
            const h = WB.GL.height;
            const z = cam.zoom;
            const rot = cam.rotation;
            const cosR = Math.cos(rot);
            const sinR = Math.sin(rot);
            const proj = WB.GL.projMatrix;
            // Compose: scale * rotate * translate + shake
            proj[0] = (2 * z * cosR) / w;
            proj[1] = (2 * z * sinR) / h;
            proj[3] = -(2 * z * sinR) / w;
            proj[4] = -(2 * z * cosR) / h;
            proj[6] = -(2 * z * (cam.x * cosR - cam.y * sinR)) / w + (2 * sx * z) / w;
            proj[7] = -(2 * z * (cam.x * sinR + cam.y * cosR)) / h + (2 * sy * z) / h;
            // Adjust translation for NDC offset
            proj[6] += 0; // shake already composed above
            proj[7] += 0;
            proj[2] = 0; proj[5] = 0; proj[8] = 1;
        };

        WB.GLEffects.clearShake = function() {
            const cam = self._camera;
            const w = WB.GL.width;
            const h = WB.GL.height;
            const z = cam.zoom;
            const rot = cam.rotation;
            const cosR = Math.cos(rot);
            const sinR = Math.sin(rot);
            const proj = WB.GL.projMatrix;
            proj[0] = (2 * z * cosR) / w;
            proj[1] = (2 * z * sinR) / h;
            proj[3] = -(2 * z * sinR) / w;
            proj[4] = -(2 * z * cosR) / h;
            proj[6] = -(2 * z * (cam.x * cosR - cam.y * sinR)) / w;
            proj[7] = -(2 * z * (cam.x * sinR + cam.y * cosR)) / h;
            proj[2] = 0; proj[5] = 0; proj[8] = 1;
        };
    },

    _unhookShake() {
        if (this._origApplyShake) {
            WB.GLEffects.applyShake = this._origApplyShake;
            WB.GLEffects.clearShake = this._origClearShake;
            WB.GLEffects.clearShake(); // Restore normal projection
            this._origApplyShake = null;
            this._origClearShake = null;
        }
    },

    // ═══════════════════════════════════════════════════════════
    //  SPEECH — WEB SPEECH API
    // ═══════════════════════════════════════════════════════════

    _speak(text, opts) {
        const s = this._speech;
        if (!s.synth) {
            // Fallback: estimate speech duration from text length
            s.isSpeaking = true;
            s._fallbackTimer = Math.max(60, text.length * 3); // ~3 frames per char
            return;
        }
        this._cancelSpeech();

        const utterance = new SpeechSynthesisUtterance(text);

        // Voice resolution: step.voice can be a preset name or a browser voice name
        let voice = s.currentVoice;
        if (opts && opts.voice) {
            if (s.voices[opts.voice]) {
                // It's a preset name
                voice = s.voices[opts.voice];
            } else {
                // Try matching by browser voice name
                const match = s.voiceList.find(v => v.name.includes(opts.voice));
                if (match) voice = match;
            }
        }
        if (voice) utterance.voice = voice;

        // Rate/pitch: use step values, or voice preset defaults, or global defaults
        const preset = (opts && opts.voice && this._voicePresets[opts.voice]) || null;
        utterance.rate = (opts && opts.rate) || (preset && preset.rate) || s.defaultRate;
        utterance.pitch = (opts && opts.pitch) || (preset && preset.pitch) || s.defaultPitch;
        utterance.volume = (opts && opts.volume) || (preset && preset.volume) || 0.8;

        utterance.onend = () => { s.isSpeaking = false; };
        utterance.onerror = () => { s.isSpeaking = false; };

        s.isSpeaking = true;
        // Fallback timeout in case speech stalls (e.g. tab hidden)
        s._fallbackTimer = Math.max(120, text.length * 4);
        s.synth.speak(utterance);
    },

    _cancelSpeech() {
        const s = this._speech;
        if (s.synth) s.synth.cancel();
        s.isSpeaking = false;
    },

    // ═══════════════════════════════════════════════════════════
    //  DIALOGUE — TYPEWRITER TEXT BOX
    // ═══════════════════════════════════════════════════════════

    _showDialogue(text, opts) {
        const d = this._dialogue;
        d.fullText = text;
        d.revealedChars = 0;
        d.accum = 0;
        d.revealRate = (opts && opts.speed) || 1.5;
        d.isActive = true;
        d.holdTimer = (opts && opts.hold) || 90;
        d.boxAlpha = 0;
        d.speaker = (opts && opts.speaker) || 'NARRATOR';
    },

    _updateDialogue() {
        const d = this._dialogue;
        if (!d.isActive) return;

        if (d.boxAlpha < 1) d.boxAlpha = Math.min(1, d.boxAlpha + 0.08);

        if (d.revealedChars < d.fullText.length) {
            d.accum += d.revealRate;
            while (d.accum >= 1 && d.revealedChars < d.fullText.length) {
                d.revealedChars++;
                d.accum -= 1;
            }
        } else {
            d.holdTimer--;
            if (d.holdTimer <= -30) {
                // Fade out
                d.boxAlpha = Math.max(0, d.boxAlpha - 0.06);
                if (d.boxAlpha <= 0) d.isActive = false;
            }
        }
    },

    _drawDialogue() {
        const d = this._dialogue;
        if (!d.isActive || d.boxAlpha <= 0) return;

        const B = WB.GLBatch;
        const T = WB.GLText;
        const cw = WB.Config.CANVAS_WIDTH;
        const ch = WB.Config.CANVAS_HEIGHT;

        const boxH = 100;
        const boxY = ch - boxH - 10;
        const boxX = 10;
        const boxW = cw - 20;

        // Dark background
        B.setAlpha(d.boxAlpha * 0.85);
        B.fillRect(boxX, boxY, boxW, boxH, '#000');
        B.restoreAlpha();

        // Gold border
        B.setAlpha(d.boxAlpha * 0.6);
        B.strokeRect(boxX, boxY, boxW, boxH, '#FFD700', 2);
        B.restoreAlpha();

        B.flush();

        // Speaker label (12px — valid atlas size)
        if (d.speaker) {
            B.setAlpha(d.boxAlpha);
            T.drawText(d.speaker, boxX + 10, boxY + 10,
                'bold 12px "Courier New", monospace', '#FFD700', 'left', 'top');
            B.restoreAlpha();
        }

        // Typewriter text (16px — valid atlas size)
        const visibleText = d.fullText.substring(0, d.revealedChars);
        const font = 'bold 16px "Courier New", monospace';
        const maxWidth = boxW - 24;
        const lines = this._wrapText(visibleText, font, maxWidth);

        B.setAlpha(d.boxAlpha);
        for (let i = 0; i < lines.length && i < 3; i++) {
            T.drawText(lines[i], boxX + 12, boxY + 30 + i * 22,
                font, '#FFF', 'left', 'top');
        }

        // Blinking cursor
        if (d.revealedChars < d.fullText.length) {
            const lastLine = lines[lines.length - 1] || '';
            const lastLineW = T.measureText(lastLine, font);
            const cursorX = boxX + 12 + lastLineW;
            const cursorY = boxY + 30 + (lines.length - 1) * 22;
            if (Math.floor(Date.now() / 300) % 2 === 0) {
                T.drawText('_', cursorX, cursorY, font, '#FFD700', 'left', 'top');
            }
        }
        B.restoreAlpha();
    },

    _drawLetterbox() {
        const lb = this._letterbox;
        if (lb.current < 1) return;

        const B = WB.GLBatch;
        const cw = WB.Config.CANVAS_WIDTH;
        const ch = WB.Config.CANVAS_HEIGHT;
        const h = Math.round(lb.current);

        B.fillRect(0, 0, cw, h, '#000');          // Top bar
        B.fillRect(0, ch - h, cw, h, '#000');      // Bottom bar
    },

    _drawTitle() {
        const tt = this._title;
        if (tt.alpha < 0.01) return;

        const B = WB.GLBatch;
        const T = WB.GLText;
        const cw = WB.Config.CANVAS_WIDTH;
        const ch = WB.Config.CANVAS_HEIGHT;

        B.setAlpha(tt.alpha);

        // Main title — 32px (valid atlas size)
        if (tt.text) {
            T.drawText(tt.text, cw / 2, ch / 2 - 20,
                'bold 32px "Courier New", monospace', tt.color, 'center', 'middle');
        }
        // Subtext — 16px (valid atlas size)
        if (tt.subtext) {
            T.drawText(tt.subtext, cw / 2, ch / 2 + 20,
                'bold 16px "Courier New", monospace', tt.color, 'center', 'middle');
        }

        B.restoreAlpha();
    },

    _drawSkipHint() {
        const T = WB.GLText;
        const cw = WB.Config.CANVAS_WIDTH;
        T.drawText('TAP TO SKIP', cw - 12, 14,
            'bold 11px "Courier New", monospace', 'rgba(255,255,255,0.35)', 'right', 'top');
    },

    _wrapText(text, font, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';

        for (const word of words) {
            const testLine = currentLine ? currentLine + ' ' + word : word;
            const testWidth = WB.GLText.measureText(testLine, font);
            if (testWidth > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) lines.push(currentLine);
        return lines;
    },

    // ═══════════════════════════════════════════════════════════
    //  SCRIPT BUILDERS — TONGUE-IN-CHEEK NARRATION
    // ═══════════════════════════════════════════════════════════

    _pickRandom(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    },

    _buildPreBattleScript(ball1, ball2) {
        const name1 = WB.Config.WEAPON_NAMES[ball1.weaponType] || ball1.weaponType;
        const name2 = WB.Config.WEAPON_NAMES[ball2.weaponType] || ball2.weaponType;
        const opening = this._pickRandom(this._openingPhrases);
        const intro1 = this._pickRandom(this._introPhrases[ball1.weaponType] || this._introPhrases._default);
        const intro2 = this._pickRandom(this._introPhrases[ball2.weaponType] || this._introPhrases._default);

        return [
            // Cinematic bars slide in
            { type: 'letterbox', height: 50 },

            // Opening wide shot with dramatic voice
            { type: 'parallel', steps: [
                { type: 'camera', target: 'arena', zoom: 1.0, ease: 0.05, duration: 120 },
                { type: 'narrate', text: opening, voice: 'narrator', hold: 20, speed: 1.2 },
            ]},

            // Slam zoom to ball 1
            { type: 'parallel', steps: [
                { type: 'camera', target: 'ball1', preset: 'slam-zoom', duration: 60 },
                { type: 'effect', name: 'shake', intensity: 3 },
            ]},
            { type: 'parallel', steps: [
                { type: 'camera', target: 'ball1', zoom: 2.8, ease: 0.03, duration: 120 },
                { type: 'narrate', text: 'On the left: ' + name1 + '. ' + intro1,
                  voice: 'narrator', hold: 15, speed: 1.5 },
            ]},

            // Slam zoom to ball 2
            { type: 'parallel', steps: [
                { type: 'camera', target: 'ball2', preset: 'slam-zoom', duration: 60 },
                { type: 'effect', name: 'shake', intensity: 3 },
            ]},
            { type: 'parallel', steps: [
                { type: 'camera', target: 'ball2', zoom: 2.8, ease: 0.03, duration: 120 },
                { type: 'narrate', text: 'On the right: ' + name2 + '. ' + intro2,
                  voice: 'narrator', hold: 15, speed: 1.5 },
            ]},

            // Pull back to arena, drop letterbox
            { type: 'letterbox', active: false },
            { type: 'camera', target: 'arena', zoom: 1.0, ease: 0.04, duration: 40 },
            { type: 'wait', frames: 10 },
        ];
    },

    _buildPostBattleScript(winner, isDraw) {
        const name = WB.Config.WEAPON_NAMES[winner.weaponType] || winner.weaponType;
        const hpPercent = winner.hp / winner.maxHp;

        let phrases;
        if (isDraw) {
            phrases = this._victoryPhrases.draw;
        } else if (hpPercent > 0.8) {
            phrases = this._victoryPhrases.dominant;
        } else if (hpPercent < 0.3) {
            phrases = this._victoryPhrases.close;
        } else {
            phrases = this._victoryPhrases.normal;
        }

        const quip = this._pickRandom(phrases);
        const winText = isDraw ? "It's a draw!" : name + ' wins!';

        return [
            // Letterbox in
            { type: 'letterbox', height: 40 },

            // Dramatic slam-zoom to winner
            { type: 'parallel', steps: [
                { type: 'camera', target: 'winner', preset: 'slam-zoom', duration: 30 },
                { type: 'effect', name: 'shake', intensity: 8 },
                { type: 'effect', name: 'chromatic', intensity: 0.15 },
            ]},

            // Hold on winner with epic voice
            { type: 'parallel', steps: [
                { type: 'camera', target: 'winner', zoom: 3.5, ease: 0.02, duration: 120 },
                { type: 'narrate', text: winText + ' ' + quip,
                  voice: 'epic', hold: 45, speed: 1.3 },
            ]},

            // Pull back, drop bars
            { type: 'letterbox', active: false },
            { type: 'camera', target: 'arena', zoom: 1.0, ease: 0.03, duration: 40 },
            { type: 'wait', frames: 20 },
        ];
    },

    // ═══════════════════════════════════════════════════════════
    //  NARRATION DATA — RADICALLY TONGUE-IN-CHEEK
    // ═══════════════════════════════════════════════════════════

    _openingPhrases: [
        "Ladies and gentlemen, welcome to the arena of dubious physics.",
        "Two enter. One wins. The other gets a participation trophy.",
        "Tonight's forecast: violence, with a chance of particles.",
        "Sponsored by gravity. And poor life choices.",
        "The International Ball Fighting Commission presents...",
        "In a world of bouncing circles... two will collide.",
        "Welcome back to the only sport where the athletes are spheres.",
        "Place your bets. Actually don't. This is deeply unregulated.",
        "The arena smells like WebGL and broken dreams.",
        "And we're live! Well, as live as requestAnimationFrame allows.",
    ],

    _introPhrases: {
        // ─── Classic weapons ───
        sword:       ["The pointy end goes in the other guy.", "Overcompensating? With a sword? Never.", "A classic. Like cholera."],
        bow:         ["Shoots first, asks questions at the funeral.", "Arrow-dynamic. Get it? I'm sorry.", "Range is just cowardice with extra steps."],
        hammer:      ["Subtlety is overrated when you have mass.", "Thor called. He wants his gimmick back.", "If it's stupid but it works, it's a hammer."],
        shuriken:    ["Weaponized fidget spinner.", "Ninjas hate this one weird trick.", "Spinning. Always spinning. Get therapy."],
        sawblade:    ["OSHA violations incarnate.", "Not technically a weapon. Technically a tool. Legally a nightmare.", "Buzzkill. Literally."],
        ghost:       ["Spooky. Translucent. Emotionally unavailable.", "Boo! Oh wait, that's its whole personality.", "Exists in a state of perpetual draft."],
        clacker:     ["Newton's Cradle of Doom.", "Clack clack clack. The sound of inevitability.", "The ball they use to test if the arena has rhythm."],
        gunclacker:  ["What if a clacker had anger issues?", "The Second Amendment, but for balls.", "Clack clack BANG. Reload. Repeat."],

        // ─── Elemental weapons ───
        fire:        ["Arsonist energy. Big arsonist energy.", "Burns things. It's not complicated.", "This one sparks joy. Also literal fire."],
        ice:         ["Cold. Like my ex. And twice as deadly.", "Let it go? Absolutely not.", "Sub-zero vibes. Sub-zero chill."],
        spark:       ["Shocking. In every sense.", "Electrifying personality. Zero friends.", "Rated E for Electrocution."],
        stone:       ["The IQ of a rock. The damage of a boulder.", "Between a rock and a hard place? You're the hard place.", "Solid strategy. Literally."],
        wind:        ["All bark, no— wait, ALL bark.", "Gusty. Like that one uncle at Thanksgiving.", "Wind: nature's way of slapping you."],
        water:       ["Hydration nation sends its regards.", "Wet and dangerous. Like a waterpark lawsuit.", "Splash damage. The worst kind of damage."],
        poison:      ["Toxic. Like that group chat.", "Slow death by committee.", "Green means go. To the hospital."],
        light:       ["Bright. Blinding. Annoyingly cheerful.", "Praise the sun! Then weaponize it.", "Flashbang theology."],
        shadow:      ["Edgy. The weapon, not the personality. Okay, both.", "Lurks in darkness. Shops at Hot Topic.", "Shadows: because sunlight is mainstream."],
        nature:      ["Mother Nature's restraining order.", "Eco-friendly violence.", "Organic, free-range brutality."],
        crystal:     ["Pretty. Fragile. Will absolutely cut you.", "A gem of a weapon. A real gem. I'm fired.", "Sparkly doom."],
        magma:       ["Floor is lava, but make it a lifestyle.", "Spicy geography.", "The Earth's anger management issues, weaponized."],
        storm:       ["Thunder and lightning, very very frightening.", "Weather forecast: localized apocalypse.", "Climate change hits different in here."],
        metal:       ["Heavy metal. The genre AND the strategy.", "Iron will. Iron fist. Iron everything.", "Rust in peace."],
        gravity:     ["What goes up must GET ABSOLUTELY DESTROYED.", "Newton's revenge.", "The ultimate pull. Literally."],

        // ─── Greek Pantheon ───
        zeus:        ["The sky daddy himself.", "Zeus, who settles every argument with lightning.", "Honestly? Just unfair."],
        poseidon:    ["Wet, angry, and holding a fork.", "Poseidon: making landlubbers cry since forever.", "Aquaman's cooler older brother."],
        hephaestus:  ["The only god who actually has a job.", "Forge marks: because regular damage wasn't petty enough.", "Built different. LITERALLY built different."],
        artemis:     ["Her arrows have better aim than your life choices.", "Homing missiles. With attitude problems.", "The 'I have trust issues' goddess."],
        apollo:      ["Sunshine and violence. The duality of man.", "SPF 3000 recommended.", "Burns so bright, burns so right."],
        ares:        ["Ares thinks anger IS a personality.", "Violence is never the answer. Unless you're Ares.", "Rage mode? In THIS economy?"],
        hermes:      ["Hermes treats the arena like a Costco parking lot.", "Fast. Reckless. Uninsured.", "Speed is his substitute for skill."],
        hades:       ["Oh great, the emo uncle showed up.", "Mr. 'It's not a phase, Dad.'", "Death and taxes, personified."],
        athena:      ["The hall monitor of Olympus.", "Athena: somehow both shield AND spear. Pick a lane.", "The 'well actually' of gods."],
        dionysus:    ["Wine, vines, and war crimes.", "Party god gone wrong. Very wrong.", "Grapes of wrath. Literal grapes."],

        // ─── Egyptian Pantheon ───
        thoth:       ["The nerd. THE nerd.", "Glyphs that get faster? That's just bureaucracy with momentum.", "Knowledge is power. Power is violence. Thoth is violence."],
        ra:          ["The original daylight savings time.", "Peaks at noon. Like your productivity.", "Hot and cold. The original mid friend."],
        sekhmet:     ["War goddess. Emphasis on the WAR.", "She doesn't have anger issues. She IS the anger issue.", "Lion-headed, lion-hearted, zero chill."],
        sobek:       ["Tick tock. That's not a clock, that's his jaw.", "Patience is a virtue. Pressure is a weapon.", "Crocodile tears? No. Crocodile VIOLENCE."],
        set:         ["Chaos incarnate. No plan. No regrets.", "Random and proud of it.", "Even HE doesn't know what happens next."],
        anubis:      ["Death's accountant.", "Hits harder when you're already dying. Relatable.", "The closer to death, the more he cares. How touching."],
        horus:       ["Falcon PUNCH. But as an entire theology.", "Death from above. On a budget.", "Gravity is just potential violence waiting to happen."],
        khnum:       ["He grows. And grows. And grows. Terrifying.", "The snowball effect, but with a ram.", "Started from the bottom, now he's LARGE."],
        wadjet:      ["Snek. SNEK.", "Venom: the gift that keeps on giving.", "Cobra Commander's origin story."],
        osiris:      ["Died once. Got better.", "Undeath is a pre-existing condition.", "Dual-wielding: because one weapon is for quitters."],

        // ─── Default fallback ───
        _default:    ["A challenger approaches!", "Brave. Foolish, but brave.", "Bold strategy, Cotton.", "This should be interesting. Or short."],
    },

    _victoryPhrases: {
        dominant: [
            "That wasn't a fight, that was a tutorial.",
            "Flawless. Absolutely disgusting.",
            "Insurance companies hate this one weird trick.",
            "Speed-ran that one.",
            "Is there a mercy rule? There should be a mercy rule.",
        ],
        close: [
            "Barely. BARELY.",
            "Winner by a single, trembling hit point.",
            "Both fighters need therapy after that one.",
            "That was uncomfortably close.",
            "Photo finish. Traumatic photo finish.",
        ],
        normal: [
            "And that, children, is why you eat your vegetables.",
            "A decisive victory for the concept of violence.",
            "The crowd goes mild!",
            "Clean fight. Well, clean-ish.",
            "Another day, another circle defeated.",
        ],
        draw: [
            "They both lost. At the same time. How poetic.",
            "Mutual destruction. How very modern.",
            "Nobody wins. Just like real life.",
            "A draw! The most unsatisfying outcome in competitive ball fighting.",
            "Congratulations to absolutely nobody.",
        ],
    },
};
