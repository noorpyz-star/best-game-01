// LUMEN DRIFT — the things that fly. Every entity is a plain object; these
// functions spawn them and step them forward. Nothing here knows about the DOM
// or the game screens — the world owns the rules, this file owns the motion.

import { ASTEROID, PARTICLES, POWERUP, SALVAGE, SEEKER, SHIP } from './config.js';
import { angle, chance, pick, range } from './random.js';

/** The player's skiff, centred, at rest, hull full. */
export function createShip(field) {
  return {
    x: field.width / 2,
    y: field.height / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    radius: SHIP.radius,
    hull: SHIP.maxHull,
    fireTimer: 0,
    dashTimer: 0,
    dashCooldown: 0,
    invulnerable: 2.0, // spawn protection: a fresh run never opens with a cheap hit
    thrusting: false,
    magnetTimer: 0,
    overdriveTimer: 0,
    shielded: false,
    dead: false,
    muzzle: 0,
    trail: [], // recent positions, drawn as a fading engine trail
  };
}

/** An asteroid of `tier` drifting in from a random edge. */
export function spawnAsteroid(rng, field, tier, level) {
  const spec = ASTEROID[tier];
  const edge = Math.floor(rng() * 4);
  const margin = spec.radius + 20;
  let x;
  let y;
  if (edge === 0) {
    x = range(rng, 0, field.width);
    y = -margin;
  } else if (edge === 1) {
    x = field.width + margin;
    y = range(rng, 0, field.height);
  } else if (edge === 2) {
    x = range(rng, 0, field.width);
    y = field.height + margin;
  } else {
    x = -margin;
    y = range(rng, 0, field.height);
  }
  // Aim roughly across the field, with a random spread, faster on higher levels.
  const targetX = field.width / 2 + range(rng, -320, 320);
  const targetY = field.height / 2 + range(rng, -220, 220);
  const aim = Math.atan2(targetY - y, targetX - x) + range(rng, -0.45, 0.45);
  const speed = range(rng, spec.speed[0], spec.speed[1]) * (1 + 0.05 * (level - 1));
  const verts = [];
  const points = tier === 'bulwark' ? 9 : 7;
  for (let i = 0; i < points; i += 1) verts.push(range(rng, 0.72, 1.18));
  // Craters, fixed per rock so the same rock always looks the same.
  const craters = [];
  for (let i = 0; i < 3; i += 1) {
    craters.push({
      dx: range(rng, -0.45, 0.45),
      dy: range(rng, -0.45, 0.45),
      r: range(rng, 0.08, 0.18),
    });
  }
  return {
    kind: 'asteroid',
    tier,
    x,
    y,
    vx: Math.cos(aim) * speed,
    vy: Math.sin(aim) * speed,
    radius: spec.radius,
    hits: spec.hits,
    maxHits: spec.hits,
    score: spec.score,
    salvage: spec.salvage,
    spin: range(rng, -1.4, 1.4),
    rotation: angle(rng),
    verts,
    craters,
    elite: false,
    flash: 0,
  };
}

/** A seeker mine: drifts in from an edge, then homes in on the ship. */
export function spawnSeeker(rng, field, level) {
  const edge = Math.floor(rng() * 4);
  const margin = SEEKER.radius + 20;
  let x;
  let y;
  if (edge === 0) {
    x = range(rng, 0, field.width);
    y = -margin;
  } else if (edge === 1) {
    x = field.width + margin;
    y = range(rng, 0, field.height);
  } else if (edge === 2) {
    x = range(rng, 0, field.width);
    y = field.height + margin;
  } else {
    x = -margin;
    y = range(rng, 0, field.height);
  }
  return {
    kind: 'seeker',
    x,
    y,
    vx: 0,
    vy: 0,
    radius: SEEKER.radius,
    hits: SEEKER.hits,
    maxHits: SEEKER.hits,
    score: SEEKER.score,
    salvage: SEEKER.salvage,
    spin: range(rng, -2, 2),
    rotation: angle(rng),
    wobble: rng() * Math.PI * 2,
    flash: 0,
  };
}

