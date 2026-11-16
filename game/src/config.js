// LUMEN DRIFT — tuning constants. One place for every number the game balances on,
// so difficulty, feel and scoring can be tuned without touching the rules.
export const FIELD = { width: 1280, height: 720 };

export const SHIP = {
  radius: 16,
  accel: 2600,
  maxSpeed: 520,
  drag: 3.2,
  turnRate: 9,
  fireCooldown: 0.16,
  bulletSpeed: 760,
  dashCooldown: 2.4,
  dashTime: 0.16,
  dashSpeed: 1150,
  invulnerableAfterHit: 1.6,
  maxHull: 3,
};

export const ASTEROID = {
  // size tiers: radius, hull hits, score, salvage dropped, drift speed range
  big: { radius: 46, hits: 3, score: 50, salvage: 3, speed: [42, 78] },
  mid: { radius: 28, hits: 2, score: 100, salvage: 2, speed: [70, 120] },
  small: { radius: 16, hits: 1, score: 150, salvage: 1, speed: [110, 175] },
  dart: { radius: 13, hits: 1, score: 200, salvage: 1, speed: [210, 290] },
  bulwark: { radius: 58, hits: 5, score: 300, salvage: 4, speed: [26, 44] },
};

export const SALVAGE = {
  radius: 10,
  value: 25,
  magnetRadius: 190,
  lifetime: 14,
};

export const POWERUP = {
  radius: 14,
  lifetime: 11,
  dropChance: 0.16,
  kinds: ['magnet', 'shield', 'overdrive'],
  durations: { magnet: 12, shield: 0, overdrive: 9 },
};

export const COMBO = {
  window: 4.0,
  step: 0.25,
  max: 4,
};

export const WAVES = {
  // level: { spawnInterval seconds, maxAsteroids, dartChance, bulwarkChance }
  base: { spawnInterval: 1.7, maxAsteroids: 7, dartChance: 0, bulwarkChance: 0 },
  perLevel: { spawnInterval: -0.05, maxAsteroids: 1, dartChance: 0.04, bulwarkChance: 0.03 },
  maxLevel: 12,
  levelUpScore: 1200,
};

export const PARTICLES = {
  explosion: 26,
  pickup: 10,
  thruster: 2,
  max: 420,
};

export const SHOT = {
  startSeconds: 4,
  playSeconds: 26,
  endSeconds: 240,
};
