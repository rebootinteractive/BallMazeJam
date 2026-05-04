import * as THREE from 'three';
import type { LevelData, WallSide } from '../shared/types';
import { Grid, type Cell, cellKey } from './Grid';
import { LabyrinthMesh } from './LabyrinthMesh';
import { Ball } from './Ball';
import { TapInput } from './Input';
import { Hud } from './Hud';

export interface GameAppOptions {
  level: LevelData;
  onMenu: () => void;
}

export class GameApp {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private grid: Grid;
  private mesh: LabyrinthMesh;
  private balls: Ball[] = [];
  private hud: Hud;
  private input: TapInput;
  private level: LevelData;
  private parent: HTMLElement;
  private resizeObserver: ResizeObserver;
  private rafId = 0;
  private lastTime = 0;
  private timeLeft: number;
  private status: 'playing' | 'won' | 'lost' = 'playing';
  private onMenuCb: () => void;

  /** When a slide finishes against a same-color ball, store the partner here. */
  private pendingPopForBall = new Map<string, string>(); // sliding ball id -> target ball id

  constructor(parent: HTMLElement, opts: GameAppOptions) {
    this.parent = parent;
    this.level = opts.level;
    this.onMenuCb = opts.onMenu;
    this.timeLeft = opts.level.timeSeconds;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.setClearColor(0x14171f, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    parent.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x14171f);

    const amb = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(amb);
    const dir = new THREE.DirectionalLight(0xffffff, 0.85);
    dir.position.set(2, 8, 4);
    this.scene.add(dir);
    const fill = new THREE.DirectionalLight(0x88a4ff, 0.18);
    fill.position.set(-3, 4, -2);
    this.scene.add(fill);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    this.scene.add(this.camera);

    this.grid = new Grid(opts.level);
    this.mesh = new LabyrinthMesh(this.grid);
    this.scene.add(this.mesh.group);

    opts.level.balls.forEach((entry, i) => {
      const ball = new Ball(this.grid, entry, i);
      this.balls.push(ball);
      this.scene.add(ball.group);
    });

    this.hud = new Hud(parent, opts.level.name, {
      onRestart: () => this.restart(),
      onMenu: () => {
        this.dispose();
        this.onMenuCb();
      },
    });
    this.hud.setTimer(this.timeLeft);
    this.hud.setBallCount(this.balls.length, this.balls.length);

    this.input = new TapInput(this.renderer.domElement, this.camera, this.grid);
    this.input.onSwipe((cell, priority) => this.handleSwipe(cell, priority));
    this.input.attach();

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(parent);
    this.handleResize();

    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  private restart() {
    this.dispose();
    new GameApp(this.parent, { level: this.level, onMenu: this.onMenuCb });
  }

  private handleResize() {
    const rect = this.parent.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    this.fitCameraToGrid();
    this.camera.updateProjectionMatrix();
  }

  private fitCameraToGrid() {
    const cols = this.grid.cols;
    const rows = this.grid.rows;
    const margin = 1.6;
    const fovV = THREE.MathUtils.degToRad(this.camera.fov);
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * this.camera.aspect);
    const dV = (rows + margin) / (2 * Math.tan(fovV / 2));
    const dH = (cols + margin) / (2 * Math.tan(fovH / 2));
    const D = Math.max(dV, dH);
    const tilt = THREE.MathUtils.degToRad(20);
    this.camera.position.set(0, D * Math.cos(tilt), D * Math.sin(tilt));
    this.camera.lookAt(0, 0, 0);
  }

  private handleSwipe(cell: Cell, priority: WallSide[]) {
    if (this.status !== 'playing') return;
    // Block input while any ball is animating
    if (this.balls.some((b) => b.state === 'sliding' || b.state === 'popping')) return;

    const ball = this.balls.find((b) => b.hitTest(cell));
    if (!ball) return;

    const others = this.otherCells(ball);
    const dir = priority.find((d) => ball.canStep(d, others));
    if (!dir) return;

    const result = this.grid.slideRay(ball.cell, dir, others);

    const samePartner = result.collidedAt
      ? this.balls.find(
          (b) =>
            b !== ball &&
            b.state === 'idle' &&
            b.color === ball.color &&
            b.cell.col === result.collidedAt!.col &&
            b.cell.row === result.collidedAt!.row
        )
      : undefined;

    if (result.path.length === 0) {
      // Couldn't move. Only act if the immediate neighbor is a same-color partner —
      // pop the pair without sliding.
      if (samePartner) {
        ball.beginPop();
        samePartner.beginPop();
      }
      return;
    }

    if (samePartner) this.pendingPopForBall.set(ball.id, samePartner.id);
    ball.beginSlide(result.path);
  }

  private otherCells(self: Ball): Set<string> {
    const set = new Set<string>();
    for (const b of this.balls) {
      if (b === self) continue;
      if (b.state === 'gone') continue;
      set.add(b.cellKeyStr());
    }
    return set;
  }

  private loop = (now: number) => {
    const dt = Math.min(64, now - this.lastTime);
    this.lastTime = now;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.rafId = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    if (this.status === 'playing') {
      this.timeLeft = Math.max(0, this.timeLeft - dt / 1000);
      this.hud.setTimer(this.timeLeft);
    }

    for (const ball of this.balls) {
      const result = ball.update(dt);
      if (result === 'slide-done') {
        const partnerId = this.pendingPopForBall.get(ball.id);
        if (partnerId) {
          this.pendingPopForBall.delete(ball.id);
          const partner = this.balls.find((b) => b.id === partnerId);
          if (partner && partner.state === 'idle') {
            ball.beginPop();
            partner.beginPop();
          }
        }
      }
    }

    const remaining = this.balls.filter((b) => b.state !== 'gone').length;
    this.hud.setBallCount(remaining, this.balls.length);

    if (this.status === 'playing') {
      if (remaining === 0) {
        this.status = 'won';
        this.hud.showWin(this.timeLeft);
      } else if (this.timeLeft <= 0) {
        const animating = this.balls.some(
          (b) => b.state === 'sliding' || b.state === 'popping'
        );
        if (!animating) {
          this.status = 'lost';
          this.hud.showLose();
        }
      }
    }
  }

  dispose() {
    cancelAnimationFrame(this.rafId);
    this.input.detach();
    this.resizeObserver.disconnect();
    for (const ball of this.balls) ball.dispose();
    this.mesh.dispose();
    this.hud.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