/** A bullet from the ship's nose. */
export function spawnBullet(ship) {
  const nx = Math.cos(ship.angle);
  const ny = Math.sin(ship.angle);
  return {
    kind: 'bullet',
    x: ship.x + nx * (ship.radius + 8),
    y: ship.y + ny * (ship.radius + 8),
    vx: nx * SHIP.bulletSpeed + ship.vx * 0.35,
    vy: ny * SHIP.bulletSpeed + ship.vy * 0.35,
    radius: 4,
    life: 0.9,
  };
}

/** One glowing salvage cell, drifting slowly. */
export function spawnSalvage(rng, x, y) {
  const a = angle(rng);
  const speed = range(rng, 12, 34);
  return {
    kind: 'salvage',
    x,
    y,
    vx: Math.cos(a) * speed,
    vy: Math.sin(a) * speed,
    radius: SALVAGE.radius,
    value: SALVAGE.value,
    life: SALVAGE.lifetime,
    pulse: rng() * Math.PI * 2,
  };
}

/** A power-up canister; kind is magnet, shield or overdrive. */
export function spawnPowerup(rng, x, y) {
  return {
    kind: 'powerup',
    power: pick(rng, POWERUP.kinds),
    x,
    y,
    vx: range(rng, -18, 18),
    vy: range(rng, -18, 18),
    radius: POWERUP.radius,
    life: POWERUP.lifetime,
    pulse: rng() * Math.PI * 2,
  };
}

/** Maybe drop a power-up where an asteroid died. */
export function maybeDropPowerup(rng, x, y) {
  if (!chance(rng, POWERUP.dropChance)) return null;
  return spawnPowerup(rng, x, y);
}

/** A burst of sparks. `color` is a css colour, `count` the number of sparks. */
export function burstParticles(list, x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    if (list.length >= PARTICLES.max) return;
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.3 + Math.random() * 0.9);
    list.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: 0.35 + Math.random() * 0.5,
      maxLife: 0.85,
      size: 1.5 + Math.random() * 2.5,
      color,
    });
  }
}

/** An expanding shockwave ring, drawn additively and fading out. */
export function addRing(list, x, y, color, maxR) {
  list.push({ x, y, color, r: 6, maxR, life: 0.45, maxLife: 0.45 });
}

/** Step every shockwave ring and drop the faded ones. */
export function stepRings(list, dt) {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const r = list[i];
    r.life -= dt;
    const frac = 1 - Math.max(0, r.life / r.maxLife);
    r.r = 6 + (r.maxR - 6) * frac * frac;
    if (r.life <= 0) list.splice(i, 1);
  }
}

/** Floating score text that rises and fades. */
export function addFloatText(list, x, y, text, color) {
  list.push({ x, y, text, color, life: 1.1, maxLife: 1.1 });
}

/** Step every particle and drop the dead ones. */
export function stepParticles(list, dt) {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const p = list[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 2.2 * dt;
    p.vy *= 1 - 2.2 * dt;
    p.life -= dt;
    if (p.life <= 0) list.splice(i, 1);
  }
}

/** Step every floating text and drop the faded ones. */
export function stepFloatTexts(list, dt) {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const t = list[i];
    t.y -= 34 * dt;
    t.life -= dt;
    if (t.life <= 0) list.splice(i, 1);
  }
}

/** Wrap a position around the field edges (asteroids and salvage drift through). */
export function wrapPosition(body, field, margin) {
  if (body.x < -margin) body.x += field.width + margin * 2;
  if (body.x > field.width + margin) body.x -= field.width + margin * 2;
  if (body.y < -margin) body.y += field.height + margin * 2;
  if (body.y > field.height + margin) body.y -= field.height + margin * 2;
}
