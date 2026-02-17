# Cutscene System API Reference

> **File:** `js/cutscene.js` | **Object:** `WB.Cutscene` | **Toggle:** SCENES button in menu

## Quick Start

```js
// Enable cutscenes (they auto-play before/after every battle)
WB.Config.CUTSCENE_ENABLED = true;

// Or play a custom cutscene anytime:
WB.Cutscene.playCutscene([
    { type: 'letterbox', height: 50 },
    { type: 'narrate', text: "In the beginning, there were balls.", voice: 'epic' },
    { type: 'camera', target: 'ball1', preset: 'slam-zoom', duration: 60 },
    { type: 'narrate', text: "And they were ANGRY.", voice: 'villain' },
    { type: 'effect', name: 'shake', intensity: 10 },
    { type: 'letterbox', active: false },
], () => console.log('done!'));
```

---

## Step Types

Every cutscene is an array of step objects. Steps execute sequentially unless wrapped in `parallel`.

### `camera` — Smooth zoom/pan to a target

```js
{ type: 'camera', target: 'ball1', zoom: 2.5, ease: 0.06, duration: 120 }
{ type: 'camera', target: 'ball1', preset: 'slam-zoom', duration: 60 }  // use a preset
{ type: 'camera', target: [200, 300], zoom: 3.0, rotation: 0.1, duration: 90 }
```

| Property   | Type              | Default | Description |
|------------|-------------------|---------|-------------|
| `target`   | string or [x,y]   | required | Where to point the camera (see Targets) |
| `zoom`     | number            | 1.0     | Zoom level (1.0 = normal, 5.0 = extreme closeup) |
| `ease`     | number            | 0.04    | Easing speed (0.01 = very slow, 0.15 = fast, 1.0 = instant) |
| `duration` | number            | 60      | Frames before step completes (60 = 1 second) |
| `rotation` | number            | 0       | Camera rotation in radians (for dutch angles) |
| `preset`   | string            | -       | Named camera preset (overrides zoom/ease/rotation if not explicitly set) |

### `cut` — Instant camera jump (no easing)

```js
{ type: 'cut', target: 'ball2', zoom: 3.0 }
```

Same properties as `camera` but applies instantly with no interpolation. Good for hard cuts between scenes.

### `pan` — Cinematic pan from A to B

```js
{ type: 'pan', from: 'ball1', target: 'ball2', zoom: 2.0, duration: 180 }
```

| Property   | Type            | Default  | Description |
|------------|-----------------|----------|-------------|
| `from`     | string or [x,y] | current  | Starting position (omit to pan from current camera pos) |
| `target`   | string or [x,y] | required | Ending position |
| `zoom`     | number          | -        | Zoom level during pan |
| `duration` | number          | 120      | Frames for the pan (uses ease-in-out) |

### `dolly` — Smooth zoom change over time

```js
{ type: 'dolly', fromZoom: 1.0, zoom: 4.0, target: 'ball1', duration: 90 }
```

| Property   | Type            | Default | Description |
|------------|-----------------|---------|-------------|
| `fromZoom` | number          | current | Starting zoom level |
| `zoom`     | number          | 1.0     | Ending zoom level |
| `target`   | string or [x,y] | -       | Optional position to move toward |
| `duration` | number          | 90      | Frames for the dolly (uses ease-in-out) |

### `orbit` — Sweep/arc around a target

```js
{ type: 'orbit', target: 'arena', radius: 80, startAngle: 0, endAngle: Math.PI, zoom: 2.0, duration: 180 }
```

| Property     | Type   | Default  | Description |
|--------------|--------|----------|-------------|
| `target`     | string | 'arena'  | Center point to orbit around |
| `radius`     | number | 50       | Distance from center (pixels) |
| `startAngle` | number | 0        | Starting angle (radians) |
| `endAngle`   | number | Math.PI  | Ending angle (radians) |
| `duration`   | number | 120      | Frames for the orbit |

### `narrate` — Show typewriter text + speak it aloud

```js
{ type: 'narrate', text: "Tonight's forecast: violence.", voice: 'narrator', hold: 30 }
{ type: 'narrate', text: "I will destroy you.", voice: 'villain', speaker: 'HADES', speed: 2.0 }
```

