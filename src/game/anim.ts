export type Easing = (t: number) => number;

export const easeOutCubic: Easing = (t) => 1 - Math.pow(1 - t, 3);
export const easeInQuad: Easing = (t) => t * t;
export const easeInOutQuad: Easing = (t) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export interface Tween {
  t: number;
  duration: number;
  done: boolean;
}

export const tween = (duration: number): Tween => ({ t: 0, duration, done: false });

export const advance = (tw: Tween, dt: number): number => {
  tw.t = Math.min(tw.duration, tw.t + dt);
  if (tw.t >= tw.duration) tw.done = true;
  return tw.duration === 0 ? 1 : tw.t / tw.duration;
};

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
