import * as THREE from 'three';
import type { LevelData, WallSide } from '../shared/types';
import { COLOR_KEYS, type ColorKey, COLOR_HEX_STR } from '../shared/colors';
import { Grid } from '../game/Grid';
import { LabyrinthMesh } from '../game/LabyrinthMesh';
import { Ball } from '../game/Ball';
import { saveCustomLevel } from '../ui/storage';

export interface EditorOptions {
  initial?: LevelData;
  onExit: () => void;
  onTestPlay: (level: LevelData) => void;
}

type Tool = 'wall' | 'ball' | 'erase';

const DEFAULT_LEVEL = (): LevelData => ({
  id: 'custom-' + Math.random().toString(36).slice(2, 8),
  name: 'New Level',
  cols: 6,
  rows: 8,
  timeSeconds: 30,
  walls: [],
  balls: [],
});

const CLONE_LEVEL = (data: LevelData): LevelData => ({
  ...data,
  walls: [...data.walls],
  balls: [...data.balls],
});

export class EditorApp {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private grid!: Grid;
  private mesh!: LabyrinthMesh;
  private ballMeshes: Ball[] = [];
  private level: LevelData;
  private tool: Tool = 'wall';
  private currentColor: ColorKey = 'red';
  private resizeObserver: ResizeObserver;
  private rafId = 0;
  private uiRoot: HTMLDivElement;
  private toolbar!: HTMLDivElement;
  private statusBar!: HTMLDivElement;

  constructor(private parent: HTMLElement, private opts: EditorOptions) {
    this.level = opts.initial ? CLONE_LEVEL(opts.initial) : DEFAULT_LEVEL();

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.setClearColor(0x14171f, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    parent.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x14171f);
    const amb = new THREE.AmbientLight(0xffffff, 0.6);
    const dir = new THREE.DirectionalLight(0xffffff, 0.85);
    dir.position.set(2, 8, 4);
    this.scene.add(amb, dir);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    this.scene.add(this.camera);

    this.uiRoot = document.createElement('div');
    this.uiRoot.className = 'overlay';
    this.uiRoot.style.pointerEvents = 'none';
    parent.appendChild(this.uiRoot);

    this.buildToolbar();
    this.buildStatus();
    this.buildBottomBar();

    this.rebuild();

    this.renderer.domElement.addEventListener('pointerdown', this.handleDown);
    this.renderer.domElement.addEventListener('pointerup', this.handleUp);
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(parent);
    this.handleResize();
    this.rafId = requestAnimationFrame(this.loop);
  }

  private buildToolbar() {
    const bar = document.createElement('div');
    bar.className = 'editor-toolbar';
    bar.style.pointerEvents = 'auto';

    const tools: { t: Tool; label: string }[] = [
      { t: 'wall', label: 'Wall' },
      { t: 'ball', label: 'Ball' },
      { t: 'erase', label: 'Erase' },
    ];
    tools.forEach((tt) => {
      const b = document.createElement('button');
      b.className = 'tool-btn';
      b.textContent = tt.label;
      b.dataset.tool = tt.t;
      b.addEventListener('click', () => {
        this.tool = tt.t;
        this.refreshToolbar();
      });
      bar.appendChild(b);
    });

    const colorRow = document.createElement('div');
    colorRow.className = 'color-row';
    colorRow.style.marginLeft = '6px';
    COLOR_KEYS.forEach((c) => {
      const dot = document.createElement('div');
      dot.className = 'color-dot';
      dot.dataset.color = c;
      dot.style.background = COLOR_HEX_STR[c];
      dot.addEventListener('click', () => {
        this.currentColor = c;
        this.refreshToolbar();
      });
      colorRow.appendChild(dot);
    });
    bar.appendChild(colorRow);

    const back = document.createElement('button');
    back.className = 'tool-btn';
    back.style.marginLeft = 'auto';
    back.textContent = '← Menu';
    back.addEventListener('click', () => this.opts.onExit());
    bar.appendChild(back);

    this.toolbar = bar;
    this.uiRoot.appendChild(bar);
    this.refreshToolbar();
  }

