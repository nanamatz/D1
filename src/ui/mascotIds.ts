export const WOODAK_SKIN_IDS = ['woodak', 'alien', 'ghost', 'dog', 'turtle'] as const;

export type WooDakSkin = (typeof WOODAK_SKIN_IDS)[number];

export const isWooDakSkin = (value: unknown): value is WooDakSkin =>
  typeof value === 'string' && WOODAK_SKIN_IDS.includes(value as WooDakSkin);
