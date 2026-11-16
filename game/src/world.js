// LUMEN DRIFT — the rules. The world owns the screens (title, play, pause,
// over), the ship's motion, spawning, collisions, scoring, combos and levels.
// It steps in fixed slices so a screenshot scene can be staged deterministically.

import { ASTEROID, COMBO, FIELD, PARTICLES, POWERUP, SALVAGE, SHIP, WAVES } from './config.js';
import { makeRandom, range } from './random.js';
import {
  addFloatText,
  burstParticles,
  createShip,
  maybeDropPowerup,
  spawnAsteroid,
  spawnBullet,
  spawnSalvage,
  stepFloatTexts,
  stepParticles,
  wrapPosition,
} from './entities.js';
import {
  isMuted,
  playBoom,
  playChime,
  playDash,
  playHit,
  playLevelUp,
  playPowerup,
  playZap,
  setMuted,
  startMusic,
  stopMusic,
  unlockAudio,
} from './audio.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_OVER = 'over';

export const EVENT_NONE = 0;
export const EVENT_OVER = 1;

function levelTuning(level) {
  const per = WAVES.perLevel;
  return {
    spawnInterval: Math.max(0.42, WAVES.base.spawnInterval + per.spawnInterval * (level - 1)),
    maxAsteroids: WAVES.base.maxAsteroids + per.maxAsteroids * (level - 1),
    dartChance: Math.min(0.3, WAVES.base.dartChance + per.dartChance * (level - 1)),
    bulwarkChance: Math.min(0.22, WAVES.base.bulwarkChance + per.bulwarkChance * (level - 1)),
  };
}

function starfield(rng, count) {
  const stars = [];
  for (let i = 0; i < count; i += 1) {
    stars.push({
      x: rng() * FIELD.width,
      y: rng() * FIELD.height,
      size: 0.6 + rng() * 1.9,
      depth: 0.25 + rng() * 0.75,
      twinkle: rng() * Math.PI * 2,
    });
  }
  return stars;
}

export function createWorld(seed) {
  const rng = makeRandom(seed);
  const world = {
    rng,
    screen: SCREEN_TITLE,
    ship: createShip(FIELD),
    asteroids: [],
    bullets: [],
    salvage: [],
    powerups: [],
    particles: [],
    floatTexts: [],
    stars: starfield(rng, 130),
    score: 0,
    best: 0,
    salvaged: 0,
    shotsFired: 0,
    shotsHit: 0,
    combo: 1,
    comboTimer: 0,
    level: 1,
    levelScore: 0,
    elapsed: 0,
    spawnTimer: 1.2,
    shake: 0,
    flash: 0,
    time: 0,
    seed,
  };
  seedInitialField(world);
  return world;
}

/** A few asteroids and salvage cells already drifting, so the title never sits empty. */
function seedInitialField(world) {
  for (let i = 0; i < 5; i += 1) {
    const rock = spawnAsteroid(world.rng, FIELD, i === 0 ? 'big' : 'mid', 1);
    // Keep the opening field clear of the ship's spawn point at the centre.
    do {
      rock.x = range(world.rng, 80, FIELD.width - 80);
      rock.y = range(world.rng, 60, FIELD.height - 60);
    } while (Math.hypot(rock.x - FIELD.width / 2, rock.y - FIELD.height / 2) < 260);
    world.asteroids.push(rock);
  }
  for (let i = 0; i < 4; i += 1) {
    world.salvage.push(spawnSalvage(world.rng, range(world.rng, 120, FIELD.width - 120), range(world.rng, 100, FIELD.height - 100)));
  }
}

export function resetWorld(world, seed) {
  const fresh = createWorld(seed === undefined ? Math.floor(Math.random() * 2147483647) : seed);
  fresh.best = world.best;
  Object.keys(fresh).forEach((key) => {
    world[key] = fresh[key];
  });
}

