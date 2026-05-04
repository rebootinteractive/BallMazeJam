# BallMazeJam — Design Spec

A mobile puzzle prototype where colored balls slide aMAZE-style through a labyrinth. Two balls of the same color cancel each other on collision. Clear the board before time runs out.

## Core mechanic

- **Grid labyrinth.** Cells form a 2D grid; walls live on cell edges (same model as GrowBlockJam).
- **Balls.** Each ball has a color and a position. Each color appears in exactly two balls per level. There is no span and no closed/open state.
- **Swipe input.** Player presses on a ball and swipes a direction. The swipe is projected to the nearest of N/E/S/W (with fallback to next-nearest if the chosen heading is immediately blocked).
- **Sliding.** The selected ball slides in the chosen direction until it stops.
  - It stops when the next cell would be off the grid, would cross a wall, or would enter a cell occupied by another ball.
  - Different-color obstacle: ball stops in the cell adjacent to the obstacle, both balls remain.
  - **Same-color obstacle: both balls are destroyed.** The sliding ball still stops in the adjacent cell visually, then both pop and disappear.
- **Goal.** Clear every ball from the board before the timer expires.
- **Win = no balls remaining. Lose = timer hits 0 with at least one ball still on the board.**

## Tech (identical to GrowBlockJam)

- Vite + TypeScript + Three.js, no framework
- Single-canvas Three.js scene; HUD and menus are HTML overlays
- iPhone 15 portrait viewport (393 × 852 CSS px); phone-frame styling on desktop
- Slight perspective top-down camera (~20° tilt)
- Levels deployed to GitHub Pages via Actions workflow on every push to `main`
- JSON levels in `src/levels/contributed/` auto-loaded via `import.meta.glob`

## Visual style

- Same flat-shaded look as GrowBlockJam.
- Balls: glossy spheres in their color, sitting on the floor (full-height ball, not half-height block).
- Walls: same low gray boxes.
- No doors.
- Slide animation: smooth ease-out tween from start to destination cell.
- Pop animation: scale up briefly, fade out (~250 ms total).

## Project layout (deltas from GrowBlockJam in **bold**)

```
src/
  main.ts                   same router (menu/game/editor)
  shared/
    types.ts                **BallEntry has no span; LevelData has no doors[]**
    colors.ts               same
  levels/
    builtin.ts              **3 new starter levels**
    contributed/            **empty + README + .gitkeep**
    index.ts                same loader
  ui/
    MainMenu.ts             same shape; copy text updated
    storage.ts              **localStorage key prefix "bmj:" instead of "gbj:"**
    styles.css              same
  game/
    GameApp.ts              **rewritten orchestration: per-swipe single-ball slide**
    Grid.ts                 **slideRay() replaces expand()**
    Ball.ts                 **rewritten — states: idle | sliding | popping | gone**
    LabyrinthMesh.ts        same minus door rendering
    Input.ts                same swipe/tap detection (TapInput unchanged)
    Hud.ts                  same; "X / Y left" still meaningful
    anim.ts                 same
  editor/
    EditorApp.ts            **trimmed — no door tool, no span control; ball tool just picks color**
.github/workflows/deploy.yml  same
```

## Data shape

```ts
type LevelData = {
  id: string;
  name: string;
  cols: number;
  rows: number;
  timeSeconds: number;
  walls: Array<{ col: number; row: number; side: 'N' | 'E' }>;
  balls: Array<{ col: number; row: number; color: ColorKey }>;
};
```

Editor validation: warn if a color has an odd count (the level is unwinnable).

## Slide algorithm

```ts
slideRay(from: Cell, dir: WallSide, occupied: Map<string, Ball>): {
  path: Cell[];          // intermediate cells passed through (inclusive of destination)
  destination: Cell;     // where the sliding ball comes to rest
  collidedBall?: Ball;   // the ball that stopped us, if any
}
```

The destination is always the last passable cell before the obstacle. If `collidedBall` is set and its color matches the slider, GameApp queues both for the popping state after the slide animation finishes.

## Animation timings

- Slide: distance-proportional, ~80 ms per cell with ease-out
- Pop: 250 ms (scale up to 1.3 over first 100 ms then fade out + shrink to 0 over 150 ms)

## Win/lose flow

- Each frame: decrement timer if `playing`. When all balls are `gone`, set status `won`. When timer hits 0 and no animation is in flight, set status `lost`.
- HUD shows timer and `<remaining> / <total> left`. Modal on win/lose with Restart and Menu buttons.

## Repo + deploy

- Repo: `rebootinteractive/BallMazeJam` (new, public)
- URL: `https://rebootinteractive.github.io/BallMazeJam/`
- Same `.github/workflows/deploy.yml` shape; Vite `base: './'` so any subpath works.

## Out of scope (prototype)

- Sound, particles
- Move counter / star ratings
- Hint system, undo
- Cross-device level sync
- Anything beyond 3 starter levels (rest go in `contributed/`)
