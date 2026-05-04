import type { LevelData } from '../shared/types';

// Level 1 — minimal tutorial. Two red balls in opposite corners, no walls.
// Player learns: swipe slides a ball to the wall; align two same-color
// balls in a row/column to pop them.
const level1: LevelData = {
  id: 'l1-first-slide',
  name: 'First Slide',
  cols: 4,
  rows: 5,
  timeSeconds: 30,
  walls: [],
  balls: [
    { col: 0, row: 0, color: 'red' },
    { col: 3, row: 4, color: 'red' },
  ],
};

// Level 2 — two color pairs in opposite corners. Each pair is a single
// horizontal swipe to clear; demonstrates the same-color collision pop.
const level2: LevelData = {
  id: 'l2-two-pairs',
  name: 'Two Pairs',
  cols: 5,
  rows: 6,
  timeSeconds: 30,
  walls: [],
  balls: [
    { col: 0, row: 0, color: 'red' },
    { col: 4, row: 0, color: 'red' },
    { col: 0, row: 5, color: 'blue' },
    { col: 4, row: 5, color: 'blue' },
  ],
};

// Level 3 — a horizontal wall partition forces routing through the right
// side of the board. Two pairs (red, blue) in opposite diagonal corners.
const level3: LevelData = {
  id: 'l3-detour',
  name: 'Detour',
  cols: 5,
  rows: 7,
  timeSeconds: 45,
  walls: [
    // Wall between row 3 and row 4 at columns 0 and 1 only — cols 2..4 stay open
    { col: 0, row: 4, side: 'N' },
    { col: 1, row: 4, side: 'N' },
  ],
  balls: [
    { col: 0, row: 0, color: 'red' },
    { col: 4, row: 6, color: 'red' },
    { col: 4, row: 0, color: 'blue' },
    { col: 0, row: 6, color: 'blue' },
  ],
};

export const BUILTIN_LEVELS: LevelData[] = [level1, level2, level3];
