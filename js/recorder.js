window.WB = window.WB || {};

// ─── Video Recorder ──────────────────────────────────────────
// Captures the game canvas + audio as a downloadable video file.
// Uses MediaRecorder API with canvas.captureStream().
WB.Recorder = {
    isRecording: false,
    _mediaRecorder: null,
    _chunks: [],

    start() {
        if (this.isRecording) return;
        const canvas = WB.Game.canvas;
        if (!canvas) return;

        // Create video stream from canvas at 60fps
        const videoStream = canvas.captureStream(60);

        // Add audio from Web Audio graph
        const audioStream = WB.Audio.createCaptureStream();
        if (audioStream) {
            for (const track of audioStream.getAudioTracks()) {
                videoStream.addTrack(track);
            }
        }

        // Choose best available codec (prefer MP4/H.264 for TikTok, fallback to WebM/VP9)
        let mimeType = 'video/webm; codecs=vp9,opus';
        if (MediaRecorder.isTypeSupported('video/mp4; codecs=avc1')) {
            mimeType = 'video/mp4; codecs=avc1';
        } else if (MediaRecorder.isTypeSupported('video/webm; codecs=vp9,opus')) {
            mimeType = 'video/webm; codecs=vp9,opus';
        } else if (MediaRecorder.isTypeSupported('video/webm; codecs=vp8,opus')) {
            mimeType = 'video/webm; codecs=vp8,opus';
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
            mimeType = 'video/webm';
        }

        try {
            this._mediaRecorder = new MediaRecorder(videoStream, {
                mimeType: mimeType,
                videoBitsPerSecond: 8_000_000, // 8 Mbps for TikTok quality
            });
        } catch (e) {
            console.warn('MediaRecorder failed with options, trying basic:', e);
            this._mediaRecorder = new MediaRecorder(videoStream);
        }

        this._chunks = [];

        this._mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                this._chunks.push(e.data);
            }
        };

        this._mediaRecorder.onstop = () => {
            this._finalize();
        };

        this._mediaRecorder.start(1000); // Request data every 1s
        this.isRecording = true;
        console.log('[Recorder] Started recording (' + mimeType + ')');
    },

    stop() {
        if (!this.isRecording || !this._mediaRecorder) return;
        try {
            this._mediaRecorder.stop();
        } catch (e) {
            console.warn('[Recorder] Stop error:', e);
        }
        this.isRecording = false;
        console.log('[Recorder] Stopped recording');
    },

    _finalize() {
        if (this._chunks.length === 0) {
            console.warn('[Recorder] No data recorded');
            WB.Audio.destroyCaptureStream();
            return;
        }

        const mimeType = this._mediaRecorder ? this._mediaRecorder.mimeType : 'video/webm';
        const blob = new Blob(this._chunks, { type: mimeType });
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';

        // Auto-download
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'battle_' + Date.now() + '.' + ext;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Cleanup
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        WB.Audio.destroyCaptureStream();
        this._chunks = [];
        this._mediaRecorder = null;

        console.log('[Recorder] Video saved: ' + a.download + ' (' + (blob.size / 1024 / 1024).toFixed(1) + 'MB)');
    }
};