function pickTier(rng, tuning) {
  const roll = rng();
  if (roll < tuning.bulwarkChance) return 'bulwark';
  if (roll < tuning.bulwarkChance + tuning.dartChance) return 'dart';
  if (rng() < 0.55) return 'big';
  return 'mid';
}

function addScore(world, base, x, y, label) {
  const gained = Math.round(base * world.combo);
  world.score += gained;
  world.levelScore += gained;
  addFloatText(world.floatTexts, x, y, label || `+${gained}`, world.combo > 1 ? '#8dff5e' : '#eaf6ff');
  return gained;
}

function breakAsteroid(world, rock, index) {
  world.asteroids.splice(index, 1);
  const tier = rock.tier;
  burstParticles(world.particles, rock.x, rock.y, tier === 'bulwark' ? '#c9d6ff' : '#ff8a5c', tier === 'big' ? PARTICLES.explosion : 16, tier === 'big' ? 260 : 200);
  playBoom(tier);
  addScore(world, rock.score, rock.x, rock.y);
  world.shake = Math.min(14, world.shake + (tier === 'big' ? 7 : 4));
  for (let i = 0; i < rock.salvage; i += 1) {
    world.salvage.push(spawnSalvage(world.rng, rock.x + range(world.rng, -18, 18), rock.y + range(world.rng, -18, 18)));
  }
  const drop = maybeDropPowerup(world.rng, rock.x, rock.y);
  if (drop) world.powerups.push(drop);
  if (tier === 'big' || tier === 'bulwark') {
    // Big rocks and bulwarks split into two mids.
    for (let i = 0; i < 2; i += 1) {
      const child = spawnAsteroid(world.rng, FIELD, 'mid', world.level);
      child.x = rock.x + range(world.rng, -24, 24);
      child.y = rock.y + range(world.rng, -24, 24);
      child.vx = range(world.rng, -140, 140);
      child.vy = range(world.rng, -140, 140);
      world.asteroids.push(child);
    }
  } else if (tier === 'mid') {
    for (let i = 0; i < 2; i += 1) {
      const child = spawnAsteroid(world.rng, FIELD, 'small', world.level);
      child.x = rock.x + range(world.rng, -16, 16);
      child.y = rock.y + range(world.rng, -16, 16);
      child.vx = range(world.rng, -190, 190);
      child.vy = range(world.rng, -190, 190);
      world.asteroids.push(child);
    }
  }
}

function damageShip(world) {
  const ship = world.ship;
  if (ship.invulnerable > 0 || ship.dashTimer > 0) return;
  if (ship.shielded) {
    ship.shielded = false;
    ship.invulnerable = SHIP.invulnerableAfterHit;
    burstParticles(world.particles, ship.x, ship.y, '#39d5ff', 22, 300);
    addFloatText(world.floatTexts, ship.x, ship.y - 30, 'SHIELD DOWN', '#39d5ff');
    playHit();
    return;
  }
  ship.hull -= 1;
  ship.invulnerable = SHIP.invulnerableAfterHit;
  world.combo = 1;
  world.comboTimer = 0;
  world.shake = 18;
  world.flash = 0.35;
  burstParticles(world.particles, ship.x, ship.y, '#ff4d6d', 30, 320);
  playHit();
  if (ship.hull <= 0) {
    ship.dead = true;
    burstParticles(world.particles, ship.x, ship.y, '#39d5ff', 60, 420);
    burstParticles(world.particles, ship.x, ship.y, '#ffb347', 40, 300);
    world.shake = 26;
    world.screen = SCREEN_OVER;
    world.best = Math.max(world.best, world.score);
    stopMusic();
  }
}