  private refreshToolbar() {
    this.toolbar.querySelectorAll('.tool-btn').forEach((el) => {
      const btn = el as HTMLButtonElement;
      const t = btn.dataset.tool;
      if (t) btn.classList.toggle('active', t === this.tool);
    });
    this.toolbar.querySelectorAll('.color-dot').forEach((el) => {
      const dot = el as HTMLElement;
      dot.classList.toggle('active', dot.dataset.color === this.currentColor);
    });
    if (this.statusBar) this.statusBar.textContent = this.toolHint();
  }

  private toolHint(): string {
    switch (this.tool) {
      case 'wall':
        return 'Tap between two cells to toggle a wall.';
      case 'ball':
        return `Tap a cell to place a ${this.currentColor} ball. Each color needs exactly two.`;
      case 'erase':
        return 'Tap a ball to remove it, or tap an edge to remove its wall.';
    }
  }

  private buildStatus() {
    const s = document.createElement('div');
    s.className = 'editor-status';
    s.style.pointerEvents = 'auto';
    s.textContent = this.toolHint();
    this.statusBar = s;
    this.uiRoot.appendChild(s);
  }

  private buildBottomBar() {
    const bar = document.createElement('div');
    bar.className = 'editor-bottom';
    bar.style.pointerEvents = 'auto';
    bar.style.marginTop = 'auto';

    const nameField = document.createElement('div');
    nameField.className = 'editor-field';
    nameField.innerHTML = `<span>Name</span>`;
    const nameInput = document.createElement('input');
    nameInput.className = 'wide';
    nameInput.value = this.level.name;
    nameInput.addEventListener('input', () => {
      this.level.name = nameInput.value;
    });
    nameField.appendChild(nameInput);

    const colsField = this.numberField('Cols', this.level.cols, 3, 12, (v) => {
      this.level.cols = v;
      this.cropToBounds();
      this.rebuild();
    });
    const rowsField = this.numberField('Rows', this.level.rows, 3, 16, (v) => {
      this.level.rows = v;
      this.cropToBounds();
      this.rebuild();
    });
    const timeField = this.numberField('Time', this.level.timeSeconds, 5, 600, (v) => {
      this.level.timeSeconds = v;
    });

    bar.appendChild(nameField);
    bar.appendChild(colsField);
    bar.appendChild(rowsField);
    bar.appendChild(timeField);

    const flex = document.createElement('div');
    flex.style.flexBasis = '100%';
    bar.appendChild(flex);

    const test = document.createElement('button');
    test.className = 'btn ghost small';
    test.textContent = '▶ Test';
    test.addEventListener('click', () => this.opts.onTestPlay(this.snapshot()));
    bar.appendChild(test);

    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn ghost small';
    exportBtn.textContent = 'Copy JSON';
    exportBtn.addEventListener('click', () => this.exportJson());
    bar.appendChild(exportBtn);

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'btn ghost small';
    downloadBtn.textContent = '↓ Download';
    downloadBtn.title = 'Download as .json — drop into src/levels/contributed/ to ship it.';
    downloadBtn.addEventListener('click', () => this.downloadJson());
    bar.appendChild(downloadBtn);

    const save = document.createElement('button');
    save.className = 'btn small';
    save.textContent = 'Save';
    save.addEventListener('click', () => {
      saveCustomLevel(this.snapshot());
      this.flashStatus('Saved to your levels.');
    });
    bar.appendChild(save);

    this.uiRoot.appendChild(bar);
  }

  private numberField(
    label: string,
    initial: number,
    min: number,
    max: number,
    onChange: (v: number) => void
  ): HTMLDivElement {
    const f = document.createElement('div');
    f.className = 'editor-field';
    const lbl = document.createElement('span');
    lbl.textContent = label;
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.min = String(min);
    inp.max = String(max);
    inp.value = String(initial);
    inp.addEventListener('change', () => {
      const v = Math.max(min, Math.min(max, parseInt(inp.value, 10) || min));
      inp.value = String(v);
      onChange(v);
    });
    f.appendChild(lbl);
    f.appendChild(inp);
    return f;
  }

