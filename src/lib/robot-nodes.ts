/** Exact GLB node names (brief §7.1). The §16 stand-in robot (M2) uses the same names so the real GLB drops in. */
export const AMR4_NODES = ['chassis', 'wheel_FL', 'wheel_FR', 'wheel_RL', 'wheel_RR', 'lidar_top', 'lidar_base', 'accent_strip'] as const;
export const HARDWARE_NODES = ['wheel_L', 'wheel_R', 'camera_pan', 'camera_tilt'] as const; // + caster_*
export const HERO_MODEL = { lo: '/models/amr_hero_lo.glb', hi: '/models/amr_hero_hi.glb' } as const;
