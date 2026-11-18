// LUMEN DRIFT — everything the player sees. One canvas, drawn fresh every frame:
// a parallax starfield, the ship, asteroids, bullets, salvage, power-ups,
// particles, floating text, the HUD and the title / pause / game-over screens.

import { FIELD, SHIP } from './config.js';
import { SCREEN_OVER, SCREEN_PAUSE, SCREEN_PLAY, SCREEN_TITLE, accuracy } from './world.js';

const INK = '#eaf6ff';
const DIM = '#8fa8c8';
const CYAN = '#39d5ff';
const AMBER = '#ffb347';
const ROSE = '#ff4d8d';
const LIME = '#8dff5e';

function hullHearts(ctx, hull, maxHull, x, y) {
  for (let i = 0; i < maxHull; i += 1) {
    const hx = x + i * 30;
    const filled = i < hull;
    ctx.beginPath();
    ctx.moveTo(hx + 8, y + 14);
    ctx.bezierCurveTo(hx, y + 4, hx + 3, y - 2, hx + 8, y + 2);
    ctx.bezierCurveTo(hx + 13, y - 2, hx + 16, y + 4, hx + 8, y + 14);
    ctx.fillStyle = filled ? '#ff4d6d' : 'rgba(143,168,200,0.25)';
    ctx.fill();
  }
}

function drawStars(ctx, stars, time) {
  const colors = ['#cfe8ff', '#ffe9c4', '#d8c8ff'];
  for (const s of stars) {
    const tw = 0.55 + 0.45 * Math.sin(time * 1.6 + s.twinkle);
    ctx.globalAlpha = tw * s.depth;
    ctx.fillStyle = colors[s.hue] || colors[0];
    ctx.fillRect(s.x, s.y, s.size, s.size);
    // The brightest stars get a cross sparkle.
    if (s.size > 2.1 && tw > 0.75) {
      ctx.globalAlpha = (tw - 0.75) * 2.4 * s.depth;
      const r = s.size * 3.2;
      ctx.fillRect(s.x + s.size / 2 - r, s.y + s.size / 2 - 0.6, r * 2, 1.2);
      ctx.fillRect(s.x + s.size / 2 - 0.6, s.y + s.size / 2 - r, 1.2, r * 2);
    }
  }
  ctx.globalAlpha = 1;
}

