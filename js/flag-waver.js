window.WB = window.WB || {};

// ─── Victory Flag Waver ───────────────────────────────────────
// Renders an animated waving flag on the result screen when a
// states-pack weapon wins. Uses a 2D offscreen canvas for the
// per-column wave distortion, then uploads to a WebGL texture
// for display in the game's GL rendering pipeline.
//
// Wave algorithm adapted from FlagWaver React component:
//   For each column X: sum harmonic sine waves, apply shear &
//   lighting, shift pixels vertically by the wave offset.
//
// Parameters saved to localStorage 'wb_flag_wave_config'.

WB.FlagWaver = {

    // ─── Config ─────────────────────────────────────────────
    _STORAGE_KEY: 'wb_flag_wave_config',
    _FLAG_W: 240,      // internal wave canvas width
    _FLAG_H: 150,      // internal wave canvas height
    _EXTRA_Y: 40,      // vertical padding for wave displacement

    // ─── State ──────────────────────────────────────────────
    _canvas: null,      // offscreen canvas for wave output
    _ctx: null,
    _srcCanvas: null,   // source flag scaled to _FLAG_W × _FLAG_H
    _srcCtx: null,
    _srcData: null,     // cached ImageData of source flag
    _texture: null,     // WebGL texture (uploaded each frame)
    _program: null,     // rectangular textured-quad shader
    _vao: null,
    _vbo: null,
    _active: false,
    _time: 0,
    _weaponType: null,
    _initialized: false,

    // ─── Wave Parameters ────────────────────────────────────
    _params: {
        amplitude: 18,
        frequency: 0.04,
        speed: 3.5,
        harmonics: 3,
        shear: 0.3,
        shadowDepth: 0.35
    },

    DEFAULTS: {
        amplitude: 18,
        frequency: 0.04,
        speed: 3.5,
        harmonics: 3,
        shear: 0.3,
        shadowDepth: 0.35
    },

    // ─── Init ───────────────────────────────────────────────

    init() {
        if (this._initialized) return;
        var gl = WB.GL ? WB.GL.gl : null;
        if (!gl) return;

        // Create offscreen canvases
        this._srcCanvas = document.createElement('canvas');
        this._srcCanvas.width = this._FLAG_W;
        this._srcCanvas.height = this._FLAG_H;
        this._srcCtx = this._srcCanvas.getContext('2d');

        this._canvas = document.createElement('canvas');
        this._canvas.width = this._FLAG_W;
        this._canvas.height = this._FLAG_H + this._EXTRA_Y * 2;
        this._ctx = this._canvas.getContext('2d');

        // Create rectangular textured-quad shader (no circle clipping)
        this._createShader(gl);
        if (!this._program) return;
        this._createQuad(gl);

        // Create initial WebGL texture
        this._texture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._canvas);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.activeTexture(gl.TEXTURE0);

        // Load saved params from localStorage
        this._loadConfig();

        this._initialized = true;
        console.log('[FlagWaver] Initialized');
    },

    _createShader(gl) {
        // Rectangular textured quad — positions in world space, UVs 0-1
        var vsSrc = `#version 300 es
            in vec2 a_pos;
            in vec2 a_uv;
            uniform mat3 u_proj;
            uniform vec2 u_pos;    // top-left corner in game coords
            uniform vec2 u_size;   // width, height in game coords
            out vec2 v_uv;
            void main() {
                // a_pos is 0-1 range (not -1 to 1)
                vec2 world = u_pos + a_pos * u_size;
                vec3 clip = u_proj * vec3(world, 1.0);
                gl_Position = vec4(clip.xy, 0.0, 1.0);
                v_uv = a_uv;
            }
        `;
        var fsSrc = `#version 300 es
            precision mediump float;
            in vec2 v_uv;
            uniform sampler2D u_image;
            uniform float u_alpha;
            out vec4 fragColor;
            void main() {
                vec4 tex = texture(u_image, v_uv);
                if (tex.a < 0.01) discard;
                fragColor = vec4(tex.rgb, tex.a * u_alpha);
            }
        `;

        this._program = WB.GL._createProgram(vsSrc, fsSrc);
        if (!this._program) {
            console.warn('[FlagWaver] Shader compilation failed');
        }
    },

    _createQuad(gl) {
        // Unit quad: positions (0 to 1) + UVs (0 to 1)
        // Y-down projection means pos (0,0) = top-left on screen
        var quadData = new Float32Array([
            // pos     uv
            0, 0,      0, 0,
            1, 0,      1, 0,
            0, 1,      0, 1,
            1, 1,      1, 1,
        ]);

        this._vao = gl.createVertexArray();
        this._vbo = gl.createBuffer();
        gl.bindVertexArray(this._vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo);
        gl.bufferData(gl.ARRAY_BUFFER, quadData, gl.STATIC_DRAW);

        var aPos = this._program._attrs.a_pos;
        var aUv = this._program._attrs.a_uv;
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(aUv);
        gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);

        gl.bindVertexArray(null);
    },

    // ─── Config Persistence ─────────────────────────────────

    _loadConfig() {
        try {
            var raw = localStorage.getItem(this._STORAGE_KEY);
            if (raw) {
                var cfg = JSON.parse(raw);
                for (var key in this.DEFAULTS) {
                    if (cfg[key] != null) this._params[key] = cfg[key];
                }
            }
        } catch (e) {
            // Use defaults
        }
    },

    saveConfig(params) {
        if (params) {
            for (var key in this.DEFAULTS) {
                if (params[key] != null) this._params[key] = params[key];
            }
        }
        try {
            localStorage.setItem(this._STORAGE_KEY, JSON.stringify(this._params));
        } catch (e) {}
    },

    // ─── Start / Stop ───────────────────────────────────────

    start(weaponType) {
        if (!this._initialized) return;
        // Only show for states-pack weapons that have flags
        if (!WB.BallImages || !WB.BallImages.hasFlag(weaponType)) {
            this._active = false;
            return;
        }

        this._weaponType = weaponType;
        this._time = 0;
        this._active = true;

        // Load flag image into source canvas
        this._loadFlagSource(weaponType);
    },

    _loadFlagSource(weaponType) {
        var self = this;
        var img = new Image();
        img.onload = function() {
            var w = self._FLAG_W;
            var h = self._FLAG_H;
            self._srcCtx.clearRect(0, 0, w, h);
            // Scale flag to fill canvas (maintain aspect ratio)
            var scale = Math.max(w / img.width, h / img.height);
            var sw = img.width * scale;
            var sh = img.height * scale;
            self._srcCtx.drawImage(img, (w - sw) / 2, (h - sh) / 2, sw, sh);
            try {
                self._srcData = self._srcCtx.getImageData(0, 0, w, h);
            } catch (e) {
                self._srcData = null;
            }
        };
        img.onerror = function() {
            console.warn('[FlagWaver] Failed to load flag for', weaponType);
            self._active = false;
        };
        img.src = 'assets/flags/' + weaponType + '.png';
    },

    stop() {
        this._active = false;
        this._srcData = null;
        this._weaponType = null;
    },

    // ─── Wave Distortion Render ─────────────────────────────

    update() {
        if (!this._active || !this._srcData) return;

        this._time += 1 / 60;

        var w = this._FLAG_W;
        var h = this._FLAG_H;
        var extraY = this._EXTRA_Y;
        var cw = this._canvas.width;
        var ch = this._canvas.height;
        var ctx = this._ctx;
        var p = this._params;
        var t = this._time;

        // Clear output canvas
        ctx.clearRect(0, 0, cw, ch);

        var src = this._srcData.data;
        var out = ctx.createImageData(cw, ch);
        var dst = out.data;

        for (var x = 0; x < w; x++) {
            // Sum harmonic sine waves
            var wave = 0;
            for (var n = 1; n <= p.harmonics; n++) {
                wave += (p.amplitude / n) * Math.sin(p.frequency * n * x + p.speed * t * (1 + n * 0.3));
            }
            // Apply shear (wave increases left to right)
            var shearFactor = 1 + p.shear * (x / w);
            wave *= shearFactor;

            var yOffset = Math.round(wave) + extraY;

            // Calculate slope for lighting (shadow/highlight)
            var waveNext = 0;
            for (var n2 = 1; n2 <= p.harmonics; n2++) {
                waveNext += (p.amplitude / n2) * Math.sin(p.frequency * n2 * (x + 1) + p.speed * t * (1 + n2 * 0.3));
            }
            var slope = (waveNext - wave / shearFactor) * p.shadowDepth;

            // Copy source column with vertical offset + lighting
            for (var y = 0; y < h; y++) {
                var si = (y * w + x) * 4;
                var dstY = y + yOffset;
                if (dstY < 0 || dstY >= ch) continue;
                var di = (dstY * cw + x) * 4;
                var light = 1 + slope * 0.08;
                dst[di]     = Math.min(255, Math.max(0, Math.round(src[si]     * light)));
                dst[di + 1] = Math.min(255, Math.max(0, Math.round(src[si + 1] * light)));
                dst[di + 2] = Math.min(255, Math.max(0, Math.round(src[si + 2] * light)));
                dst[di + 3] = src[si + 3];
            }
        }

        ctx.putImageData(out, 0, 0);

        // Upload to WebGL texture
        this._uploadTexture();
    },

    _uploadTexture() {
        var gl = WB.GL ? WB.GL.gl : null;
        if (!gl || !this._texture) return;

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._canvas);
        gl.activeTexture(gl.TEXTURE0);
    },

    // ─── Draw to Screen ─────────────────────────────────────

    drawFlag(x, y, w, h) {
        if (!this._active || !this._initialized || !this._texture) return;
        if (!this._srcData) return;

        var gl = WB.GL.gl;

        // Flush batch renderer to maintain draw order
        WB.GLBatch.flush();
        WB.GLText.flush();

        // Save state
        var prevProgram = gl.getParameter(gl.CURRENT_PROGRAM);

        gl.useProgram(this._program);

        // Uniforms
        gl.uniformMatrix3fv(this._program._unis.u_proj, false, WB.GL.projMatrix);
        gl.uniform2f(this._program._unis.u_pos, x, y);
        gl.uniform2f(this._program._unis.u_size, w, h);
        gl.uniform1f(this._program._unis.u_alpha, 1.0);

        // Bind wave texture on TEXTURE1
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        gl.uniform1i(this._program._unis.u_image, 1);

        // Blending
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // Draw
        gl.bindVertexArray(this._vao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);

        // Restore
        gl.activeTexture(gl.TEXTURE0);
        if (prevProgram) gl.useProgram(prevProgram);
    },

    // ─── Public Getters ─────────────────────────────────────

    isActive() { return this._active; },
    getParams() { return Object.assign({}, this._params); },
};
