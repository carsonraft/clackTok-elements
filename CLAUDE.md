# CLAUDE.md — CryptoClacks-Elements

## Project Overview

CryptoClacks-Elements is a **vanilla JS + WebGL2 canvas game** where balls with weapons fight in an arena. No frameworks, no build step — just raw JS loaded via `<script>` tags in `index.html`. All game state lives under `window.WB`.

**Server**: `python3 -m http.server 8900` from the project root. Open `http://localhost:8900`.

## Architecture

### Core Pattern
- **`window.WB`** — global namespace for everything
- **`WB.Weapon`** — base class for all weapons (in `js/weapon.js`)
- **`WB.WeaponRegistry`** — registers weapons by type name + pack (classic/elemental/pantheon)
- **`WB.Config`** — all game constants (arena size, ball HP, friction, etc.)
- **`WB.Simulator`** — headless battle engine for balance testing
- **`WB.Game`** — runtime game state (balls, projectiles, hazards, particles)

### File Structure
```
index.html                  — Main game page (all scripts loaded here)
sim-balance.html            — Headless balance simulation page
js/
  config.js                 — Game constants, arena presets, friction presets
  physics.js                — Collision detection (circleCircle, lineCircle, etc.)
  ball.js                   — Ball entity (HP, debuffs, movement, forge mark system)
  weapon.js                 — WB.Weapon base class + WB.WeaponRegistry
  simulator.js              — WB.Simulator.runBattle() headless engine
  projectile.js             — WB.Projectile (arrows, bolts — with homing support)
  hazard.js                 — WB.Hazard (fire trails, ground effects)
  arena-modifiers.js        — WB.ArenaModifiers (flood, wall shift, etc.)
  particles.js              — Particle system (emit, explode, spark)
  rng.js                    — Seeded RNG (WB.random, WB.seed)
  excitement.js             — Match excitement scoring
  audio.js                  — Sound effects
  main.js                   — Game loop, state machine
  ui.js                     — Menu/HUD rendering
  sim-ui.js                 — In-game simulation UI
  renderer.js               — WebGL batch renderer bridge
  webgl/
    gl-context.js           — WebGL2 context setup
    gl-batch.js             — WB.GLBatch (fillCircle, fillRect, line, etc.)
    gl-text.js              — Font atlas text rendering
    gl-effects.js           — Damage numbers, impact rings, speed lines
  weapons/
    # Classic pack (8): sword, bow, hammer, shuriken, sawblade, ghost, clacker, gunclacker
    # Elemental pack (15): fire, ice, spark, stone, wind, water, poison, light, shadow, nature, crystal, magma, storm, metal, gravity
    # Pantheon pack (10): zeus, poseidon, hephaestus, artemis, apollo, ares, hermes, hades, athena, dionysus
```

### Key Config Values
```javascript
WB.Config.STAGE_SIZE_INDEX = 0;     // 0=SMALL(340x540), 1=MEDIUM(500x780), 2=LARGE(700x1080)
WB.Config.FRICTION_INDEX = 2;       // 2=MED(0.9998)
WB.Config.BALL_MAX_HP = 100;
WB.Config.BALL_RADIUS = 30;
WB.Config.BALL_MAX_SPEED = 14;
WB.Config.WEAPON_HIT_COOLDOWN = 15; // frames between hits
```

### Font Atlas Sizes
All font sizes MUST be one of: `[10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 26, 28, 32, 44, 48, 80]`
Using a size not in this list will render invisible text.

### Cache Busting
All `<script>` tags use `?v=N` query params. **Currently at `?v=9`**. When modifying any JS file, bump this number in BOTH `index.html` and `sim-balance.html` to avoid stale browser cache.

## Weapon System

### Creating a Weapon
Every weapon extends `WB.Weapon` and registers itself:
```javascript
class FooWeapon extends WB.Weapon {
    constructor(owner) {
        super(owner, {
            type: 'foo',
            baseDamage: 5,
            rotationSpeed: 0.04,    // rad/frame for melee weapons
            reach: 70,              // melee range in px
            scalingName: 'Stacks',  // UI label for scaling stat
            superThreshold: 10,     // hits before super activates
            isRanged: true,         // set for projectile weapons (disables melee collision)
            canParry: false,        // set to disable parry interactions
        });
    }
    update() { /* per-frame logic */ }
    onHit(target) { /* when weapon hits enemy */ }
    applyScaling() { /* recalculate stats after each hit */ }
    activateSuper() { /* one-time super activation */ }
    draw() { /* WebGL rendering via WB.GLBatch */ }
}
WB.WeaponRegistry.register('foo', FooWeapon, 'pantheon');
```

### Weapon Types in Pantheon Pack
- **Melee**: Ares (war blade), Hephaestus (forge hammer), Poseidon (trident), Dionysus (vine whip)
- **Hybrid**: Athena (shield+spear — reflects projectiles)
- **Ranged**: Artemis (homing arrows), Apollo (spread+burn), Zeus (bouncing bolts)
- **Body Contact**: Hermes (speed-based contact), Hades (AoE pulse+lifesteal)

