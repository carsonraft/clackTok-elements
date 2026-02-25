// ─── Stage Physics Tuner ─────────────────────────────────────
// HTML overlay panel for tweaking per-preset physics values.
// Persists to localStorage so settings survive between sessions.

(function() {
    'use strict';

    var STORAGE_KEY = 'wb_stage_physics';

    // Default ranges for each tunable parameter
    var PARAMS = [
        { key: 'maxSpeed',        label: 'Max Speed',    min: 4,   max: 20,  step: 0.5, default: 14 },
        { key: 'wallRestitution', label: 'Wall Bounce',  min: 0.5, max: 1.5, step: 0.01, default: 1.12 },
        { key: 'gravity',         label: 'Gravity',      min: 0,   max: 0.4, step: 0.01, default: 0.15 },
        { key: 'ballRadius',      label: 'Ball Size',    min: 15,  max: 50,  step: 1,    default: 30 },
    ];

    var _panel = null;
    var _visible = false;
    var _savedData = {};

    function _load() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (raw) _savedData = JSON.parse(raw);
        } catch(e) { _savedData = {}; }
    }

    function _save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(_savedData));
        } catch(e) {}
    }

    // Get the effective value for a param on the current preset
    function _getValue(presetLabel, paramKey) {
        // User override first
        if (_savedData[presetLabel] && _savedData[presetLabel][paramKey] !== undefined) {
            return _savedData[presetLabel][paramKey];
        }
        // Then preset-defined value
        var preset = WB.Config.STAGE_PRESETS[WB.Config.STAGE_SIZE_INDEX];
        if (preset[paramKey] !== undefined) return preset[paramKey];
        // Then global default
        for (var i = 0; i < PARAMS.length; i++) {
            if (PARAMS[i].key === paramKey) return PARAMS[i].default;
        }
        return 0;
    }

    // Get all overrides for a preset (merged: preset defaults + user overrides)
    function getOverrides(presetLabel) {
        var result = {};
        for (var i = 0; i < PARAMS.length; i++) {
            result[PARAMS[i].key] = _getValue(presetLabel, PARAMS[i].key);
        }
        return result;
    }

    // Helper: create element with styles
    function _el(tag, styles, text) {
        var e = document.createElement(tag);
        if (styles) e.style.cssText = styles;
        if (text !== undefined) e.textContent = text;
        return e;
    }

    function _createPanel() {
        if (_panel) return;

        _panel = _el('div', [
            'position:fixed',
            'z-index:9999',
            'background:#2A2520',
            'border:2px solid #8B7355',
            'border-radius:10px',
            'padding:16px 20px 12px',
            'min-width:280px',
            'max-width:340px',
            'font-family:"Courier New",monospace',
            'color:#E8E0D0',
            'box-shadow:0 8px 32px rgba(0,0,0,0.6)',
            'display:none',
            'user-select:none',
        ].join(';'));
        _panel.id = 'stageTunerPanel';

        // Close if clicking outside
        document.addEventListener('mousedown', function(e) {
            if (_visible && _panel && !_panel.contains(e.target)) {
                hide();
            }
        });

        document.body.appendChild(_panel);
    }

    function _buildContent() {
        var preset = WB.Config.STAGE_PRESETS[WB.Config.STAGE_SIZE_INDEX];
        var label = preset.label;

        // Clear panel
        _panel.textContent = '';

        // Header row
        var header = _el('div', 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px');
        header.appendChild(_el('span', 'font-weight:bold;font-size:14px;color:#D4A853', 'TUNE: ' + label));
        var resetBtn = _el('span', 'font-size:11px;color:#999;cursor:pointer;padding:2px 8px;border:1px solid #555;border-radius:4px', 'RESET');
        resetBtn.addEventListener('click', function() {
            delete _savedData[label];
            _save();
            _buildContent();
        });
        header.appendChild(resetBtn);
        _panel.appendChild(header);

        // Size display
        var sizeInfo = _el('div', 'font-size:11px;color:#888;margin-bottom:10px', 'Arena: ' + preset.width + ' x ' + preset.height + 'px');
        _panel.appendChild(sizeInfo);

        // Build a slider for each parameter
        for (var i = 0; i < PARAMS.length; i++) {
            (function(p) {
                var val = _getValue(label, p.key);
                var isDefault = (!_savedData[label] || _savedData[label][p.key] === undefined);

                var row = _el('div', 'margin-bottom:10px');

                // Label row
                var labelRow = _el('div', 'display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px');
                labelRow.appendChild(_el('span', 'color:#C8B8A0', p.label));
                var valSpan = _el('span', 'color:' + (isDefault ? '#888' : '#D4A853') + ';font-weight:bold', String(val));
                labelRow.appendChild(valSpan);
                row.appendChild(labelRow);

                // Slider
                var slider = document.createElement('input');
                slider.type = 'range';
                slider.min = p.min;
                slider.max = p.max;
                slider.step = p.step;
                slider.value = val;
                slider.style.cssText = 'width:100%;height:18px;accent-color:#D4A853;cursor:pointer';

                slider.addEventListener('input', function() {
                    var v = parseFloat(this.value);
                    var dec = (p.step.toString().split('.')[1] || '').length;
                    v = parseFloat(v.toFixed(dec));
                    valSpan.textContent = String(v);
                    valSpan.style.color = '#D4A853';
                    if (!_savedData[label]) _savedData[label] = {};
                    _savedData[label][p.key] = v;
                    _save();
                });

                row.appendChild(slider);
                _panel.appendChild(row);
            })(PARAMS[i]);
        }

        // Footer
        _panel.appendChild(_el('div', 'text-align:center;font-size:10px;color:#666;margin-top:4px', 'Saved per preset \u2022 applied on FIGHT'));
    }

    function show() {
        _createPanel();
        _buildContent();

        // Position centered over the canvas, vertically centered
        var canvas = document.getElementById('gameCanvas');
        if (canvas) {
            var rect = canvas.getBoundingClientRect();
            // Show panel hidden to measure it
            _panel.style.visibility = 'hidden';
            _panel.style.display = 'block';
            var panelH = _panel.offsetHeight;
            var panelW = _panel.offsetWidth;
            _panel.style.visibility = '';
            // Center horizontally on canvas
            var leftPos = Math.round(rect.left + rect.width / 2 - panelW / 2);
            // Center vertically on canvas
            var topPos = Math.round(rect.top + rect.height / 2 - panelH / 2);
            // Clamp to viewport
            topPos = Math.max(10, Math.min(topPos, window.innerHeight - panelH - 10));
            leftPos = Math.max(10, Math.min(leftPos, window.innerWidth - panelW - 10));
            _panel.style.left = leftPos + 'px';
            _panel.style.top = topPos + 'px';
        }

        _panel.style.display = 'block';
        _visible = true;
    }

    function hide() {
        if (_panel) _panel.style.display = 'none';
        _visible = false;
    }

    function toggle() {
        if (_visible) hide();
        else show();
    }

    function isVisible() { return _visible; }

    // Load saved data on init
    _load();

    // Expose API
    WB.StageTuner = {
        show: show,
        hide: hide,
        toggle: toggle,
        isVisible: isVisible,
        getOverrides: getOverrides,
        PARAMS: PARAMS,
    };
})();
