window.WB = window.WB || {};

// ─── Offline Prerender Engine ────────────────────────────────
// Steps the game loop frame-by-frame at GPU speed (not real-time),
// captures each frame via captureStream(0) + requestFrame(), and
// encodes to a downloadable video via MediaRecorder.
// Produces buttery smooth, zero-drop-frame video for TikTok.
WB.Prerender = {
    isActive: false,
    _stream: null,
    _videoTrack: null,
    _mediaRecorder: null,
    _chunks: [],
    _currentFrame: 0,
    _totalEstimate: 0,
    _phase: 'idle',       // idle | countdown | battle | result | done
    _battle: null,
    _progressEl: null,
    _cancelled: false,
    _resultFrames: 0,
    _RESULT_DURATION: 120, // 2s of result screen at 60fps
    _BATCH_SIZE: 5,        // frames per batch before yielding for progress UI
    _MAX_FRAMES: 7200,     // 2 min safety cap (same as simulator)

    // ─── Public API ──────────────────────────────────────

    start(battle) {
        if (this.isActive) return;
        if (!battle || !battle.seed) {
            console.warn('[Prerender] No battle data');
            return;
        }

        // Check browser support
        if (typeof WB.Game.canvas.captureStream !== 'function') {
            alert('Your browser does not support canvas.captureStream. Try Chrome or Firefox.');
            return;
        }

        this.isActive = true;
        this._cancelled = false;
        this._currentFrame = 0;
        this._resultFrames = 0;
        this._phase = 'countdown';
        this._battle = battle;

        // Estimate total frames: countdown + battle (with ~10% hit stop buffer) + result
        const battleFrames = battle.frames || 1800;
        this._totalEstimate = 240 + Math.ceil(battleFrames * 1.1) + this._RESULT_DURATION;

        // Pause the normal rAF game loop
        WB.Game._prerenderActive = true;

        // Set up the battle (mirrors Studio._preview)
        this._setup(battle);

        // Route audio to capture stream instead of speakers.
        // Must happen BEFORE _createStream so audio tracks can be added to the stream.
        // Since we're rAF-paced (real-time 60fps), AudioContext.currentTime
        // advances at the correct rate and audio events stay in sync.
        this._setupAudioCapture();

        // Create capture stream + MediaRecorder
        if (!this._createStream()) {
            this._cleanup();
            return;
        }

        // Show progress overlay
        this._showProgress();

        console.log('[Prerender] Starting — estimated ' + this._totalEstimate + ' frames');

        // Kick off the async render loop
        this._renderLoop();
    },

    cancel() {
        if (!this.isActive) return;
        this._cancelled = true;
        console.log('[Prerender] Cancelled by user');
    },

    // ─── Battle Setup ────────────────────────────────────

    _setup(battle) {
        // Set weapons
        WB.UI.selectedLeft = battle.weaponLeft;
        WB.UI.selectedRight = battle.weaponRight;

        // Restore physics toggles from original battle
        if (battle.toggles && WB.SimUI._restoreToggles) {
            WB.SimUI._restoreToggles(battle.toggles);
        }

        // Seed RNG for deterministic replay
        WB.RNG.seed(battle.seed);

        // Suppress the SAVE button on the result screen
        WB.SimUI.isReplaying = true;

        // Suppress cutscenes
        this._prevCutsceneEnabled = WB.Config.CUTSCENE_ENABLED;
        WB.Config.CUTSCENE_ENABLED = false;

        // Start the countdown (creates balls, applies arena size, etc.)
        WB.Game.startCountdown();

        // Override _returnFromResult so the game doesn't auto-navigate away
        this._origReturnFromResult = WB.Game._returnFromResult;
        WB.Game._returnFromResult = function() {
            // No-op during prerender — we control when to stop
        };
    },

    // ─── Audio Capture (silent to speakers, captured to stream) ──

    _setupAudioCapture() {
        this._captureNode = null;
        this._audioStream = null;
        if (!WB.Audio.ctx || !WB.Audio.masterGain) return;

        try {
            // Create capture destination
            this._captureNode = WB.Audio.ctx.createMediaStreamDestination();
            this._audioStream = this._captureNode.stream;

            // Disconnect masterGain from speakers
            WB.Audio.masterGain.disconnect(WB.Audio.ctx.destination);

            // Route masterGain to capture node instead
            WB.Audio.masterGain.connect(this._captureNode);
        } catch (e) {
            console.warn('[Prerender] Audio capture setup failed:', e);
            // Fallback: mute audio entirely
            this._prevMasterVol = WB.Audio.masterGain.gain.value;
            WB.Audio.masterGain.gain.value = 0;
        }
    },

    _teardownAudioCapture() {
        if (this._captureNode && WB.Audio.masterGain) {
            try {
                // Disconnect from capture node
                WB.Audio.masterGain.disconnect(this._captureNode);
            } catch (e) { /* already disconnected */ }

            // Reconnect to speakers
            try {
                WB.Audio.masterGain.connect(WB.Audio.ctx.destination);
            } catch (e) { /* already connected */ }

            this._captureNode = null;
            this._audioStream = null;
        } else if (this._prevMasterVol !== undefined) {
            // Fallback path: restore volume
            if (WB.Audio.masterGain) {
                WB.Audio.masterGain.gain.value = this._prevMasterVol;
            }
            this._prevMasterVol = undefined;
        }
    },

    // ─── Stream & MediaRecorder Setup ────────────────────

    _createStream() {
        var canvas = WB.Game.canvas;

        // captureStream(0) = manual frame mode. We call requestFrame()
        // after each rendered frame to capture it. Combined with rAF pacing
        // in the render loop, each frame gets wall-clock PTS ~16.67ms apart.
        try {
            this._stream = canvas.captureStream(0);
        } catch (e) {
            console.error('[Prerender] captureStream failed:', e);
            alert('Failed to create capture stream: ' + e.message);
            return false;
        }

        this._videoTrack = this._stream.getVideoTracks()[0];
        if (!this._videoTrack || typeof this._videoTrack.requestFrame !== 'function') {
            console.error('[Prerender] requestFrame not supported on video track');
            alert('Your browser does not support requestFrame(). Try Chrome or Firefox.');
            return false;
        }

        // Add audio tracks from the capture stream (if available)
        if (this._audioStream) {
            var audioTracks = this._audioStream.getAudioTracks();
            for (var i = 0; i < audioTracks.length; i++) {
                this._stream.addTrack(audioTracks[i]);
            }
            console.log('[Prerender] Audio capture attached (' + audioTracks.length + ' tracks)');
        }

        // Codec detection — include audio codec when audio is captured
        var hasAudio = this._audioStream && this._audioStream.getAudioTracks().length > 0;
        var mimeType = 'video/webm; codecs=vp9';
        if (hasAudio) {
            if (MediaRecorder.isTypeSupported('video/mp4; codecs=avc1')) {
                mimeType = 'video/mp4; codecs=avc1';
            } else if (MediaRecorder.isTypeSupported('video/webm; codecs=vp9,opus')) {
                mimeType = 'video/webm; codecs=vp9,opus';
            } else if (MediaRecorder.isTypeSupported('video/webm; codecs=vp8,opus')) {
                mimeType = 'video/webm; codecs=vp8,opus';
            } else if (MediaRecorder.isTypeSupported('video/webm')) {
                mimeType = 'video/webm';
            }
        } else {
            if (MediaRecorder.isTypeSupported('video/mp4; codecs=avc1')) {
                mimeType = 'video/mp4; codecs=avc1';
            } else if (MediaRecorder.isTypeSupported('video/webm; codecs=vp9')) {
                mimeType = 'video/webm; codecs=vp9';
            } else if (MediaRecorder.isTypeSupported('video/webm; codecs=vp8')) {
                mimeType = 'video/webm; codecs=vp8';
            } else if (MediaRecorder.isTypeSupported('video/webm')) {
                mimeType = 'video/webm';
            }
        }

        try {
            this._mediaRecorder = new MediaRecorder(this._stream, {
                mimeType: mimeType,
                videoBitsPerSecond: 8_000_000, // 8 Mbps for TikTok quality
            });
        } catch (e) {
            console.warn('[Prerender] MediaRecorder with options failed, trying basic:', e);
            try {
                this._mediaRecorder = new MediaRecorder(this._stream);
            } catch (e2) {
                console.error('[Prerender] MediaRecorder creation failed:', e2);
                alert('MediaRecorder not available: ' + e2.message);
                return false;
            }
        }

        this._chunks = [];

        this._mediaRecorder.ondataavailable = function(e) {
            if (e.data && e.data.size > 0) {
                WB.Prerender._chunks.push(e.data);
            }
        };

        this._mediaRecorder.start(1000); // Request data every 1s
        console.log('[Prerender] Recording with ' + mimeType);
        return true;
    },

    // ─── Async Render Loop ───────────────────────────────
    // Uses requestAnimationFrame for wall-clock pacing at display refresh
    // rate. Each rAF callback renders exactly one game frame and calls
    // requestFrame() — this gives MediaRecorder correct PTS timestamps
    // at ~16.67ms intervals. On 120Hz displays, the 60fps limiter logic
    // in _stepOneFrame skips alternating rAF ticks automatically.

    _renderLoop() {
        var self = this;
        var lastTime = 0;
        var FRAME_INTERVAL = 1000 / 60;

        function step(timestamp) {
            if (self._cancelled || self._phase === 'done') {
                if (self._cancelled) {
                    self._abortRecording();
                } else {
                    self._finalize();
                }
                return;
            }

            // 60fps pacing — skip if less than ~16.67ms since last frame
            if (timestamp - lastTime < FRAME_INTERVAL * 0.9) {
                requestAnimationFrame(step);
                return;
            }
            lastTime = timestamp - ((timestamp - lastTime) % FRAME_INTERVAL);

            self._stepOneFrame();
            self._currentFrame++;

            // Safety cap
            if (self._currentFrame >= self._MAX_FRAMES) {
                self._phase = 'done';
            }

            // Update progress every 30 frames (~0.5s)
            if (self._currentFrame % 30 === 0) {
                self._updateProgress();
            }

            requestAnimationFrame(step);
        }

        requestAnimationFrame(step);
    },

    // ─── Single Frame Step ───────────────────────────────

    _stepOneFrame() {
        WB.GL.beginFrame();

        switch (this._phase) {
            case 'countdown':
                // updateCountdown transitions to BATTLE via startBattle()
                WB.Game.updateCountdown();
                if (WB.Game.state === 'BATTLE') {
                    this._phase = 'battle';
                }
                break;

            case 'battle':
                WB.Game.updateBattle();
                if (WB.Game.state === 'RESULT') {
                    this._phase = 'result';
                    this._resultFrames = 0;
                    // Refine total estimate now that we know exact battle length
                    this._totalEstimate = this._currentFrame + this._RESULT_DURATION;
                }
                break;

            case 'result':
                WB.Game.drawResult();
                this._resultFrames++;
                if (this._resultFrames >= this._RESULT_DURATION) {
                    this._phase = 'done';
                }
                break;
        }

        WB.GLText.flush();
        WB.GL.endFrame();

        // Capture this frame to the video stream
        if (this._videoTrack) {
            this._videoTrack.requestFrame();
        }
    },

    // ─── Progress Overlay (DOM, not canvas) ──────────────

    _showProgress() {
        if (this._progressEl) return;

        var el = document.createElement('div');
        el.id = 'prerenderProgress';
        el.style.cssText = [
            'position:fixed', 'top:50%', 'left:50%',
            'transform:translate(-50%,-50%)',
            'background:rgba(0,0,0,0.92)', 'color:#FFF',
            'padding:28px 36px', 'border-radius:12px',
            'font-family:"Courier New",monospace',
            'text-align:center', 'z-index:9999',
            'min-width:300px', 'pointer-events:none',
            'border:2px solid #D4A853',
        ].join(';');

        // Title
        var title = document.createElement('div');
        title.style.cssText = 'font-size:18px;font-weight:bold;letter-spacing:2px;margin-bottom:14px;color:#D4A853';
        title.textContent = 'PRERENDERING';
        el.appendChild(title);

        // Progress bar outer
        var barOuter = document.createElement('div');
        barOuter.style.cssText = 'width:100%;height:8px;background:#333;border-radius:4px;overflow:hidden;margin-bottom:10px';
        var barFill = document.createElement('div');
        barFill.id = 'prerenderBarFill';
        barFill.style.cssText = 'width:0%;height:100%;background:#D4A853;transition:width 0.08s';
        barOuter.appendChild(barFill);
        el.appendChild(barOuter);

        // Stats line
        var stats = document.createElement('div');
        stats.id = 'prerenderStats';
        stats.style.cssText = 'font-size:12px;color:#AAA';
        stats.textContent = 'Frame 0 / ~0';
        el.appendChild(stats);

        // Cancel hint
        var hint = document.createElement('div');
        hint.style.cssText = 'font-size:11px;color:#666;margin-top:10px';
        hint.textContent = 'Click canvas to cancel';
        el.appendChild(hint);

        document.body.appendChild(el);
        this._progressEl = el;
    },

    _updateProgress() {
        var fill = document.getElementById('prerenderBarFill');
        var stats = document.getElementById('prerenderStats');
        if (!fill || !stats) return;

        var pct = this._totalEstimate > 0
            ? Math.min(100, (this._currentFrame / this._totalEstimate) * 100)
            : 0;
        fill.style.width = pct.toFixed(1) + '%';

        var phaseLabel = this._phase === 'countdown' ? 'countdown'
            : this._phase === 'battle' ? 'battle'
            : this._phase === 'result' ? 'result' : '';
        stats.textContent = 'Frame ' + this._currentFrame + ' / ~' + this._totalEstimate + '  (' + phaseLabel + ')';
    },

    _hideProgress() {
        if (this._progressEl) {
            this._progressEl.remove();
            this._progressEl = null;
        }
    },

    // ─── Finalize & Download ─────────────────────────────

    _finalize() {
        var self = this;
        if (!this._mediaRecorder) {
            this._cleanup();
            return;
        }

        // Set up the onstop handler to download the video
        this._mediaRecorder.onstop = function() {
            if (self._chunks.length === 0) {
                console.warn('[Prerender] No data recorded');
                self._cleanup();
                return;
            }

            var mimeType = self._mediaRecorder ? self._mediaRecorder.mimeType : 'video/webm';
            var blob = new Blob(self._chunks, { type: mimeType });
            var ext = mimeType.indexOf('mp4') >= 0 ? 'mp4' : 'webm';

            // Build filename from weapon names
            var nameL = self._battle ? self._battle.weaponLeft : 'left';
            var nameR = self._battle ? self._battle.weaponRight : 'right';
            var filename = nameL + '_vs_' + nameR + '_prerender.' + ext;

            // Auto-download
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(function() { URL.revokeObjectURL(a.href); }, 5000);

            var sizeMB = (blob.size / 1024 / 1024).toFixed(1);
            console.log('[Prerender] Video saved: ' + filename + ' (' + sizeMB + 'MB, ' + self._currentFrame + ' frames)');

            self._cleanup();
        };

        // Stop the recorder — triggers onstop which downloads
        try {
            this._mediaRecorder.stop();
        } catch (e) {
            console.warn('[Prerender] Stop error:', e);
            this._cleanup();
        }
    },

    _abortRecording() {
        var self = this;
        // Cancel — stop recorder without downloading
        if (this._mediaRecorder) {
            this._mediaRecorder.onstop = function() {
                // Discard chunks
                self._cleanup();
            };
            try {
                this._mediaRecorder.stop();
            } catch (e) {
                this._cleanup();
            }
        } else {
            this._cleanup();
        }
        console.log('[Prerender] Aborted');
    },

    // ─── Cleanup & State Restoration ─────────────────────

    _cleanup() {
        this._hideProgress();

        // Restore _returnFromResult
        if (this._origReturnFromResult) {
            WB.Game._returnFromResult = this._origReturnFromResult;
            this._origReturnFromResult = null;
        }

        // Restore audio routing (capture → speakers)
        this._teardownAudioCapture();

        // Restore cutscene setting
        if (this._prevCutsceneEnabled !== undefined) {
            WB.Config.CUTSCENE_ENABLED = this._prevCutsceneEnabled;
            this._prevCutsceneEnabled = undefined;
        }

        // Unseed RNG
        WB.RNG.unseed();
        WB.SimUI.isReplaying = false;

        // Clean up arena modifiers
        var wallShift = WB.ArenaModifiers.getModifier('wallshift');
        if (wallShift && wallShift.restore) wallShift.restore();
        WB.ArenaModifiers.clear();

        // Restore menu size
        WB.Game._restoreMenuSize();

        // Stop all stream tracks
        if (this._stream) {
            this._stream.getTracks().forEach(function(t) { t.stop(); });
        }

        // Clear references
        this._stream = null;
        this._videoTrack = null;
        this._mediaRecorder = null;
        this._chunks = [];
        this._battle = null;
        this._phase = 'idle';
        this.isActive = false;

        // Resume normal game loop and return to Studio
        WB.Game._prerenderActive = false;
        WB.Game.state = 'STUDIO';

        // Clear motion blur history (prerender frames would ghost into live view)
        if (WB.GL) WB.GL.clearMotionBlurHistory();
    },
};
