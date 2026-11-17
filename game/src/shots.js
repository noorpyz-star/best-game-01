// LUMEN DRIFT — the screenshot scenes behind ?shot=start|play|end. Each scene
// plays the real rules forward from a fresh world for a fixed number of steps,
// steered by a simple autopilot (chase the nearest salvage, shoot the nearest
// rock, dash clear when one closes in), so the frame is what a short real game
// looks like and the same seed always gives the same frame.

import { FIELD, SHOT } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, createWorld, stepWorld } from './world.js';

const SAMPLE = 1 / 30;

/** A fake input object that the autopilot fills in each step. */
function fakeInput() {
  return {
    keys: new Set(),
    mouseX: FIELD.width / 2,
    mouseY: FIELD.height / 2,
    mouseDown: false,
    pressed: new Set(),
    consumePressed(action) {
      if (this.pressed.has(action)) {
        this.pressed.delete(action);
        return true;
      }
      return false;
    },
    isDown(action) {
      return this.keys.has(action);
    },
    endFrame() {},
  };
}

function nearestSalvage(world) {
  let best = null;
  let bestDist = Infinity;
  for (const cell of world.salvage) {
    const d = Math.hypot(cell.x - world.ship.x, cell.y - world.ship.y);
    if (d < bestDist) {
      bestDist = d;
      best = cell;
    }
  }
  return best;
}

function nearestAsteroid(world) {
  let best = null;
  let bestDist = Infinity;
  // Seekers count as threats too: they home in, so they outrank distant rocks.
  const threats = world.asteroids.concat(world.seekers);
  for (const rock of threats) {
    const d = Math.hypot(rock.x - world.ship.x, rock.y - world.ship.y);
    if (d < bestDist) {
      bestDist = d;
      best = rock;
    }
  }
  return best;
}

/** The closest rock that is closing in, and how soon it would arrive. */
function closingRock(world) {
  const ship = world.ship;
  let worst = null;
  let worstTime = Infinity;
  const threats = world.asteroids.concat(world.seekers);
  for (const rock of threats) {
    const dx = rock.x - ship.x;
    const dy = rock.y - ship.y;
    const dist = Math.hypot(dx, dy);
    const closing = -(dx * rock.vx + dy * rock.vy) / (dist || 1);
    if (closing <= 0) continue;
    const time = (dist - rock.radius - ship.radius) / closing;
    if (time < worstTime) {
      worstTime = time;
      worst = rock;
    }
  }
  return { rock: worst, time: worstTime };
}

function angleTo(fromX, fromY, toX, toY) {
  return Math.atan2(toY - fromY, toX - fromX);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

/**
 * Steer one step. The mouse is the aim (and, when it is far, the destination);
 * the arrow keys are independent thrust, so the pilot can do what a skilled
 * player does: aim at a rock with the mouse while thrusting away from it with
 * the keys, and only fly toward salvage when the field is clear.
 */
function autopilot(world, input, horizon) {
  const ship = world.ship;
  input.keys.clear();
  const rock = nearestAsteroid(world);
  const rockDist = rock ? Math.hypot(rock.x - ship.x, rock.y - ship.y) : Infinity;
  const { rock: closing, time } = closingRock(world);
  if ((closing && time < horizon && rockDist < 320) || rockDist < 220) {
    // Flee: aim away from the closest rock, dash, and thrust away with keys.
    const threat = rockDist < 220 ? rock : closing;
    const away = angleTo(threat.x, threat.y, ship.x, ship.y);
    input.mouseX = ship.x + Math.cos(away) * 320;
    input.mouseY = ship.y + Math.sin(away) * 320;
    input.mouseDown = false;
    input.pressed.add('dash');
    thrustToward(input, Math.cos(away), Math.sin(away));
    return;
  }
  const cell = nearestSalvage(world);
  const cellDist = cell ? Math.hypot(cell.x - ship.x, cell.y - ship.y) : Infinity;
  if (cell && cellDist < 260 && rockDist > 340) {
    // Chase the cell with the mouse; hold fire so shots stay honest.
    input.mouseX = cell.x;
    input.mouseY = cell.y;
    input.mouseDown = false;
    return;
  }
  if (rock) {
    // Aim at the rock and fire when the nose is on it. Thrust keeps the
    // range: back off inside 280, close in beyond 420, strafe between.
    input.mouseX = rock.x;
    input.mouseY = rock.y;
    const aim = angleTo(ship.x, ship.y, rock.x, rock.y);
    input.mouseDown = angleDiff(aim, ship.angle) < 0.5 && rockDist < 520;
    const dx = ship.x - rock.x;
    const dy = ship.y - rock.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 280) {
      thrustToward(input, dx / d, dy / d);
    } else if (d > 420) {
      thrustToward(input, -dx / d, -dy / d);
    } else {
      // Strafe sideways around the rock.
      thrustToward(input, -dy / d, dx / d);
    }
  }
}

/** Add arrow-key thrust in the direction (ux, uy): screen-space components. */
function thrustToward(input, ux, uy) {
  if (ux > 0.3) input.keys.add('right');
  if (ux < -0.3) input.keys.add('left');
  if (uy > 0.3) input.keys.add('down');
  if (uy < -0.3) input.keys.add('up');
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start)
 * and return the screen to draw over it.
 */
export function stageShot(name, world) {
  const input = fakeInput();
  if (name !== 'play' && name !== 'end') {
    world.screen = SCREEN_TITLE;
    for (let i = 0; i < SHOT.startSeconds / SAMPLE; i += 1) {
      stepWorld(world, input, SAMPLE);
    }
    return SCREEN_TITLE;
  }
  world.screen = SCREEN_PLAY;
  const limit = name === 'end' ? SHOT.endSeconds : SHOT.playSeconds;
  const horizon = name === 'end' ? 0.35 : 0.9;
  for (let i = 0; i < limit / SAMPLE; i += 1) {
    // The end scene stops playing after 45 seconds: a tired pilot drifts
    // into the field and the rocks finish the run.
    if (name === 'end' && world.elapsed > 45) {
      input.mouseX = FIELD.width / 2;
      input.mouseY = FIELD.height / 2;
      input.mouseDown = false;
    } else {
      autopilot(world, input, horizon);
    }
    const over = stepWorld(world, input, SAMPLE);
    input.pressed.clear();
    if (over) break;
  }
  if (name === 'end' && world.screen !== SCREEN_OVER) {
    // Force the loss so the end frame always shows the results screen.
    world.ship.hull = 0;
    world.ship.dead = true;
    world.screen = SCREEN_OVER;
    world.best = Math.max(world.best, world.score);
  }
  return world.screen;
}

export function shotSeed(params) {
  const seed = Number.parseInt(params.get('seed') || '7', 10);
  return Number.isFinite(seed) ? seed : 7;
}

export function shotName(params) {
  const name = params.get('shot') || 'start';
  return name === 'play' || name === 'end' ? name : 'start';
}
