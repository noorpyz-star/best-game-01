// LUMEN DRIFT — keyboard and mouse state. The game reads this one object every
// frame; nothing else touches the DOM events. Mouse aims the ship, click or Space
// fires, Shift or right-click dashes, P or Escape pauses, R restarts, M mutes.

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    mouseX: 640,
    mouseY: 360,
    mouseDown: false,
    // Edge-triggered presses, consumed once per frame by the world.
    pressed: new Set(),
  };

  const KEYMAP = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowUp: 'up',
    ArrowDown: 'down',
    KeyA: 'left',
    KeyD: 'right',
    KeyW: 'up',
    KeyS: 'down',
    Space: 'fire',
    ShiftLeft: 'dash',
    ShiftRight: 'dash',
    KeyP: 'pause',
    Escape: 'pause',
    KeyR: 'restart',
    KeyM: 'mute',
    Enter: 'start',
  };

  function onKeyDown(event) {
    const action = KEYMAP[event.code];
    if (!action) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) input.pressed.add(action);
    input.keys.add(action);
  }

  function onKeyUp(event) {
    const action = KEYMAP[event.code];
    if (action) input.keys.delete(action);
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = event.clientX - rect.left;
    input.mouseY = event.clientY - rect.top;
  }

  function onMouseDown(event) {
    if (event.button === 0) {
      input.mouseDown = true;
      input.pressed.add('fire');
    }
    if (event.button === 2) input.pressed.add('dash');
  }

  function onMouseUp(event) {
    if (event.button === 0) input.mouseDown = false;
  }

  function onContextMenu(event) {
    event.preventDefault();
  }

  function onBlur() {
    input.keys.clear();
    input.mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('blur', onBlur);

  input.consumePressed = function consumePressed(action) {
    if (input.pressed.has(action)) {
      input.pressed.delete(action);
      return true;
    }
    return false;
  };

  input.endFrame = function endFrame() {
    input.pressed.clear();
  };

  input.isDown = function isDown(action) {
    return input.keys.has(action);
  };

  return input;
}
