import * as THREE from 'three';
import type { BallEntry, WallSide } from '../shared/types';
import type { ColorKey } from '../shared/colors';
import { COLOR_HEX } from '../shared/colors';
import { Grid, cellKey, type Cell } from './Grid';
import { easeOutCubic, lerp } from './anim';

export type BallState = 'idle' | 'sliding' | 'popping' | 'gone';

const SLIDE_MS_PER_CELL = 80;
const POP_MS = 250;
const BALL_RADIUS = 0.36;

export class Ball {
  readonly id: string;
  readonly color: ColorKey;
  readonly group = new THREE.Group();

  state: BallState = 'idle';
  /** Current resting cell. Updated when a slide finishes. */
  cell: Cell;

  private grid: Grid;
  private mesh: THREE.Mesh;

  // Slide state
  private slidePath: Cell[] = [];
  private slideOrigin!: Cell;
  private slideTimer = 0;
  private slideTotalMs = 0;

  // Pop state
  private popTimer = 0;

  private static materials = new Map<ColorKey, THREE.MeshStandardMaterial>();

  constructor(grid: Grid, entry: BallEntry, idx: number) {
    this.grid = grid;
    this.color = entry.color;
    this.cell = { col: entry.col, row: entry.row };
    this.id = `ball-${idx}-${entry.color}`;
    const sphere = new THREE.SphereGeometry(BALL_RADIUS, 28, 20);
    const mat = Ball.getMaterial(this.color);
    this.mesh = new THREE.Mesh(sphere, mat);
    this.mesh.userData.ball = this.id;
    this.mesh.userData.cell = this.cell;
    const w = grid.cellToWorld(this.cell);
    this.mesh.position.set(w.x, BALL_RADIUS, w.z);
    this.group.add(this.mesh);
  }

  static getMaterial(color: ColorKey): THREE.MeshStandardMaterial {
    let m = Ball.materials.get(color);
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color: COLOR_HEX[color],
        roughness: 0.35,
        metalness: 0.15,
        emissive: COLOR_HEX[color],
        emissiveIntensity: 0.18,
      });
      Ball.materials.set(color, m);
    }
    return m;
  }

  cellKeyStr(): string {
    return cellKey(this.cell);
  }

  hitTest(c: Cell): boolean {
    return this.state === 'idle' && c.col === this.cell.col && c.row === this.cell.row;
  }

  /**
   * Begin sliding along the given path. The destination is the last cell in the path
   * (or the origin if the path is empty — caller should not invoke in that case).
   */
  beginSlide(path: Cell[]) {
    if (path.length === 0) return;
    this.slidePath = path.map((c) => ({ ...c }));
    this.slideOrigin = { ...this.cell };
    this.slideTimer = 0;
    this.slideTotalMs = path.length * SLIDE_MS_PER_CELL;
    this.state = 'sliding';
  }

  /** Trigger pop animation. Ball will report 'gone' when finished. */
  beginPop() {
    this.popTimer = 0;
    this.state = 'popping';
  }

  /** Compute the destination cell at the end of the active slide path. */
  endOfPath(): Cell {
    return this.slidePath[this.slidePath.length - 1] ?? this.cell;
  }

  /**
   * Per-frame update. Returns 'slide-done' when a slide completes (so GameApp can
   * resolve collisions), 'gone' when a pop finishes, otherwise null.
   */
  update(dtMs: number): 'slide-done' | 'gone' | null {
    if (this.state === 'sliding') {
      this.slideTimer = Math.min(this.slideTotalMs, this.slideTimer + dtMs);
      const t = this.slideTotalMs === 0 ? 1 : this.slideTimer / this.slideTotalMs;
      const eased = easeOutCubic(t);
      const start = this.grid.cellToWorld(this.slideOrigin);
      const end = this.grid.cellToWorld(this.endOfPath());
      const x = lerp(start.x, end.x, eased);
      const z = lerp(start.z, end.z, eased);
      this.mesh.position.set(x, BALL_RADIUS, z);
      if (t >= 1) {
        this.cell = this.endOfPath();
        this.mesh.userData.cell = this.cell;
        this.slidePath = [];
        this.state = 'idle';
        return 'slide-done';
      }
      return null;
    }

    if (this.state === 'popping') {
      this.popTimer += dtMs;
      const t = Math.min(1, this.popTimer / POP_MS);
      // First 40% scale up to 1.3, then shrink + fade to 0
      let s: number;
      let a: number;
      if (t < 0.4) {
        s = lerp(1, 1.3, t / 0.4);
        a = 1;
      } else {
        const k = (t - 0.4) / 0.6;
        s = lerp(1.3, 0, k);
        a = lerp(1, 0, k);
      }
      this.mesh.scale.setScalar(s);
      const mat = this.mesh.material as THREE.MeshStandardMaterial;
      mat.transparent = true;
      mat.opacity = a;
      if (t >= 1) {
        this.state = 'gone';
        this.dispose();
        return 'gone';
      }
      return null;
    }

    return null;
  }

  /** True if a swipe in `dir` from this ball would move at least one cell. */
  canStep(dir: WallSide, otherOccupied: Set<string>): boolean {
    return this.grid.canStep(this.cell, dir, otherOccupied);
  }

  dispose() {
    this.group.parent?.remove(this.group);
    this.mesh.geometry.dispose();
  }
}