### Debuff System (on `ball.debuffs`)
- `forgeMarks` — Hephaestus: +30% incoming damage per stack (max 10)
- `madness` — Dionysus: 3 stacks = movement inversion, 6 = weapon reversal
- `slowFactor` / `slowTimer` — Poseidon: reduces max speed
- `weaponReversed` — reverses weapon rotation direction
- `burn` — Apollo: DOT over time

## Greek Pantheon Balance State (v9)

### Final Win Rates (SMALL arena 340x540, 200 battles/matchup)
| Rank | God | Win Rate | Archetype |
|------|-----|----------|-----------|
| 1 | Hephaestus | 54.8% | Heavy melee + forge mark debuffs |
| 2 | Zeus | 54.6% | Bouncing bolt projectile |
| 3 | Hades | 52.5% | AoE pulse + gravity pull + lifesteal |
| 4 | Hermes | 52.1% | Speed-based body contact |
| 5 | Dionysus | 50.7% | Vine whip + madness debuffs |
| 6 | Apollo | 49.7% | Spread-shot + burn DOT |
| 7 | Ares | 48.6% | War blade -> berserker mode |
| 8 | Athena | 47.8% | Shield reflect + spear jab |
| 9 | Artemis | 45.2% | Homing arrow ranged |
| 10 | Poseidon | 43.9% | Trident melee + knockback + slow |

**All 10 gods within 42-58% balanced range.** Spread: 10.9 points.

### Key Counter-Matchups (Rock-Paper-Scissors)
- **Athena 100% vs Zeus/Artemis** — Shield reflects all projectiles back
- **Hades 98% vs Athena** — AoE pulse bypasses shield (no projectile to reflect)
- **Artemis 96% vs Poseidon** — Homing arrows outrange trident in small arena
- **Zeus 90% vs Poseidon/Hades** — Bouncing bolts dominate slow melee
- **Hermes 72% vs Artemis** — Too fast for homing arrows to track

### Current Weapon Stats (v9)

#### Zeus (Lightning Bolt) — Ranged
- baseDamage: 4, superThreshold: 9, fireRate: 60
- boltSpeed: 7, boltBounces: 3, homing: 0.02, damageFalloff: 0.25
- Scaling: boltSpeed min(12, 7 + hits*0.3), damage +floor(hits*0.4)

#### Poseidon (Trident) — Melee
- baseDamage: 9, superThreshold: 8, reach: 90, rotationSpeed: 0.085
- HP: 120, mass: x1.1, knockback: 4.5, slowFactor: 0.3, slowTimer: 120
- Scaling: damage +floor(hits*0.8), knockback min(8, 4.5 + hits*0.35)

#### Hephaestus (Forge Hammer) — Melee
- baseDamage: 6, superThreshold: 12, reach: 75, rotationSpeed: 0.04
- HP: 100, mass: x1.05, maxRotationSpeed: 0.075, minRotationSpeed: 0.025
- Scaling: damage +floor(hits*0.45), marks 1+floor(hits/4)

#### Artemis (Moon Bow) — Ranged
- baseDamage: 3, superThreshold: 12, fireRate: 52, arrowCount: 2
- arrowSpeed: 5, lifespan: 90, bounces: 0, homingStrength: 0.045
- Scaling: arrows 2+floor(hits/4), homing min(0.09, 0.045+hits*0.005)

#### Apollo (Sun Bow) — Ranged
- baseDamage: 4, superThreshold: 10, fireRate: 44, arrowCount: 3
- burnDamage: 1.2, burnDuration: 120, burnTickRate: 15
- arrowSpeed: 7, lifespan: 90, bounces: 0
- Scaling: arrows 3+floor(hits/3), burn min(2.5, 1.2+hits*0.15)

#### Ares (War Blade) — Melee/Berserker
- baseDamage: 7, superThreshold: 9, reach: 88, rotationSpeed: 0.035
- Berserker: regen 2HP/90frames, +7 damage, radius x1.25, mass x1.6, speed x1.4, +15 HP heal
- Scaling: damage +floor(hits*0.6)

#### Hermes (Winged Sandal) — Body Contact
- baseDamage: 4, superThreshold: 10, contactCooldownTime: 38
- HP: 92, mass: x0.82, maxSpeed: x1.25, speedBonus: floor(speed*0.3)
- Dash every 75 frames, nudge strength: 4
- Scaling: maxSpeed x min(1.55, 1.25+hits*0.035), damage +floor(hits*0.3)

#### Hades (Death Pulse) — AoE
- baseDamage: 2, superThreshold: 10, HP: 115, mass: x1.1
- pulseRate: 110, pulseRadius: 75, pulseDamage: 4, healPerHit: 2
- pullStrength: 0.14, contactAura: 3
- Scaling: pulseDmg 4+floor(hits*0.25), pull min(0.35, 0.14+hits*0.025)

#### Athena (Shield & Spear) — Hybrid
- baseDamage: 4, superThreshold: 9, reach: 72, rotationSpeed: 0.045
- HP: 110, shieldConeWidth: 0.6*PI (~108deg), reflectBonus: 1.4, spearRate: 48
- Scaling: damage +floor(hits*0.4), reflectBonus min(2.2, 1.4+hits*0.1)

