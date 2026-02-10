window.WB = window.WB || {};

WB.Physics = {
    dot(ax, ay, bx, by) {
        return ax * bx + ay * by;
    },

    magnitude(x, y) {
        return Math.sqrt(x * x + y * y);
    },

    normalize(x, y) {
        const m = Math.sqrt(x * x + y * y);
        if (m === 0) return { x: 0, y: 0 };
        return { x: x / m, y: y / m };
    },

    distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    },

    distanceSq(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return dx * dx + dy * dy;
    },

    circleCircle(x1, y1, r1, x2, y2, r2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const minDist = r1 + r2;
        return (dx * dx + dy * dy) < (minDist * minDist);
    },

    pointCircle(px, py, cx, cy, cr) {
        const dx = px - cx;
        const dy = py - cy;
        return (dx * dx + dy * dy) < (cr * cr);
    },

    // Line segment (x1,y1)-(x2,y2) vs circle (cx,cy,cr)
    lineCircle(x1, y1, x2, y2, cx, cy, cr) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const fx = x1 - cx;
        const fy = y1 - cy;
        const a = dx * dx + dy * dy;
        const b = 2 * (fx * dx + fy * dy);
        const c = fx * fx + fy * fy - cr * cr;
        let discriminant = b * b - 4 * a * c;
        if (discriminant < 0) return false;
        discriminant = Math.sqrt(discriminant);
        const t1 = (-b - discriminant) / (2 * a);
        const t2 = (-b + discriminant) / (2 * a);
        if (t1 >= 0 && t1 <= 1) return true;
        if (t2 >= 0 && t2 <= 1) return true;
        return false;
    },

    // Elastic collision response for two balls
    resolveCircleCircle(a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return;

        const nx = dx / dist;
        const ny = dy / dist;

        const dvx = a.vx - b.vx;
        const dvy = a.vy - b.vy;
        const dvDotN = dvx * nx + dvy * ny;

        // Don't resolve if already moving apart
        if (dvDotN < 0) return;

        const restitution = WB.Config.BALL_RESTITUTION;
        const j = (1 + restitution) * dvDotN / (a.mass + b.mass);

        a.vx -= j * b.mass * nx;
        a.vy -= j * b.mass * ny;
        b.vx += j * a.mass * nx;
        b.vy += j * a.mass * ny;
    },

    // Push overlapping circles apart
    separateCircles(a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = a.radius + b.radius;
        if (dist >= minDist || dist === 0) return;

        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = (minDist - dist) / 2 + 0.5;

        a.x -= nx * overlap;
        a.y -= ny * overlap;
        b.x += nx * overlap;
        b.y += ny * overlap;
    },

    // Bounce ball off arena walls, returns which wall was hit (or null)
    bounceOffWalls(ball, arena) {
        const r = ball.radius;
        const left = arena.x;
        const right = arena.x + arena.width;
        const top = arena.y;
        const bottom = arena.y + arena.height;
        const e = WB.Config.WALL_RESTITUTION;
        let hit = null;

        if (ball.x - r < left) {
            ball.x = left + r;
            ball.vx = Math.abs(ball.vx) * e;
            hit = 'left';
        }
        if (ball.x + r > right) {
            ball.x = right - r;
            ball.vx = -Math.abs(ball.vx) * e;
            hit = 'right';
        }
        if (ball.y - r < top) {
            ball.y = top + r;
            ball.vy = Math.abs(ball.vy) * e;
            hit = 'top';
        }
        if (ball.y + r > bottom) {
            ball.y = bottom - r;
            ball.vy = -Math.abs(ball.vy) * e;
            hit = 'bottom';
        }
        return hit;
    },

    // Bounce ball when its melee weapon tip extends outside the arena.
    // Strength scales with weapon damage when WEAPON_WALL_DMG_BOUNCE is on.
    weaponWallBounce(ball, arena) {
        const weapon = ball.weapon;
        if (!weapon || weapon.reach === 0 || weapon.isRanged) return null;

        const tipX = weapon.getTipX();
        const tipY = weapon.getTipY();
        const left = arena.x;
        const right = arena.x + arena.width;
        const top = arena.y;
        const bottom = arena.y + arena.height;

        // Base strength, optionally scaled by weapon damage
        let strength = WB.Config.WEAPON_WALL_BOUNCE_STRENGTH;
        if (WB.Config.WEAPON_WALL_DMG_BOUNCE) {
            strength = 1.0 + weapon.currentDamage * 0.5;
        }
        let hit = null;

        if (tipX < left) { ball.vx += strength; hit = 'left'; }
        else if (tipX > right) { ball.vx -= strength; hit = 'right'; }
        if (tipY < top) { ball.vy += strength; hit = hit || 'top'; }
        else if (tipY > bottom) { ball.vy -= strength; hit = hit || 'bottom'; }

        return hit;
    }
};
