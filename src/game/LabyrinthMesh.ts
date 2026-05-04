import * as THREE from 'three';
import { Grid } from './Grid';

const FLOOR_COLOR_A = 0x2a2f3d;
const FLOOR_COLOR_B = 0x252a37;
const WALL_COLOR = 0x4a526a;
const WALL_HEIGHT = 0.4;
const WALL_THICK = 0.08;

export class LabyrinthMesh {
  readonly group = new THREE.Group();
  private wallMaterial = new THREE.MeshStandardMaterial({
    color: WALL_COLOR,
    roughness: 0.85,
    metalness: 0.0,
  });

  constructor(private grid: Grid) {
    this.build();
  }

  dispose() {
    this.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
    });
    this.wallMaterial.dispose();
  }

  private build() {
    const { cols, rows } = this.grid;
    const halfW = cols / 2;
    const halfD = rows / 2;

    // Floor tiles for subtle checker
    const tileGeom = new THREE.PlaneGeometry(0.96, 0.96);
    tileGeom.rotateX(-Math.PI / 2);
    const matA = new THREE.MeshStandardMaterial({
      color: FLOOR_COLOR_A,
      roughness: 1,
      metalness: 0,
    });
    const matB = new THREE.MeshStandardMaterial({
      color: FLOOR_COLOR_B,
      roughness: 1,
      metalness: 0,
    });
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const m = new THREE.Mesh(tileGeom, (c + r) % 2 === 0 ? matA : matB);
        const w = this.grid.cellToWorld({ col: c, row: r });
        m.position.set(w.x, 0, w.z);
        m.userData.kind = 'floor';
        m.userData.cell = { col: c, row: r };
        this.group.add(m);
      }
    }

    // Underlying floor base
    const baseGeom = new THREE.PlaneGeometry(cols + 0.4, rows + 0.4);
    baseGeom.rotateX(-Math.PI / 2);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x14171f,
      roughness: 1,
    });
    const base = new THREE.Mesh(baseGeom, baseMat);
    base.position.y = -0.01;
    this.group.add(base);

    // Internal walls
    this.grid.forEachInternalWall((kind, col, row) => {
      this.addWallSegment(kind, col, row, halfW, halfD);
    });

    // Outer borders — always wall
    for (let c = 0; c < cols; c++) {
      this.addWallSegment('h', c, 0, halfW, halfD);
      this.addWallSegment('h', c, rows, halfW, halfD);
    }
    for (let r = 0; r < rows; r++) {
      this.addWallSegment('v', 0, r, halfW, halfD);
      this.addWallSegment('v', cols, r, halfW, halfD);
    }
  }

  private addWallSegment(
    kind: 'h' | 'v',
    col: number,
    row: number,
    halfW: number,
    halfD: number
  ) {
    const isHoriz = kind === 'h';
    const length = 1;
    const width = WALL_THICK;
    const height = WALL_HEIGHT;
    const geom = isHoriz
      ? new THREE.BoxGeometry(length, height, width)
      : new THREE.BoxGeometry(width, height, length);

    let x: number, z: number;
    if (isHoriz) {
      x = col - halfW + 0.5;
      z = row - halfD;
    } else {
      x = col - halfW;
      z = row - halfD + 0.5;
    }

    const mesh = new THREE.Mesh(geom, this.wallMaterial);
    mesh.position.set(x, height / 2, z);
    mesh.userData.kind = 'wall';
    this.group.add(mesh);
  }
}
