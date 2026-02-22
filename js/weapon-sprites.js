window.WB = window.WB || {};

// ─── Weapon Sprite System ──────────────────────────────────────
// Loads the Egyptian pixel art SVG sprite sheet and renders weapon
// sprites via a rotation-aware textured-quad shader on TEXTURE4.
// Replaces procedural draw() calls for all 10 Egyptian weapons,
// plus projectile shapes (glyph, droplet) and hazards (venom puddle).
WB.WeaponSprites = {
    _texture: null,
    _program: null,
    _vao: null,
    _vbo: null,
    _initialized: false,

    // Atlas: 4×4 grid of 64×64 sprites in a 256×256 SVG
    // Rasterized to 512×512 for crispness
    ATLAS_SIZE: 512,

    // Sprite grid: key → [col, row]
    GRID: {
        'thoth-staff':     [0, 0],
        'thoth-glyph':     [1, 0],
        'ra-disk':         [2, 0],
        'ra-corona':       [3, 0],
        'sekhmet-claws':   [0, 1],
        'sobek-jaw':       [1, 1],
        'set-khopesh':     [2, 1],
        'set-arrow':       [3, 1],
        'anubis-crook':    [0, 2],
        'horus-wings':     [1, 2],
        'khnum-horns':     [2, 2],
        'wadjet-cobra':    [3, 2],
        'wadjet-glob':     [0, 3],
        'wadjet-puddle':   [1, 3],
        'osiris-crook':    [2, 3],
        'osiris-flail':    [3, 3],
    },

    init() {
        if (this._initialized) return;
        const gl = WB.GL.gl;
        if (!gl) return;

        this._createShader(gl);
        if (!this._program) return;
        this._createQuad(gl);
        this._loadAtlas();
    },

    // ─── Shader ────────────────────────────────────────────

    _createShader(gl) {
        const vsSrc = `#version 300 es
            in vec2 a_pos;
            in vec2 a_uv;
            uniform mat3 u_proj;
            uniform vec2 u_center;
            uniform vec2 u_scale;
            uniform float u_rotation;
            uniform vec4 u_uvRect;
            out vec2 v_uv;
            void main() {
                float c = cos(u_rotation);
                float s = sin(u_rotation);
                vec2 rotated = vec2(
                    a_pos.x * c - a_pos.y * s,
                    a_pos.x * s + a_pos.y * c
                );
                vec2 world = u_center + rotated * u_scale;
                vec3 clip = u_proj * vec3(world, 1.0);
                gl_Position = vec4(clip.xy, 0.0, 1.0);
                v_uv = u_uvRect.xy + a_uv * (u_uvRect.zw - u_uvRect.xy);
            }
        `;
        const fsSrc = `#version 300 es
            precision mediump float;
            in vec2 v_uv;
            uniform sampler2D u_atlas;
            uniform float u_alpha;
            uniform float u_brightness;
            out vec4 fragColor;
            void main() {
                vec4 tex = texture(u_atlas, v_uv);
                if (tex.a < 0.01) discard;
                vec3 color = tex.rgb * u_brightness;
                fragColor = vec4(color, tex.a * u_alpha);
            }
        `;

        this._program = WB.GL._createProgram(vsSrc, fsSrc);
        if (!this._program) {
            console.warn('[WeaponSprites] Shader compilation failed');
        }
    },

    // ─── Quad VAO ──────────────────────────────────────────

    _createQuad(gl) {
        // Unit quad: positions (-1 to 1) + UVs (0 to 1)
        const quadData = new Float32Array([
            // pos       uv
            -1, -1,      0, 1,
             1, -1,      1, 1,
            -1,  1,      0, 0,
             1,  1,      1, 0,
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
    },

    // ─── SVG Atlas Loading ─────────────────────────────────

    _loadAtlas() {
        fetch('assets/egyptian-inventory.svg')
            .then(r => r.text())
            .then(svgText => {
                // Parse SVG DOM to remove inventory UI decoration
                const parser = new DOMParser();
                const doc = parser.parseFromString(svgText, 'image/svg+xml');
                const svg = doc.documentElement;

                // Remove global background rect
                const bgRects = svg.querySelectorAll(':scope > rect');
                bgRects.forEach(r => r.remove());

                // Remove each slot's 2 decorative rects (inventory border)
                const groups = svg.querySelectorAll(':scope > g');
                groups.forEach(g => {
                    const rects = g.querySelectorAll(':scope > rect');
                    rects.forEach(r => r.remove());
                });

                // Remove the pixel-outline filter and all references to it.
                // The filter creates opaque dark outlines (#16181f) around sprites
                // which render as big dark blocks on a transparent atlas.
                const defs = svg.querySelector('defs');
                if (defs) defs.remove();
                svg.querySelectorAll('[filter]').forEach(el => el.removeAttribute('filter'));

                // Serialize cleaned SVG to blob URL
                const serializer = new XMLSerializer();
                const cleanSvg = serializer.serializeToString(svg);
                const blob = new Blob([cleanSvg], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(blob);

                // Rasterize to canvas
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = this.ATLAS_SIZE;
                    canvas.height = this.ATLAS_SIZE;
                    const ctx = canvas.getContext('2d');
                    ctx.imageSmoothingEnabled = false;
                    ctx.drawImage(img, 0, 0, this.ATLAS_SIZE, this.ATLAS_SIZE);
                    URL.revokeObjectURL(url);
                    this._uploadTexture(canvas);
                    this._initialized = true;
                    console.log('[WeaponSprites] Atlas loaded (' + this.ATLAS_SIZE + 'x' + this.ATLAS_SIZE + ')');
                };
                img.onerror = () => {
                    console.warn('[WeaponSprites] Failed to load SVG atlas');
                    URL.revokeObjectURL(url);
                };
                img.src = url;
            })
            .catch(e => {
                console.warn('[WeaponSprites] Fetch failed:', e);
            });
    },

    _uploadTexture(canvas) {
        const gl = WB.GL.gl;
        if (!gl) return;

        this._texture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE4);
        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        // Restore TEXTURE0
        gl.activeTexture(gl.TEXTURE0);
    },

    // ─── UV Lookup ─────────────────────────────────────────

    _getUV(key) {
        const grid = this.GRID[key];
        if (!grid) return [0, 0, 0.25, 0.25];
        const u0 = grid[0] * 0.25;
        const v0 = grid[1] * 0.25;
        return [u0, v0, u0 + 0.25, v0 + 0.25];
    },

    // ─── Public Draw API ───────────────────────────────────

    /**
     * Draw a sprite from the atlas.
     * @param {string} key   - Sprite name (e.g. 'thoth-staff')
     * @param {number} x     - World X center
     * @param {number} y     - World Y center
     * @param {number} angle - Rotation in radians
     * @param {number} sx    - Half-width in game pixels
     * @param {number} sy    - Half-height in game pixels
     * @param {number} [alpha=1]      - Opacity 0-1
     * @param {number} [brightness=1] - Color multiplier (1=normal)
     */
    drawSprite(key, x, y, angle, sx, sy, alpha, brightness) {
        if (!this._initialized || !this._texture) return;

        const gl = WB.GL.gl;

        // Flush batch renderer to maintain draw order
        WB.GLBatch.flush();

        // Save state
        const prevProgram = gl.getParameter(gl.CURRENT_PROGRAM);

        gl.useProgram(this._program);

        // Uniforms
        gl.uniformMatrix3fv(this._program._unis.u_proj, false, WB.GL.projMatrix);
        gl.uniform2f(this._program._unis.u_center, x, y);
        gl.uniform2f(this._program._unis.u_scale, sx, sy);
        gl.uniform1f(this._program._unis.u_rotation, angle || 0);
        gl.uniform1f(this._program._unis.u_alpha, alpha != null ? alpha : 1.0);
        gl.uniform1f(this._program._unis.u_brightness, brightness || 1.0);

        // UV rect for this sprite
        const uv = this._getUV(key);
        gl.uniform4f(this._program._unis.u_uvRect, uv[0], uv[1], uv[2], uv[3]);

        // Bind atlas on TEXTURE4
        gl.activeTexture(gl.TEXTURE4);
        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        gl.uniform1i(this._program._unis.u_atlas, 4);

        // Blending
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // Draw
        gl.bindVertexArray(this._vao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);

        // Restore TEXTURE0 for font atlas
        gl.activeTexture(gl.TEXTURE0);

        // Restore previous program
        if (prevProgram) gl.useProgram(prevProgram);
    },
};
