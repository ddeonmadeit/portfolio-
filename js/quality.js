// Device-tier switches — keep the dunes smooth on phones.
export const IS_MOBILE =
  (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches) ||
  (typeof window !== 'undefined' && window.innerWidth < 820);

export const TERRAIN_SEGS = IS_MOBILE ? 160 : 256;
export const SHADOW_SIZE = IS_MOBILE ? 1024 : 2048;
export const PIXEL_CAP = IS_MOBILE ? 1.3 : 1.75;
