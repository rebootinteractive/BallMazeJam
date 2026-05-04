import * as THREE from 'three';
import type { WallSide } from '../shared/types';
import type { Cell } from './Grid';
import { Grid } from './Grid';

export type TapHandler = (cell: Cell, world: THREE.Vector3) => void;
export type SwipeHandler = (cell: Cell, directionPriority: WallSide[]) => void;

const TAP_MAX_DIST = 14; // px
const SWIPE_MIN_DIST = 18; // px
const MAX_GESTURE_MS = 800;

export class TapInput {
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private onTapCb?: TapHandler;
  private onSwipeCb?: SwipeHandler;
  private downX = 0;
  private downY = 0;
  private downTime = 0;
  private downCell: Cell | null = null;
  private downWorld = new THREE.Vector3();
  private isDown = false;

  constructor(
    private dom: HTMLElement,
    private camera: THREE.Camera,
    private grid: Grid
  ) {}

  onTap(cb: TapHandler) {
    this.onTapCb = cb;
  }

  onSwipe(cb: SwipeHandler) {
    this.onSwipeCb = cb;
  }

  attach() {
    this.dom.addEventListener('pointerdown', this.handleDown);
    this.dom.addEventListener('pointerup', this.handleUp);
    this.dom.addEventListener('pointercancel', this.handleCancel);
  }

  detach() {
    this.dom.removeEventListener('pointerdown', this.handleDown);
    this.dom.removeEventListener('pointerup', this.handleUp);
    this.dom.removeEventListener('pointercancel', this.handleCancel);
  }

  private screenToWorld(clientX: number, clientY: number): THREE.Vector3 | null {
    const rect = this.dom.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const out = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.floorPlane, out) ? out : null;
  }

  private handleDown = (e: PointerEvent) => {
    this.isDown = true;
    this.downX = e.clientX;
    this.downY = e.clientY;
    this.downTime = performance.now();
    const w = this.screenToWorld(e.clientX, e.clientY);
    if (w) {
      this.downWorld.copy(w);
      this.downCell = this.grid.worldToCell(w.x, w.z);
    } else {
      this.downCell = null;
    }
  };

  private handleCancel = () => {
    this.isDown = false;
    this.downCell = null;
  };

  private handleUp = (e: PointerEvent) => {
    if (!this.isDown) return;
    this.isDown = false;
    const dx = e.clientX - this.downX;
    const dy = e.clientY - this.downY;
    const dist = Math.hypot(dx, dy);
    const dt = performance.now() - this.downTime;
    if (dt > MAX_GESTURE_MS) return;

    if (dist < TAP_MAX_DIST) {
      // Tap — fall back to UP-position cell so that quick non-moving taps
      // resolve consistently even if the user lifted slightly off the press point.
      const w = this.screenToWorld(e.clientX, e.clientY);
      if (!w) return;
      const cell = this.grid.worldToCell(w.x, w.z);
      if (cell) this.onTapCb?.(cell, w);
      return;
    }

    if (dist >= SWIPE_MIN_DIST && this.downCell) {
      // Swipe direction priority: rank N/E/S/W by alignment with the world-space delta,
      // best match first.
      const upWorld = this.screenToWorld(e.clientX, e.clientY);
      const wdx = upWorld ? upWorld.x - this.downWorld.x : dx;
      const wdz = upWorld ? upWorld.z - this.downWorld.z : dy;
      const priority = directionPriority(wdx, wdz);
      this.onSwipeCb?.(this.downCell, priority);
    }
  };
}

/**
 * Rank the four cardinal directions by how closely they align with the swipe vector.
 * Returned in best-first order.
 */
function directionPriority(dx: number, dz: number): WallSide[] {
  const choices: { side: WallSide; dot: number }[] = [
    { side: 'E', dot: dx },
    { side: 'W', dot: -dx },
    { side: 'S', dot: dz },
    { side: 'N', dot: -dz },
  ];
  choices.sort((a, b) => b.dot - a.dot);
  return choices.map((c) => c.side);
}
