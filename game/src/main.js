// LUMEN DRIFT — bootstrap. Sizes the canvas, wires input and audio, runs the
// frame loop, and stages a screenshot scene when the page opens with ?shot=.

import { FIELD } from './config.js';
import { createInput } from './input.js';
import { drawWorld } from './render.js';
import { unlockAudio } from './audio.js';
import { SCREEN_PLAY, createWorld, pressAction, stepWorld } from './world.js';
import { shotName, shotSeed, stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function fitCanvas() {
  const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
  canvas.width = FIELD.width;
  canvas.height = FIELD.height;
  canvas.style.width = `${Math.floor(FIELD.width * scale)}px`;
  canvas.style.height = `${Math.floor(FIELD.height * scale)}px`;
}

fitCanvas();
window.addEventListener('resize', fitCanvas);

const params = new URLSearchParams(window.location.search);
const input = createInput(canvas);
const world = createWorld(shotSeed(params));
let last = performance.now();
let shotScreen = null;

if (params.has('shot')) {
  shotScreen = stageShot(shotName(params), world);
  drawWorld(ctx, world);
} else {
  const status = document.getElementById('status');
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    unlockAudio();
    pressAction(world, input);
    stepWorld(world, input, dt);
    drawWorld(ctx, world);
    if (status) {
      const line =
        world.screen === SCREEN_PLAY
          ? `Score ${world.score}, hull ${world.ship.hull}, level ${world.level}`
          : world.screen;
      if (status.textContent !== line) status.textContent = line;
    }
    input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// Exposed for the screenshot driver and for debugging in the console.
window.__lumen = { world, screen: () => (shotScreen === null ? world.screen : shotScreen) };
