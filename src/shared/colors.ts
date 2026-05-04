export type ColorKey = 'red' | 'blue' | 'green' | 'yellow' | 'purple';

export const COLOR_KEYS: ColorKey[] = ['red', 'blue', 'green', 'yellow', 'purple'];

export const COLOR_HEX: Record<ColorKey, number> = {
  red: 0xff5468,
  blue: 0x4a8fff,
  green: 0x4dd17a,
  yellow: 0xffd166,
  purple: 0xb978ff,
};

export const COLOR_HEX_STR: Record<ColorKey, string> = Object.fromEntries(
  Object.entries(COLOR_HEX).map(([k, v]) => [k, '#' + v.toString(16).padStart(6, '0')])
) as Record<ColorKey, string>;

export const COLOR_DARK: Record<ColorKey, number> = {
  red: 0x8c2231,
  blue: 0x1f4a99,
  green: 0x217340,
  yellow: 0x9c7c2c,
  purple: 0x6b3a9e,
};