  private flashStatus(msg: string) {
    const original = this.toolHint();
    this.statusBar.textContent = msg;
    setTimeout(() => {
      this.statusBar.textContent = original;
    }, 1400);
  }

  private snapshot(): LevelData {
    return {
      id: this.level.id,
      name: this.level.name || 'Untitled',
      cols: this.level.cols,
      rows: this.level.rows,
      timeSeconds: this.level.timeSeconds,
      walls: this.level.walls.map((w) => ({ ...w })),
      balls: this.level.balls.map((b) => ({ ...b })),
    };
  }

  private cropToBounds() {
    this.level.balls = this.level.balls.filter(
      (b) => b.col >= 0 && b.row >= 0 && b.col < this.level.cols && b.row < this.level.rows
    );
    this.level.walls = this.level.walls.filter((w) => {
      if (w.col < 0 || w.row < 0 || w.col >= this.level.cols || w.row >= this.level.rows)
        return false;
      if (w.side === 'E' && w.col >= this.level.cols - 1) return false;
      if (w.side === 'N' && w.row === 0) return false;
      return true;
    });
  }

  private rebuild() {
    if (this.mesh) {
      this.scene.remove(this.mesh.group);
      this.mesh.dispose();
    }
    for (const b of this.ballMeshes) b.dispose();
    this.ballMeshes = [];

    this.grid = new Grid(this.level);
    this.mesh = new LabyrinthMesh(this.grid);
    this.scene.add(this.mesh.group);

    this.level.balls.forEach((entry, i) => {
      const ball = new Ball(this.grid, entry, i);
      this.ballMeshes.push(ball);
      this.scene.add(ball.group);
    });

    this.handleResize();
  }

  private handleResize() {
    const rect = this.parent.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    if (!this.grid) {
      this.camera.updateProjectionMatrix();
      return;
    }
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
    this.camera.updateProjectionMatrix();
  }

  private downX = 0;
  private downY = 0;
  private downTime = 0;
  private isDown = false;

  private handleDown = (e: PointerEvent) => {
    this.isDown = true;
    this.downX = e.clientX;
    this.downY = e.clientY;
    this.downTime = performance.now();
  };

  private handleUp = (e: PointerEvent) => {
    if (!this.isDown) return;
    this.isDown = false;
    const dx = e.clientX - this.downX;
    const dy = e.clientY - this.downY;
    const dt = performance.now() - this.downTime;
    if (Math.hypot(dx, dy) > 14 || dt > 700) return;
    this.handleClick(e.clientX, e.clientY);
  };