| Property  | Type   | Default    | Description |
|-----------|--------|------------|-------------|
| `text`    | string | required   | The text to display and speak |
| `voice`   | string | 'narrator' | Voice preset name (see Voice Presets) |
| `rate`    | number | (preset)   | Speech rate override (0.1-2.0) |
| `pitch`   | number | (preset)   | Speech pitch override (0.0-2.0) |
| `volume`  | number | (preset)   | Speech volume override (0.0-1.0) |
| `speaker` | string | 'NARRATOR' | Label shown in the dialogue box |
| `speed`   | number | 1.5        | Typewriter reveal speed (chars/frame) |
| `hold`    | number | 90         | Extra frames to hold text after reveal finishes |

**Completion:** Waits for BOTH text reveal AND speech to finish, plus hold time.

### `dialogue` — Show typewriter text only (no speech)

Same properties as `narrate` except no voice/rate/pitch/volume. Completes when text is fully revealed + hold time.

### `speak` — Speak text aloud only (no dialogue box)

```js
{ type: 'speak', text: "Whispered threat.", voice: 'whisper' }
```

Completes when speech finishes (or fallback timer expires).

### `wait` — Pause for N frames

```js
{ type: 'wait', frames: 60 }   // 1 second at 60fps
```

### `effect` — Trigger a visual effect (instant)

```js
{ type: 'effect', name: 'shake', intensity: 8 }
{ type: 'effect', name: 'flash', color: '#FF0000' }
{ type: 'effect', name: 'shockwave', target: 'ball1', intensity: 0.3 }
{ type: 'effect', name: 'chromatic', intensity: 0.2 }
{ type: 'effect', name: 'particles', target: 'winner', color: '#FFD700', count: 20 }
```

| Effect       | Properties                        | Description |
|-------------|-----------------------------------|-------------|
| `shake`     | `intensity` (default 5)           | Screen shake |
| `flash`     | `color` (default '#FFD700')       | Full-screen flash |
| `shockwave` | `target`, `intensity` (default 0.2) | Shockwave ring |
| `chromatic` | `intensity` (default 0.2)         | Chromatic aberration |
| `particles` | `target`, `color`, `count` (default 12) | Particle burst |

### `letterbox` — Cinematic black bars

```js
{ type: 'letterbox', height: 50 }           // Slide in bars (50px each)
{ type: 'letterbox', active: false }         // Slide bars away
{ type: 'letterbox', height: 80, speed: 0.1 } // Tall bars, slow animation
```

| Property | Type    | Default | Description |
|----------|---------|---------|-------------|
| `active` | boolean | true    | Set false to retract bars |
| `height` | number  | 50      | Bar height in pixels |
| `speed`  | number  | 0.06    | Animation speed |