function stepShip(world, input, dt) {
  const ship = world.ship;
  if (ship.dead) return;
  // Aim: the nose follows the mouse; keys nudge it too.
  const dx = input.mouseX - ship.x;
  const dy = input.mouseY - ship.y;
  const mouseDist = Math.hypot(dx, dy);
  if (mouseDist > 6) {
    const want = Math.atan2(dy, dx);
    let diff = want - ship.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    ship.angle += diff * Math.min(1, SHIP.turnRate * dt);
  }
  let ax = 0;
  let ay = 0;
  if (input.isDown('up')) ay -= 1;
  if (input.isDown('down')) ay += 1;
  if (input.isDown('left')) ax -= 1;
  if (input.isDown('right')) ax += 1;
  // Mouse pull: the ship eases toward the cursor when it is far away.
  if (mouseDist > 90) {
    ax += dx / mouseDist;
    ay += dy / mouseDist;
  }
  const len = Math.hypot(ax, ay);
  if (len > 0) {
    ship.vx += (ax / len) * SHIP.accel * dt;
    ship.vy += (ay / len) * SHIP.accel * dt;
    ship.thrusting = true;
  } else {
    ship.thrusting = false;
  }
  const drag = Math.max(0, 1 - SHIP.drag * dt);
  ship.vx *= drag;
  ship.vy *= drag;
  const speed = Math.hypot(ship.vx, ship.vy);
  const cap = ship.overdriveTimer > 0 ? SHIP.maxSpeed * 1.25 : SHIP.maxSpeed;
  if (speed > cap) {
    ship.vx = (ship.vx / speed) * cap;
    ship.vy = (ship.vy / speed) * cap;
  }
  // Dash: a short burst along the aim with brief invulnerability.
  ship.dashCooldown = Math.max(0, ship.dashCooldown - dt);
  if (input.consumePressed('dash') && ship.dashCooldown <= 0 && ship.dashTimer <= 0) {
    ship.dashTimer = SHIP.dashTime;
    ship.dashCooldown = SHIP.dashCooldown;
    ship.vx = Math.cos(ship.angle) * SHIP.dashSpeed;
    ship.vy = Math.sin(ship.angle) * SHIP.dashSpeed;
    playDash();
    burstParticles(world.particles, ship.x, ship.y, '#39d5ff', 12, 180);
  }
  if (ship.dashTimer > 0) ship.dashTimer -= dt;
  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;
  ship.x = Math.max(ship.radius, Math.min(FIELD.width - ship.radius, ship.x));
  ship.y = Math.max(ship.radius, Math.min(FIELD.height - ship.radius, ship.y));
  ship.invulnerable = Math.max(0, ship.invulnerable - dt);
  ship.magnetTimer = Math.max(0, ship.magnetTimer - dt);
  ship.overdriveTimer = Math.max(0, ship.overdriveTimer - dt);
  // Thruster sparks while accelerating.
  if (ship.thrusting && world.particles.length < PARTICLES.max) {
    const bx = ship.x - Math.cos(ship.angle) * ship.radius;
    const by = ship.y - Math.sin(ship.angle) * ship.radius;
    burstParticles(world.particles, bx, by, '#ffb347', 1, 60);
  }
  // Fire: hold mouse or Space; overdrive halves the cooldown.
  ship.fireTimer -= dt;
  const firing = input.mouseDown || input.isDown('fire');
  if (firing && ship.fireTimer <= 0) {
    ship.fireTimer = ship.overdriveTimer > 0 ? SHIP.fireCooldown * 0.5 : SHIP.fireCooldown;
    world.bullets.push(spawnBullet(ship));
    world.shotsFired += 1;
    playZap();
  }
}

function stepBullets(world, dt) {
  for (let i = world.bullets.length - 1; i >= 0; i -= 1) {
    const b = world.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
      world.bullets.splice(i, 1);
    }
  }
}

function stepAsteroids(world, dt) {
  for (const rock of world.asteroids) {
    rock.x += rock.vx * dt;
    rock.y += rock.vy * dt;
    rock.rotation += rock.spin * dt;
    rock.flash = Math.max(0, rock.flash - dt);
    wrapPosition(rock, FIELD, rock.radius + 30);
  }
}

