window.WB = window.WB || {};

// ─── WebGL2 Context & Shader Management ───────────────────────
WB.GL = {
    gl: null,
    canvas: null,
    width: 0,
    height: 0,
    programs: {},      // compiled shader programs
    projMatrix: null,  // Float32Array(9) for 3x3 ortho projection
    // Post-processing
    _fbo: null,
    _fboTexture: null,
    _ppQuadVAO: null,
    _ppQuadVBO: null,
    // Deformation parameters
    _deform: {
        chromaticAberration: 0,  // 0-1 intensity
        shockwaves: [],          // [{x, y, time, intensity, speed}]
        barrelDistort: 0,        // 0-1 intensity
        time: 0,
    },

    init(canvas) {
        this.canvas = canvas;
        this.width = canvas.width;
        this.height = canvas.height;
        const gl = canvas.getContext('webgl2', {
            alpha: false,
            antialias: true,
            premultipliedAlpha: false,
        });
        if (!gl) {
            console.error('WebGL2 not supported');
            return false;
        }
        this.gl = gl;

        // Enable blending
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // Compile shader programs
        this._compilePrograms();

        // Build orthographic projection (maps pixel coords → clip space)
        // x: [0, width] → [-1, 1]
        // y: [0, height] → [1, -1]  (flipped so y-down like Canvas 2D)
        this.projMatrix = new Float32Array([
            2 / this.width,  0,                0,
            0,              -2 / this.height,  0,
            -1,              1,                1,
        ]);

        // Init subsystems
        WB.GLBatch.init(gl);
        WB.GLText.init(gl);
        WB.GLEffects.init();

        // Init post-processing FBO
        this._initPostProcess(gl);

        return true;
    },

    _initPostProcess(gl) {
        // Create FBO texture
        this._fboTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this._fboTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // Create FBO
        this._fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this._fboTexture, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null);

        // Create fullscreen quad VAO for post-process pass
        const quadVerts = new Float32Array([
            -1, -1,  0, 0,
             1, -1,  1, 0,
            -1,  1,  0, 1,
             1,  1,  1, 1,
        ]);
        this._ppQuadVAO = gl.createVertexArray();
        this._ppQuadVBO = gl.createBuffer();
        gl.bindVertexArray(this._ppQuadVAO);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._ppQuadVBO);
        gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);
        // a_pos
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
        // a_uv
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
        gl.bindVertexArray(null);
    },

    beginFrame() {
        const gl = this.gl;
        this._deform.time += 1 / 60;

        // Render to FBO
        gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo);
        gl.viewport(0, 0, this.width, this.height);
        gl.clearColor(1, 0.973, 0.906, 1); // #FFF8E7
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Reset batch state
        WB.GLBatch.resetFrame();
        WB.GLEffects.resetFrame();
    },

    endFrame() {
        const gl = this.gl;
        WB.GLBatch.flush();

        // Switch to default framebuffer and draw post-processed result
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.width, this.height);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Check if any deformation is active
        const d = this._deform;
        const hasDeform = d.chromaticAberration > 0.001 || d.shockwaves.length > 0 || d.barrelDistort > 0.001;

        const prog = this.programs.postProcess;
        gl.useProgram(prog);

        // Bind scene texture
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this._fboTexture);
        gl.uniform1i(prog._unis['u_scene'], 2);

        // Uniforms
        gl.uniform1f(prog._unis['u_time'], d.time);
        gl.uniform2f(prog._unis['u_resolution'], this.width, this.height);
        gl.uniform1f(prog._unis['u_chromatic'], d.chromaticAberration);
        gl.uniform1f(prog._unis['u_barrel'], d.barrelDistort);

        // Shockwave data (max 4 active)
        const maxShocks = 4;
        const shockData = new Float32Array(maxShocks * 4); // x, y, time, intensity
        const count = Math.min(d.shockwaves.length, maxShocks);
        for (let i = 0; i < count; i++) {
            const sw = d.shockwaves[i];
            shockData[i * 4 + 0] = sw.x / this.width;
            shockData[i * 4 + 1] = 1.0 - sw.y / this.height; // flip Y
            shockData[i * 4 + 2] = sw.time;
            shockData[i * 4 + 3] = sw.intensity;
        }
        gl.uniform1i(prog._unis['u_shockCount'], count);
        gl.uniform4fv(prog._unis['u_shockwaves[0]'], shockData);

        // Draw fullscreen quad
        gl.bindVertexArray(this._ppQuadVAO);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);

        // Decay deformation params
        d.chromaticAberration *= 0.92;
        d.barrelDistort *= 0.9;

        // Update and prune shockwaves
        for (let i = d.shockwaves.length - 1; i >= 0; i--) {
            d.shockwaves[i].time += d.shockwaves[i].speed;
            d.shockwaves[i].intensity *= 0.94;
            if (d.shockwaves[i].intensity < 0.005 || d.shockwaves[i].time > 2.0) {
                d.shockwaves.splice(i, 1);
            }
        }
    },

    // ─── Deformation API ──────────────────────────────────
    triggerChromaticAberration(intensity) {
        this._deform.chromaticAberration = Math.max(this._deform.chromaticAberration, intensity || 0.5);
    },

    triggerShockwave(x, y, intensity, speed) {
        if (this._deform.shockwaves.length >= 4) return; // max 4 concurrent
        this._deform.shockwaves.push({
            x: x, y: y,
            time: 0,
            intensity: intensity || 0.3,
            speed: speed || 0.04,
        });
    },

    triggerBarrelDistort(intensity) {
        this._deform.barrelDistort = Math.max(this._deform.barrelDistort, intensity || 0.3);
    },

    // ─── Shader Compilation ─────────────────────────────────
    _compilePrograms() {
        const gl = this.gl;

        // 1. Flat color shader (rects, triangles, polygons)
        this.programs.flat = this._createProgram(
            // Vertex
            `#version 300 es
            in vec2 a_pos;
            in vec4 a_color;
            uniform mat3 u_proj;
            out vec4 v_color;
            void main() {
                vec3 p = u_proj * vec3(a_pos, 1.0);
                gl_Position = vec4(p.xy, 0.0, 1.0);
                v_color = a_color;
            }`,
            // Fragment
            `#version 300 es
            precision mediump float;
            in vec4 v_color;
            out vec4 fragColor;
            void main() {
                fragColor = v_color;
            }`
        );

        // 2. Circle SDF shader — 3D sphere lighting for filled circles
        this.programs.circle = this._createProgram(
            // Vertex
            `#version 300 es
            in vec2 a_pos;       // quad vertex [-1,1]
            in vec3 a_center;    // circle center x,y and radius
            in vec4 a_color;
            in vec2 a_params;    // lineWidth (0=filled), startAngle (for arcs, unused if full)
            uniform mat3 u_proj;
            out vec2 v_uv;
            out vec4 v_color;
            out float v_radius;
            out float v_lineWidth;
            void main() {
                v_uv = a_pos;
                v_color = a_color;
                v_radius = a_center.z;
                v_lineWidth = a_params.x;
                // Expand quad to world space
                vec2 worldPos = a_center.xy + a_pos * (a_center.z + 1.5);
                vec3 p = u_proj * vec3(worldPos, 1.0);
                gl_Position = vec4(p.xy, 0.0, 1.0);
            }`,
            // Fragment — 3D sphere shading for filled circles
            `#version 300 es
            precision mediump float;
            in vec2 v_uv;
            in vec4 v_color;
            in float v_radius;
            in float v_lineWidth;
            uniform float u_time;
            out vec4 fragColor;

            void main() {
                float dist = length(v_uv) * (v_radius + 1.5);
                float aa = 1.0;

                if (v_lineWidth > 0.0) {
                    // Ring/stroke — stays flat, no 3D shading
                    float inner = v_radius - v_lineWidth;
                    float outer = v_radius;
                    float alpha = smoothstep(outer + aa, outer - aa * 0.5, dist)
                                * smoothstep(inner - aa, inner + aa * 0.5, dist);
                    fragColor = vec4(v_color.rgb, v_color.a * alpha);
                } else {
                    // Filled circle — 3D sphere lighting!
                    float alpha = smoothstep(v_radius + aa, v_radius - aa * 0.5, dist);

                    // Only apply 3D shading to balls large enough (r > 12px)
                    // Small circles (particles, dots) stay flat
                    if (v_radius > 12.0 && alpha > 0.0) {
                        // Normalized position within circle [-1, 1]
                        vec2 nPos = v_uv * (v_radius + 1.5) / v_radius;
                        float r2 = dot(nPos, nPos);

                        if (r2 < 1.0) {
                            // Compute sphere normal
                            vec3 normal = vec3(nPos, sqrt(1.0 - r2));

                            // Light direction (top-left, slightly forward)
                            vec3 lightDir = normalize(vec3(-0.4, -0.6, 0.7));
                            // Secondary fill light (bottom-right)
                            vec3 fillLight = normalize(vec3(0.3, 0.4, 0.5));

                            // Diffuse lighting
                            float diffuse = max(dot(normal, lightDir), 0.0);
                            float fillDiffuse = max(dot(normal, fillLight), 0.0) * 0.3;

                            // Specular (Blinn-Phong)
                            vec3 viewDir = vec3(0.0, 0.0, 1.0);
                            vec3 halfDir = normalize(lightDir + viewDir);
                            float spec = pow(max(dot(normal, halfDir), 0.0), 32.0);

                            // Rim/Fresnel glow — bright edge highlight
                            float rim = 1.0 - normal.z;
                            rim = pow(rim, 3.0) * 0.4;

                            // Ambient occlusion at edges
                            float ao = smoothstep(0.0, 0.3, normal.z);

                            // Combine lighting
                            vec3 baseColor = v_color.rgb;
                            float ambient = 0.35;
                            vec3 litColor = baseColor * (ambient + diffuse * 0.55 + fillDiffuse);
                            litColor += vec3(1.0) * spec * 0.6; // white specular
                            litColor += baseColor * rim;          // colored rim
                            litColor *= ao;

                            // Subtle environment reflection shimmer
                            float shimmer = sin(u_time * 0.8 + nPos.x * 3.0) * 0.02 + 0.02;
                            litColor += vec3(shimmer);

                            fragColor = vec4(litColor, v_color.a * alpha);
                        } else {
                            fragColor = vec4(v_color.rgb, v_color.a * alpha);
                        }
                    } else {
                        fragColor = vec4(v_color.rgb, v_color.a * alpha);
                    }
                }
            }`
        );

        // 3. Post-processing shader (screen deformation)
        this.programs.postProcess = this._createProgram(
            // Vertex — fullscreen quad
            `#version 300 es
            layout(location=0) in vec2 a_pos;
            layout(location=1) in vec2 a_uv;
            out vec2 v_uv;
            void main() {
                gl_Position = vec4(a_pos, 0.0, 1.0);
                v_uv = a_uv;
            }`,
            // Fragment — chromatic aberration + shockwave + barrel distortion
            `#version 300 es
            precision highp float;
            in vec2 v_uv;
            uniform sampler2D u_scene;
            uniform float u_time;
            uniform vec2 u_resolution;
            uniform float u_chromatic;
            uniform float u_barrel;
            uniform int u_shockCount;
            uniform vec4 u_shockwaves[4]; // xy=center, z=time, w=intensity
            out vec4 fragColor;

            vec2 barrelDistort(vec2 uv, float amt) {
                vec2 cc = uv - 0.5;
                float dist = dot(cc, cc);
                return uv + cc * dist * amt;
            }

            void main() {
                vec2 uv = v_uv;

                // Barrel distortion
                if (u_barrel > 0.001) {
                    uv = barrelDistort(uv, u_barrel * 0.5);
                }

                // Shockwave distortion
                for (int i = 0; i < 4; i++) {
                    if (i >= u_shockCount) break;
                    vec2 center = u_shockwaves[i].xy;
                    float t = u_shockwaves[i].z;
                    float intensity = u_shockwaves[i].w;

                    vec2 toPixel = uv - center;
                    // Correct for aspect ratio
                    toPixel.x *= u_resolution.x / u_resolution.y;
                    float dist = length(toPixel);

                    // Ring of distortion expanding outward
                    float ringRadius = t * 0.8;
                    float ringWidth = 0.08 + t * 0.04;
                    float ring = smoothstep(ringRadius - ringWidth, ringRadius, dist)
                               * smoothstep(ringRadius + ringWidth, ringRadius, dist);

                    // Displace UVs along direction from center
                    vec2 dir = normalize(toPixel + 0.0001);
                    dir.x /= u_resolution.x / u_resolution.y; // un-correct aspect
                    uv += dir * ring * intensity * 0.04;
                }

                // Chromatic aberration
                if (u_chromatic > 0.001) {
                    vec2 cc = uv - 0.5;
                    float aberr = u_chromatic * 0.008;
                    float r = texture(u_scene, uv + cc * aberr).r;
                    float g = texture(u_scene, uv).g;
                    float b = texture(u_scene, uv - cc * aberr).b;
                    fragColor = vec4(r, g, b, 1.0);
                } else {
                    fragColor = texture(u_scene, uv);
                }
            }`
        );

        // 4. Textured quad shader (for font atlas)
        this.programs.text = this._createProgram(
            // Vertex
            `#version 300 es
            in vec2 a_pos;
            in vec2 a_uv;
            in vec4 a_color;
            uniform mat3 u_proj;
            out vec2 v_uv;
            out vec4 v_color;
            void main() {
                vec3 p = u_proj * vec3(a_pos, 1.0);
                gl_Position = vec4(p.xy, 0.0, 1.0);
                v_uv = a_uv;
                v_color = a_color;
            }`,
            // Fragment
            `#version 300 es
            precision mediump float;
            in vec2 v_uv;
            in vec4 v_color;
            uniform sampler2D u_texture;
            out vec4 fragColor;
            void main() {
                float a = texture(u_texture, v_uv).r;
                fragColor = vec4(v_color.rgb, v_color.a * a);
            }`
        );
    },

    _createProgram(vsSrc, fsSrc) {
        const gl = this.gl;
        const vs = this._compileShader(gl.VERTEX_SHADER, vsSrc);
        const fs = this._compileShader(gl.FRAGMENT_SHADER, fsSrc);
        const prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(prog));
            return null;
        }
        // Cache attribute and uniform locations
        prog._attrs = {};
        prog._unis = {};
        const nAttrs = gl.getProgramParameter(prog, gl.ACTIVE_ATTRIBUTES);
        for (let i = 0; i < nAttrs; i++) {
            const info = gl.getActiveAttrib(prog, i);
            prog._attrs[info.name] = gl.getAttribLocation(prog, info.name);
        }
        const nUnis = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < nUnis; i++) {
            const info = gl.getActiveUniform(prog, i);
            prog._unis[info.name] = gl.getUniformLocation(prog, info.name);
        }
        return prog;
    },

    _compileShader(type, src) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
            return null;
        }
        return shader;
    },

    // ─── Color Parsing ───────────────────────────────────────
    // Cache parsed colors for performance
    _colorCache: {},

    parseColor(cssColor) {
        if (this._colorCache[cssColor]) return this._colorCache[cssColor];

        let r = 0, g = 0, b = 0, a = 1;

        if (cssColor.startsWith('#')) {
            const hex = cssColor.slice(1);
            if (hex.length === 3) {
                r = parseInt(hex[0] + hex[0], 16) / 255;
                g = parseInt(hex[1] + hex[1], 16) / 255;
                b = parseInt(hex[2] + hex[2], 16) / 255;
            } else if (hex.length === 6) {
                r = parseInt(hex.slice(0, 2), 16) / 255;
                g = parseInt(hex.slice(2, 4), 16) / 255;
                b = parseInt(hex.slice(4, 6), 16) / 255;
            }
        } else if (cssColor.startsWith('rgba')) {
            const m = cssColor.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\)/);
            if (m) {
                r = parseFloat(m[1]) / 255;
                g = parseFloat(m[2]) / 255;
                b = parseFloat(m[3]) / 255;
                a = m[4] !== undefined ? parseFloat(m[4]) : 1;
            }
        } else if (cssColor.startsWith('rgb')) {
            const m = cssColor.match(/rgb\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/);
            if (m) {
                r = parseFloat(m[1]) / 255;
                g = parseFloat(m[2]) / 255;
                b = parseFloat(m[3]) / 255;
            }
        }

        const result = [r, g, b, a];
        this._colorCache[cssColor] = result;
        return result;
    },
};
