/* What the rider wants this frame, from real keydown/keyup events (js/game.js passes them in) and the touch controls:
   { steer: -1 | 0 | 1, speed: -1 | 0 | 1, throwL: presses, throwR: presses }.
   - ← → (or A D) steer, ↑ ↓ (or W S) faster and slower; the key you pressed last wins while you hold two.
   - Z or , throws left, X or . throws right. Each press is one paper; presses wait until the rules have used them.
   - A tap shorter than a frame still steers for a moment (latched).
   - Two players take turns, so both sets of keys work for whoever is riding.
   - Leaving the window (blur) lets go of everything, so no key can get stuck down. */
(function () {
  'use strict';
  const STEER = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 };
  const SPEED = { ArrowUp: 1, KeyW: 1, ArrowDown: -1, KeyS: -1 };
  const THROW = { KeyZ: -1, Comma: -1, KeyX: 1, Period: 1 };
  const LATCH = 0.12;
  const I = {
    mirror: false, // only for the play check's "must fail" run: swaps left and right
    steerKeys: [], speedKeys: [], latch: { steer: 0, t: 0 }, throws: { L: 0, R: 0 },
    pad: { steer: 0, speed: 0 },
    isGameKey: (code) => code in STEER || code in SPEED || code in THROW,
    down(code, repeat) {
      if (code in STEER) {
        const at = this.steerKeys.indexOf(code);
        if (at >= 0) this.steerKeys.splice(at, 1);
        this.steerKeys.push(code);
        this.latch = { steer: STEER[code], t: LATCH };
        return true;
      }
      if (code in SPEED) {
        const at = this.speedKeys.indexOf(code);
        if (at >= 0) this.speedKeys.splice(at, 1);
        this.speedKeys.push(code);
        return true;
      }
      if (code in THROW) {
        if (!repeat) this.press(THROW[code]);
        return true;
      }
      return false;
    },
    up(code) {
      for (const list of [this.steerKeys, this.speedKeys]) { const at = list.indexOf(code); if (at >= 0) list.splice(at, 1); }
      return this.isGameKey(code);
    },
    press(side) { if (side < 0) this.throws.L = Math.min(2, this.throws.L + 1); else this.throws.R = Math.min(2, this.throws.R + 1); },
    clear() {
      this.steerKeys = [];
      this.speedKeys = [];
      this.latch = { steer: 0, t: 0 };
      this.throws = { L: 0, R: 0 };
      this.pad = { steer: 0, speed: 0 };
    },
    read(dt) {
      let steer = 0, speed = 0;
      if (this.steerKeys.length) steer = STEER[this.steerKeys[this.steerKeys.length - 1]];
      else if (this.pad.steer) steer = this.pad.steer;
      else if (this.latch.t > 0) steer = this.latch.steer;
      this.latch.t = Math.max(0, this.latch.t - dt);
      if (this.speedKeys.length) speed = SPEED[this.speedKeys[this.speedKeys.length - 1]];
      else speed = this.pad.speed;
      if (this.mirror) steer = -steer;
      return { steer, speed, throwL: this.throws.L, throwR: this.throws.R };
    },
    // the rules ran at least one tick with this frame's input: the presses are used up
    used() { this.throws.L = this.throws.R = 0; },
  };
  PR.Input = I;
})();
