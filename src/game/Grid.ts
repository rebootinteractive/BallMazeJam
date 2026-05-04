import type { LevelData, WallSide } from '../shared/types';

export interface Cell {
  col: number;
  row: number;
}

export const cellKey = (c: Cell) => `${c.col},${c.row}`;
export const parseKey = (k: string): Cell => {
  const [c, r] = k.split(',').map(Number);
  return { col: c, row: r };
};

export function neighborInDirection(cell: Cell, dir: WallSide): Cell {
  switch (dir) {
    case 'N':
      return { col: cell.col, row: cell.row - 1 };
    case 'S':
      return { col: cell.col, row: cell.row + 1 };
    case 'E':
      return { col: cell.col + 1, row: cell.row };
    case 'W':
      return { col: cell.col - 1, row: cell.row };
  }
}

export interface SlideResult {
  /** Cells the ball passes through, including the destination but not the starting cell. */
  path: Cell[];
  /** The cell where the ball comes to rest. Equal to origin if it can't move at all. */
  destination: Cell;
  /** If a ball stopped the slide, its grid cell. Undefined for wall/edge stops. */
  collidedAt?: Cell;
}

export class Grid {
  readonly cols: number;
  readonly rows: number;

  // Edge-coordinate wall sets:
  // hWalls keys "c,edgeRow" — horizontal wall above row=edgeRow at column c. edgeRow in 0..rows.
  // vWalls keys "edgeCol,r" — vertical wall left of col=edgeCol at row r. edgeCol in 0..cols.
  private hWalls = new Set<string>();
  private vWalls = new Set<string>();

  constructor(level: LevelData) {
    this.cols = level.cols;
    this.rows = level.rows;
    for (const w of level.walls) {
      if (w.side === 'N') {
        this.hWalls.add(`${w.col},${w.row}`);
      } else {
        this.vWalls.add(`${w.col + 1},${w.row}`);
      }
    }
  }

  inBounds(c: number, r: number): boolean {
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows;
  }

  passable(from: Cell, to: Cell): boolean {
    if (!this.inBounds(to.col, to.row)) return false;
    if (from.row === to.row && Math.abs(from.col - to.col) === 1) {
      const edgeCol = Math.max(from.col, to.col);
      return !this.vWalls.has(`${edgeCol},${from.row}`);
    }
    if (from.col === to.col && Math.abs(from.row - to.row) === 1) {
      const edgeRow = Math.max(from.row, to.row);
      return !this.hWalls.has(`${from.col},${edgeRow}`);
    }
    return false;
  }

  /**
   * aMAZE-style slide: starting from `from`, walk one cell at a time in `dir`,
   * stopping when the next cell is off-grid, blocked by a wall, or occupied by
   * another ball. Returns the cells walked through (excluding origin) and where
   * the ball comes to rest.
   *
   * `occupied` should NOT include the sliding ball's own origin cell.
   */
  slideRay(from: Cell, dir: WallSide, occupied: Set<string>): SlideResult {
    const path: Cell[] = [];
    let cur = from;
    while (true) {
      const next = neighborInDirection(cur, dir);
      if (!this.passable(cur, next)) {
        return { path, destination: cur };
      }
      const nextKey = cellKey(next);
      if (occupied.has(nextKey)) {
        return { path, destination: cur, collidedAt: next };
      }
      path.push(next);
      cur = next;
    }
  }

  /** Convert a cell to its world-space center. Cells are 1×1, grid centered on origin. */
  cellToWorld(cell: Cell): { x: number; z: number } {
    return {
      x: cell.col - (this.cols - 1) / 2,
      z: cell.row - (this.rows - 1) / 2,
    };
  }

  worldToCell(x: number, z: number): Cell | null {
    const col = Math.round(x + (this.cols - 1) / 2);
    const row = Math.round(z + (this.rows - 1) / 2);
    if (!this.inBounds(col, row)) return null;
    return { col, row };
  }

  forEachInternalWall(fn: (kind: 'h' | 'v', col: number, row: number) => void) {
    for (const k of this.hWalls) {
      const [c, r] = k.split(',').map(Number);
      if (r === 0 || r === this.rows) continue;
      fn('h', c, r);
    }
    for (const k of this.vWalls) {
      const [c, r] = k.split(',').map(Number);
      if (c === 0 || c === this.cols) continue;
      fn('v', c, r);
    }
  }

  /** Whether the immediate neighbor in the given direction can be entered. */
  canStep(cell: Cell, direction: WallSide, occupied: Set<string>): boolean {
    const n = neighborInDirection(cell, direction);
    if (!this.passable(cell, n)) return false;
    if (occupied.has(cellKey(n))) return false;
    return true;
  }
}