**Note:** This is instant (doesn't block) — the bars animate smoothly in the background.

### `title` — Big centered text overlay

```js
{ type: 'title', text: 'ROUND ONE', subtext: 'FIGHT!', color: '#FFD700', duration: 120 }
```

| Property   | Type   | Default | Description |
|------------|--------|---------|-------------|
| `text`     | string | ''      | Main title (32px) |
| `subtext`  | string | ''      | Subtitle (16px) |
| `color`    | string | '#FFF'  | Text color |
| `duration` | number | 120     | Frames to display before fading |

### `parallel` — Run multiple steps simultaneously

```js
{ type: 'parallel', steps: [
    { type: 'camera', target: 'ball1', zoom: 3.0, duration: 90 },
    { type: 'narrate', text: "Behold!", voice: 'epic' },
    { type: 'effect', name: 'particles', target: 'ball1', color: '#FF0' },
]}
```

Completes when ALL inner steps have completed.

### `callback` — Run arbitrary JavaScript

```js
{ type: 'callback', fn: (ctx) => {
    console.log('Balls:', ctx.balls);
    console.log('Winner:', ctx.winner);
    // ctx.cutscene gives access to WB.Cutscene itself
}}
```

The callback receives `{ balls, winner, cutscene }`. Completes immediately.

---

## Camera Targets

These named strings resolve to world positions:

| Target   | Position |
|----------|----------|
| `'arena'` or `'center'` | Center of the arena |
| `'ball1'` | Player 1's ball position |
| `'ball2'` | Player 2's ball position |
| `'winner'` | The winning ball (post-battle only) |
| `'top'`   | Top 20% of arena |
| `'bottom'` | Bottom 80% of arena |
| `'left'`  | Left 20% of arena |
| `'right'` | Right 80% of arena |
| `[x, y]`  | Exact pixel coordinates |

---

## Camera Presets

Use `preset: 'name'` in any `camera` step. Values are overridden if you also specify `zoom`/`ease`/`rotation` explicitly.

| Preset              | Zoom | Ease  | Rotation | Description |
|---------------------|------|-------|----------|-------------|
| `'extreme-closeup'` | 5.0  | 0.08  | -        | Very tight close-up |
| `'closeup'`         | 3.0  | 0.06  | -        | Standard close-up |
| `'medium'`          | 2.0  | 0.05  | -        | Medium shot |
| `'wide'`            | 1.0  | 0.04  | -        | Normal/wide view |
| `'ultra-wide'`      | 0.7  | 0.03  | -        | Wider than normal |
| `'slam-zoom'`       | 4.0  | 0.15  | -        | Very fast zoom in (dramatic) |
| `'slow-push'`       | 2.5  | 0.015 | -        | Slow creeping zoom |
| `'pull-back'`       | 0.8  | 0.03  | -        | Slow zoom out past normal |
| `'snap-to'`         | 3.0  | 1.0   | -        | Instant jump (ease=1) |
| `'dutch-left'`      | -    | 0.05  | -0.15    | Tilted left |
| `'dutch-right'`     | -    | 0.05  | 0.15     | Tilted right |
| `'level'`           | -    | 0.05  | 0        | Reset rotation to level |

List all presets: `WB.Cutscene.listCameraPresets()`

---

## Voice Presets

Use `voice: 'name'` in any `narrate` or `speak` step. Each preset has default rate/pitch/volume that can be overridden per-step.

| Preset      | Rate | Pitch | Vol  | Style |
|-------------|------|-------|------|-------|
| `'narrator'` | 1.1  | 0.8   | 0.8  | Default announcer — slightly fast, deep |
| `'epic'`     | 0.85 | 0.5   | 0.9  | Slow, very deep — victory announcements |
| `'hype'`     | 1.4  | 1.2   | 0.9  | Fast, high-energy sports caster |
| `'villain'`  | 0.9  | 0.3   | 0.85 | Slow, very low — menacing |
| `'whisper'`  | 0.8  | 0.6   | 0.4  | Quiet, breathy |
| `'robot'`    | 1.3  | 0.1   | 0.7  | Fast, extremely low pitch |
| `'excited'`  | 1.6  | 1.5   | 1.0  | Very fast, high pitch — HYPE |
| `'dramatic'` | 0.7  | 0.4   | 0.9  | Very slow, deep — gravitas |
| `'chipmunk'` | 1.8  | 2.0   | 0.8  | Ridiculously fast and high |
| `'god'`      | 0.6  | 0.2   | 1.0  | Extremely slow, basso profondo |

### Console helpers

```js
WB.Cutscene.listVoices()                          // Show all browser voices + presets
WB.Cutscene.previewVoice('villain')                // Hear default test phrase
WB.Cutscene.previewVoice('epic', 'I am inevitable') // Hear custom phrase
```

### Using a specific browser voice

```js
{ type: 'narrate', text: "Hello!", voice: 'Google UK English Female' }
```

If the `voice` string doesn't match a preset name, it searches browser voices by name substring.

---

## Auto-Generated Cutscenes

When `WB.Config.CUTSCENE_ENABLED = true`, the system auto-plays:

### Pre-Battle (before countdown)
1. Letterbox slides in
2. Wide shot of arena + random opening quip (narrator voice)
3. Slam-zoom to ball 1 + shake + weapon-specific intro phrase
4. Slam-zoom to ball 2 + shake + weapon-specific intro phrase
5. Pull back to arena, letterbox slides out

### Post-Battle (after someone dies)
1. Letterbox slides in
2. Slam-zoom to winner + shake + chromatic aberration
3. Hold on winner + victory quip (epic voice, varies by margin)
4. Pull back, letterbox slides out

### Customizing narration phrases

Edit the objects at the bottom of `cutscene.js`:

```js
WB.Cutscene._introPhrases.zeus = [
    "Custom intro 1.",
    "Custom intro 2.",
];

WB.Cutscene._victoryPhrases.dominant = [
    "Custom dominant victory line.",
];

WB.Cutscene._openingPhrases.push("A new opening line!");
```

---

## Full Example: Custom Tournament Intro

```js
WB.Cutscene.playCutscene([
    // Black screen with title
    { type: 'cut', target: 'arena', zoom: 0.5 },
    { type: 'letterbox', height: 80 },
    { type: 'title', text: 'THE GRAND TOURNAMENT', subtext: 'Season 1', color: '#FFD700', duration: 150 },
    { type: 'narrate', text: "Welcome to the Grand Tournament. Where legends are born... and balls are destroyed.", voice: 'epic' },

    // Dramatic reveal of arena
    { type: 'parallel', steps: [
        { type: 'dolly', fromZoom: 0.5, zoom: 1.0, duration: 120 },
        { type: 'effect', name: 'particles', target: 'arena', color: '#FFD700', count: 30 },
    ]},

    // Pan across the arena
    { type: 'pan', from: 'left', target: 'right', zoom: 2.0, duration: 180 },
    { type: 'narrate', text: "Two warriors. One arena. Zero mercy.", voice: 'dramatic' },

    // Introduce fighters with slam zooms
    { type: 'camera', target: 'ball1', preset: 'slam-zoom', duration: 45 },
    { type: 'effect', name: 'shake', intensity: 5 },
    { type: 'narrate', text: "The challenger approaches!", voice: 'hype', speaker: 'COMMENTATOR' },

    // Dutch angle on opponent
    { type: 'parallel', steps: [
        { type: 'camera', target: 'ball2', preset: 'closeup', duration: 90 },
        { type: 'camera', target: 'ball2', preset: 'dutch-right', duration: 90 },
    ]},
    { type: 'narrate', text: "And the defending champion... looks terrified.", voice: 'whisper' },

    // Reset and go
    { type: 'camera', target: 'arena', preset: 'level', duration: 30 },
    { type: 'letterbox', active: false },
    { type: 'title', text: 'FIGHT!', color: '#FF4444', duration: 60 },
    { type: 'effect', name: 'shake', intensity: 10 },
    { type: 'effect', name: 'flash', color: '#FFF' },
], () => console.log('Intro complete!'));
```

---

## Architecture Notes (for Claude)

- **Camera works via projection matrix monkey-patching** — `_hookShake()` replaces `WB.GLEffects.applyShake`/`clearShake` to compose camera transform (scale + rotate + translate) with shake offsets. Originals are restored in `_unhookShake()`.
- **Rotation** is composed into the 3x3 orthographic projection matrix using cos/sin. The matrix is a `Float32Array[9]` stored at `WB.GL.projMatrix`.
- **Letterbox, title, dialogue** are drawn AFTER `clearShake` (in screen-space) so they don't wobble with the camera.
- **HUD is hidden** during cutscene via a guard in `renderer.js drawFrame()`: `if (!WB.Cutscene || !WB.Cutscene.isPlaying)`.
- **State machine** in `main.js` has `PRE_BATTLE_CUTSCENE` and `POST_BATTLE_CUTSCENE` states. Click during either calls `WB.Cutscene.skip()`.
- **Speech fallback timer** ensures the cutscene advances even if TTS stalls (browser tab hidden, no voices available, etc).
- **Font sizes** in dialogue/title MUST be from the atlas: `[10,11,12,13,14,16,18,20,22,24,26,28,32,44,48,80]`.
- **All narration phrase arrays** are at the bottom of `cutscene.js` in `_introPhrases`, `_victoryPhrases`, `_openingPhrases`.
