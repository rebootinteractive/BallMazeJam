import type { ColorKey } from './colors';

export type WallSide = 'N' | 'E' | 'S' | 'W';
export type WallStorageSide = 'N' | 'E';

export interface WallEntry {
  col: number;
  row: number;
  side: WallStorageSide;
}

export interface BallEntry {
  col: number;
  row: number;
  color: ColorKey;
}

export interface LevelData {
  id: string;
  name: string;
  cols: number;
  rows: number;
  timeSeconds: number;
  walls: WallEntry[];
  balls: BallEntry[];
}

export const LEVEL_SCHEMA_VERSION = 1;
