// ─── Flag Position Editor ──────────────────────────────────────────
// Standalone Canvas 2D editor for adjusting per-state flag position,
// scale, and rotation. Writes to localStorage key 'wb_flag_config'
// which is read by WB.BallImages at game init.
// ───────────────────────────────────────────────────────────────────

(function() {
    'use strict';

    var STORAGE_KEY = 'wb_flag_config';
    var PREVIEW_R = 120;         // preview ball radius (px)
    var CX = 150, CY = 150;     // center of 300x300 canvas

    var canvas, ctx;
    var stateTypes = [];
    var selectedType = null;
    var flagImages = {};         // type -> HTMLImageElement
    var config = {};             // type -> { ox, oy, scale, rot }

    // Drag state
    var dragging = false;
    var dragStartX = 0, dragStartY = 0;
    var dragStartOx = 0, dragStartOy = 0;

    // DOM refs
    var scaleSlider, rotSlider, scaleVal, rotVal, offsetReadout, solidBtn;

    // ─── Init ──────────────────────────────────────────────

    function init() {
        canvas = document.getElementById('previewCanvas');
        ctx = canvas.getContext('2d');
        scaleSlider = document.getElementById('scaleSlider');
        rotSlider = document.getElementById('rotSlider');
        scaleVal = document.getElementById('scaleVal');
        rotVal = document.getElementById('rotVal');
        offsetReadout = document.getElementById('offsetReadout');
        solidBtn = document.getElementById('btnSolid');

        loadConfig();
        loadStateTypes();
        loadAllFlags();
        buildGrid();
        bindEvents();

        // Select first state
        if (stateTypes.length > 0) selectState(stateTypes[0]);
    }

    function loadConfig() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (raw) config = JSON.parse(raw);
            else config = {};
        } catch (e) { config = {}; }
    }

    function saveConfig() {
        try {
            // Remove default entries to keep storage clean
            var clean = {};
            for (var k in config) {
                var c = config[k];
                if (c.ox !== 0 || c.oy !== 0 || c.scale !== 1.0 || c.rot !== 0 || c.solid) {
                    clean[k] = c;
                }
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
        } catch (e) { /* storage full */ }
        updateGridIndicators();
    }

    function getTransform(type) {
        var c = config[type];
        if (!c) return { ox: 0, oy: 0, scale: 1.0, rot: 0 };
        return {
            ox: c.ox || 0,
            oy: c.oy || 0,
            scale: c.scale || 1.0,
            rot: c.rot || 0
        };
    }

    // ─── State types ───────────────────────────────────────

    function loadStateTypes() {
        if (WB.WeaponRegistry) {
            stateTypes = WB.WeaponRegistry.getTypes('states') || [];
        }
        if (stateTypes.length === 0) {
            // Fallback: just list known ones from config COLORS
            var colors = WB.Config && WB.Config.COLORS || {};
            for (var k in colors) {
                if (k.length > 1) stateTypes.push(k);
            }
        }
    }

    function loadAllFlags() {
        for (var i = 0; i < stateTypes.length; i++) {
            (function(type) {
                var img = new Image();
                img.onload = function() {
                    flagImages[type] = img;
                    // Redraw if this is selected
                    if (selectedType === type) draw();
                    // Update grid thumbnail
                    var el = document.getElementById('flag-' + type);
                    if (el) {
                        var thumb = el.querySelector('img');
                        if (thumb) thumb.src = img.src;
                    }
                };
                img.src = 'assets/flags/' + type + '.png';
            })(stateTypes[i]);
        }
    }

    // ─── Grid ──────────────────────────────────────────────

    function buildGrid() {
        var grid = document.getElementById('grid');
        // Clear children safely
        while (grid.firstChild) grid.removeChild(grid.firstChild);

        for (var i = 0; i < stateTypes.length; i++) {
            var type = stateTypes[i];
            var div = document.createElement('div');
            div.className = 'state-btn';
            div.id = 'flag-' + type;
            div.dataset.type = type;

            var img = document.createElement('img');
            img.src = 'assets/flags/' + type + '.png';
            img.alt = type;
            div.appendChild(img);

            var label = document.createElement('div');
            label.className = 'label';
            label.textContent = getDisplayName(type);
            div.appendChild(label);

            div.addEventListener('click', (function(t) {
                return function() { selectState(t); };
            })(type));

            grid.appendChild(div);
        }
        updateGridIndicators();
    }

    function updateGridIndicators() {
        for (var i = 0; i < stateTypes.length; i++) {
            var type = stateTypes[i];
            var el = document.getElementById('flag-' + type);
            if (!el) continue;
            var c = config[type];
            var isEdited = c && (c.ox !== 0 || c.oy !== 0 || c.scale !== 1.0 || c.rot !== 0 || c.solid);
            if (isEdited) {
                el.classList.add('edited');
            } else {
                el.classList.remove('edited');
            }
        }
    }

    function getDisplayName(type) {
        if (WB.Config && WB.Config.WEAPON_NAMES && WB.Config.WEAPON_NAMES[type]) {
            return WB.Config.WEAPON_NAMES[type];
        }
        // Fallback: capitalize
        return type.split('-').map(function(w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ');
    }

    // ─── Selection ─────────────────────────────────────────

    function selectState(type) {
        selectedType = type;

        // Highlight grid
        var btns = document.querySelectorAll('.state-btn');
        for (var i = 0; i < btns.length; i++) {
            if (btns[i].dataset.type === type) {
                btns[i].classList.add('selected');
            } else {
                btns[i].classList.remove('selected');
            }
        }

        // Update name
        var color = (WB.Config && WB.Config.COLORS && WB.Config.COLORS[type]) || '#FFD700';
        document.getElementById('stateName').textContent = getDisplayName(type);
        document.getElementById('stateName').style.color = color;

        // Update sliders from config
        var tfm = getTransform(type);
        scaleSlider.value = tfm.scale;
        rotSlider.value = Math.round(tfm.rot * 180 / Math.PI);
        updateReadouts(tfm);

        // Update solid toggle
        var isSolid = config[type] && config[type].solid;
        if (solidBtn) {
            if (isSolid) solidBtn.classList.add('active');
            else solidBtn.classList.remove('active');
        }

        draw();
    }

    function updateReadouts(tfm) {
        scaleVal.textContent = tfm.scale.toFixed(2);
        rotVal.textContent = Math.round(tfm.rot * 180 / Math.PI) + '\u00B0';
        offsetReadout.textContent = 'offset: ' + tfm.ox.toFixed(3) + ', ' + tfm.oy.toFixed(3);
    }

    // ─── Preview Drawing ───────────────────────────────────

    function draw() {
        if (!selectedType) return;
        var tfm = getTransform(selectedType);
        var color = (WB.Config && WB.Config.COLORS && WB.Config.COLORS[selectedType]) || '#888';

        ctx.clearRect(0, 0, 300, 300);

        // Dark background
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, 300, 300);

        // Crosshair (behind everything)
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(CX - PREVIEW_R, CY);
        ctx.lineTo(CX + PREVIEW_R, CY);
        ctx.moveTo(CX, CY - PREVIEW_R);
        ctx.lineTo(CX, CY + PREVIEW_R);
        ctx.stroke();

        // Ball fill (state color)
        ctx.beginPath();
        ctx.arc(CX, CY, PREVIEW_R, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Flag image with transforms (clipped to ball circle) — skip if solid mode
        var isSolid = config[selectedType] && config[selectedType].solid;
        var img = flagImages[selectedType];
        if (!isSolid && img && img.complete && img.naturalWidth > 0) {
            ctx.save();
            // Clip to circle
            ctx.beginPath();
            ctx.arc(CX, CY, PREVIEW_R - 2, 0, Math.PI * 2);
            ctx.clip();

            // The shader does: center UV -> rotate -> scale(divide) -> offset -> restore
            // Canvas 2D equivalent (reverse order of ctx calls):
            ctx.translate(CX, CY);
            ctx.rotate(-tfm.rot);
            ctx.scale(tfm.scale, tfm.scale);
            ctx.translate(-tfm.ox * PREVIEW_R * 2, -tfm.oy * PREVIEW_R * 2);

            // Draw image to fill ball diameter (scale-to-fill, same as _createFlagTexture)
            var imgScale = Math.max(PREVIEW_R * 2 / img.width, PREVIEW_R * 2 / img.height);
            var sw = img.width * imgScale;
            var sh = img.height * imgScale;
            ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh);

            ctx.restore();
        }

        // Ball outline
        ctx.beginPath();
        ctx.arc(CX, CY, PREVIEW_R, 0, Math.PI * 2);
        ctx.strokeStyle = '#eee';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Center dot
        ctx.beginPath();
        ctx.arc(CX, CY, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fill();
    }

    // ─── Events ────────────────────────────────────────────

    function bindEvents() {
        // Drag on canvas
        canvas.addEventListener('mousedown', function(e) {
            if (!selectedType) return;
            dragging = true;
            canvas.classList.add('dragging');
            var rect = canvas.getBoundingClientRect();
            dragStartX = e.clientX - rect.left;
            dragStartY = e.clientY - rect.top;
            var tfm = getTransform(selectedType);
            dragStartOx = tfm.ox;
            dragStartOy = tfm.oy;
            e.preventDefault();
        });

        document.addEventListener('mousemove', function(e) {
            if (!dragging || !selectedType) return;
            var rect = canvas.getBoundingClientRect();
            var mx = e.clientX - rect.left;
            var my = e.clientY - rect.top;
            var dx = mx - dragStartX;
            var dy = my - dragStartY;
            // Convert pixel delta to UV offset delta
            // Shader uv += offset shifts sampling, so visual is inverted: negate
            var canvasScale = 300 / rect.width; // account for CSS vs canvas pixel ratio
            var uvDx = -(dx * canvasScale) / (PREVIEW_R * 2);
            var uvDy = -(dy * canvasScale) / (PREVIEW_R * 2);
            setTransform(selectedType, {
                ox: clamp(dragStartOx + uvDx, -0.5, 0.5),
                oy: clamp(dragStartOy + uvDy, -0.5, 0.5)
            });
        });

        document.addEventListener('mouseup', function() {
            if (dragging) {
                dragging = false;
                canvas.classList.remove('dragging');
                saveConfig();
            }
        });

        // Touch support
        canvas.addEventListener('touchstart', function(e) {
            if (!selectedType || e.touches.length !== 1) return;
            dragging = true;
            var rect = canvas.getBoundingClientRect();
            var touch = e.touches[0];
            dragStartX = touch.clientX - rect.left;
            dragStartY = touch.clientY - rect.top;
            var tfm = getTransform(selectedType);
            dragStartOx = tfm.ox;
            dragStartOy = tfm.oy;
            e.preventDefault();
        }, { passive: false });

        document.addEventListener('touchmove', function(e) {
            if (!dragging || !selectedType || e.touches.length !== 1) return;
            var rect = canvas.getBoundingClientRect();
            var touch = e.touches[0];
            var mx = touch.clientX - rect.left;
            var my = touch.clientY - rect.top;
            var dx = mx - dragStartX;
            var dy = my - dragStartY;
            var canvasScale = 300 / rect.width;
            var uvDx = -(dx * canvasScale) / (PREVIEW_R * 2);
            var uvDy = -(dy * canvasScale) / (PREVIEW_R * 2);
            setTransform(selectedType, {
                ox: clamp(dragStartOx + uvDx, -0.5, 0.5),
                oy: clamp(dragStartOy + uvDy, -0.5, 0.5)
            });
            e.preventDefault();
        }, { passive: false });

        document.addEventListener('touchend', function() {
            if (dragging) {
                dragging = false;
                canvas.classList.remove('dragging');
                saveConfig();
            }
        });

        // Scroll wheel on canvas -> scale
        canvas.addEventListener('wheel', function(e) {
            if (!selectedType) return;
            e.preventDefault();
            var tfm = getTransform(selectedType);
            var delta = e.deltaY > 0 ? -0.05 : 0.05;
            var newScale = clamp(tfm.scale + delta, 0.5, 3.0);
            setTransform(selectedType, { scale: newScale });
            scaleSlider.value = newScale;
            saveConfig();
        }, { passive: false });

        // Sliders
        scaleSlider.addEventListener('input', function() {
            if (!selectedType) return;
            setTransform(selectedType, { scale: parseFloat(scaleSlider.value) });
            saveConfig();
        });

        rotSlider.addEventListener('input', function() {
            if (!selectedType) return;
            var deg = parseFloat(rotSlider.value);
            setTransform(selectedType, { rot: deg * Math.PI / 180 });
            saveConfig();
        });

        // Solid color toggle
        document.getElementById('btnSolid').addEventListener('click', function() {
            if (!selectedType) return;
            if (!config[selectedType]) {
                config[selectedType] = { ox: 0, oy: 0, scale: 1.0, rot: 0 };
            }
            config[selectedType].solid = !config[selectedType].solid;
            if (solidBtn) {
                if (config[selectedType].solid) solidBtn.classList.add('active');
                else solidBtn.classList.remove('active');
            }
            draw();
            saveConfig();
        });

        // Buttons
        document.getElementById('btnReset').addEventListener('click', function() {
            if (!selectedType) return;
            delete config[selectedType];
            scaleSlider.value = 1.0;
            rotSlider.value = 0;
            updateReadouts({ ox: 0, oy: 0, scale: 1.0, rot: 0 });
            if (solidBtn) solidBtn.classList.remove('active');
            draw();
            saveConfig();
        });

        document.getElementById('btnResetAll').addEventListener('click', function() {
            if (!confirm('Reset ALL flag positions to defaults?')) return;
            config = {};
            scaleSlider.value = 1.0;
            rotSlider.value = 0;
            if (solidBtn) solidBtn.classList.remove('active');
            updateReadouts({ ox: 0, oy: 0, scale: 1.0, rot: 0 });
            draw();
            saveConfig();
        });

        document.getElementById('btnExport').addEventListener('click', function() {
            var json = JSON.stringify(config, null, 2);
            navigator.clipboard.writeText(json).then(function() {
                var btn = document.getElementById('btnExport');
                btn.textContent = 'COPIED!';
                setTimeout(function() { btn.textContent = 'COPY JSON'; }, 1500);
            }).catch(function() {
                // Fallback: show in prompt
                prompt('Flag config JSON:', json);
            });
        });
    }

    // ─── Helpers ────────────────────────────────────────────

    function setTransform(type, partial) {
        if (!config[type]) {
            config[type] = { ox: 0, oy: 0, scale: 1.0, rot: 0 };
        }
        for (var k in partial) {
            config[type][k] = partial[k];
        }
        var tfm = getTransform(type);
        updateReadouts(tfm);
        draw();
    }

    function clamp(v, min, max) {
        return v < min ? min : v > max ? max : v;
    }

    // ─── Boot ──────────────────────────────────────────────

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
