window.WB = window.WB || {};

// ─── Batched WebGL Draw Primitives ────────────────────────────
WB.GLBatch = {
    gl: null,

    // Flat geometry (rects, triangles, polygons)
    _flatVerts: null,    // Float32Array
    _flatCount: 0,
    _flatBuf: null,      // WebGLBuffer
    _flatVAO: null,
    MAX_FLAT_VERTS: 30000,

    // Circle instances
    _circVerts: null,
    _circCount: 0,
    _circBuf: null,
    _circVAO: null,
    MAX_CIRC_INSTANCES: 4000,

    // Transform stack
    _transformStack: [],
    _currentTransform: null, // [a, b, c, d, tx, ty] = 2D affine

    // Alpha stack
    _alphaStack: [],
    _currentAlpha: 1.0,

    init(gl) {
        this.gl = gl;

        // ─── Flat geometry buffers ───
        this._flatVerts = new Float32Array(this.MAX_FLAT_VERTS * 6); // x,y,r,g,b,a per vertex
        this._flatBuf = gl.createBuffer();
        this._flatVAO = gl.createVertexArray();
        gl.bindVertexArray(this._flatVAO);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._flatBuf);
        gl.bufferData(gl.ARRAY_BUFFER, this._flatVerts.byteLength, gl.DYNAMIC_DRAW);
        const flatProg = WB.GL.programs.flat;
        // a_pos: vec2
        gl.enableVertexAttribArray(flatProg._attrs.a_pos);
        gl.vertexAttribPointer(flatProg._attrs.a_pos, 2, gl.FLOAT, false, 24, 0);
        // a_color: vec4
        gl.enableVertexAttribArray(flatProg._attrs.a_color);
        gl.vertexAttribPointer(flatProg._attrs.a_color, 4, gl.FLOAT, false, 24, 8);
        gl.bindVertexArray(null);

        // ─── Circle instance buffers ───
        // Per-instance: centerX, centerY, radius, r, g, b, a, lineWidth, unused = 9 floats
        this._circVerts = new Float32Array(this.MAX_CIRC_INSTANCES * 9);
        this._circBuf = gl.createBuffer();
        this._circVAO = gl.createVertexArray();

        // Quad vertices for circle rendering (unit quad)
        const quadVerts = new Float32Array([
            -1, -1,  1, -1,  -1, 1,
            -1,  1,  1, -1,   1, 1,
        ]);
        const quadBuf = gl.createBuffer();

        gl.bindVertexArray(this._circVAO);

        // Quad vertex buffer (shared across instances)
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
        gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);
        const circProg = WB.GL.programs.circle;
        gl.enableVertexAttribArray(circProg._attrs.a_pos);
        gl.vertexAttribPointer(circProg._attrs.a_pos, 2, gl.FLOAT, false, 8, 0);

        // Instance buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this._circBuf);
        gl.bufferData(gl.ARRAY_BUFFER, this._circVerts.byteLength, gl.DYNAMIC_DRAW);
        const stride = 36; // 9 floats * 4 bytes
        // a_center: vec3 (x, y, radius)
        gl.enableVertexAttribArray(circProg._attrs.a_center);
        gl.vertexAttribPointer(circProg._attrs.a_center, 3, gl.FLOAT, false, stride, 0);
        gl.vertexAttribDivisor(circProg._attrs.a_center, 1);
        // a_color: vec4
        gl.enableVertexAttribArray(circProg._attrs.a_color);
        gl.vertexAttribPointer(circProg._attrs.a_color, 4, gl.FLOAT, false, stride, 12);
        gl.vertexAttribDivisor(circProg._attrs.a_color, 1);
        // a_params: vec2 (lineWidth, unused)
        gl.enableVertexAttribArray(circProg._attrs.a_params);
        gl.vertexAttribPointer(circProg._attrs.a_params, 2, gl.FLOAT, false, stride, 28);
        gl.vertexAttribDivisor(circProg._attrs.a_params, 1);

        gl.bindVertexArray(null);

        // Init transform
        this._currentTransform = [1, 0, 0, 1, 0, 0];
    },

    resetFrame() {
        this._flatCount = 0;
        this._circCount = 0;
        this._transformStack.length = 0;
        this._currentTransform = [1, 0, 0, 1, 0, 0];
        this._alphaStack.length = 0;
        this._currentAlpha = 1.0;
    },

    // ─── Transform Stack ─────────────────────────────────────
    pushTransform(tx, ty, rotation, sx, sy) {
        this._transformStack.push(this._currentTransform.slice());
        // Build new transform and multiply
        const cos = Math.cos(rotation || 0) * (sx || 1);
        const sin = Math.sin(rotation || 0) * (sy || 1);
        const cosY = Math.cos(rotation || 0) * (sy || 1);
        const sinX = Math.sin(rotation || 0) * (sx || 1);
        const old = this._currentTransform;
        // Multiply: old * [cos, sin, -sin, cos, tx, ty]
        const a = old[0] * cos + old[2] * sinX;
        const b = old[1] * cos + old[3] * sinX;
        const c = old[0] * (-sin) + old[2] * cosY;
        const d = old[1] * (-sin) + old[3] * cosY;
        const e = old[0] * (tx || 0) + old[2] * (ty || 0) + old[4];
        const f = old[1] * (tx || 0) + old[3] * (ty || 0) + old[5];
        this._currentTransform = [a, b, c, d, e, f];
    },

    popTransform() {
        if (this._transformStack.length > 0) {
            this._currentTransform = this._transformStack.pop();
        }
    },

    // Convenience: push translate only
    pushTranslate(tx, ty) {
        this._transformStack.push(this._currentTransform.slice());
        const old = this._currentTransform;
        this._currentTransform = [
            old[0], old[1], old[2], old[3],
            old[0] * tx + old[2] * ty + old[4],
            old[1] * tx + old[3] * ty + old[5],
        ];
    },

    // Convenience: push scale only
    pushScale(sx, sy) {
        this._transformStack.push(this._currentTransform.slice());
        const old = this._currentTransform;
        this._currentTransform = [
            old[0] * sx, old[1] * sx,
            old[2] * (sy !== undefined ? sy : sx), old[3] * (sy !== undefined ? sy : sx),
            old[4], old[5],
        ];
    },

    // Apply current transform to a point
    _tx(x, y) {
        const t = this._currentTransform;
        return [
            t[0] * x + t[2] * y + t[4],
            t[1] * x + t[3] * y + t[5],
        ];
    },

    // Get the current scale factor (for line widths, radii)
    _getScale() {
        const t = this._currentTransform;
        return Math.sqrt(t[0] * t[0] + t[1] * t[1]);
    },

    // ─── Alpha Stack ─────────────────────────────────────────
    setAlpha(a) {
        this._alphaStack.push(this._currentAlpha);
        this._currentAlpha *= a;
    },

    restoreAlpha() {
        if (this._alphaStack.length > 0) {
            this._currentAlpha = this._alphaStack.pop();
        }
    },

    // ─── Draw Primitives ─────────────────────────────────────

    fillRect(x, y, w, h, color) {
        this._addQuad(x, y, x + w, y, x + w, y + h, x, y + h, color);
    },

    strokeRect(x, y, w, h, color, lineWidth) {
        const lw = lineWidth || 1;
        // Top
        this.line(x, y, x + w, y, color, lw);
        // Right
        this.line(x + w, y, x + w, y + h, color, lw);
        // Bottom
        this.line(x + w, y + h, x, y + h, color, lw);
        // Left
        this.line(x, y + h, x, y, color, lw);
    },

    fillCircle(cx, cy, r, color) {
        this._addCircle(cx, cy, r, color, 0);
    },

    strokeCircle(cx, cy, r, color, lineWidth) {
        this._addCircle(cx, cy, r, color, lineWidth || 1);
    },

    fillArc(cx, cy, r, startAngle, endAngle, color) {
        // Approximate arc as filled triangle fan
        const segments = Math.max(8, Math.ceil(Math.abs(endAngle - startAngle) / (Math.PI / 8)));
        const step = (endAngle - startAngle) / segments;
        const [rgba] = [WB.GL.parseColor(color)];
        for (let i = 0; i < segments; i++) {
            const a1 = startAngle + i * step;
            const a2 = startAngle + (i + 1) * step;
            this.fillTriangle(
                cx, cy,
                cx + Math.cos(a1) * r, cy + Math.sin(a1) * r,
                cx + Math.cos(a2) * r, cy + Math.sin(a2) * r,
                color
            );
        }
    },

    line(x1, y1, x2, y2, color, width) {
        // Render thick line as a quad
        const lw = (width || 1) * 0.5;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = (-dy / len) * lw;
        const ny = (dx / len) * lw;

        this._addQuad(
            x1 + nx, y1 + ny,
            x2 + nx, y2 + ny,
            x2 - nx, y2 - ny,
            x1 - nx, y1 - ny,
            color
        );
    },

    fillTriangle(x1, y1, x2, y2, x3, y3, color) {
        const rgba = WB.GL.parseColor(color);
        const alpha = this._currentAlpha * rgba[3];
        const [tx1, ty1] = this._tx(x1, y1);
        const [tx2, ty2] = this._tx(x2, y2);
        const [tx3, ty3] = this._tx(x3, y3);

        if (this._flatCount + 3 > this.MAX_FLAT_VERTS) this._flushFlat();

        const v = this._flatVerts;
        let o = this._flatCount * 6;
        v[o++] = tx1; v[o++] = ty1; v[o++] = rgba[0]; v[o++] = rgba[1]; v[o++] = rgba[2]; v[o++] = alpha;
        v[o++] = tx2; v[o++] = ty2; v[o++] = rgba[0]; v[o++] = rgba[1]; v[o++] = rgba[2]; v[o++] = alpha;
        v[o++] = tx3; v[o++] = ty3; v[o++] = rgba[0]; v[o++] = rgba[1]; v[o++] = rgba[2]; v[o++] = alpha;
        this._flatCount += 3;
    },

    fillPolygon(points, color) {
        // Simple ear-clipping for convex and mildly concave polygons
        if (points.length < 3) return;
        // Triangle fan from first vertex (works for convex)
        for (let i = 1; i < points.length - 1; i++) {
            this.fillTriangle(
                points[0][0], points[0][1],
                points[i][0], points[i][1],
                points[i + 1][0], points[i + 1][1],
                color
            );
        }
    },

    strokePolygon(points, color, lineWidth) {
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            this.line(points[i][0], points[i][1], points[j][0], points[j][1], color, lineWidth);
        }
    },

    // Quadratic bezier curve as line segments
    drawQuadratic(x0, y0, cpx, cpy, x1, y1, color, width) {
        const segs = 8;
        let px = x0, py = y0;
        for (let i = 1; i <= segs; i++) {
            const t = i / segs;
            const t1 = 1 - t;
            const nx = t1 * t1 * x0 + 2 * t1 * t * cpx + t * t * x1;
            const ny = t1 * t1 * y0 + 2 * t1 * t * cpy + t * t * y1;
            this.line(px, py, nx, ny, color, width);
            px = nx;
            py = ny;
        }
    },

    // Cubic bezier curve as line segments
    drawBezier(x0, y0, cp1x, cp1y, cp2x, cp2y, x1, y1, color, width) {
        const segs = 12;
        let px = x0, py = y0;
        for (let i = 1; i <= segs; i++) {
            const t = i / segs;
            const t1 = 1 - t;
            const nx = t1*t1*t1*x0 + 3*t1*t1*t*cp1x + 3*t1*t*t*cp2x + t*t*t*x1;
            const ny = t1*t1*t1*y0 + 3*t1*t1*t*cp1y + 3*t1*t*t*cp2y + t*t*t*y1;
            this.line(px, py, nx, ny, color, width);
            px = nx;
            py = ny;
        }
    },

    // Filled quadratic bezier (like Canvas closePath + fill)
    fillQuadratic(x0, y0, cpx, cpy, x1, y1, color) {
        const segs = 8;
        const points = [[x0, y0]];
        for (let i = 1; i <= segs; i++) {
            const t = i / segs;
            const t1 = 1 - t;
            points.push([
                t1 * t1 * x0 + 2 * t1 * t * cpx + t * t * x1,
                t1 * t1 * y0 + 2 * t1 * t * cpy + t * t * y1,
            ]);
        }
        this.fillPolygon(points, color);
    },

    // Filled cubic bezier
    fillBezier(x0, y0, cp1x, cp1y, cp2x, cp2y, x1, y1, color) {
        const segs = 12;
        const points = [[x0, y0]];
        for (let i = 1; i <= segs; i++) {
            const t = i / segs;
            const t1 = 1 - t;
            points.push([
                t1*t1*t1*x0 + 3*t1*t1*t*cp1x + 3*t1*t*t*cp2x + t*t*t*x1,
                t1*t1*t1*y0 + 3*t1*t1*t*cp1y + 3*t1*t*t*cp2y + t*t*t*y1,
            ]);
        }
        this.fillPolygon(points, color);
    },

    // ─── Glow/Shadow helpers ─────────────────────────────────
    fillCircleGlow(cx, cy, r, color, blur) {
        // Draw larger, faded circle behind for glow effect
        const rgba = WB.GL.parseColor(color);
        const glowColor = `rgba(${Math.round(rgba[0]*255)},${Math.round(rgba[1]*255)},${Math.round(rgba[2]*255)},${rgba[3] * 0.3})`;
        this.fillCircle(cx, cy, r + blur * 0.5, glowColor);
    },

    strokeCircleGlow(cx, cy, r, color, lineWidth, blur) {
        const rgba = WB.GL.parseColor(color);
        const glowColor = `rgba(${Math.round(rgba[0]*255)},${Math.round(rgba[1]*255)},${Math.round(rgba[2]*255)},${rgba[3] * 0.3})`;
        this.strokeCircle(cx, cy, r + blur * 0.3, glowColor, lineWidth + blur * 0.5);
    },

    // ─── Additive blending mode for glow ─────────────────────
    setAdditiveBlend() {
        this.flush();
        const gl = this.gl;
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    },

    setNormalBlend() {
        this.flush();
        const gl = this.gl;
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    },

    // ─── Internal: Add quad as 2 triangles ───────────────────
    _addQuad(x1, y1, x2, y2, x3, y3, x4, y4, color) {
        const rgba = WB.GL.parseColor(color);
        const alpha = this._currentAlpha * rgba[3];
        const [tx1, ty1] = this._tx(x1, y1);
        const [tx2, ty2] = this._tx(x2, y2);
        const [tx3, ty3] = this._tx(x3, y3);
        const [tx4, ty4] = this._tx(x4, y4);

        if (this._flatCount + 6 > this.MAX_FLAT_VERTS) this._flushFlat();

        const v = this._flatVerts;
        let o = this._flatCount * 6;
        const r = rgba[0], g = rgba[1], b = rgba[2];
        // Triangle 1
        v[o++] = tx1; v[o++] = ty1; v[o++] = r; v[o++] = g; v[o++] = b; v[o++] = alpha;
        v[o++] = tx2; v[o++] = ty2; v[o++] = r; v[o++] = g; v[o++] = b; v[o++] = alpha;
        v[o++] = tx3; v[o++] = ty3; v[o++] = r; v[o++] = g; v[o++] = b; v[o++] = alpha;
        // Triangle 2
        v[o++] = tx1; v[o++] = ty1; v[o++] = r; v[o++] = g; v[o++] = b; v[o++] = alpha;
        v[o++] = tx3; v[o++] = ty3; v[o++] = r; v[o++] = g; v[o++] = b; v[o++] = alpha;
        v[o++] = tx4; v[o++] = ty4; v[o++] = r; v[o++] = g; v[o++] = b; v[o++] = alpha;
        this._flatCount += 6;
    },

    // ─── Internal: Add circle instance ───────────────────────
    _addCircle(cx, cy, r, color, lineWidth) {
        const rgba = WB.GL.parseColor(color);
        const alpha = this._currentAlpha * rgba[3];
        const [tcx, tcy] = this._tx(cx, cy);
        const scale = this._getScale();
        const sr = r * scale;

        if (this._circCount >= this.MAX_CIRC_INSTANCES) this._flushCirc();

        const v = this._circVerts;
        let o = this._circCount * 9;
        v[o++] = tcx; v[o++] = tcy; v[o++] = sr;
        v[o++] = rgba[0]; v[o++] = rgba[1]; v[o++] = rgba[2]; v[o++] = alpha;
        v[o++] = lineWidth * scale; v[o++] = 0; // unused
        this._circCount++;
    },

    // ─── Flush ───────────────────────────────────────────────
    flush() {
        this._flushFlat();
        this._flushCirc();
    },

    _flushFlat() {
        if (this._flatCount === 0) return;
        const gl = this.gl;
        const prog = WB.GL.programs.flat;

        gl.useProgram(prog);
        gl.uniformMatrix3fv(prog._unis.u_proj, false, WB.GL.projMatrix);

        gl.bindVertexArray(this._flatVAO);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._flatBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this._flatVerts.subarray(0, this._flatCount * 6));
        gl.drawArrays(gl.TRIANGLES, 0, this._flatCount);
        gl.bindVertexArray(null);

        this._flatCount = 0;
    },

    _flushCirc() {
        if (this._circCount === 0) return;
        const gl = this.gl;
        const prog = WB.GL.programs.circle;

        gl.useProgram(prog);
        gl.uniformMatrix3fv(prog._unis.u_proj, false, WB.GL.projMatrix);
        // Pass time for 3D lighting shimmer
        if (prog._unis.u_time !== undefined) {
            gl.uniform1f(prog._unis.u_time, WB.GL._deform.time);
        }

        gl.bindVertexArray(this._circVAO);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._circBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this._circVerts.subarray(0, this._circCount * 9));
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this._circCount);
        gl.bindVertexArray(null);

        this._circCount = 0;
    },
};
