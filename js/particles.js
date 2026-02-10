window.WB = window.WB || {};

WB.Particle = class {
    constructor(x, y, color, opts) {
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
        this.size = opts.size || (2 + Math.random() * 3);
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
        B.fillRect(
            this.x - this.size / 2,
            this.y - this.size / 2,
            this.size,
            this.size,
            this.color
        );
        B.restoreAlpha();
    }
};

WB.ParticleSystem = class {
    constructor() {
        this.particles = [];
    }

    emit(x, y, count, color, opts) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new WB.Particle(x, y, color, opts));
        }
    }

    explode(x, y, count, color) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new WB.Particle(x, y, color, {
                speed: 6 + Math.random() * 4,
                life: 40 + Math.random() * 30,
                size: 3 + Math.random() * 5
            }));
        }
    }

    spark(x, y, count) {
        const colors = ['#FFD700', '#FFF', '#FFA500'];
        for (let i = 0; i < count; i++) {
            const color = colors[Math.floor(Math.random() * colors.length)];
            this.particles.push(new WB.Particle(x, y, color, {
                speed: 5 + Math.random() * 3,
                life: 10 + Math.random() * 10,
                size: 1.5 + Math.random() * 2
            }));
        }
    }

    update() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update();
            if (this.particles[i].life <= 0) {
                this.particles.splice(i, 1);
            }
        }
        if (this.particles.length > 600) {
            this.particles.splice(0, this.particles.length - 600);
        }
    }

    draw() {
        for (const p of this.particles) {
            p.draw();
        }
    }
};
