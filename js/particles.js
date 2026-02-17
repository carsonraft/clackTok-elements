window.WB = window.WB || {};

// ─── Pool-based Particle System ─────────────────────────────
// Pre-allocates all particle objects to eliminate GC pressure.
// Dead particles are swap-removed in O(1) instead of splice O(n).

const PARTICLE_CAP = 150;

WB.Particle = class {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.life = 0;
        this.maxLife = 0;
        this.color = '#FFF';
        this.size = 1;
    }

    reset(x, y, color, opts) {
        opts = opts || {};
        this.x = x;
        this.y = y;
        const speed = opts.speed || 4;
        const angle = Math.random() * Math.PI * 2;
        const mag = (0.3 + Math.random() * 0.7) * speed;
        this.vx = Math.cos(angle) * mag;
        this.vy = Math.sin(angle) * mag;
        this.life = opts.life || (20 + Math.random() * 25);
        this.maxLife = this.life;
        this.color = color;
        this.size = opts.size || (1.5 + Math.random() * 2);
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.94;
        this.vy *= 0.94;
        this.life--;
    }

    draw() {
        const B = WB.GLBatch;
        const alpha = this.life / this.maxLife;
        B.setAlpha(alpha);
        // Use circles for smooth anti-aliased particles on HiDPI
        B.fillCircle(this.x, this.y, this.size * 0.5, this.color);
        B.restoreAlpha();
    }
};

WB.ParticleSystem = class {
    constructor() {
        // Pre-allocate full pool — zero allocations during gameplay
        this.pool = new Array(PARTICLE_CAP);
        for (let i = 0; i < PARTICLE_CAP; i++) {
            this.pool[i] = new WB.Particle();
        }
        this.activeCount = 0;
    }

    _acquire(x, y, color, opts) {
        if (this.activeCount >= PARTICLE_CAP) {
            // Recycle oldest particle (index 0)
            this.pool[0].reset(x, y, color, opts);
            // Swap it to end of active range so it's "newest"
            const temp = this.pool[0];
            this.pool[0] = this.pool[this.activeCount - 1];
            this.pool[this.activeCount - 1] = temp;
            return;
        }
        this.pool[this.activeCount].reset(x, y, color, opts);
        this.activeCount++;
    }

    emit(x, y, count, color, opts) {
        count = Math.ceil(count * 0.3);  // global particle reduction
        for (let i = 0; i < count; i++) {
            this._acquire(x, y, color, opts);
        }
    }

    explode(x, y, count, color) {
        count = Math.ceil(count * 0.25);  // global particle reduction
        for (let i = 0; i < count; i++) {
            this._acquire(x, y, color, {
                speed: 6 + Math.random() * 4,
                life: 20 + Math.random() * 15,
                size: 2 + Math.random() * 3
            });
        }
    }

    spark(x, y, count) {
        count = Math.ceil(count * 0.25);  // global particle reduction
        const colors = ['#FFD700', '#FFF', '#FFA500'];
        for (let i = 0; i < count; i++) {
            const color = colors[Math.floor(Math.random() * colors.length)];
            this._acquire(x, y, color, {
                speed: 5 + Math.random() * 3,
                life: 6 + Math.random() * 6,
                size: 1.5 + Math.random() * 2
            });
        }
    }

    update() {
        for (let i = this.activeCount - 1; i >= 0; i--) {
            this.pool[i].update();
            if (this.pool[i].life <= 0) {
                // Swap dead particle with last active particle (O(1) removal)
                this.activeCount--;
                const temp = this.pool[i];
                this.pool[i] = this.pool[this.activeCount];
                this.pool[this.activeCount] = temp;
            }
        }
    }

    draw() {
        for (let i = 0; i < this.activeCount; i++) {
            this.pool[i].draw();
        }
    }
};
