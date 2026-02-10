window.WB = window.WB || {};

// Seedable PRNG using mulberry32 algorithm.
// When seeded, WB.random() produces a deterministic sequence.
// When unseeded, WB.random() falls through to Math.random().
WB.RNG = {
    _seed: null,
    _state: null,
    _seeded: false,

    seed(s) {
        this._seed = s;
        this._state = s;
        this._seeded = true;
    },

    unseed() {
        this._seeded = false;
        this._seed = null;
        this._state = null;
    },

    getSeed() {
        return this._seed;
    },

    generateSeed() {
        return Math.floor(Math.random() * 0x7FFFFFFF);
    }
};

WB.random = function() {
    if (WB.RNG._seeded) {
        // mulberry32
        let t = WB.RNG._state += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return Math.random();
};
