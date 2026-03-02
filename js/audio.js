window.WB = window.WB || {};

WB.Audio = {
    ctx: null,
    masterGain: null,
    muted: false,

    init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.5;
            this.masterGain.connect(this.ctx.destination);
        } catch (e) {
            console.warn('Web Audio API not available');
        }
        this._loadSoundConfig();
    },

    // ═══════════════════════════════════════════════════════════════
    //  FILE-BASED SOUND SYSTEM — MP3 weapon sounds for states pack
    // ═══════════════════════════════════════════════════════════════
    _fileBuffers: {},    // weaponType → { hit: [AudioBuffer,...], fire: [AudioBuffer,...], ... }
    _soundConfig: null,  // from localStorage 'wb_sound_config'

    // Static mapping: weapon type → { hit: [filenames], fire: [filenames], spawn: [...], hazard: {...} }
    // Categories: hit=on-impact, fire=on-launch, wall=on-wall-bounce, spawn=on-entity-creation
    //   hazard = spriteKey→filename map for per-hazard-type damage sounds
    _fileSoundMap: {
        // ── Projectile weapons: fire = on-launch, hit = on-impact ──
        'alabama':        { fire: ['alabamaRocket.mp3'] },
        'arizona':        { fire: ['arizonaPhoenix.mp3'] },
        'arkansas':       { hit: ['arkansasDiamondClink.mp3'] },
        'florida':        { hit: ['floridaGatorBest.mp3'] },
        'idaho':          { hit: ['idahoPopcornPopUnlayered.mp3'] },
        'maine':          { fire: ['maineThrownLobsterPerhaps.mp3'] },
        'massachusetts':  { hit: ['massachussetsMagic1.mp3', 'massachussetsMagic2.mp3', 'massachussetsMagic3.mp3'] },
        'new-hampshire':  { hit: ['newHampshireStoneHit.mp3'], fire: ['newHampshireStoneThrow.mp3'] },
        'new-jersey':     { hit: ['newJerseyPillPop.mp3'] },
        'new-mexico':     { hit: ['newMexicoFlamenco1.mp3', 'newMexicoFlamenco2.mp3', 'newMexicoFlamenco3.mp3'] },
        'new-york':       { fire: ['newYorkDartThrow.mp3'], hit: ['newYorkBuildingComplete.mp3'] },
        'north-dakota':   { fire: ['northDakotaOilSpill.mp3'] },
        'oklahoma':       { fire: ['oklahomaWindTurbineWhoosh.mp3'] },
        'washington':     { fire: ['washingtonCoffeePour.mp3'] },
        'wisconsin':      { hit: ['wisconsinCheeseWhap1.mp3'], fire: ['wisconsinCowMoo1.mp3', 'wisconsinCowMoo2.mp3', 'wisconsinCowMoo3.mp3', 'wisconsinCowMoo4.mp3'] },
        // ── Melee weapons: hit = on-contact ──
        'alaska':         { hit: ['alaskaHarpoon.mp3'] },
        'california':     { hit: ['californiaChopCarDoorMaybe.mp3', 'californiaSlicePerhaps.mp3'] },
        'connecticut':    { hit: ['connecticutPaperSmack.mp3'] },
        'georgia':        { hit: ['georgiaBottleClunk.mp3'] },
        'hawaii':         { hit: ['hawaiiLavaThick.mp3'] },
        'illinois':       { hit: ['illinoisePizzaWheelCut.mp3'] },
        'iowa':           { hit: ['iowaShucks1.mp3'] },
        'kansas':         { hit: ['kansasWind1.mp3', 'kansasWind2.mp3'] },
        'kentucky':       { hit: ['kentuckyBarrelLaunch.mp3'] },
        'maryland':       { hit: ['marylandClawSnip.mp3'] },
        'minnesota':      { hit: ['minnesotaStick.mp3'] },
        'mississippi':    { hit: ['mississippiWheelTurn.mp3'] },
        'missouri':       { hit: ['missouriSlice.mp3'] },
        'montana':        { hit: ['montanaMoose.mp3'] },
        'nevada':         { hit: ['nevadaSlotMachinePlusLoss.mp3', 'nevadaSlotMachineWinNoBefore.mp3'] },
        'ohio':           { hit: ['ohioSlamCrowd.mp3', 'ohioWhistle.mp3'] },
        'oregon':         { hit: ['oregonWoodSmack1.mp3', 'oregonWoodSmack2.mp3'] },
        'pennsylvania':   { hit: ['pennsylvaniaBong.mp3'] },
        'rhode-island':   { hit: ['rhodeIslandAnchorSplash.mp3'] },
        'south-carolina': { hit: ['southCarolinaPalmettoSmack.mp3'] },
        'south-dakota':   {
            spawn: ['southDakotaBustPlaced.mp3'],
            hazard: {
                'southdakota-washington': 'southDakotaWashington.mp3',
                'southdakota-jefferson':  'southDakotaThomasJefferson.mp3',
                'southdakota-lincoln':    'southDakotaLincoln.mp3',
                'southdakota-roosevelt':  'southDakotaRoosevelt.mp3'
            }
        },
        'texas':          { hit: ['texasWhipCrack.mp3'] },
        'utah':           { hit: ['utahSaltSlice.mp3'] },
        'virginia':       { hit: ['virginiaGuillotine.mp3'] },
        'west-virginia':  { hit: ['westVirginiaCoalHit1.mp3', 'westVirginiaCoalHit2.mp3'] },
        'wyoming':        { hit: ['wyomingGeyserBubble1.mp3', 'wyomingGeyserBubble2.mp3'] },
        // ── Body slam weapons: hit = on-contact ──
        'colorado':       { hit: ['coloradoBoulderHit.mp3'] },
        'delaware':       { hit: ['delewareMoneyHit.mp3'] },
        'indiana':        { hit: ['indianaRaceCar.mp3'] },
        'michigan':       { hit: ['michiganChunk.mp3'] },
        'nebraska':       { hit: ['nebraskaBull.mp3'] },
        'north-carolina': { hit: ['northCarolinaPlane.mp3'] },
        // ── Tennessee: single notes on fire, chords on hit (once scaled) ──
        'tennessee':      { fire: ['tennesseeBanjoNote1.mp3', 'tennesseeBanjoNote2.mp3'], hit: ['tennesseeBanjoChord1.mp3', 'tennesseeBanjoChord2.mp3'] },
    },

    _loadSoundConfig() {
        try {
            this._soundConfig = JSON.parse(localStorage.getItem('wb_sound_config')) || {};
        } catch (e) {
            this._soundConfig = {};
        }
    },

    // Load all MP3 sounds — returns Promise, call at game init (fire-and-forget)
    loadAllSounds() {
        if (!this.ctx) return Promise.resolve();
        var self = this;
        var types = Object.keys(this._fileSoundMap);
        var allPromises = [];

        types.forEach(function(weaponType) {
            var map = self._fileSoundMap[weaponType];
            var result = {};

            // Array categories: hit, fire, wall, spawn
            ['hit', 'fire', 'wall', 'spawn'].forEach(function(cat) {
                if (!map[cat]) return;
                result[cat] = new Array(map[cat].length);
                map[cat].forEach(function(filename, idx) {
                    var p = fetch('assets/sounds/states/' + filename)
                        .then(function(r) { return r.arrayBuffer(); })
                        .then(function(buf) { return self.ctx.decodeAudioData(buf); })
                        .then(function(decoded) { result[cat][idx] = decoded; })
                        .catch(function(e) { /* silent — file might not exist */ });
                    allPromises.push(p);
                });
            });

            // Hazard map: spriteKey → AudioBuffer (keyed dispatch, not random)
            if (map.hazard) {
                result.hazard = {};
                var keys = Object.keys(map.hazard);
                keys.forEach(function(spriteKey) {
                    var filename = map.hazard[spriteKey];
                    var p = fetch('assets/sounds/states/' + filename)
                        .then(function(r) { return r.arrayBuffer(); })
                        .then(function(buf) { return self.ctx.decodeAudioData(buf); })
                        .then(function(decoded) { result.hazard[spriteKey] = decoded; })
                        .catch(function(e) { /* silent */ });
                    allPromises.push(p);
                });
            }

            self._fileBuffers[weaponType] = result;
        });

        return Promise.all(allPromises).then(function() {
            console.log('[Audio] Loaded', types.length, 'weapon sound sets');
        });
    },

    // Play a file-based sound with clip/pitch/volume overrides from sound editor
    _playFileSound(buffer, weaponType, filename) {
        if (!buffer || !this.ctx) return;
        // Look up config: per-variant key first, then per-weapon fallback
        var cfg = {};
        if (this._soundConfig) {
            var variantKey = weaponType + ':' + filename;
            var wepCfg = this._soundConfig[weaponType] || {};
            var varCfg = this._soundConfig[variantKey] || {};
            // Merge: variant overrides weapon-level
            cfg.clipStart = varCfg.clipStart != null ? varCfg.clipStart : (wepCfg.clipStart || 0);
            cfg.clipEnd = varCfg.clipEnd != null ? varCfg.clipEnd : (wepCfg.clipEnd || buffer.duration);
            cfg.pitch = varCfg.pitch != null ? varCfg.pitch : (wepCfg.pitch || 1.0);
            cfg.volume = varCfg.volume != null ? varCfg.volume : (wepCfg.volume != null ? wepCfg.volume : 0.6);
        } else {
            cfg.clipStart = 0;
            cfg.clipEnd = buffer.duration;
            cfg.pitch = 1.0;
            cfg.volume = 0.6;
        }

        var source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = cfg.pitch;

        var gain = this.ctx.createGain();
        gain.gain.value = cfg.volume;

        source.connect(gain);
        gain.connect(this.masterGain);

        var clipStart = Math.max(0, cfg.clipStart);
        var clipEnd = Math.min(buffer.duration, cfg.clipEnd);
        var duration = Math.max(0.01, clipEnd - clipStart);
        source.start(this.ctx.currentTime, clipStart, duration);
    },

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    // Create a noise buffer for percussive sounds
    _noiseBuffer(duration) {
        const sampleRate = this.ctx.sampleRate;
        const length = sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    },

    // Weapon category map for sound selection
    _weaponCategory: {
        // Generic weapons
        sword: 'blade', bow: 'ranged', hammer: 'blunt',
        shuriken: 'ranged', sawblade: 'tech',
        ghost: 'ethereal', clacker: 'blunt', gunclacker: 'ranged',
        // Elemental weapons
        fire: 'ethereal', ice: 'blade', spark: 'tech', stone: 'blunt',
        wind: 'blade', water: 'ranged', poison: 'pierce', light: 'ethereal',
        shadow: 'ethereal', nature: 'blade', crystal: 'tech', magma: 'blunt',
        storm: 'blunt', metal: 'blunt',
    },

    // Random pitch variation factor
    _pitchVar() { return 1 + (Math.random() - 0.5) * 0.3; },

    // Wall clack - disabled for now (too noisy)
    wallClack(speed, weaponType) {
        // Intentionally silent — wall bounce sounds removed
    },

    // Hazard damage sound — dispatches per-spriteKey sounds (e.g. South Dakota president busts)
    hazardHit(weaponType, spriteKey) {
        if (!this.ctx || this.muted || !weaponType) return;
        var fileSounds = this._fileBuffers[weaponType];
        if (fileSounds && fileSounds.hazard && spriteKey) {
            var buffer = fileSounds.hazard[spriteKey];
            if (buffer) {
                var map = this._fileSoundMap[weaponType];
                var filename = map && map.hazard ? (map.hazard[spriteKey] || '') : '';
                this._playFileSound(buffer, weaponType, filename);
                return;
            }
        }
        // No file sound — fall through to generic quiet tick (no procedural fallback needed)
    },

    // Spawn sound — plays when an entity is created (clones, busts, etc.)
    spawnSound(weaponType) {
        if (!this.ctx || this.muted || !weaponType) return;
        var fileSounds = this._fileBuffers[weaponType];
        if (fileSounds && fileSounds.spawn) {
            var variants = fileSounds.spawn.filter(Boolean);
            if (variants.length > 0) {
                var idx = Math.floor(Math.random() * variants.length);
                var map = this._fileSoundMap[weaponType];
                var filename = map && map.spawn ? map.spawn[idx] : '';
                this._playFileSound(variants[idx], weaponType, filename);
            }
        }
    },

    // Ball-ball collision - ULTRA MEGA CLACKY thud with crack on top
    ballClack(speed) {
        if (!this.ctx || this.muted) return;
        const t = this.ctx.currentTime;
        const vol = Math.min(0.6, 0.3 + speed * 0.07);
        const variant = Math.floor(Math.random() * 3);
        const pv = this._pitchVar();

        if (variant === 0) {
            // Low thud — deeper, louder
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime((180 + speed * 35) * pv, t);
            osc.frequency.exponentialRampToValueAtTime(50, t + 0.1);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(vol * 1.1, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.14);
        } else if (variant === 1) {
            // Mid-range pop — punchier
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._noiseBuffer(0.05);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = (2200 + speed * 300) * pv;
            filter.Q.value = 5 + Math.random() * 5;
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(vol, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
            noise.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
            noise.start(t); noise.stop(t + 0.06);
        } else {
            // High click — snappier
            const osc = this.ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime((3200 + speed * 300) * pv, t);
            osc.frequency.exponentialRampToValueAtTime(1000, t + 0.03);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(vol * 0.8, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.05);
        }

        // Shared noise layer — louder
        const noise = this.ctx.createBufferSource();
        noise.buffer = this._noiseBuffer(0.06);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1500 * pv;
        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(vol * 0.45, t);
        nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        noise.connect(filter); filter.connect(nGain); nGain.connect(this.masterGain);
        noise.start(t); noise.stop(t + 0.08);

        // EXTRA CLACK — sharp high-freq crack on top of every ball collision
        const clackOsc = this.ctx.createOscillator();
        clackOsc.type = 'square';
        const clackFreq = (3500 + speed * 500) * pv;
        clackOsc.frequency.setValueAtTime(clackFreq, t);
        clackOsc.frequency.exponentialRampToValueAtTime(clackFreq * 0.15, t + 0.02);
        const clackGain = this.ctx.createGain();
        clackGain.gain.setValueAtTime(vol * 0.4, t);
        clackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
        clackOsc.connect(clackGain); clackGain.connect(this.masterGain);
        clackOsc.start(t); clackOsc.stop(t + 0.03);
    },

    // Weapon hits target — each weapon type has a unique sound + UNIVERSAL CLACK OVERLAY
    weaponHit(combo, weaponType) {
        if (!this.ctx || this.muted) return;
        const t = this.ctx.currentTime;
        const pv = this._pitchVar();

        // Check for file-based sound (states pack MP3s)
        var fileSounds = this._fileBuffers[weaponType];
        if (fileSounds && fileSounds.hit) {
            var variants = fileSounds.hit.filter(Boolean);
            if (variants.length > 0) {
                var idx = Math.floor(Math.random() * variants.length);
                var map = this._fileSoundMap[weaponType];
                var filename = map && map.hit ? map.hit[idx] : '';
                this._playFileSound(variants[idx], weaponType, filename);
                // Skip procedural synth — file sound replaces it
                // But STILL play the universal clack overlay below
            }
        } else {
            // Procedural synth path (classic/elemental/pantheon/egyptian)
            const handler = this._weaponSounds[weaponType];
            if (handler) {
                handler.call(this, t, combo, pv);
            } else {
                this._weaponSounds.sword.call(this, t, combo, pv);
            }
        }

        // UNIVERSAL CLACK OVERLAY — sharp percussive snap on EVERY weapon hit
        // This is what makes it CLACKY
        const clackNoise = this.ctx.createBufferSource();
        clackNoise.buffer = this._noiseBuffer(0.025);
        const clackFilter = this.ctx.createBiquadFilter();
        clackFilter.type = 'bandpass';
        clackFilter.frequency.value = (3000 + combo * 200) * pv;
        clackFilter.Q.value = 8 + Math.random() * 6;
        const clackGain = this.ctx.createGain();
        clackGain.gain.setValueAtTime(0.22, t);
        clackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
        clackNoise.connect(clackFilter); clackFilter.connect(clackGain); clackGain.connect(this.masterGain);
        clackNoise.start(t); clackNoise.stop(t + 0.03);

        // Bonus clack pop — tiny sine ping
        const clackPop = this.ctx.createOscillator();
        clackPop.type = 'sine';
        const popFreq = (2800 + combo * 150) * pv;
        clackPop.frequency.setValueAtTime(popFreq, t);
        clackPop.frequency.exponentialRampToValueAtTime(popFreq * 0.2, t + 0.015);
        const popGain = this.ctx.createGain();
        popGain.gain.setValueAtTime(0.15, t);
        popGain.gain.exponentialRampToValueAtTime(0.001, t + 0.018);
        clackPop.connect(popGain); popGain.connect(this.masterGain);
        clackPop.start(t); clackPop.stop(t + 0.025);
    },

    _weaponSounds: {
        // SWORD: Classic metallic ring — sine+triangle, mid-high
        sword(t, combo, pv) {
            const pitch = (1200 + combo * 80) * pv;
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(pitch, t);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.6, t + 0.08);
            const osc2 = this.ctx.createOscillator();
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(pitch * 1.5, t);
            osc2.frequency.exponentialRampToValueAtTime(pitch * 0.8, t + 0.06);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.22, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
            osc.connect(gain); osc2.connect(gain); gain.connect(this.masterGain);
            osc.start(t); osc2.start(t);
            osc.stop(t + 0.12); osc2.stop(t + 0.08);
        },

        // HAMMER: Deep heavy slam — very low sine + loud noise burst
        hammer(t, combo, pv) {
            const pitch = (150 + combo * 15) * pv;
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(pitch, t);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.2, t + 0.15);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.35, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.2);
            // Heavy noise thump
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._noiseBuffer(0.1);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 600 * pv;
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.25, t);
            nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
            noise.connect(filter); filter.connect(nGain); nGain.connect(this.masterGain);
            noise.start(t); noise.stop(t + 0.12);
        },

        // BOW: Twangy string release — fast sine wobble
        bow(t, combo, pv) {
            const pitch = (900 + combo * 50) * pv;
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(pitch, t);
            osc.frequency.setValueAtTime(pitch * 1.3, t + 0.02);
            osc.frequency.setValueAtTime(pitch * 0.7, t + 0.04);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.4, t + 0.08);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.18, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.1);
        },

        // SHURIKEN: Metallic whir — fast oscillating triangle
        shuriken(t, combo, pv) {
            const pitch = (2000 + combo * 90) * pv;
            const osc = this.ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(pitch, t);
            osc.frequency.setValueAtTime(pitch * 1.4, t + 0.015);
            osc.frequency.setValueAtTime(pitch * 0.8, t + 0.03);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.5, t + 0.06);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.2, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.08);
        },

        // SAWBLADE: Grinding buzz — sawtooth + heavy filtered noise
        sawblade(t, combo, pv) {
            const pitch = (800 + combo * 50) * pv;
            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(pitch, t);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.6, t + 0.1);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = pitch * 2;
            filter.Q.value = 2;
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.2, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
            osc.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.14);
            // Grinding noise
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._noiseBuffer(0.08);
            const nFilter = this.ctx.createBiquadFilter();
            nFilter.type = 'bandpass';
            nFilter.frequency.value = pitch * 1.5;
            nFilter.Q.value = 3;
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.15, t);
            nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
            noise.connect(nFilter); nFilter.connect(nGain); nGain.connect(this.masterGain);
            noise.start(t); noise.stop(t + 0.1);
        },

        // GHOST: Ethereal whoosh — warbling sine with vibrato + breathy phase
        ghost(t, combo, pv) {
            const pitch = (500 + combo * 30) * pv;
            // Warbling ethereal tone
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(pitch, t);
            osc.frequency.setValueAtTime(pitch * 1.4, t + 0.03);
            osc.frequency.setValueAtTime(pitch * 0.7, t + 0.06);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.3, t + 0.15);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.15, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.2);
            // Breathy phase noise
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._noiseBuffer(0.12);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1200 * pv, t);
            filter.frequency.exponentialRampToValueAtTime(400, t + 0.12);
            filter.Q.value = 2;
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.1, t);
            nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
            noise.connect(filter); filter.connect(nGain); nGain.connect(this.masterGain);
            noise.start(t); noise.stop(t + 0.14);
        },

        // GUNCLACKER: Bullet impact — distorted crack + ricochet whine + meaty thud
        gunclacker(t, combo, pv) {
            const pitch = (1600 + combo * 80) * pv;
            // Distorted impact crack (full-spectrum noise through waveshaper)
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._noiseBuffer(0.015);
            const distortion = this.ctx.createWaveShaper();
            const curve = new Float32Array(64);
            for (let i = 0; i < 64; i++) {
                const x = (i * 2) / 63 - 1;
                curve[i] = Math.tanh(x * 5);
            }
            distortion.curve = curve;
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.3, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
            noise.connect(distortion); distortion.connect(gain); gain.connect(this.masterGain);
            noise.start(t); noise.stop(t + 0.025);
            // Ricochet whine (ascending → descending sine — "pew" shape)
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(pitch, t);
            osc.frequency.exponentialRampToValueAtTime(pitch * 3, t + 0.04);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.8, t + 0.12);
            const oGain = this.ctx.createGain();
            oGain.gain.setValueAtTime(0.12, t);
            oGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
            osc.connect(oGain); oGain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.16);
            // Meaty thud (sub-bass punch)
            const bass = this.ctx.createOscillator();
            bass.type = 'sine';
            bass.frequency.setValueAtTime(100 * pv, t);
            bass.frequency.exponentialRampToValueAtTime(30, t + 0.1);
            const bGain = this.ctx.createGain();
            bGain.gain.setValueAtTime(0.25, t);
            bGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
            bass.connect(bGain); bGain.connect(this.masterGain);
            bass.start(t); bass.stop(t + 0.14);
            // Body crunch (mid-freq filtered noise)
            const crunch = this.ctx.createBufferSource();
            crunch.buffer = this._noiseBuffer(0.04);
            const cFilter = this.ctx.createBiquadFilter();
            cFilter.type = 'bandpass';
            cFilter.frequency.value = 1200 * pv;
            cFilter.Q.value = 2;
            const cGain = this.ctx.createGain();
            cGain.gain.setValueAtTime(0.18, t);
            cGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
            crunch.connect(cFilter); cFilter.connect(cGain); cGain.connect(this.masterGain);
            crunch.start(t); crunch.stop(t + 0.05);
        },

        // CLACKER: Newton's Cradle — sharp metallic double-click + resonant ring
        // THE CLACKIEST SOUND IN THE GAME
        clacker(t, combo, pv) {
            // First click — ultra-sharp attack
            const pitch1 = (2500 + combo * 120) * pv;
            const osc1 = this.ctx.createOscillator();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(pitch1, t);
            osc1.frequency.exponentialRampToValueAtTime(pitch1 * 0.4, t + 0.04);
            const gain1 = this.ctx.createGain();
            gain1.gain.setValueAtTime(0.35, t);
            gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
            osc1.connect(gain1); gain1.connect(this.masterGain);
            osc1.start(t); osc1.stop(t + 0.06);

            // Second click — delayed by 15ms (the "clack-CLACK" pattern)
            const pitch2 = (3200 + combo * 150) * pv;
            const osc2 = this.ctx.createOscillator();
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(pitch2, t + 0.015);
            osc2.frequency.exponentialRampToValueAtTime(pitch2 * 0.3, t + 0.045);
            const gain2 = this.ctx.createGain();
            gain2.gain.setValueAtTime(0.3, t + 0.015);
            gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
            osc2.connect(gain2); gain2.connect(this.masterGain);
            osc2.start(t + 0.015); osc2.stop(t + 0.06);

            // Metallic resonance ring — lingers after the click
            const ring = this.ctx.createOscillator();
            ring.type = 'sine';
            ring.frequency.setValueAtTime(4200 * pv, t + 0.01);
            ring.frequency.exponentialRampToValueAtTime(3000, t + 0.15);
            const ringGain = this.ctx.createGain();
            ringGain.gain.setValueAtTime(0.1, t + 0.01);
            ringGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
            ring.connect(ringGain); ringGain.connect(this.masterGain);
            ring.start(t + 0.01); ring.stop(t + 0.2);

            // Hard noise crack
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._noiseBuffer(0.03);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = (4500 + combo * 200) * pv;
            filter.Q.value = 12;
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.25, t);
            nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
            noise.connect(filter); filter.connect(nGain); nGain.connect(this.masterGain);
            noise.start(t); noise.stop(t + 0.04);

            // Sub bass impact
            const bass = this.ctx.createOscillator();
            bass.type = 'sine';
            bass.frequency.setValueAtTime(120 * pv, t);
            bass.frequency.exponentialRampToValueAtTime(40, t + 0.08);
            const bassGain = this.ctx.createGain();
            bassGain.gain.setValueAtTime(0.2, t);
            bassGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
            bass.connect(bassGain); bassGain.connect(this.masterGain);
            bass.start(t); bass.stop(t + 0.12);
        },

        // FIRE: Crackling pop — rising sine + filtered noise burst
        fire(t, combo, pv) {
            const pitch = (600 + combo * 40) * pv;
            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(pitch, t);
            osc.frequency.exponentialRampToValueAtTime(pitch * 2.5, t + 0.04);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.3, t + 0.12);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.2, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.16);
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._noiseBuffer(0.06);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass'; filter.frequency.value = 1800 * pv; filter.Q.value = 2;
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.18, t);
            nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
            noise.connect(filter); filter.connect(nGain); nGain.connect(this.masterGain);
            noise.start(t); noise.stop(t + 0.08);
        },

        // ICE: Crystalline shatter — high sine ring + sharp noise crack
        ice(t, combo, pv) {
            const pitch = (2200 + combo * 100) * pv;
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(pitch, t);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.5, t + 0.1);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.2, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.18);
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._noiseBuffer(0.015);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'highpass'; filter.frequency.value = 4000;
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.22, t);
            nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
            noise.connect(filter); filter.connect(nGain); nGain.connect(this.masterGain);
            noise.start(t); noise.stop(t + 0.03);
        },

        // SPARK: Electric zap — sawtooth buzz with frequency wobble + snap
        spark(t, combo, pv) {
            const pitch = (900 + combo * 60) * pv;
            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(pitch, t);
            osc.frequency.setValueAtTime(pitch * 2, t + 0.01);
            osc.frequency.setValueAtTime(pitch * 0.5, t + 0.025);
            osc.frequency.exponentialRampToValueAtTime(pitch * 1.5, t + 0.05);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass'; filter.frequency.value = pitch * 1.5; filter.Q.value = 3;
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.18, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
            osc.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.09);
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._noiseBuffer(0.01);
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.25, t);
            nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.012);
            noise.connect(nGain); nGain.connect(this.masterGain);
            noise.start(t); noise.stop(t + 0.015);
        },

        // STONE: Deep rumbling thud — ultra-low sine + long noise tail
        stone(t, combo, pv) {
            const pitch = (80 + combo * 8) * pv;
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(pitch, t);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.15, t + 0.25);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.4, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.35);
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._noiseBuffer(0.15);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass'; filter.frequency.value = 600 * pv;
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.3, t);
            nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
            noise.connect(filter); filter.connect(nGain); nGain.connect(this.masterGain);
            noise.start(t); noise.stop(t + 0.18);
        },

        // WIND: Whooshing sweep — bandpass noise sweep high→low + whistle
        wind(t, combo, pv) {
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._noiseBuffer(0.12);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(3000 * pv, t);
            filter.frequency.exponentialRampToValueAtTime(400, t + 0.12);
            filter.Q.value = 2;
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.18, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
            noise.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
            noise.start(t); noise.stop(t + 0.14);
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime((1800 + combo * 80) * pv, t);
            osc.frequency.exponentialRampToValueAtTime(800, t + 0.08);
            const oGain = this.ctx.createGain();
            oGain.gain.setValueAtTime(0.1, t);
            oGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
            osc.connect(oGain); oGain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.1);
        },

        // WATER: Splashy burst — low bandpass noise pop + sine bubble
        water(t, combo, pv) {
            const pitch = (300 + combo * 25) * pv;
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._noiseBuffer(0.06);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass'; filter.frequency.value = 600 * pv; filter.Q.value = 4;
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.25, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
            noise.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
            noise.start(t); noise.stop(t + 0.08);
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(pitch, t);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.3, t + 0.1);
            const oGain = this.ctx.createGain();
            oGain.gain.setValueAtTime(0.2, t);
            oGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
            osc.connect(oGain); oGain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.14);
        },

        // POISON: Sharp puncture + hiss — triangle stab + filtered noise decay
        poison(t, combo, pv) {
            const pitch = (1600 + combo * 90) * pv;
            const osc = this.ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(pitch, t);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.3, t + 0.04);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.22, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.06);
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._noiseBuffer(0.1);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'highpass'; filter.frequency.value = 3000 * pv;
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.08, t + 0.02);
            nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
            noise.connect(filter); filter.connect(nGain); nGain.connect(this.masterGain);
            noise.start(t + 0.02); noise.stop(t + 0.14);
        },

        // LIGHT: Bright chime — fast ascending sine arpeggio + shimmer
        light(t, combo, pv) {
            const pitch = (1400 + combo * 80) * pv;
            for (let i = 0; i < 3; i++) {
                const d = i * 0.015;
                const np = pitch * (1 + i * 0.35);
                const osc = this.ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(np, t + d);
                osc.frequency.exponentialRampToValueAtTime(np * 0.6, t + d + 0.05);
                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(0.15, t + d);
                gain.gain.exponentialRampToValueAtTime(0.001, t + d + 0.06);
                osc.connect(gain); gain.connect(this.masterGain);
                osc.start(t + d); osc.stop(t + d + 0.08);
            }
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._noiseBuffer(0.04);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'highpass'; filter.frequency.value = 5000;
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.06, t);
            nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
            noise.connect(filter); filter.connect(nGain); nGain.connect(this.masterGain);
            noise.start(t); noise.stop(t + 0.05);
        },

        // SHADOW: Dark warble — descending sine with vibrato + muffled noise
        shadow(t, combo, pv) {
            const pitch = (400 + combo * 25) * pv;
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(pitch, t);
            osc.frequency.setValueAtTime(pitch * 1.3, t + 0.03);
            osc.frequency.setValueAtTime(pitch * 0.6, t + 0.06);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.2, t + 0.15);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.18, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.2);
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._noiseBuffer(0.08);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass'; filter.frequency.value = 800 * pv;
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.1, t);
            nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
            noise.connect(filter); filter.connect(nGain); nGain.connect(this.masterGain);
            noise.start(t); noise.stop(t + 0.1);
        },

        // NATURE: Whip crack + woody thud
        nature(t, combo, pv) {
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._noiseBuffer(0.015);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass'; filter.frequency.value = 2000 * pv; filter.Q.value = 5;
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.28, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
            noise.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
            noise.start(t); noise.stop(t + 0.025);
            const osc = this.ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime((250 + combo * 15) * pv, t);
            osc.frequency.exponentialRampToValueAtTime(80, t + 0.1);
            const oGain = this.ctx.createGain();
            oGain.gain.setValueAtTime(0.18, t);
            oGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
            osc.connect(oGain); oGain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.14);
        },

        // CRYSTAL: Shimmer chord — two close sines + glass crack
        crystal(t, combo, pv) {
            const pitch = (1800 + combo * 90) * pv;
            const osc1 = this.ctx.createOscillator();
            osc1.type = 'sine'; osc1.frequency.setValueAtTime(pitch, t);
            osc1.frequency.exponentialRampToValueAtTime(pitch * 0.6, t + 0.12);
            const osc2 = this.ctx.createOscillator();
            osc2.type = 'sine'; osc2.frequency.setValueAtTime(pitch * 1.06, t);
            osc2.frequency.exponentialRampToValueAtTime(pitch * 0.65, t + 0.12);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.15, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
            osc1.connect(gain); osc2.connect(gain); gain.connect(this.masterGain);
            osc1.start(t); osc2.start(t); osc1.stop(t + 0.18); osc2.stop(t + 0.18);
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._noiseBuffer(0.02);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'highpass'; filter.frequency.value = 3500;
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.18, t);
            nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
            noise.connect(filter); filter.connect(nGain); nGain.connect(this.masterGain);
            noise.start(t); noise.stop(t + 0.03);
        },

        // MAGMA: Deep sizzle — low thud + rising hiss
        magma(t, combo, pv) {
            const pitch = (100 + combo * 10) * pv;
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(pitch, t);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.15, t + 0.2);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.35, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.28);
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._noiseBuffer(0.12);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'highpass'; filter.frequency.value = 2000 * pv;
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.01, t);
            nGain.gain.linearRampToValueAtTime(0.15, t + 0.04);
            nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
            noise.connect(filter); filter.connect(nGain); nGain.connect(this.masterGain);
            noise.start(t); noise.stop(t + 0.14);
        },

        // STORM: Thunder boom — bass thud + crackling noise burst + flash tone
        storm(t, combo, pv) {
            const pitch = (120 + combo * 12) * pv;
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(pitch, t);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.2, t + 0.18);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.35, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.25);
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._noiseBuffer(0.08);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass'; filter.frequency.value = 1500 * pv; filter.Q.value = 1;
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.25, t);
            nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
            noise.connect(filter); filter.connect(nGain); nGain.connect(this.masterGain);
            noise.start(t); noise.stop(t + 0.1);
            const flash = this.ctx.createOscillator();
            flash.type = 'sine';
            flash.frequency.setValueAtTime(3000 * pv, t);
            flash.frequency.exponentialRampToValueAtTime(800, t + 0.03);
            const fGain = this.ctx.createGain();
            fGain.gain.setValueAtTime(0.12, t);
            fGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
            flash.connect(fGain); fGain.connect(this.masterGain);
            flash.start(t); flash.stop(t + 0.05);
        },

        // METAL: Metallic clang — detuned sine bell + heavy thud
        metal(t, combo, pv) {
            const pitch = (1200 + combo * 60) * pv;
            const osc1 = this.ctx.createOscillator();
            osc1.type = 'sine'; osc1.frequency.setValueAtTime(pitch, t);
            osc1.frequency.exponentialRampToValueAtTime(pitch * 0.5, t + 0.12);
            const osc2 = this.ctx.createOscillator();
            osc2.type = 'sine'; osc2.frequency.setValueAtTime(pitch * 1.03, t);
            osc2.frequency.exponentialRampToValueAtTime(pitch * 0.52, t + 0.12);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.2, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
            osc1.connect(gain); osc2.connect(gain); gain.connect(this.masterGain);
            osc1.start(t); osc2.start(t); osc1.stop(t + 0.2); osc2.stop(t + 0.2);
            const bass = this.ctx.createOscillator();
            bass.type = 'sine';
            bass.frequency.setValueAtTime(150 * pv, t);
            bass.frequency.exponentialRampToValueAtTime(40, t + 0.12);
            const bGain = this.ctx.createGain();
            bGain.gain.setValueAtTime(0.25, t);
            bGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
            bass.connect(bGain); bGain.connect(this.masterGain);
            bass.start(t); bass.stop(t + 0.16);
        },
    },

    // Weapon-weapon parry - SUPER CLACKY metallic ring with sharp crack
    parry() {
        if (!this.ctx || this.muted) return;
        const t = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2200, t);
        osc.frequency.exponentialRampToValueAtTime(1800, t + 0.15);

        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(3300, t);
        osc2.frequency.exponentialRampToValueAtTime(2800, t + 0.12);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc2.start(t);
        osc.stop(t + 0.3);
        osc2.stop(t + 0.25);

        // CLACK LAYER — sharp noise crack for that satisfying parry feel
        const clackNoise = this.ctx.createBufferSource();
        clackNoise.buffer = this._noiseBuffer(0.03);
        const clackFilter = this.ctx.createBiquadFilter();
        clackFilter.type = 'bandpass';
        clackFilter.frequency.value = 5000 * this._pitchVar();
        clackFilter.Q.value = 10;
        const clackGain = this.ctx.createGain();
        clackGain.gain.setValueAtTime(0.3, t);
        clackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
        clackNoise.connect(clackFilter); clackFilter.connect(clackGain); clackGain.connect(this.masterGain);
        clackNoise.start(t); clackNoise.stop(t + 0.04);

        // Extra metallic ring — high sine that lingers
        const osc3 = this.ctx.createOscillator();
        osc3.type = 'triangle';
        osc3.frequency.setValueAtTime(4400, t);
        osc3.frequency.exponentialRampToValueAtTime(3500, t + 0.2);
        const gain3 = this.ctx.createGain();
        gain3.gain.setValueAtTime(0.12, t);
        gain3.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc3.connect(gain3); gain3.connect(this.masterGain);
        osc3.start(t); osc3.stop(t + 0.3);
    },

    // Projectile fire - clacky snap + whoosh
    projectileFire(weaponType) {
        if (!this.ctx || this.muted) return;

        // Check for file-based fire sound (states pack)
        if (weaponType) {
            var fileSounds = this._fileBuffers[weaponType];
            if (fileSounds && fileSounds.fire) {
                var variants = fileSounds.fire.filter(Boolean);
                if (variants.length > 0) {
                    var idx = Math.floor(Math.random() * variants.length);
                    var map = this._fileSoundMap[weaponType];
                    var filename = map && map.fire ? map.fire[idx] : '';
                    this._playFileSound(variants[idx], weaponType, filename);
                    return; // file sound replaces generic swoosh
                }
            }
        }

        const t = this.ctx.currentTime;

        const noise = this.ctx.createBufferSource();
        noise.buffer = this._noiseBuffer(0.1);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1800, t);
        filter.frequency.exponentialRampToValueAtTime(900, t + 0.08);
        filter.Q.value = 3;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start(t);
        noise.stop(t + 0.12);

        // Snap — sharp click at the start for that clacky feel
        const snap = this.ctx.createOscillator();
        snap.type = 'square';
        snap.frequency.setValueAtTime(3500 * this._pitchVar(), t);
        snap.frequency.exponentialRampToValueAtTime(800, t + 0.015);
        const snapGain = this.ctx.createGain();
        snapGain.gain.setValueAtTime(0.12, t);
        snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.018);
        snap.connect(snapGain); snapGain.connect(this.masterGain);
        snap.start(t); snap.stop(t + 0.025);
    },

    // Death explosion - low rumble
    death() {
        if (!this.ctx || this.muted) return;
        const t = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.5);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.7);

        // Noise rumble
        const noise = this.ctx.createBufferSource();
        noise.buffer = this._noiseBuffer(0.5);
        const nFilter = this.ctx.createBiquadFilter();
        nFilter.type = 'lowpass';
        nFilter.frequency.value = 300;
        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(0.25, t);
        nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

        noise.connect(nFilter);
        nFilter.connect(nGain);
        nGain.connect(this.masterGain);
        noise.start(t);
        noise.stop(t + 0.55);
    },

    // Super activation - rising tone sweep
    superActivate() {
        if (!this.ctx || this.muted) return;
        const t = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.exponentialRampToValueAtTime(1600, t + 0.3);

        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(600, t);
        osc2.frequency.exponentialRampToValueAtTime(2400, t + 0.3);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.2, t + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc2.start(t);
        osc.stop(t + 0.45);
        osc2.stop(t + 0.45);
    },

    // Combo clack burst — rapid-fire stacked clacks for high combos
    comboClack(comboCount) {
        if (!this.ctx || this.muted) return;
        const t = this.ctx.currentTime;
        const layers = Math.min(comboCount, 8);
        const pv = this._pitchVar();

        for (let i = 0; i < layers; i++) {
            const delay = i * 0.012; // Rapid stagger
            const pitch = (2500 + comboCount * 200 + i * 300) * pv;

            const osc = this.ctx.createOscillator();
            osc.type = i % 2 === 0 ? 'triangle' : 'square';
            osc.frequency.setValueAtTime(pitch, t + delay);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.2, t + delay + 0.02);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.08 + 0.02 * (layers - i), t + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.025);
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(t + delay); osc.stop(t + delay + 0.03);
        }

        // Bass thump layer that scales with combo
        const bass = this.ctx.createOscillator();
        bass.type = 'sine';
        bass.frequency.setValueAtTime(80 + comboCount * 10, t);
        bass.frequency.exponentialRampToValueAtTime(30, t + 0.1);
        const bassGain = this.ctx.createGain();
        bassGain.gain.setValueAtTime(Math.min(0.3, 0.1 + comboCount * 0.02), t);
        bassGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        bass.connect(bassGain); bassGain.connect(this.masterGain);
        bass.start(t); bass.stop(t + 0.14);
    },

    // Victory fanfare — rapid ascending clack burst
    victoryFanfare() {
        if (!this.ctx || this.muted) return;
        const t = this.ctx.currentTime;

        // 8 rapid ascending clacks
        for (let i = 0; i < 8; i++) {
            const delay = i * 0.06;
            const pitch = 1200 + i * 300;

            // Melodic tone
            const osc = this.ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(pitch, t + delay);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.6, t + delay + 0.05);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.2, t + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.06);
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(t + delay); osc.stop(t + delay + 0.07);

            // Clack noise layer
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._noiseBuffer(0.03);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 3000 + i * 500;
            filter.Q.value = 6;
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.15, t + delay);
            nGain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.025);
            noise.connect(filter); filter.connect(nGain); nGain.connect(this.masterGain);
            noise.start(t + delay); noise.stop(t + delay + 0.04);
        }

        // Final big chord hit
        const finalDelay = 0.55;
        for (const freq of [800, 1200, 1600, 2400]) {
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t + finalDelay);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.7, t + finalDelay + 0.3);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.12, t + finalDelay);
            gain.gain.exponentialRampToValueAtTime(0.001, t + finalDelay + 0.35);
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(t + finalDelay); osc.stop(t + finalDelay + 0.4);
        }
        // Final big clack snap
        const finalNoise = this.ctx.createBufferSource();
        finalNoise.buffer = this._noiseBuffer(0.05);
        const finalFilter = this.ctx.createBiquadFilter();
        finalFilter.type = 'bandpass';
        finalFilter.frequency.value = 4000;
        finalFilter.Q.value = 5;
        const finalGain = this.ctx.createGain();
        finalGain.gain.setValueAtTime(0.3, t + finalDelay);
        finalGain.gain.exponentialRampToValueAtTime(0.001, t + finalDelay + 0.04);
        finalNoise.connect(finalFilter); finalFilter.connect(finalGain); finalGain.connect(this.masterGain);
        finalNoise.start(t + finalDelay); finalNoise.stop(t + finalDelay + 0.06);
    },

    // Victory fireworks — layered pops, crackles, and whistles over ~2 seconds
    // Called repeatedly during RESULT state to create a fireworks display
    victoryFireworks() {
        if (!this.ctx || this.muted) return;
        var t = this.ctx.currentTime;

        // 5-8 staggered firework bursts
        var burstCount = 5 + Math.floor(Math.random() * 4);
        for (var i = 0; i < burstCount; i++) {
            var delay = Math.random() * 1.8;
            var pitch = 600 + Math.random() * 2000;

            // Rising whistle (before burst)
            var whistle = this.ctx.createOscillator();
            whistle.type = 'sine';
            whistle.frequency.setValueAtTime(pitch * 0.3, t + delay);
            whistle.frequency.exponentialRampToValueAtTime(pitch, t + delay + 0.15);
            var wGain = this.ctx.createGain();
            wGain.gain.setValueAtTime(0.06, t + delay);
            wGain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.15);
            whistle.connect(wGain); wGain.connect(this.masterGain);
            whistle.start(t + delay); whistle.stop(t + delay + 0.16);

            // Burst pop (noise + tone)
            var burstTime = delay + 0.15;
            var pop = this.ctx.createBufferSource();
            pop.buffer = this._noiseBuffer(0.06);
            var bpf = this.ctx.createBiquadFilter();
            bpf.type = 'bandpass';
            bpf.frequency.value = pitch;
            bpf.Q.value = 2 + Math.random() * 3;
            var pGain = this.ctx.createGain();
            pGain.gain.setValueAtTime(0.18, t + burstTime);
            pGain.gain.exponentialRampToValueAtTime(0.001, t + burstTime + 0.08);
            pop.connect(bpf); bpf.connect(pGain); pGain.connect(this.masterGain);
            pop.start(t + burstTime); pop.stop(t + burstTime + 0.09);

            // Sparkle crackle (3-6 tiny pops after burst)
            var crackles = 3 + Math.floor(Math.random() * 4);
            for (var c = 0; c < crackles; c++) {
                var cDelay = burstTime + 0.02 + Math.random() * 0.2;
                var cNoise = this.ctx.createBufferSource();
                cNoise.buffer = this._noiseBuffer(0.02);
                var cFilter = this.ctx.createBiquadFilter();
                cFilter.type = 'highpass';
                cFilter.frequency.value = 4000 + Math.random() * 4000;
                var cGain = this.ctx.createGain();
                cGain.gain.setValueAtTime(0.08 + Math.random() * 0.06, t + cDelay);
                cGain.gain.exponentialRampToValueAtTime(0.001, t + cDelay + 0.03);
                cNoise.connect(cFilter); cFilter.connect(cGain); cGain.connect(this.masterGain);
                cNoise.start(t + cDelay); cNoise.stop(t + cDelay + 0.04);
            }
        }
    },

    // Countdown clack — escalating layers: phase 0 = 1 layer, phase 2 = 3 layers, "FIGHT!" = explosion
    countdownClack(phase) {
        if (!this.ctx || this.muted) return;
        const t = this.ctx.currentTime;
        const layers = phase === 3 ? 6 : phase + 1; // FIGHT! gets 6 layers

        for (let i = 0; i < layers; i++) {
            const delay = i * 0.015;
            const pitch = (1800 + i * 400 + phase * 300);

            const osc = this.ctx.createOscillator();
            osc.type = i % 2 === 0 ? 'triangle' : 'square';
            osc.frequency.setValueAtTime(pitch, t + delay);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.3, t + delay + 0.04);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.2 + phase * 0.04, t + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.05);
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(t + delay); osc.stop(t + delay + 0.06);
        }

        // Noise burst layer
        const noise = this.ctx.createBufferSource();
        noise.buffer = this._noiseBuffer(0.04 + phase * 0.01);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 2000 + phase * 800;
        filter.Q.value = 5;
        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(0.2 + phase * 0.05, t);
        nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04 + phase * 0.01);
        noise.connect(filter); filter.connect(nGain); nGain.connect(this.masterGain);
        noise.start(t); noise.stop(t + 0.06 + phase * 0.01);

        // Bass impact on FIGHT!
        if (phase === 3) {
            const bass = this.ctx.createOscillator();
            bass.type = 'sine';
            bass.frequency.setValueAtTime(120, t);
            bass.frequency.exponentialRampToValueAtTime(30, t + 0.2);
            const bassGain = this.ctx.createGain();
            bassGain.gain.setValueAtTime(0.35, t);
            bassGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
            bass.connect(bassGain); bassGain.connect(this.masterGain);
            bass.start(t); bass.stop(t + 0.3);
        }
    },

    // Menu button click — crisp little clack
    menuClack() {
        if (!this.ctx || this.muted) return;
        const t = this.ctx.currentTime;
        const pv = this._pitchVar();

        // Sharp click
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(3000 * pv, t);
        osc.frequency.exponentialRampToValueAtTime(1500, t + 0.015);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
        osc.connect(gain); gain.connect(this.masterGain);
        osc.start(t); osc.stop(t + 0.025);

        // Tiny noise snap
        const noise = this.ctx.createBufferSource();
        noise.buffer = this._noiseBuffer(0.015);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 4000 * pv;
        filter.Q.value = 8;
        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(0.08, t);
        nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.012);
        noise.connect(filter); filter.connect(nGain); nGain.connect(this.masterGain);
        noise.start(t); noise.stop(t + 0.02);
    },

    // GUN CLACK — PROPER gunshot with distorted transient + barrel resonance + reverb tail
    // isReload = true for the louder reload clack every 6 shots
    gunClack(isReload) {
        if (!this.ctx || this.muted) return;
        const t = this.ctx.currentTime;
        const pv = this._pitchVar();
        const vol = isReload ? 0.45 : 0.32;

        // --- WAVESHAPER for distortion (makes the crack GRITTY) ---
        const distortion = this.ctx.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            const x = (i * 2) / 255 - 1;
            curve[i] = (Math.PI + 200) * x / (Math.PI + 200 * Math.abs(x));
        }
        distortion.curve = curve;
        distortion.oversample = '2x';

        // 1. TRANSIENT — ultra-short (<3ms) full-spectrum noise burst (the "crack")
        const transient = this.ctx.createBufferSource();
        transient.buffer = this._noiseBuffer(0.008);
        const transGain = this.ctx.createGain();
        transGain.gain.setValueAtTime(vol * 1.4, t);
        transGain.gain.exponentialRampToValueAtTime(0.001, t + 0.008);
        transient.connect(distortion);
        distortion.connect(transGain);
        transGain.connect(this.masterGain);
        transient.start(t); transient.stop(t + 0.01);

        // 2. BODY — mid-frequency barrel resonance (wider bandpass, longer decay)
        const body = this.ctx.createBufferSource();
        body.buffer = this._noiseBuffer(isReload ? 0.08 : 0.05);
        const bodyFilter = this.ctx.createBiquadFilter();
        bodyFilter.type = 'bandpass';
        bodyFilter.frequency.value = (isReload ? 1400 : 1800) * pv;
        bodyFilter.Q.value = 1.5; // Wide — real guns have broad mid-freq
        const bodyGain = this.ctx.createGain();
        bodyGain.gain.setValueAtTime(vol * 0.9, t);
        bodyGain.gain.exponentialRampToValueAtTime(0.001, t + (isReload ? 0.08 : 0.05));
        body.connect(bodyFilter); bodyFilter.connect(bodyGain); bodyGain.connect(this.masterGain);
        body.start(t); body.stop(t + (isReload ? 0.1 : 0.07));

        // 3. BASS THUMP — sub-bass concussive punch
        const boom = this.ctx.createOscillator();
        boom.type = 'sine';
        boom.frequency.setValueAtTime((isReload ? 100 : 140) * pv, t);
        boom.frequency.exponentialRampToValueAtTime(25, t + 0.15);
        const boomGain = this.ctx.createGain();
        boomGain.gain.setValueAtTime(vol * 1.0, t);
        boomGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        boom.connect(boomGain); boomGain.connect(this.masterGain);
        boom.start(t); boom.stop(t + 0.2);

        // 4. HIGH CRACK — sharp supersonic snap (like a bullet breaking sound barrier)
        const snap = this.ctx.createOscillator();
        snap.type = 'square';
        snap.frequency.setValueAtTime(5000 * pv, t);
        snap.frequency.exponentialRampToValueAtTime(1000, t + 0.012);
        const snapGain = this.ctx.createGain();
        snapGain.gain.setValueAtTime(vol * 0.5, t);
        snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.015);
        snap.connect(snapGain); snapGain.connect(this.masterGain);
        snap.start(t); snap.stop(t + 0.02);

        // 5. REVERB TAIL — filtered noise that decays slowly (room echo)
        const tail = this.ctx.createBufferSource();
        tail.buffer = this._noiseBuffer(0.25);
        const tailHP = this.ctx.createBiquadFilter();
        tailHP.type = 'highpass';
        tailHP.frequency.value = 400;
        const tailLP = this.ctx.createBiquadFilter();
        tailLP.type = 'lowpass';
        tailLP.frequency.value = 2500 * pv;
        const tailGain = this.ctx.createGain();
        tailGain.gain.setValueAtTime(vol * 0.15, t + 0.01);
        tailGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        tail.connect(tailHP); tailHP.connect(tailLP); tailLP.connect(tailGain); tailGain.connect(this.masterGain);
        tail.start(t + 0.01); tail.stop(t + 0.3);

        // 6. CLACK LAYER — metallic bolt action (what makes it a "gun-CLACK")
        const clack1 = this.ctx.createOscillator();
        clack1.type = 'triangle';
        clack1.frequency.setValueAtTime(4200 * pv, t + 0.003);
        clack1.frequency.exponentialRampToValueAtTime(1200, t + 0.025);
        const clack1Gain = this.ctx.createGain();
        clack1Gain.gain.setValueAtTime(vol * 0.5, t + 0.003);
        clack1Gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
        clack1.connect(clack1Gain); clack1Gain.connect(this.masterGain);
        clack1.start(t + 0.003); clack1.stop(t + 0.04);

        // Second clack (delayed 12ms — the "clack-CLACK" double-tap)
        const clack2 = this.ctx.createOscillator();
        clack2.type = 'sine';
        clack2.frequency.setValueAtTime(3500 * pv, t + 0.015);
        clack2.frequency.exponentialRampToValueAtTime(900, t + 0.04);
        const clack2Gain = this.ctx.createGain();
        clack2Gain.gain.setValueAtTime(vol * 0.35, t + 0.015);
        clack2Gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
        clack2.connect(clack2Gain); clack2Gain.connect(this.masterGain);
        clack2.start(t + 0.015); clack2.stop(t + 0.05);

        // 7. SHELL CASING — tiny metallic tinkle (bouncing brass)
        const casing = this.ctx.createOscillator();
        casing.type = 'sine';
        const casingDelay = 0.04 + Math.random() * 0.02;
        casing.frequency.setValueAtTime(6200 * pv, t + casingDelay);
        casing.frequency.exponentialRampToValueAtTime(3800, t + casingDelay + 0.06);
        const casingGain = this.ctx.createGain();
        casingGain.gain.setValueAtTime(0.05, t + casingDelay);
        casingGain.gain.exponentialRampToValueAtTime(0.001, t + casingDelay + 0.08);
        casing.connect(casingGain); casingGain.connect(this.masterGain);
        casing.start(t + casingDelay); casing.stop(t + casingDelay + 0.1);
        // Second casing bounce
        const cd2 = casingDelay + 0.05 + Math.random() * 0.03;
        const casing2 = this.ctx.createOscillator();
        casing2.type = 'sine';
        casing2.frequency.setValueAtTime(5800 * pv, t + cd2);
        casing2.frequency.exponentialRampToValueAtTime(4200, t + cd2 + 0.04);
        const casing2Gain = this.ctx.createGain();
        casing2Gain.gain.setValueAtTime(0.03, t + cd2);
        casing2Gain.gain.exponentialRampToValueAtTime(0.001, t + cd2 + 0.05);
        casing2.connect(casing2Gain); casing2Gain.connect(this.masterGain);
        casing2.start(t + cd2); casing2.stop(t + cd2 + 0.06);

        // 8. RELOAD extras — slide rack + chamber lock + resonant ring
        if (isReload) {
            // Slide rack (descending filtered noise — "chk-chk")
            const slideNoise = this.ctx.createBufferSource();
            slideNoise.buffer = this._noiseBuffer(0.05);
            const slideFilter = this.ctx.createBiquadFilter();
            slideFilter.type = 'bandpass';
            slideFilter.frequency.setValueAtTime(3000 * pv, t + 0.05);
            slideFilter.frequency.exponentialRampToValueAtTime(800, t + 0.09);
            slideFilter.Q.value = 3;
            const slideGain = this.ctx.createGain();
            slideGain.gain.setValueAtTime(0.18, t + 0.05);
            slideGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
            slideNoise.connect(slideFilter); slideFilter.connect(slideGain); slideGain.connect(this.masterGain);
            slideNoise.start(t + 0.05); slideNoise.stop(t + 0.12);

            // Chamber lock — sharp metallic snap
            const lock = this.ctx.createOscillator();
            lock.type = 'triangle';
            lock.frequency.setValueAtTime(5000 * pv, t + 0.09);
            lock.frequency.exponentialRampToValueAtTime(2200, t + 0.105);
            const lockGain = this.ctx.createGain();
            lockGain.gain.setValueAtTime(0.25, t + 0.09);
            lockGain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
            lock.connect(lockGain); lockGain.connect(this.masterGain);
            lock.start(t + 0.09); lock.stop(t + 0.12);

            // Resonant ring (metallic sustain after reload)
            const ring = this.ctx.createOscillator();
            ring.type = 'sine';
            ring.frequency.setValueAtTime(3600 * pv, t + 0.08);
            ring.frequency.exponentialRampToValueAtTime(2800, t + 0.3);
            const ringGain = this.ctx.createGain();
            ringGain.gain.setValueAtTime(0.07, t + 0.08);
            ringGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
            ring.connect(ringGain); ringGain.connect(this.masterGain);
            ring.start(t + 0.08); ring.stop(t + 0.38);
        }
    },

    // Poison tick - subtle hiss
    poisonTick() {
        if (!this.ctx || this.muted) return;
        const t = this.ctx.currentTime;

        const noise = this.ctx.createBufferSource();
        noise.buffer = this._noiseBuffer(0.04);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 5000;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.04, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start(t);
        noise.stop(t + 0.05);
    },

    // ─── Audio Capture for Recording ────────────────────
    _captureNode: null,

    createCaptureStream() {
        if (!this.ctx || !this.masterGain) return null;
        try {
            this._captureNode = this.ctx.createMediaStreamDestination();
            this.masterGain.connect(this._captureNode);
            return this._captureNode.stream;
        } catch (e) {
            console.warn('Audio capture not supported:', e);
            return null;
        }
    },

    destroyCaptureStream() {
        if (this._captureNode && this.masterGain) {
            try {
                this.masterGain.disconnect(this._captureNode);
            } catch (e) { /* already disconnected */ }
            this._captureNode = null;
        }
    }
};
