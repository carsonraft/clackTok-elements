window.WB = window.WB || {};

// ─── Bitmap Font Atlas Text Rendering ─────────────────────────
WB.GLText = {
    gl: null,
    _atlas: null,       // WebGLTexture
    _atlasWidth: 0,
    _atlasHeight: 0,
    _glyphs: {},        // key: fontSize → { char → {x, y, w, h, advance} }
    _sizes: [10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 26, 28, 32, 44, 48, 80],

    // Text batch
    _verts: null,
    _vertCount: 0,
    _buf: null,
    _vao: null,
    MAX_TEXT_VERTS: 12000,

    init(gl) {
        this.gl = gl;
        this._generateAtlas();
        this._initBuffers();
    },

    _generateAtlas() {
        const gl = this.gl;
        const chars = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~★✕▶▲▼';
        const padding = 2;

        // Calculate atlas size
        // Each size gets a row (or multiple rows)
        const offCanvas = document.createElement('canvas');
        const offCtx = offCanvas.getContext('2d');

        // Measure all glyphs to determine atlas dimensions
        let totalHeight = 0;
        let maxRowWidth = 0;
        const sizeLayouts = [];

        for (const size of this._sizes) {
            offCtx.font = `bold ${size}px "Courier New", monospace`;
            const rowHeight = size + padding * 2;
            let rowWidth = 0;
            for (const ch of chars) {
                const m = offCtx.measureText(ch);
                rowWidth += Math.ceil(m.width) + padding * 2;
            }
            sizeLayouts.push({ size, rowHeight, rowWidth });
            maxRowWidth = Math.max(maxRowWidth, rowWidth);
            totalHeight += rowHeight;
        }

        // Power of 2 dimensions
        const atlasW = Math.min(4096, this._nextPow2(Math.min(maxRowWidth, 2048)));
        // Recalculate with wrapping
        totalHeight = 0;
        for (const layout of sizeLayouts) {
            const rows = Math.ceil(layout.rowWidth / (atlasW - padding));
            totalHeight += layout.rowHeight * rows;
        }
        const atlasH = this._nextPow2(totalHeight + 10);

        offCanvas.width = atlasW;
        offCanvas.height = atlasH;
        offCtx.clearRect(0, 0, atlasW, atlasH);

        // Render glyphs
        let curY = 0;
        for (const layout of sizeLayouts) {
            const size = layout.size;
            offCtx.font = `bold ${size}px "Courier New", monospace`;
            offCtx.fillStyle = '#FFF';
            offCtx.textBaseline = 'top';

            this._glyphs[size] = {};
            let curX = padding;

            for (const ch of chars) {
                const m = offCtx.measureText(ch);
                const gw = Math.ceil(m.width);

                if (curX + gw + padding > atlasW) {
                    curX = padding;
                    curY += layout.rowHeight;
                }

                offCtx.fillText(ch, curX, curY + padding);

                this._glyphs[size][ch] = {
                    x: curX,
                    y: curY + padding,
                    w: gw,
                    h: size,
                    advance: gw,
                };

                curX += gw + padding * 2;
            }
            curY += layout.rowHeight;
        }

        // Upload to WebGL texture
        this._atlas = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this._atlas);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, atlasW, atlasH, 0, gl.RED, gl.UNSIGNED_BYTE, null);

        // Extract red channel from canvas
        const imgData = offCtx.getImageData(0, 0, atlasW, atlasH);
        const redChannel = new Uint8Array(atlasW * atlasH);
        for (let i = 0; i < redChannel.length; i++) {
            // Use alpha channel since we drew white text
            redChannel[i] = imgData.data[i * 4 + 3];
        }
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, atlasW, atlasH, gl.RED, gl.UNSIGNED_BYTE, redChannel);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        this._atlasWidth = atlasW;
        this._atlasHeight = atlasH;
    },

    _initBuffers() {
        const gl = this.gl;
        // Per vertex: x, y, u, v, r, g, b, a = 8 floats
        this._verts = new Float32Array(this.MAX_TEXT_VERTS * 8);
        this._buf = gl.createBuffer();
        this._vao = gl.createVertexArray();

        gl.bindVertexArray(this._vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._buf);
        gl.bufferData(gl.ARRAY_BUFFER, this._verts.byteLength, gl.DYNAMIC_DRAW);

        const prog = WB.GL.programs.text;
        const stride = 32; // 8 * 4
        gl.enableVertexAttribArray(prog._attrs.a_pos);
        gl.vertexAttribPointer(prog._attrs.a_pos, 2, gl.FLOAT, false, stride, 0);
        gl.enableVertexAttribArray(prog._attrs.a_uv);
        gl.vertexAttribPointer(prog._attrs.a_uv, 2, gl.FLOAT, false, stride, 8);
        gl.enableVertexAttribArray(prog._attrs.a_color);
        gl.vertexAttribPointer(prog._attrs.a_color, 4, gl.FLOAT, false, stride, 16);

        gl.bindVertexArray(null);
    },

    // ─── Public API ──────────────────────────────────────────

    // Parse font string like 'bold 18px "Courier New", monospace' → size number
    _parseFontSize(fontStr) {
        const m = fontStr.match(/(\d+)px/);
        return m ? parseInt(m[1]) : 14;
    },

    // Find nearest available atlas size
    _nearestSize(target) {
        let best = this._sizes[0];
        let bestDiff = Infinity;
        for (const s of this._sizes) {
            const diff = Math.abs(s - target);
            if (diff < bestDiff) {
                bestDiff = diff;
                best = s;
            }
        }
        return best;
    },

    measureText(text, font) {
        const requestedSize = this._parseFontSize(font);
        const atlasSize = this._nearestSize(requestedSize);
        const scale = requestedSize / atlasSize;
        const glyphs = this._glyphs[atlasSize];
        if (!glyphs) return 0;

        let w = 0;
        for (const ch of text) {
            const g = glyphs[ch] || glyphs[' '];
            if (g) w += g.advance;
        }
        return w * scale;
    },

    drawText(text, x, y, font, color, align, baseline) {
        if (!text) return;
        const requestedSize = this._parseFontSize(font);
        const atlasSize = this._nearestSize(requestedSize);
        const scale = requestedSize / atlasSize;
        const glyphs = this._glyphs[atlasSize];
        if (!glyphs) return;

        const rgba = WB.GL.parseColor(color);
        const alpha = WB.GLBatch._currentAlpha * rgba[3];

        // Calculate total width for alignment
        let totalW = 0;
        for (const ch of text) {
            const g = glyphs[ch] || glyphs[' '];
            if (g) totalW += g.advance;
        }
        totalW *= scale;

        // Horizontal alignment — snap to integer pixels to avoid bilinear fringing
        let startX = x;
        if (align === 'center') startX = x - totalW / 2;
        else if (align === 'right') startX = x - totalW;
        startX = Math.round(startX);

        // Vertical alignment — snap to integer pixels
        let startY = y;
        if (baseline === 'middle') startY = y - requestedSize * 0.4;
        else if (baseline === 'top') startY = y;
        else if (baseline === 'alphabetic' || !baseline) startY = y - requestedSize * 0.8;
        startY = Math.round(startY);

        // Transform
        let curX = startX;
        for (const ch of text) {
            const g = glyphs[ch] || glyphs[' '];
            if (!g) continue;

            const gw = g.w * scale;
            const gh = g.h * scale;

            // UV coords
            const u0 = g.x / this._atlasWidth;
            const v0 = g.y / this._atlasHeight;
            const u1 = (g.x + g.w) / this._atlasWidth;
            const v1 = (g.y + g.h) / this._atlasHeight;

            // Screen coords (apply transform)
            const [x0, y0] = WB.GLBatch._tx(curX, startY);
            const [x1, y1] = WB.GLBatch._tx(curX + gw, startY + gh);

            this._addGlyphQuad(x0, y0, x1, y1, u0, v0, u1, v1, rgba[0], rgba[1], rgba[2], alpha);

            curX += Math.round(g.advance * scale);
        }
    },

    strokeText(text, x, y, font, strokeColor, strokeWidth) {
        // Draw text at multiple offsets for stroke effect
        const offsets = [
            [-1, -1], [0, -1], [1, -1],
            [-1, 0],           [1, 0],
            [-1, 1],  [0, 1],  [1, 1],
        ];
        const sw = (strokeWidth || 2) * 0.5;
        for (const [ox, oy] of offsets) {
            this.drawText(text, x + ox * sw, y + oy * sw, font, strokeColor, 'center', 'alphabetic');
        }
    },

    // Convenience: stroke + fill — clean drop shadow + tight outline
    drawTextWithStroke(text, x, y, font, fillColor, strokeColor, strokeWidth, align, baseline) {
        const sw = Math.max(1, Math.round((strokeWidth || 2) * 0.5));
        // Drop shadow for depth (offset down-right)
        this.drawText(text, x + sw, y + sw, font, strokeColor, align, baseline);
        // Cardinal outline only (4 dirs, not 8) — avoids muddy diagonal overlap
        this.drawText(text, x - sw, y, font, strokeColor, align, baseline);
        this.drawText(text, x + sw, y, font, strokeColor, align, baseline);
        this.drawText(text, x, y - sw, font, strokeColor, align, baseline);
        this.drawText(text, x, y + sw, font, strokeColor, align, baseline);
        // Fill pass on top
        this.drawText(text, x, y, font, fillColor, align, baseline);
    },

    flush() {
        if (this._vertCount === 0) return;
        const gl = this.gl;
        const prog = WB.GL.programs.text;

        // Flush flat/circle batches first to maintain draw order
        WB.GLBatch._flushFlat();
        WB.GLBatch._flushCirc();

        gl.useProgram(prog);
        gl.uniformMatrix3fv(prog._unis.u_proj, false, WB.GL.projMatrix);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this._atlas);
        gl.uniform1i(prog._unis.u_texture, 0);

        gl.bindVertexArray(this._vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._buf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this._verts.subarray(0, this._vertCount * 8));
        gl.drawArrays(gl.TRIANGLES, 0, this._vertCount);
        gl.bindVertexArray(null);

        this._vertCount = 0;
    },

    _addGlyphQuad(x0, y0, x1, y1, u0, v0, u1, v1, r, g, b, a) {
        if (this._vertCount + 6 > this.MAX_TEXT_VERTS) this.flush();

        const v = this._verts;
        let o = this._vertCount * 8;
        // Triangle 1
        v[o++]=x0; v[o++]=y0; v[o++]=u0; v[o++]=v0; v[o++]=r; v[o++]=g; v[o++]=b; v[o++]=a;
        v[o++]=x1; v[o++]=y0; v[o++]=u1; v[o++]=v0; v[o++]=r; v[o++]=g; v[o++]=b; v[o++]=a;
        v[o++]=x1; v[o++]=y1; v[o++]=u1; v[o++]=v1; v[o++]=r; v[o++]=g; v[o++]=b; v[o++]=a;
        // Triangle 2
        v[o++]=x0; v[o++]=y0; v[o++]=u0; v[o++]=v0; v[o++]=r; v[o++]=g; v[o++]=b; v[o++]=a;
        v[o++]=x1; v[o++]=y1; v[o++]=u1; v[o++]=v1; v[o++]=r; v[o++]=g; v[o++]=b; v[o++]=a;
        v[o++]=x0; v[o++]=y1; v[o++]=u0; v[o++]=v1; v[o++]=r; v[o++]=g; v[o++]=b; v[o++]=a;
        this._vertCount += 6;
    },

    _nextPow2(v) {
        v--;
        v |= v >> 1; v |= v >> 2; v |= v >> 4; v |= v >> 8; v |= v >> 16;
        return v + 1;
    },
};