  private handleClick(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(x, y), this.camera);
    const point = new THREE.Vector3();
    if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), point)) return;

    const cx = point.x + (this.grid.cols - 1) / 2;
    const cz = point.z + (this.grid.rows - 1) / 2;
    const col = Math.round(cx);
    const row = Math.round(cz);
    if (col < 0 || row < 0 || col >= this.grid.cols || row >= this.grid.rows) return;
    const dx = cx - col;
    const dz = cz - row;
    const edgeThreshold = 0.28;
    const onEdge = Math.max(Math.abs(dx), Math.abs(dz)) > edgeThreshold;

    if (this.tool === 'wall') {
      if (onEdge) this.toggleWall(col, row, dominantSide(dx, dz));
    } else if (this.tool === 'ball') {
      if (!onEdge) this.placeBall(col, row);
    } else if (this.tool === 'erase') {
      if (!onEdge) this.eraseBallAt(col, row);
      else this.eraseEdge(col, row, dominantSide(dx, dz));
    }
  }

  private toggleWall(col: number, row: number, side: WallSide) {
    const norm = normalizeWall(col, row, side, this.grid.cols, this.grid.rows);
    if (!norm) return;
    const idx = this.level.walls.findIndex(
      (w) => w.col === norm.col && w.row === norm.row && w.side === norm.side
    );
    if (idx >= 0) this.level.walls.splice(idx, 1);
    else this.level.walls.push(norm);
    this.rebuild();
  }

  private placeBall(col: number, row: number) {
    const idx = this.level.balls.findIndex((b) => b.col === col && b.row === row);
    if (idx >= 0) this.level.balls.splice(idx, 1);
    this.level.balls.push({ col, row, color: this.currentColor });
    this.rebuild();
  }

  private eraseBallAt(col: number, row: number) {
    this.level.balls = this.level.balls.filter((b) => !(b.col === col && b.row === row));
    this.rebuild();
  }

  private eraseEdge(col: number, row: number, side: WallSide) {
    const norm = normalizeWall(col, row, side, this.grid.cols, this.grid.rows);
    if (!norm) return;
    const idx = this.level.walls.findIndex(
      (w) => w.col === norm.col && w.row === norm.row && w.side === norm.side
    );
    if (idx >= 0) {
      this.level.walls.splice(idx, 1);
      this.rebuild();
    }
  }

  private exportJson() {
    const lv = this.snapshot();
    const json = JSON.stringify(lv, null, 2);
    showJsonModal(this.parent, json);
  }

  private downloadJson() {
    const lv = this.snapshot();
    const json = JSON.stringify(lv, null, 2);
    const slug =
      (lv.name || lv.id || 'level')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'level';
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.flashStatus('Downloaded — drop into src/levels/contributed/ to ship it.');
  }

  private loop = () => {
    this.renderer.render(this.scene, this.camera);
    this.rafId = requestAnimationFrame(this.loop);
  };

  dispose() {
    cancelAnimationFrame(this.rafId);
    this.renderer.domElement.removeEventListener('pointerdown', this.handleDown);
    this.renderer.domElement.removeEventListener('pointerup', this.handleUp);
    this.resizeObserver.disconnect();
    if (this.mesh) this.mesh.dispose();
    for (const b of this.ballMeshes) b.dispose();
    this.uiRoot.remove();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

function dominantSide(dx: number, dz: number): WallSide {
  if (Math.abs(dx) >= Math.abs(dz)) return dx > 0 ? 'E' : 'W';
  return dz > 0 ? 'S' : 'N';
}

function normalizeWall(
  col: number,
  row: number,
  side: WallSide,
  cols: number,
  rows: number
): { col: number; row: number; side: 'N' | 'E' } | null {
  if (side === 'N') {
    if (row === 0) return null;
    return { col, row, side: 'N' };
  }
  if (side === 'S') {
    if (row === rows - 1) return null;
    return { col, row: row + 1, side: 'N' };
  }
  if (side === 'E') {
    if (col === cols - 1) return null;
    return { col, row, side: 'E' };
  }
  if (col === 0) return null;
  return { col: col - 1, row, side: 'E' };
}

function showJsonModal(parent: HTMLElement, json: string) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  const card = document.createElement('div');
  card.className = 'modal-card';
  const h = document.createElement('h2');
  h.textContent = 'Level JSON';
  const p = document.createElement('p');
  p.textContent = 'Copy this and save anywhere.';
  const ta = document.createElement('textarea');
  ta.className = 'json';
  ta.value = json;
  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const copy = document.createElement('button');
  copy.className = 'btn';
  copy.textContent = 'Copy';
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(json);
      copy.textContent = 'Copied!';
      setTimeout(() => (copy.textContent = 'Copy'), 1200);
    } catch {
      ta.select();
    }
  });
  const close = document.createElement('button');
  close.className = 'btn ghost';
  close.textContent = 'Close';
  close.addEventListener('click', () => modal.remove());
  actions.appendChild(close);
  actions.appendChild(copy);
  card.appendChild(h);
  card.appendChild(p);
  card.appendChild(ta);
  card.appendChild(actions);
  modal.appendChild(card);
  parent.appendChild(modal);
}