function drawNebula(ctx, time) {
  // Four slow-drifting radial glows, drawn additively for depth.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const drift = Math.sin(time * 0.05) * 40;
  const drift2 = Math.cos(time * 0.037) * 34;
  const glows = [
    [300 + drift, 180, 320, '57,120,255', 0.15],
    [1020 - drift, 560, 300, '255,77,141', 0.11],
    [980 + drift2, 130, 260, '139,92,246', 0.10],
    [180 - drift2, 600, 280, '45,212,191', 0.08],
  ];
  for (const [x, y, r, rgb, a] of glows) {
    const g = ctx.createRadialGradient(x, y, 20, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }
  ctx.restore();
}

function drawVignette(ctx) {
  const g = ctx.createRadialGradient(
    FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.42,
    FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.85,
  );
  g.addColorStop(0, 'rgba(2,4,12,0)');
  g.addColorStop(1, 'rgba(2,4,12,0.42)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
}

function drawShip(ctx, ship, time) {
  // Engine trail: a fading cyan wake behind the ship.
  const trail = ship.trail;
  if (trail.length > 1) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i < trail.length; i += 1) {
      const frac = 1 - i / trail.length;
      ctx.strokeStyle = `rgba(57,213,255,${(frac * 0.5).toFixed(3)})`;
      ctx.lineWidth = 1 + frac * 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
      ctx.lineTo(trail[i].x, trail[i].y);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.angle);
  // Blink while invulnerable after a hit.
  if (ship.invulnerable > 0 && Math.floor(time * 14) % 2 === 0) ctx.globalAlpha = 0.35;
  // Thruster flame, layered: hot core + orange halo.
  if (ship.thrusting) {
    const flick = 14 + Math.sin(time * 40) * 5;
    ctx.beginPath();
    ctx.moveTo(-ship.radius + 2, -8);
    ctx.lineTo(-ship.radius - flick - 6, 0);
    ctx.lineTo(-ship.radius + 2, 8);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,179,71,0.55)';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-ship.radius + 2, -5);
    ctx.lineTo(-ship.radius - flick, 0);
    ctx.lineTo(-ship.radius + 2, 5);
    ctx.closePath();
    ctx.fillStyle = '#ffe1a8';
    ctx.fill();
  }
  // Muzzle flash when a shot leaves the nose.
  if (ship.muzzle > 0) {
    ctx.beginPath();
    ctx.arc(ship.radius + 10, 0, 7, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(191,239,255,0.9)';
    ctx.shadowColor = CYAN;
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  // Hull: a swept dart.
  ctx.beginPath();
  ctx.moveTo(ship.radius + 6, 0);
  ctx.lineTo(-ship.radius + 4, -11);
  ctx.lineTo(-ship.radius + 10, 0);
  ctx.lineTo(-ship.radius + 4, 11);
  ctx.closePath();
  ctx.fillStyle = '#0e2a3f';
  ctx.fill();
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 2;
  ctx.shadowColor = CYAN;
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.shadowBlur = 0;
  // Cockpit.
  ctx.beginPath();
  ctx.arc(4, 0, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = CYAN;
  ctx.fill();
  ctx.restore();
  // Shield ring.
  if (ship.shielded) {
    ctx.beginPath();
    ctx.arc(ship.x, ship.y, ship.radius + 10, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(57,213,255,0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // Magnet radius hint.
  if (ship.magnetTimer > 0) {
    ctx.beginPath();
    ctx.arc(ship.x, ship.y, ship.radius + 26 + Math.sin(time * 5) * 4, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(141,255,94,0.35)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 8]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawAsteroid(ctx, rock) {
  ctx.save();
  ctx.translate(rock.x, rock.y);
  ctx.rotate(rock.rotation);
  ctx.beginPath();
  const n = rock.verts.length;
  for (let i = 0; i <= n; i += 1) {
    const v = rock.verts[i % n];
    const a = (i / n) * Math.PI * 2;
    const r = rock.radius * v;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  const baseColors = { big: '#6a5578', mid: '#7d5644', small: '#8c6856', dart: '#5a4870', bulwark: '#485a80' };
  const lightColors = { big: '#a390c8', mid: '#c08a68', small: '#c89c78', dart: '#9670b0', bulwark: '#8298c0' };
  const rimColors = { big: '#cdbcf0', mid: '#e8b888', small: '#f0c098', dart: '#d090f0', bulwark: '#bcd4f8' };
  if (rock.elite) {
    const g = ctx.createRadialGradient(-rock.radius * 0.3, -rock.radius * 0.3, 4, 0, 0, rock.radius * 1.1);
    g.addColorStop(0, '#ffe9a8');
    g.addColorStop(0.55, '#c8922a');
    g.addColorStop(1, '#6b4a10');
    ctx.fillStyle = g;
    ctx.shadowColor = '#ffd166';
    ctx.shadowBlur = 18;
  } else {
    const g = ctx.createRadialGradient(-rock.radius * 0.35, -rock.radius * 0.35, 4, 0, 0, rock.radius * 1.15);
    g.addColorStop(0, lightColors[rock.tier] || '#8a7ab0');
    g.addColorStop(1, baseColors[rock.tier] || '#5a4a6b');
    ctx.fillStyle = g;
  }
  ctx.fill();
  ctx.shadowBlur = 0;
  // Craters: darker pits with a lit lower rim.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  for (const c of rock.craters) {
    ctx.beginPath();
    ctx.arc(c.dx * rock.radius, c.dy * rock.radius, c.r * rock.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = rock.flash > 0 ? '#ffffff' : rock.elite ? '#ffd166' : rimColors[rock.tier] || '#9a8ab0';
  ctx.lineWidth = rock.elite ? 2.5 : 2;
  ctx.stroke();
  // Cracks show how many hits are left.
  if (rock.hits < rock.maxHits) {
    ctx.beginPath();
    ctx.moveTo(-rock.radius * 0.4, -rock.radius * 0.2);
    ctx.lineTo(0, rock.radius * 0.1);
    ctx.lineTo(rock.radius * 0.4, -rock.radius * 0.3);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Bulwarks carry a bright core.
  if (rock.tier === 'bulwark') {
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd166';
    ctx.shadowColor = '#ffd166';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  // Darts are drawn with a motion streak.
  if (rock.tier === 'dart') {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-rock.radius * 1.6, 0);
    ctx.strokeStyle = 'rgba(255,77,141,0.6)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();
}

/** A seeker mine: a spiked magenta orb with a pulsing core. */
function drawSeeker(ctx, s, time) {
  ctx.save();
  ctx.translate(s.x, s.y);
  const blink = 0.55 + 0.45 * Math.sin(time * 9 + s.wobble);
  // Spikes.
  ctx.rotate(s.rotation);
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    const r1 = s.radius * 0.85;
    const r2 = s.radius * 1.35;
    ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.lineTo(Math.cos(a + 0.2) * r2, Math.sin(a + 0.2) * r2);
    ctx.lineTo(Math.cos(a + 0.4) * r1, Math.sin(a + 0.4) * r1);
  }
  ctx.fillStyle = '#3a0a2e';
  ctx.fill();
  ctx.strokeStyle = `rgba(255,77,210,${blink.toFixed(2)})`;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.rotate(-s.rotation);
  // Body + pulsing core.
  ctx.beginPath();
  ctx.arc(0, 0, s.radius * 0.8, 0, Math.PI * 2);
  ctx.fillStyle = '#5c1040';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, 4 + blink * 3, 0, Math.PI * 2);
  ctx.fillStyle = '#ff4dd2';
  ctx.shadowColor = '#ff4dd2';
  ctx.shadowBlur = 14;
  ctx.fill();
  ctx.restore();
}

function drawSalvage(ctx, cell, time) {
  const pulse = 1 + 0.18 * Math.sin(cell.pulse);
  // Fade out in the last two seconds of life.
  if (cell.life < 2) {
    ctx.globalAlpha = Math.max(0.15, cell.life / 2);
  }
  ctx.save();
  ctx.translate(cell.x, cell.y);
  // Outer halo ring.
  ctx.beginPath();
  ctx.arc(0, 0, 13 + Math.sin(cell.pulse) * 2, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,179,71,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.rotate(Math.PI / 4);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = AMBER;
  ctx.shadowColor = AMBER;
  ctx.shadowBlur = 14;
  ctx.fillRect(-6, -6, 12, 12);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffe1a8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-6, -6, 12, 12);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawPowerup(ctx, p, time) {
  const colors = { magnet: LIME, shield: CYAN, overdrive: ROSE, repair: '#ff5c5c' };
  const letters = { magnet: 'M', shield: 'S', overdrive: 'O', repair: '+' };
  const color = colors[p.power] || CYAN;
  const pulse = 1 + 0.15 * Math.sin(p.pulse);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(pulse, pulse);
  ctx.beginPath();
  ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
  ctx.fillStyle = '#0e2a3f';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = color;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letters[p.power] || '?', 0, 1);
  ctx.restore();
}

function drawBullets(ctx, bullets) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.shadowColor = CYAN;
  ctx.shadowBlur = 10;
  for (const b of bullets) {
    ctx.strokeStyle = '#bfefff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.022, b.y - b.vy * 0.022);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    // White-hot core.
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRings(ctx, rings) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const r of rings) {
    const frac = Math.max(0, r.life / r.maxLife);
    ctx.globalAlpha = frac * 0.8;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 1 + frac * 3;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles(ctx, particles) {
  ctx.save();
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.restore();
}

function drawFloatTexts(ctx, texts) {
  ctx.save();
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const t of texts) {
    ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.restore();
}

function drawHud(ctx, world) {
  ctx.save();
  ctx.textBaseline = 'top';
  // Score, big at the top left.
  ctx.fillStyle = INK;
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(String(world.score).padStart(6, '0'), 24, 18);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = DIM;
  ctx.fillText(`BEST ${Math.max(world.best, world.score)}`, 24, 54);
  ctx.fillText(`SALVAGE ${world.salvaged}`, 24, 74);
  // Level, top centre.
  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText(`LEVEL ${world.level}`, FIELD.width / 2, 20);
  // Combo meter under the level.
  if (world.combo > 1) {
    const w = 130;
    const frac = world.comboTimer / 4;
    ctx.fillStyle = 'rgba(143,168,200,0.3)';
    ctx.fillRect(FIELD.width / 2 - w / 2, 48, w, 7);
    ctx.fillStyle = LIME;
    ctx.fillRect(FIELD.width / 2 - w / 2, 48, w * frac, 7);
    ctx.fillStyle = LIME;
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(`COMBO x${world.combo.toFixed(2)}`, FIELD.width / 2, 60);
  }
  // Hull hearts, top right.
  hullHearts(ctx, world.ship.hull, SHIP.maxHull, FIELD.width - 24 - 3 * 30, 20);
  ctx.textAlign = 'right';
  ctx.fillStyle = DIM;
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('HULL', FIELD.width - 24, 48);
  // Active power-up timers, bottom left.
  let py = FIELD.height - 28;
  ctx.textAlign = 'left';
  ctx.font = 'bold 14px system-ui, sans-serif';
  if (world.ship.magnetTimer > 0) {
    ctx.fillStyle = LIME;
    ctx.fillText(`MAGNET ${Math.ceil(world.ship.magnetTimer)}s`, 24, py);
    py -= 22;
  }
  if (world.ship.overdriveTimer > 0) {
    ctx.fillStyle = ROSE;
    ctx.fillText(`OVERDRIVE ${Math.ceil(world.ship.overdriveTimer)}s`, 24, py);
    py -= 22;
  }
  if (world.ship.shielded) {
    ctx.fillStyle = CYAN;
    ctx.fillText('SHIELD READY', 24, py);
  }
  // Dash cooldown, bottom right.
  const dashFrac = 1 - world.ship.dashCooldown / 2.4;
  ctx.textAlign = 'right';
  ctx.fillStyle = DIM;
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('DASH [SHIFT]', FIELD.width - 24, FIELD.height - 48);
  ctx.fillStyle = 'rgba(143,168,200,0.3)';
  ctx.fillRect(FIELD.width - 124, FIELD.height - 28, 100, 7);
  ctx.fillStyle = CYAN;
  ctx.fillRect(FIELD.width - 124, FIELD.height - 28, 100 * Math.max(0, dashFrac), 7);
  ctx.restore();
}

function panel(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(7,13,28,0.82)';
  ctx.strokeStyle = 'rgba(57,213,255,0.45)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawBanner(ctx, banner) {
  const frac = Math.max(0, banner.life / banner.maxLife);
  const alpha = frac > 0.8 ? (1 - frac) / 0.2 : Math.min(1, frac / 0.35);
  const scale = 1 + (1 - Math.min(1, (banner.maxLife - banner.life) / 0.25)) * 0.12;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.translate(FIELD.width / 2, 240);
  ctx.scale(scale, scale);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#eaf6ff';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.shadowColor = CYAN;
  ctx.shadowBlur = 26;
  ctx.fillText(banner.text, 0, 0);
  ctx.shadowBlur = 0;
  ctx.fillStyle = AMBER;
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText(banner.sub, 0, 34);
  ctx.restore();
}

function drawTitle(ctx, world) {
  panel(ctx, FIELD.width / 2 - 330, 106, 660, 432);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = CYAN;
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.shadowColor = CYAN;
  ctx.shadowBlur = 24;
  ctx.fillText('LUMEN DRIFT', FIELD.width / 2, 168);
  ctx.shadowBlur = 0;
  ctx.fillStyle = AMBER;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('S A L V A G E   R U N', FIELD.width / 2, 226);
  ctx.fillStyle = INK;
  ctx.font = '16px system-ui, sans-serif';
  const lines = [
    'Pilot your skiff through the drift. Blast asteroids apart,',
    'scoop the salvage they drop, and chain pickups into combos.',
    'One hit costs hull — lose all three and the run is over.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, FIELD.width / 2, 268 + i * 24));
  ctx.fillStyle = DIM;
  ctx.font = '15px system-ui, sans-serif';
  const controls = [
    'MOUSE move & aim   •   CLICK / SPACE fire',
    'SHIFT / RIGHT-CLICK dash   •   P pause   •   M mute',
  ];
  controls.forEach((line, i) => ctx.fillText(line, FIELD.width / 2, 360 + i * 24));
  ctx.fillStyle = '#8fa8c8';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('12 LEVELS  •  5 ROCK TYPES  •  SEEKER MINES  •  ELITE GOLD ROCKS  •  4 POWER-UPS', FIELD.width / 2, 404);
  // Power-up legend: what each canister does, in its own colour.
  const legend = [
    ['M ', LIME], ['MAGNET   ', DIM],
    ['S ', CYAN], ['SHIELD   ', DIM],
    ['O ', ROSE], ['OVERDRIVE   ', DIM],
    ['+ ', '#ff5c5c'], ['REPAIR', DIM],
  ];
  ctx.font = 'bold 13px system-ui, sans-serif';
  let legendW = 0;
  for (const [text] of legend) legendW += ctx.measureText(text).width;
  let lx = FIELD.width / 2 - legendW / 2;
  ctx.textAlign = 'left';
  for (const [text, color] of legend) {
    ctx.fillStyle = color;
    ctx.fillText(text, lx, 430);
    lx += ctx.measureText(text).width;
  }
  ctx.textAlign = 'center';
  // Pulsing launch prompt.
  ctx.globalAlpha = 0.65 + 0.35 * Math.sin(world.time * 4);
  ctx.fillStyle = LIME;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('CLICK OR PRESS ENTER TO LAUNCH', FIELD.width / 2, 462);
  ctx.globalAlpha = 1;
  if (world.best > 0) {
    ctx.fillStyle = DIM;
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(`BEST SCORE ${world.best}`, FIELD.width / 2, 500);
  }
  ctx.restore();
}

function drawPause(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(4,8,18,0.55)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  panel(ctx, FIELD.width / 2 - 220, FIELD.height / 2 - 90, 440, 180);
  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillText('PAUSED', FIELD.width / 2, FIELD.height / 2 - 48);
  ctx.fillStyle = DIM;
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('Press P or Enter to keep flying', FIELD.width / 2, FIELD.height / 2 + 8);
  ctx.restore();
}

function drawGameOver(ctx, world) {
  ctx.save();
  ctx.fillStyle = 'rgba(4,8,18,0.6)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  panel(ctx, FIELD.width / 2 - 300, 130, 600, 400);
  ctx.textAlign = 'center';
  ctx.fillStyle = ROSE;
  ctx.font = 'bold 56px system-ui, sans-serif';
  ctx.shadowColor = ROSE;
  ctx.shadowBlur = 20;
  ctx.fillText('SHIP LOST', FIELD.width / 2, 178);
  ctx.shadowBlur = 0;
  ctx.fillStyle = INK;
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText(`FINAL SCORE ${world.score}`, FIELD.width / 2, 258);
  const isBest = world.score >= world.best && world.score > 0;
  if (isBest) {
    ctx.fillStyle = AMBER;
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText('★ NEW BEST ★', FIELD.width / 2, 296);
  }
  ctx.fillStyle = DIM;
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(`Salvage collected  ${world.salvaged}`, FIELD.width / 2, 336);
  ctx.fillText(`Seekers destroyed  ${world.seekersDowned}`, FIELD.width / 2, 362);
  ctx.fillText(`Shots on target  ${accuracy(world)}%`, FIELD.width / 2, 388);
  ctx.fillText(`Reached level  ${world.level}`, FIELD.width / 2, 414);
  ctx.fillText(`Survived  ${Math.floor(world.elapsed)}s`, FIELD.width / 2, 440);
  ctx.fillStyle = LIME;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('PRESS R OR CLICK TO FLY AGAIN', FIELD.width / 2, 470);
  ctx.restore();
}

/** Draw one frame of `world` onto `ctx` (already sized to FIELD). */
export function drawWorld(ctx, world) {
  const { time } = world;
  ctx.save();
  // Screen shake on hits and explosions.
  if (world.shake > 0.2) {
    const s = world.shake;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
  ctx.fillStyle = '#070b1a';
  ctx.fillRect(-30, -30, FIELD.width + 60, FIELD.height + 60);
  drawNebula(ctx, time);
  drawStars(ctx, world.stars, time);
  for (const cell of world.salvage) drawSalvage(ctx, cell, time);
  for (const p of world.powerups) drawPowerup(ctx, p, time);
  for (const rock of world.asteroids) drawAsteroid(ctx, rock);
  for (const s of world.seekers) drawSeeker(ctx, s, time);
  drawBullets(ctx, world.bullets);
  if (!world.ship.dead) drawShip(ctx, world.ship, time);
  drawParticles(ctx, world.particles);
  drawRings(ctx, world.rings);
  drawFloatTexts(ctx, world.floatTexts);
  drawVignette(ctx);
  ctx.restore();
  // Hit flash over everything.
  if (world.flash > 0) {
    ctx.fillStyle = `rgba(255,77,109,${(world.flash * 0.5).toFixed(3)})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }
  if (world.banner && world.screen === SCREEN_PLAY) drawBanner(ctx, world.banner);
  if (world.screen === SCREEN_PLAY || world.screen === SCREEN_PAUSE) drawHud(ctx, world);
  if (world.screen === SCREEN_TITLE) drawTitle(ctx, world);
  if (world.screen === SCREEN_PAUSE) drawPause(ctx);
  if (world.screen === SCREEN_OVER) drawGameOver(ctx, world);
}