function stepSalvage(world, dt) {
  const ship = world.ship;
  for (let i = world.salvage.length - 1; i >= 0; i -= 1) {
    const cell = world.salvage[i];
    cell.life -= dt;
    cell.pulse += dt * 5;
    if (ship.magnetTimer > 0 && !ship.dead) {
      const dx = ship.x - cell.x;
      const dy = ship.y - cell.y;
      const d = Math.hypot(dx, dy);
      if (d < SALVAGE.magnetRadius && d > 1) {
        cell.vx += (dx / d) * 900 * dt;
        cell.vy += (dy / d) * 900 * dt;
      }
    }
    cell.x += cell.vx * dt;
    cell.y += cell.vy * dt;
    wrapPosition(cell, FIELD, 24);
    if (cell.life <= 0) world.salvage.splice(i, 1);
  }
  for (let i = world.powerups.length - 1; i >= 0; i -= 1) {
    const p = world.powerups[i];
    p.life -= dt;
    p.pulse += dt * 5;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    wrapPosition(p, FIELD, 24);
    if (p.life <= 0) world.powerups.splice(i, 1);
  }
}

function collide(world) {
  const ship = world.ship;
  // Bullets vs asteroids.
  for (let bi = world.bullets.length - 1; bi >= 0; bi -= 1) {
    const b = world.bullets[bi];
    let hit = false;
    for (let ai = world.asteroids.length - 1; ai >= 0; ai -= 1) {
      const rock = world.asteroids[ai];
      const dx = b.x - rock.x;
      const dy = b.y - rock.y;
      const rr = rock.radius + b.radius;
      if (dx * dx + dy * dy < rr * rr) {
        hit = true;
        world.shotsHit += 1;
        rock.hits -= 1;
        rock.flash = 0.12;
        burstParticles(world.particles, b.x, b.y, '#ffd166', 6, 160);
        if (rock.hits <= 0) breakAsteroid(world, rock, ai);
        break;
      }
    }
    if (hit) world.bullets.splice(bi, 1);
  }
  if (ship.dead) return;
  // Ship vs asteroids.
  for (const rock of world.asteroids) {
    const dx = ship.x - rock.x;
    const dy = ship.y - rock.y;
    const rr = rock.radius + ship.radius - 6;
    if (dx * dx + dy * dy < rr * rr) {
      damageShip(world);
      // Shove the rock away so one hit does not chain into the next frame.
      const d = Math.hypot(dx, dy) || 1;
      rock.x += (dx / d) * 30;
      rock.y += (dy / d) * 30;
      if (ship.dead) return;
      break;
    }
  }
  // Ship vs salvage.
  for (let i = world.salvage.length - 1; i >= 0; i -= 1) {
    const cell = world.salvage[i];
    const dx = ship.x - cell.x;
    const dy = ship.y - cell.y;
    const rr = ship.radius + cell.radius + 6;
    if (dx * dx + dy * dy < rr * rr) {
      world.salvage.splice(i, 1);
      world.salvaged += 1;
      world.comboTimer = COMBO.window;
      world.combo = Math.min(COMBO.max, world.combo + COMBO.step);
      addScore(world, cell.value, cell.x, cell.y);
      burstParticles(world.particles, cell.x, cell.y, '#ffb347', PARTICLES.pickup, 140);
      playChime(world.combo);
    }
  }
  // Ship vs power-ups.
  for (let i = world.powerups.length - 1; i >= 0; i -= 1) {
    const p = world.powerups[i];
    const dx = ship.x - p.x;
    const dy = ship.y - p.y;
    const rr = ship.radius + p.radius + 6;
    if (dx * dx + dy * dy < rr * rr) {
      world.powerups.splice(i, 1);
      applyPowerup(world, p.power);
    }
  }
}

function applyPowerup(world, power) {
  const ship = world.ship;
  if (power === 'magnet') {
    ship.magnetTimer = POWERUP.durations.magnet;
    addFloatText(world.floatTexts, ship.x, ship.y - 30, 'MAGNET 12s', '#8dff5e');
  } else if (power === 'shield') {
    ship.shielded = true;
    addFloatText(world.floatTexts, ship.x, ship.y - 30, 'SHIELD UP', '#39d5ff');
  } else {
    ship.overdriveTimer = POWERUP.durations.overdrive;
    addFloatText(world.floatTexts, ship.x, ship.y - 30, 'OVERDRIVE 9s', '#ff4d8d');
  }
  playPowerup();
}

