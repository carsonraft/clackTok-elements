window.WB = window.WB || {};

// Tracks battle metrics frame-by-frame and computes excitement score.
WB.Excitement = class {
    constructor() {
        this.frameCount = 0;
        this.totalHits = 0;
        this.superActivations = 0;
        this.leadChanges = 0;
        this.criticalZoneFrames = 0;
        this.lastLeader = null;
        this.b1MaxDeficit = 0;
        this.b2MaxDeficit = 0;
    }

    recordFrame(ball1, ball2) {
        this.frameCount++;

        const leader = ball1.hp >= ball2.hp ? 1 : 2;
        if (this.lastLeader !== null && leader !== this.lastLeader) {
            this.leadChanges++;
        }
        this.lastLeader = leader;

        // Track deficits for comeback scoring
        const deficit1 = ball2.hp - ball1.hp;
        const deficit2 = ball1.hp - ball2.hp;
        if (deficit1 > 0) this.b1MaxDeficit = Math.max(this.b1MaxDeficit, deficit1);
        if (deficit2 > 0) this.b2MaxDeficit = Math.max(this.b2MaxDeficit, deficit2);

        // Critical zone: either ball below 30% HP
        const threshold = WB.Config.BALL_MAX_HP * 0.3;
        if (ball1.hp < threshold || ball2.hp < threshold) {
            this.criticalZoneFrames++;
        }
    }

    recordHit() {
        this.totalHits++;
    }

    recordSuper() {
        this.superActivations++;
    }

    // Compute composite excitement score. winnerIdx = 0 or 1.
    computeScore(winnerIdx, ball1, ball2) {
        const winnerBall = winnerIdx === 0 ? ball1 : ball2;

        // Closeness (0-30): how close the winner was to dying
        const winnerHpPct = winnerBall.hp / WB.Config.BALL_MAX_HP;
        const closeness = (1 - winnerHpPct) * 30;

        // Lead changes (0-25)
        const leadScore = Math.min(25, this.leadChanges * 5);

        // Comeback (0-20): biggest deficit the winner overcame
        const winnerMaxDeficit = winnerIdx === 0 ? this.b1MaxDeficit : this.b2MaxDeficit;
        const comebackPct = winnerMaxDeficit / WB.Config.BALL_MAX_HP;
        const comebackScore = Math.min(20, comebackPct * 40);

        // Critical zone (0-15): % of battle in danger zone
        const critPct = this.criticalZoneFrames / Math.max(1, this.frameCount);
        const critScore = Math.min(15, critPct * 50);

        // Action density (0-10): hits per second
        const hitsPerSec = this.totalHits / Math.max(1, this.frameCount / 60);
        const actionScore = Math.min(10, hitsPerSec * 3);

        // Duration curve (0-10): sweet spot 10-30 seconds
        let durationScore = 0;
        const dur = this.frameCount;
        if (dur < 300) durationScore = dur / 300 * 5;
        else if (dur < 600) durationScore = 5 + (dur - 300) / 300 * 5;
        else if (dur <= 1800) durationScore = 10;
        else if (dur <= 3600) durationScore = 10 - (dur - 1800) / 1800 * 10;
        else durationScore = 0;

        // Super bonus (0-5)
        const superScore = Math.min(5, this.superActivations * 2);

        const total = closeness + leadScore + comebackScore + critScore
                    + actionScore + durationScore + superScore;

        return {
            total: Math.round(total * 10) / 10,
            breakdown: {
                closeness: Math.round(closeness * 10) / 10,
                leadChanges: leadScore,
                comeback: Math.round(comebackScore * 10) / 10,
                criticalZone: Math.round(critScore * 10) / 10,
                actionDensity: Math.round(actionScore * 10) / 10,
                duration: Math.round(durationScore * 10) / 10,
                supers: superScore,
            },
            meta: {
                frames: this.frameCount,
                totalHits: this.totalHits,
                leadChanges: this.leadChanges,
                winnerHpRemaining: Math.ceil(winnerBall.hp),
                comebackDeficit: Math.round(winnerMaxDeficit),
            }
        };
    }
};
