window.WB = window.WB || {};

// ─── Ball Image Overlay System ──────────────────────────────────
// Renders user-uploaded images (flags, faces, logos) on top of balls.
// Uses a dedicated textured-quad shader on TEXTURE1.
// Images are pre-cropped to circles on an offscreen canvas.
WB.BallImages = {
    _textures: { left: null, right: null },
    _images: { left: null, right: null },   // HTMLImageElement cache
    _flagTextures: {},    // weaponType → WebGL texture (state flags)
    _flagsLoaded: false,
    _program: null,
    _vao: null,
    _vbo: null,
    _STORAGE_KEY: 'wb_ball_images',
    _initialized: false,

    init() {
        if (this._initialized) return;
        const gl = WB.GL.gl;
        if (!gl) return;

        // Create textured circle shader
        const vsSrc = `#version 300 es
            in vec2 a_pos;
            in vec2 a_uv;
            uniform mat3 u_proj;
            uniform vec2 u_center;
            uniform float u_radius;
            out vec2 v_uv;
            out vec2 v_local;
            void main() {
                vec2 world = u_center + a_pos * u_radius;
                vec3 clip = u_proj * vec3(world, 1.0);
                gl_Position = vec4(clip.xy, 0.0, 1.0);
                v_uv = a_uv;
                v_local = a_pos; // -1 to +1 range for circle clip
            }
        `;
        const fsSrc = `#version 300 es
            precision mediump float;
            in vec2 v_uv;
            in vec2 v_local;
            uniform sampler2D u_image;
            uniform float u_alpha;
            out vec4 fragColor;
            void main() {
                float dist = length(v_local);
                if (dist > 1.0) discard;
                // Soft edge anti-aliasing
                float edge = smoothstep(1.0, 0.95, dist);
                vec4 tex = texture(u_image, v_uv);
                fragColor = vec4(tex.rgb, tex.a * u_alpha * edge);
            }
        `;

        this._program = WB.GL._createProgram(vsSrc, fsSrc);
        if (!this._program) {
            console.warn('[BallImages] Shader compilation failed');
            return;
        }

        // Create a unit quad VAO: positions (-1 to 1) + UVs (0 to 1)
        // NOTE: projection flips Y (y-down), so pos (-1,-1) = top-left on screen.
        // UV (0,0) = top of image, so top-left vertex gets V=0 (not V=1).
        const quadData = new Float32Array([
            // pos       uv
            -1, -1,      0, 0,
             1, -1,      1, 0,
            -1,  1,      0, 1,
             1,  1,      1, 1,
        ]);

        this._vao = gl.createVertexArray();
        this._vbo = gl.createBuffer();
        gl.bindVertexArray(this._vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo);
        gl.bufferData(gl.ARRAY_BUFFER, quadData, gl.STATIC_DRAW);

        const aPos = this._program._attrs.a_pos;
        const aUv = this._program._attrs.a_uv;
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(aUv);
        gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);

        gl.bindVertexArray(null);

        this._initialized = true;

        // Load persisted images
        this._loadFromStorage();
    },

    // ─── Public API ──────────────────────────────────────

    loadImage(side, dataUrl) {
        const img = new Image();
        img.onload = () => {
            this._images[side] = img;
            this._createTexture(side, img);
            this._saveToStorage();
        };
        img.onerror = () => {
            console.warn('[BallImages] Failed to load image for', side);
        };
        img.src = dataUrl;
    },

    clear(side) {
        const gl = WB.GL.gl;
        if (this._textures[side]) {
            gl.deleteTexture(this._textures[side]);
            this._textures[side] = null;
        }
        this._images[side] = null;
        this._saveToStorage();
    },

    hasImage(side) {
        return this._textures[side] !== null;
    },

    // Draw a textured circle at (x, y) with given radius
    drawCircle(x, y, radius, side) {
        if (!this._initialized || !this._textures[side]) return;

        const gl = WB.GL.gl;

        // Flush batch renderer first to maintain draw order
        WB.GLBatch.flush();

        // Save state
        const prevProgram = gl.getParameter(gl.CURRENT_PROGRAM);

        gl.useProgram(this._program);

        // Set uniforms
        gl.uniformMatrix3fv(this._program._unis.u_proj, false, WB.GL.projMatrix);
        gl.uniform2f(this._program._unis.u_center, x, y);
        gl.uniform1f(this._program._unis.u_radius, radius);
        gl.uniform1f(this._program._unis.u_alpha, 1.0);

        // Bind texture on TEXTURE1
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this._textures[side]);
        gl.uniform1i(this._program._unis.u_image, 1);

        // Enable blending for transparency
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // Draw
        gl.bindVertexArray(this._vao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);

        // Restore — re-activate TEXTURE0 for font atlas
        gl.activeTexture(gl.TEXTURE0);

        // Restore previous program
        if (prevProgram) gl.useProgram(prevProgram);
    },

    // ─── Texture Management ──────────────────────────────

    _createTexture(side, img) {
        const gl = WB.GL.gl;
        if (!gl) return;

        // Delete old texture
        if (this._textures[side]) {
            gl.deleteTexture(this._textures[side]);
        }

        // Create square canvas for circle crop
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Draw image scaled to fill the square
        const scale = Math.max(size / img.width, size / img.height);
        const sw = img.width * scale;
        const sh = img.height * scale;
        ctx.drawImage(img, (size - sw) / 2, (size - sh) / 2, sw, sh);

        // Create WebGL texture
        const tex = gl.createTexture();
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        // Restore TEXTURE0
        gl.activeTexture(gl.TEXTURE0);

        this._textures[side] = tex;
    },

    // ─── State Flag Textures ──────────────────────────────

    // Load all flag PNGs for the states pack (called once at init)
    loadFlags() {
        if (!this._initialized) return;
        var statesTypes = WB.WeaponRegistry.getTypes('states');
        if (!statesTypes || statesTypes.length === 0) return;

        var self = this;
        var loaded = 0;
        var total = statesTypes.length;

        for (var i = 0; i < statesTypes.length; i++) {
            (function(type) {
                var img = new Image();
                img.onload = function() {
                    self._createFlagTexture(type, img);
                    loaded++;
                    if (loaded >= total) {
                        self._flagsLoaded = true;
                        console.log('[BallImages] All ' + total + ' state flags loaded');
                    }
                };
                img.onerror = function() {
                    console.warn('[BallImages] Failed to load flag for', type);
                    loaded++;
                    if (loaded >= total) {
                        self._flagsLoaded = true;
                    }
                };
                img.src = 'assets/flags/' + type + '.png';
            })(statesTypes[i]);
        }
    },

    _createFlagTexture(type, img) {
        var gl = WB.GL.gl;
        if (!gl) return;

        // Delete old texture if reloading
        if (this._flagTextures[type]) {
            gl.deleteTexture(this._flagTextures[type]);
        }

        // Create square canvas, scale-to-fill (same as _createTexture)
        var size = 256;
        var canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext('2d');

        var scale = Math.max(size / img.width, size / img.height);
        var sw = img.width * scale;
        var sh = img.height * scale;
        ctx.drawImage(img, (size - sw) / 2, (size - sh) / 2, sw, sh);

        // Create WebGL texture
        var tex = gl.createTexture();
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        // Restore TEXTURE0
        gl.activeTexture(gl.TEXTURE0);

        this._flagTextures[type] = tex;
    },

    hasFlag(weaponType) {
        return !!this._flagTextures[weaponType];
    },

    // Draw a flag texture circle (same pipeline as user images)
    drawFlagCircle(x, y, radius, weaponType) {
        if (!this._initialized || !this._flagTextures[weaponType]) return;

        var gl = WB.GL.gl;

        // Flush batch renderer first to maintain draw order
        WB.GLBatch.flush();

        // Save state
        var prevProgram = gl.getParameter(gl.CURRENT_PROGRAM);

        gl.useProgram(this._program);

        // Set uniforms
        gl.uniformMatrix3fv(this._program._unis.u_proj, false, WB.GL.projMatrix);
        gl.uniform2f(this._program._unis.u_center, x, y);
        gl.uniform1f(this._program._unis.u_radius, radius);
        gl.uniform1f(this._program._unis.u_alpha, 1.0);

        // Bind flag texture on TEXTURE1
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this._flagTextures[weaponType]);
        gl.uniform1i(this._program._unis.u_image, 1);

        // Enable blending for transparency
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // Draw
        gl.bindVertexArray(this._vao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);

        // Restore — re-activate TEXTURE0 for font atlas
        gl.activeTexture(gl.TEXTURE0);

        // Restore previous program
        if (prevProgram) gl.useProgram(prevProgram);
    },

    // ─── Persistence ─────────────────────────────────────

    _saveToStorage() {
        const data = {};
        for (const side of ['left', 'right']) {
            if (this._images[side]) {
                // Convert image to data URL for storage
                const canvas = document.createElement('canvas');
                const img = this._images[side];
                canvas.width = Math.min(img.width, 512);
                canvas.height = Math.min(img.height, 512);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                try {
                    data[side] = canvas.toDataURL('image/png');
                } catch (e) {
                    // CORS image — can't export
                }
            }
        }
        try {
            localStorage.setItem(this._STORAGE_KEY, JSON.stringify(data));
        } catch (e) { /* storage full */ }
    },

    _loadFromStorage() {
        try {
            const raw = localStorage.getItem(this._STORAGE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            for (const side of ['left', 'right']) {
                if (data[side]) {
                    this.loadImage(side, data[side]);
                }
            }
        } catch (e) { /* ignore */ }
    },
};
