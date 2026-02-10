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
        sword: 'blade', dagger: 'blade', scythe: 'blade', axe: 'blade',
        hammer: 'blunt', unarmed: 'blunt', duplicator: 'blunt',
        spear: 'pierce', lance: 'pierce', crossbow: 'pierce',
        bow: 'ranged', shuriken: 'ranged', boomerang: 'ranged',
        magnet: 'tech', sawblade: 'tech',
        ghost: 'ethereal', muscle: 'blunt', buu: 'blunt', clacker: 'blunt',
        gunclacker: 'ranged', sailormoon: 'ranged', david: 'tech', vash: 'ranged',
    },

    // Random pitch variation factor
    _pitchVar() { return 1 + (Math.random() - 0.5) * 0.3; },

    // Wall clack - SUPER CLACKY sharp crack with layered resonance
    wallClack(speed) {
        if (!this.ctx || this.muted) return;
        const t = this.ctx.currentTime;
        const vol = Math.min(0.5, 0.2 + speed * 0.06);
        const variant = Math.random();
        const pv = this._pitchVar();

        if (variant < 0.5) {
            // Bandpass noise burst — louder, wider
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._noiseBuffer(0.05);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = (2500 + speed * 500) * pv;
            filter.Q.value = 4 + Math.random() * 8;
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(vol, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
            noise.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
            noise.start(t); noise.stop(t + 0.05);
        } else {
            // Short sine pop — sharper
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            const freq = (3000 + speed * 400) * pv;
            osc.frequency.setValueAtTime(freq, t);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.3, t + 0.025);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(vol * 0.8, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.04);
        }
        // EXTRA CLACK LAYER — high-freq resonant ping on every wall hit
        const clackOsc = this.ctx.createOscillator();
        clackOsc.type = 'triangle';
        const clackFreq = (4000 + speed * 600) * pv;
        clackOsc.frequency.setValueAtTime(clackFreq, t);
        clackOsc.frequency.exponentialRampToValueAtTime(clackFreq * 0.2, t + 0.02);
        const clackGain = this.ctx.createGain();
        clackGain.gain.setValueAtTime(vol * 0.5, t);
        clackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
        clackOsc.connect(clackGain); clackGain.connect(this.masterGain);
        clackOsc.start(t); clackOsc.stop(t + 0.03);
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

        // Per-weapon sound — each type has a distinct voice
        const handler = this._weaponSounds[weaponType];
        if (handler) {
            handler.call(this, t, combo, pv);
        } else {
            // Fallback: generic blade sound
            this._weaponSounds.sword.call(this, t, combo, pv);
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

        // DAGGER: Quick staccato stab — high triangle, very short
        dagger(t, combo, pv) {
            const pitch = (1800 + combo * 100) * pv;
            const osc = this.ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(pitch, t);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.4, t + 0.04);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.25, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.06);
            // Tiny click layer
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._noiseBuffer(0.02);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = 5000;
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.12, t);
            nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
            noise.connect(filter); filter.connect(nGain); nGain.connect(this.masterGain);
            noise.start(t); noise.stop(t + 0.03);
        },

        // AXE: Heavy chop — low sine thud + mid-freq metallic crunch
        axe(t, combo, pv) {
            const pitch = (400 + combo * 40) * pv;
            // Low impact thud
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(pitch, t);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.25, t + 0.12);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.3, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.16);
            // Crunchy noise layer
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._noiseBuffer(0.06);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = (900 + combo * 60) * pv;
            filter.Q.value = 2;
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.2, t);
            nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
            noise.connect(filter); filter.connect(nGain); nGain.connect(this.masterGain);
            noise.start(t); noise.stop(t + 0.08);
        },

        // SCYTHE: Eerie whistle slash — descending sine with breathy noise
        scythe(t, combo, pv) {
            const pitch = (1600 + combo * 60) * pv;
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(pitch, t);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.3, t + 0.15);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.15, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.2);
            // Breathy whoosh layer
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._noiseBuffer(0.1);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(2000 * pv, t);
            filter.frequency.exponentialRampToValueAtTime(600, t + 0.1);
            filter.Q.value = 1.5;
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.12, t);
            nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
            noise.connect(filter); filter.connect(nGain); nGain.connect(this.masterGain);
            noise.start(t); noise.stop(t + 0.12);
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

        // SPEAR: Sharp thrust — mid square pop, quick decay
        spear(t, combo, pv) {
            const pitch = (1400 + combo * 90) * pv;
            const osc = this.ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.setValueAtTime(pitch, t);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.5, t + 0.05);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.18, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.07);
        },

        // LANCE: Powerful impale — rising square + heavy crunch
        lance(t, combo, pv) {
            const pitch = (800 + combo * 80) * pv;
            const osc = this.ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.setValueAtTime(pitch * 0.6, t);
            osc.frequency.exponentialRampToValueAtTime(pitch, t + 0.03);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.3, t + 0.1);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.25, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.14);
            // Impact crunch
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._noiseBuffer(0.06);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 1200 * pv;
            filter.Q.value = 3;
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.2, t);
            nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
            noise.connect(filter); filter.connect(nGain); nGain.connect(this.masterGain);
            noise.start(t); noise.stop(t + 0.07);
        },

        // CROSSBOW: Bolt impact thwack — sharp attack, woody
        crossbow(t, combo, pv) {
            const pitch = (2200 + combo * 100) * pv;
            const osc = this.ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(pitch, t);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.2, t + 0.06);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.2, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.08);
            // Woody thud
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._noiseBuffer(0.03);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 1800 * pv;
            filter.Q.value = 5;
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.15, t);
            nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
            noise.connect(filter); filter.connect(nGain); nGain.connect(this.masterGain);
            noise.start(t); noise.stop(t + 0.04);
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

        // BOOMERANG: Whooping curve — sine frequency sweep up then down
        boomerang(t, combo, pv) {
            const pitch = (600 + combo * 40) * pv;
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(pitch, t);
            osc.frequency.exponentialRampToValueAtTime(pitch * 2, t + 0.06);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.5, t + 0.12);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.2, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.15);
        },

        // DUPLICATOR: Squishy slap — low triangle + noise burst, organic feel
        duplicator(t, combo, pv) {
            const pitch = (350 + combo * 25) * pv;
            const osc = this.ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(pitch, t);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.4, t + 0.08);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.22, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.12);
            // Wet slap noise
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._noiseBuffer(0.04);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 500 * pv;
            filter.Q.value = 6;
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.18, t);
            nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
            noise.connect(filter); filter.connect(nGain); nGain.connect(this.masterGain);
            noise.start(t); noise.stop(t + 0.05);
        },

        // UNARMED: Punchy thud — mid sine + sharp noise pop
        unarmed(t, combo, pv) {
            const pitch = (300 + combo * 30) * pv;
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(pitch, t);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.3, t + 0.08);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.28, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.12);
            // Knuckle crack noise
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._noiseBuffer(0.03);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 1500 * pv;
            filter.Q.value = 8;
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.15, t);
            nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
            noise.connect(filter); filter.connect(nGain); nGain.connect(this.masterGain);
            noise.start(t); noise.stop(t + 0.04);
        },

        // MAGNET: Electric zap — sawtooth buzz + rising tone
        magnet(t, combo, pv) {
            const pitch = (600 + combo * 40) * pv;
            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(pitch, t);
            osc.frequency.exponentialRampToValueAtTime(pitch * 2.5, t + 0.06);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = pitch * 1.5;
            filter.Q.value = 4;
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.18, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
            osc.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.1);
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

        // GOKU: Ki burst — rising sine + energy pop
        goku(t, combo, pv) {
            const pitch = (800 + combo * 50) * pv;
            // Rising energy tone
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(pitch, t);
            osc.frequency.exponentialRampToValueAtTime(pitch * 2, t + 0.06);
            osc.frequency.exponentialRampToValueAtTime(pitch * 1.2, t + 0.1);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.25, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.14);
            // Energy pop noise
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._noiseBuffer(0.04);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 2000 * pv;
            filter.Q.value = 4;
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.18, t);
            nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
            noise.connect(filter); filter.connect(nGain); nGain.connect(this.masterGain);
            noise.start(t); noise.stop(t + 0.05);
        },

        // VEGETA: Ki burst — descending aggressive pulse + low growl
        vegeta(t, combo, pv) {
            const pitch = (600 + combo * 40) * pv;
            // Aggressive descending tone
            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(pitch * 1.5, t);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.6, t + 0.08);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.2, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.12);
            // Low rumble
            const osc2 = this.ctx.createOscillator();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(pitch * 0.5, t);
            const gain2 = this.ctx.createGain();
            gain2.gain.setValueAtTime(0.15, t);
            gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
            osc2.connect(gain2); gain2.connect(this.masterGain);
            osc2.start(t); osc2.stop(t + 0.1);
            // Energy crack noise
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._noiseBuffer(0.03);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = 2500 * pv;
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.2, t);
            nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
            noise.connect(filter); filter.connect(nGain); nGain.connect(this.masterGain);
            noise.start(t); noise.stop(t + 0.04);
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

        // MUSCLE: Heavy body slam — ultra-low thud + meaty noise crunch
        muscle(t, combo, pv) {
            const pitch = (100 + combo * 10) * pv;
            // Ultra-low bass thud
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(pitch, t);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.15, t + 0.2);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.4, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.28);
            // Meaty impact crunch
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._noiseBuffer(0.1);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 800 * pv;
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.3, t);
            nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
            noise.connect(filter); filter.connect(nGain); nGain.connect(this.masterGain);
            noise.start(t); noise.stop(t + 0.12);
            // Secondary mid-range body slap
            const osc2 = this.ctx.createOscillator();
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(250 * pv, t);
            osc2.frequency.exponentialRampToValueAtTime(80, t + 0.1);
            const gain2 = this.ctx.createGain();
            gain2.gain.setValueAtTime(0.2, t);
            gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
            osc2.connect(gain2); gain2.connect(this.masterGain);
            osc2.start(t); osc2.stop(t + 0.14);
        },

        // BUU: Wet squishy slap — low wobble sine + wet noise burst + bounce pop
        buu(t, combo, pv) {
            const pitch = (180 + combo * 15) * pv;
            // Wobbling low sine (the squish)
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(pitch, t);
            osc.frequency.setValueAtTime(pitch * 1.3, t + 0.03);
            osc.frequency.setValueAtTime(pitch * 0.7, t + 0.06);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.3, t + 0.15);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.3, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.2);
            // Wet slap noise
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._noiseBuffer(0.06);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = (400 + combo * 30) * pv;
            filter.Q.value = 3;
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.25, t);
            nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
            noise.connect(filter); filter.connect(nGain); nGain.connect(this.masterGain);
            noise.start(t); noise.stop(t + 0.08);
            // Bounce pop (high sine)
            const pop = this.ctx.createOscillator();
            pop.type = 'sine';
            pop.frequency.setValueAtTime(800 * pv, t + 0.02);
            pop.frequency.exponentialRampToValueAtTime(300, t + 0.08);
            const popGain = this.ctx.createGain();
            popGain.gain.setValueAtTime(0.15, t + 0.02);
            popGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
            pop.connect(popGain); popGain.connect(this.masterGain);
            pop.start(t + 0.02); pop.stop(t + 0.1);
        },

        // SAILOR MOON: Sparkly magical chime — ascending arpeggiated sine + shimmer
        sailormoon(t, combo, pv) {
            const pitch = (1200 + combo * 70) * pv;
            // Sparkle arpeggio (3 quick ascending notes)
            for (let i = 0; i < 3; i++) {
                const delay = i * 0.02;
                const notePitch = pitch * (1 + i * 0.3);
                const osc = this.ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(notePitch, t + delay);
                osc.frequency.exponentialRampToValueAtTime(notePitch * 0.7, t + delay + 0.06);
                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(0.15, t + delay);
                gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.08);
                osc.connect(gain); gain.connect(this.masterGain);
                osc.start(t + delay); osc.stop(t + delay + 0.1);
            }
            // High shimmer noise
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._noiseBuffer(0.06);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = 4000 * pv;
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.08, t);
            nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
            noise.connect(filter); filter.connect(nGain); nGain.connect(this.masterGain);
            noise.start(t); noise.stop(t + 0.08);
        },

        // DAVID: Cyber-punch impact — distorted bass hit + digital glitch
        david(t, combo, pv) {
            const pitch = (200 + combo * 20) * pv;
            // Heavy bass punch
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(pitch, t);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.15, t + 0.15);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.35, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.2);
            // Digital glitch (rapid square oscillation)
            const glitch = this.ctx.createOscillator();
            glitch.type = 'square';
            glitch.frequency.setValueAtTime(2200 * pv, t);
            glitch.frequency.setValueAtTime(800, t + 0.015);
            glitch.frequency.setValueAtTime(3500, t + 0.025);
            glitch.frequency.exponentialRampToValueAtTime(500, t + 0.05);
            const gGain = this.ctx.createGain();
            gGain.gain.setValueAtTime(0.1, t);
            gGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
            glitch.connect(gGain); gGain.connect(this.masterGain);
            glitch.start(t); glitch.stop(t + 0.06);
            // Impact crunch
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._noiseBuffer(0.05);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 1000 * pv;
            filter.Q.value = 2;
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.22, t);
            nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
            noise.connect(filter); filter.connect(nGain); nGain.connect(this.masterGain);
            noise.start(t); noise.stop(t + 0.07);
        },

        // VASH: Revolver shot impact — gunClack-style but with western twang
        vash(t, combo, pv) {
            const pitch = (1400 + combo * 80) * pv;
            // Sharp crack (gunshot transient)
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._noiseBuffer(0.012);
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.3, t);
            nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.015);
            noise.connect(nGain); nGain.connect(this.masterGain);
            noise.start(t); noise.stop(t + 0.02);
            // Western twang (sine with vibrato)
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(pitch * 1.2, t);
            osc.frequency.setValueAtTime(pitch * 0.8, t + 0.03);
            osc.frequency.setValueAtTime(pitch * 1.1, t + 0.05);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.5, t + 0.12);
            const oGain = this.ctx.createGain();
            oGain.gain.setValueAtTime(0.15, t);
            oGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
            osc.connect(oGain); oGain.connect(this.masterGain);
            osc.start(t); osc.stop(t + 0.16);
            // Low thud
            const bass = this.ctx.createOscillator();
            bass.type = 'sine';
            bass.frequency.setValueAtTime(120 * pv, t);
            bass.frequency.exponentialRampToValueAtTime(35, t + 0.1);
            const bGain = this.ctx.createGain();
            bGain.gain.setValueAtTime(0.22, t);
            bGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
            bass.connect(bGain); bGain.connect(this.masterGain);
            bass.start(t); bass.stop(t + 0.14);
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
    projectileFire() {
        if (!this.ctx || this.muted) return;
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
    }
};