function stepSpawning(world, dt) {
  const tuning = levelTuning(world.level);
  world.spawnTimer -= dt;
  if (world.spawnTimer <= 0 && world.asteroids.length < tuning.maxAsteroids) {
    world.spawnTimer = tuning.spawnInterval * (0.8 + world.rng() * 0.4);
    world.asteroids.push(spawnAsteroid(world.rng, FIELD, pickTier(world.rng, tuning), world.level));
  }
  // A slow trickle of free salvage keeps the field worth crossing.
  if (world.rng() < dt * 0.5 && world.salvage.length < 8) {
    world.salvage.push(spawnSalvage(world.rng, range(world.rng, 80, FIELD.width - 80), range(world.rng, 80, FIELD.height - 80)));
  }
}

function stepLevel(world) {
  if (world.levelScore >= WAVES.levelUpScore && world.level < WAVES.maxLevel) {
    world.levelScore -= WAVES.levelUpScore;
    world.level += 1;
    addFloatText(world.floatTexts, FIELD.width / 2, 180, `LEVEL ${world.level}`, '#8dff5e');
    playLevelUp();
    world.flash = 0.25;
  }
}

/** Advance the world by `dt` seconds with `input` held. Returns an event flag. */
export function stepWorld(world, input, dt) {
  world.time += dt;
  world.shake = Math.max(0, world.shake - 30 * dt);
  world.flash = Math.max(0, world.flash - dt);
  stepParticles(world.particles, dt);
  stepFloatTexts(world.floatTexts, dt);
  if (world.screen === SCREEN_TITLE) {
    stepAsteroids(world, dt);
    stepSalvage(world, dt);
    return EVENT_NONE;
  }
  if (world.screen !== SCREEN_PLAY) return EVENT_NONE;
  world.elapsed += dt;
  if (world.comboTimer > 0) {
    world.comboTimer -= dt;
    if (world.comboTimer <= 0) world.combo = 1;
  }
  stepShip(world, input, dt);
  stepBullets(world, dt);
  stepAsteroids(world, dt);
  stepSalvage(world, dt);
  collide(world);
  stepSpawning(world, dt);
  stepLevel(world);
  if (world.ship.dead) return EVENT_OVER;
  return EVENT_NONE;
}

/** Handle one pressed action on the current screen; returns true when consumed. */
export function pressAction(world, input) {
  if (input.consumePressed('mute')) {
    setMuted(!isMuted());
    return true;
  }
  if (world.screen === SCREEN_TITLE) {
    if (input.consumePressed('start') || input.consumePressed('fire')) {
      world.screen = SCREEN_PLAY;
      unlockAudio();
      startMusic();
      return true;
    }
    return false;
  }
  if (world.screen === SCREEN_PLAY) {
    if (input.consumePressed('pause')) {
      world.screen = SCREEN_PAUSE;
      return true;
    }
    return false;
  }
  if (world.screen === SCREEN_PAUSE) {
    if (input.consumePressed('pause') || input.consumePressed('start')) {
      world.screen = SCREEN_PLAY;
      return true;
    }
    return false;
  }
  if (world.screen === SCREEN_OVER) {
    if (input.consumePressed('restart') || input.consumePressed('start') || input.consumePressed('fire')) {
      resetWorld(world);
      world.screen = SCREEN_PLAY;
      unlockAudio();
      startMusic();
      return true;
    }
    return false;
  }
  return false;
}

/** Accuracy of the run so far, as a percentage. */
export function accuracy(world) {
  if (world.shotsFired === 0) return 100;
  return Math.round((world.shotsHit / world.shotsFired) * 100);
}