#### Dionysus (Vine Whip) — Melee
- baseDamage: 7, superThreshold: 8, reach: 88, rotationSpeed: 0.085
- HP: 105, madnessPerHit: 3
- Scaling: damage +floor(hits*0.7), madness 3+floor(hits/2), rotSpeed min(0.15, 0.08+hits*0.006)

## Balance Simulation System

### Running Simulations
1. Serve the project: `python3 -m http.server 8900`
2. Open `http://localhost:8900/sim-balance.html`
3. Wait ~2-3 minutes for 9,000 battles (45 matchups x 200 each)

### CRITICAL: Arena Size Must Match
The sim-balance.html applies the game's default arena size before running:
```javascript
var preset = WB.Config.STAGE_PRESETS[WB.Config.STAGE_SIZE_INDEX]; // SMALL = 340x540
WB.Config.ARENA.width = preset.width;
WB.Config.ARENA.height = preset.height;
```
**Never change this.** Previous balance work was invalidated because sims ran in MEDIUM (500x780) while the game uses SMALL (340x540). The smaller arena fundamentally changes balance — ranged/homing weapons are stronger, body-contact weapons bounce more, and escape is harder.

### Balance Tuning Methodology
This balance was achieved through **7 rounds of iterative simulation**, totaling ~63,000 headless battles:

1. **Never change more than 2-3 stats per god per round** — overcorrecting multiple stats causes wild oscillation (Apollo went 89%->15% when 6 stats were nerfed simultaneously)
2. **Diminishing adjustments** — Round 1 had +-50% stat changes, Round 7 used +-5% tweaks
3. **Artemis homing is ultra-sensitive** — In the small arena, homing 0.04 = 35% win rate, 0.05 = 65% win rate, 0.045 = 45% win rate. Fractional changes matter enormously.
4. **Athena is the ranged-god check** — Her shield creates a natural counter-system. Don't nerf her anti-projectile capability or all ranged gods become overpowered.
5. **Statistical noise** — With 200 battles/matchup, expect ~+-3.5% variance between runs. Don't react to single-run results; look for consistent patterns.

### Balance History (starting point -> final)
| God | Initial | R1 | R2 | R3 | R4 | Final (R7) |
|-----|---------|----|----|----|----|------------|
| Artemis | 92.2% | 48.7% | 41.3% | 66.0% | 52.8% | 45.2% |
| Apollo | 89.9% | 15.6% | 35.0% | 45.7% | 49.9% | 49.7% |
| Hephaestus | 76.2% | 54.1% | 58.2% | 44.3% | 53.9% | 54.8% |
| Zeus | 23.5% | 67.8% | 56.1% | 56.0% | 51.7% | 54.6% |
| Hermes | 31.8% | 84.1% | 37.1% | 53.5% | 55.8% | 52.1% |
| Athena | 32.2% | 67.7% | 49.6% | 45.6% | 47.1% | 47.8% |
| Dionysus | 34.9% | 39.3% | 55.3% | 52.3% | 48.2% | 50.7% |
| Ares | 36.6% | 57.1% | 60.8% | 44.3% | 45.3% | 48.6% |
| Poseidon | 38.4% | 38.6% | 47.3% | 45.3% | 49.7% | 43.9% |
| Hades | 44.3% | 27.2% | 59.3% | 47.1% | 48.1% | 52.5% |

## Visual System Notes
- **Particles**: Global reduction applied (emit x0.5, explode x0.4, spark x0.4, cap 300)
- **Wall effects**: Reduced wall impact visuals, impact rings, collision flash
- **Zeus super**: Was causing visual overload — golden blob covering everything. Fixed by reducing bolt count and flash.
- **Hazard rendering**: Uses ring outlines + faint fill (not solid circles)
- **Font sizes**: All UI fonts bumped 2-4px from original. Battle fonts also increased.

## Known Issues / Watch Items
- **Inferno (fire) elemental** hard-counters ALL pantheon gods (0-3% win rates) — cross-pack balance not yet addressed
- **Gravity Well** elemental is also problematic vs some pantheon gods
- **Frostbite and Volt Whip** elementals lose to every pantheon god (100% losses) — opposite imbalance
- **Zeus boltSpeed scaling** starts from 7 in constructor but scaling formula was corrected to match
- **Poseidon knockback scaling** similarly corrected to start from 4.5 base

## Development Tips
- **Testing changes**: Always bump `?v=N` in both HTML files after editing any JS
- **Quick balance check**: Run sim-balance.html, look at the "Balance Recommendations" section at bottom — it flags gods outside 42-58%
- **Projectile homing**: `homing` property on WB.Projectile — the projectile curves toward the nearest enemy each frame by this angular amount
- **Super system**: `hitCount >= superThreshold` triggers `activateSuper()` once. `this.superActive` stays true forever after.
- **Debuffs applied in ball.js**: `takeDamage()` checks `forgeMarks` to amplify damage. Movement checks `slowFactor`/`slowTimer` and `madness`.
