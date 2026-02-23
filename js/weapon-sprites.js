window.WB = window.WB || {};

// ─── Weapon Sprite System ──────────────────────────────────────
// Multi-atlas sprite renderer: loads sprite sheets and renders
// weapon sprites via a rotation-aware textured-quad shader on TEXTURE4.
// Atlas 0: Egyptian pixel art (512×512, 4×4 grid)
// Atlas 1: US States SVG icons (768×768, 6×6 grid)
WB.WeaponSprites = {
    _textures: [],       // WebGL textures per atlas
    _grids: [],          // Grid maps per atlas: key → [col, row]
    _gridSizes: [],      // Grid dimensions per atlas (e.g. 4 for 4×4)
    _atlasIndex: {},     // Sprite key → atlas index
    _program: null,
    _vao: null,
    _vbo: null,
    _initialized: false,

    // Egyptian atlas: 4×4 grid of 64×64 sprites in a 256×256 SVG
    // Rasterized to 512×512 for crispness
    ATLAS_SIZE: 512,

    // Egyptian sprite grid: key → [col, row]
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

    // ─── Egyptian SVG Atlas Loading ──────────────────────────

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
                    // Register as atlas 0 (Egyptian)
                    this.registerAtlas(0, canvas, this.GRID, 4);
                    this._initialized = true;
                    console.log('[WeaponSprites] Egyptian atlas loaded (' + this.ATLAS_SIZE + 'x' + this.ATLAS_SIZE + ')');
                };
                img.onerror = () => {
                    console.warn('[WeaponSprites] Failed to load SVG atlas');
                    URL.revokeObjectURL(url);
                    // Still mark initialized so states atlas can work independently
                    this._initialized = true;
                };
                img.src = url;
            })
            .catch(e => {
                console.warn('[WeaponSprites] Fetch failed:', e);
                // Still mark initialized so states atlas can work independently
                this._initialized = true;
            });
    },

    // ─── Multi-Atlas Registration ────────────────────────────

    /**
     * Register an atlas texture.
     * @param {number} index    - Atlas index (0=egyptian, 1=states, etc.)
     * @param {HTMLCanvasElement} canvas - Rasterized atlas canvas
     * @param {Object} gridMap  - Sprite key → [col, row]
     * @param {number} gridSize - Grid dimensions (4 for 4×4, 6 for 6×6)
     */
    registerAtlas(index, canvas, gridMap, gridSize) {
        const gl = WB.GL.gl;
        if (!gl) return;

        // Create WebGL texture
        var tex = gl.createTexture();
        gl.activeTexture(gl.TEXTURE4);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        // Use LINEAR for states SVGs (smooth), NEAREST for Egyptian pixel art
        var filter = index === 0 ? gl.NEAREST : gl.LINEAR;
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        gl.activeTexture(gl.TEXTURE0);

        // Store atlas data
        this._textures[index] = tex;
        this._grids[index] = gridMap;
        this._gridSizes[index] = gridSize;

        // Index all sprite keys to this atlas
        for (var key in gridMap) {
            this._atlasIndex[key] = index;
        }

        console.log('[WeaponSprites] Atlas ' + index + ' registered (' + Object.keys(gridMap).length + ' sprites, ' + gridSize + 'x' + gridSize + ' grid)');
    },

    // ─── UV Lookup ─────────────────────────────────────────

    _getUV(key) {
        var atlasIdx = this._atlasIndex[key];
        if (atlasIdx == null) return [0, 0, 0.25, 0.25];
        var grid = this._grids[atlasIdx];
        if (!grid || !grid[key]) return [0, 0, 0.25, 0.25];
        var cell = grid[key];
        var size = this._gridSizes[atlasIdx] || 4;
        var cellUV = 1.0 / size;
        var u0 = cell[0] * cellUV;
        var v0 = cell[1] * cellUV;
        return [u0, v0, u0 + cellUV, v0 + cellUV];
    },

    // ─── Public API ───────────────────────────────────────

    /**
     * Check if a sprite key exists in any atlas.
     */
    hasSprite(key) {
        return this._atlasIndex[key] != null && this._textures[this._atlasIndex[key]] != null;
    },

    /**
     * Draw a sprite from any registered atlas.
     * @param {string} key   - Sprite name (e.g. 'thoth-staff', 'alabama-rocket')
     * @param {number} x     - World X center
     * @param {number} y     - World Y center
     * @param {number} angle - Rotation in radians
     * @param {number} sx    - Half-width in game pixels
     * @param {number} sy    - Half-height in game pixels
     * @param {number} [alpha=1]      - Opacity 0-1
     * @param {number} [brightness=1] - Color multiplier (1=normal)
     */
    drawSprite(key, x, y, angle, sx, sy, alpha, brightness) {
        if (!this._initialized) return;

        // Look up which atlas this sprite belongs to
        var atlasIdx = this._atlasIndex[key];
        if (atlasIdx == null) return;
        var tex = this._textures[atlasIdx];
        if (!tex) return;

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

        // Bind correct atlas texture on TEXTURE4
        gl.activeTexture(gl.TEXTURE4);
        gl.bindTexture(gl.TEXTURE_2D, tex);
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
