/* The play check with real keys: game.playCheck() in the page. Everything goes in the way a child's hands do:
   keydown / keyup events on window, and pointer events on the touch pad and the paper buttons. Time runs through
   game.step (the same frame code as the real loop); nothing calls the rules to move the bike.
     direction  on every day (Monday to Sunday) and in the bonus park, EASY and NORMAL, 1 player as Teddy and as
                Tommy, and both turns of 2 players: → and D move the bike right on the screen, ← and A left
                (measured where it is drawn, through the camera); ↑ / W go faster, ↓ / S slower
     throws     Z and , land on the left of the screen, X and . on the right
     touch      the pad steers the way the finger points (up faster, down slower); the paper buttons throw that way
     stuck      after a tumble (each kind of obstacle), after pausing with a key held, after the window loses focus,
                pinned against the curb, in the air off a ramp, while the companion rides along, after a day ends,
                and after a "keyboard kid" mashes keys on several days: → and ← still move him and he still rides on
   game.playCheck({ inputMirror: true }) swaps left and right in the input and { stuckTumble: true } never lets him get up
   after a tumble: both must fail (game.playCheck.prove() runs them). */
(function () {
  'use strict';
  const kd = (code, repeat) => dispatchEvent(new KeyboardEvent('keydown', { code, key: code, repeat: !!repeat, bubbles: true, cancelable: true }));
  const ku = (code) => dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true, cancelable: true }));
  const tap = (code) => { kd(code); ku(code); };
  const step = (s) => window.game.step(s, { draw: false });
  const g = () => window.game;

  function begin(o, sab) {
    g().hold(true);
    g().autoPause(false);
    g().start(Object.assign({ skipReady: true }, o));
    const M = g().M;
    PR.Input.mirror = !!(sab && sab.inputMirror); // the keys themselves swapped (the rules are left alone)
    if (sab) Object.assign(M.sab, sab);
    return M;
  }
  // nothing in the way, so a direction test measures only the keys
  function calm(M) { M.obs.length = 0; M.bales.length = 0; M.ramps.length = 0; }
  const scr = (M) => g().toScreen(M.bike.x, M.bike.s);
  function press(M, code, secs) {
    step(1 / 60); // after moving the bike for a test, let the camera catch up before measuring
    const a = scr(M);
    kd(code);
    step(secs);
    ku(code);
    step(0.05);
    const b = scr(M);
    return { dx: b.x - a.x, dy: b.y - a.y };
  }
  const rightOk = (m) => m.dx > 6 && Math.abs(m.dy) < Math.abs(m.dx);
  const leftOk = (m) => m.dx < -6 && Math.abs(m.dy) < Math.abs(m.dx);
  function steers(M, fails, tag) {
    for (const [code, want] of [['ArrowRight', 1], ['ArrowLeft', -1], ['KeyD', 1], ['KeyA', -1]]) {
      M.bike.x = 0;
      const m = press(M, code, 0.3);
      if (!(want > 0 ? rightOk(m) : leftOk(m))) fails.push(`${tag} ${code}: moved ${m.dx.toFixed(0)},${m.dy.toFixed(0)} px (should go ${want > 0 ? 'right' : 'left'})`);
    }
  }
  function speeds(M, fails, tag) {
    for (const [code, want] of [['ArrowUp', 1], ['ArrowDown', -1], ['KeyW', 1], ['KeyS', -1]]) {
      M.bike.v = M.D.cruise * M.up;
      const v0 = M.bike.v;
      kd(code);
      step(0.4);
      const v1 = M.bike.v;
      ku(code);
      step(0.05);
      if ((v1 - v0) * want < 0.5) fails.push(`${tag} ${code}: speed went ${v0.toFixed(1)} -> ${v1.toFixed(1)}`);
    }
  }

  function direction(sab) {
    const fails = [];
    let n = 0;
    const runs = [
      { diff: 'easy', hero: 'teddy' }, { diff: 'normal', hero: 'teddy' }, { diff: 'easy', hero: 'tommy' }, { diff: 'normal', hero: 'tommy' },
      { two: true, diffs: { teddy: 'normal', tommy: 'easy' } },
    ];
    for (const r of runs) {
      for (let day = 0; day < 7; day++) {
        for (const turn of r.two ? [0, 1] : [0]) {
          const M = begin(Object.assign({ day }, r), sab);
          if (turn) g().nextFromDay(); // the other brother's turn on the same day
          const MM = g().M;
          if (sab) Object.assign(MM.sab, sab);
          MM.state = 'ride';
          MM.bike.v = MM.D.cruise * MM.up;
          calm(MM);
          for (const where of ['street', 'park']) {
            MM.bike.s = where === 'street' ? 40 + day * 6 : MM.street.parkS + 3;
            MM.bike.st = 'ok';
            const tag = `${r.two ? '2P ' + MM.hero : '1P ' + r.hero} ${MM.diff} ${PR.TUNE.days[day]} ${where}`;
            steers(MM, fails, tag);
            if (where === 'street') speeds(MM, fails, tag);
            n += where === 'street' ? 8 : 4;
          }
          void M;
        }
      }
    }
    return { name: 'direction', tried: n, fails };
  }

  // a paper thrown with a real key: where does it come down on the screen, compared with the bike?
  function throwWith(M, act) {
    const s0 = M.bike.s, x0 = M.bike.x;
    const before = M.flying.length;
    act();
    step(1 / 60);
    const p = M.flying[M.flying.length - 1];
    if (!p || M.flying.length === before) return null;
    for (let k = 0; k < 120 && !p.done; k++) step(1 / 60);
    const a = g().toScreenAt(x0, s0, s0), b = g().toScreenAt(p.x, p.s, s0);
    return { dx: b.x - a.x, side: p.side };
  }
  function throws(sab) {
    const fails = [];
    for (const diff of ['easy', 'normal']) {
      const M = begin({ diff, day: 1 }, sab);
      calm(M);
      M.bins.length = 0;
      M.papers = 20;
      for (const [code, want] of [['KeyZ', -1], ['KeyX', 1], ['Comma', -1], ['Period', 1]]) {
        M.bike.x = 0;
        M.bike.s = 50;
        const r = throwWith(M, () => tap(code));
        if (!r) { fails.push(`${diff} ${code}: no paper thrown`); continue; }
        if (r.dx * want < 40) fails.push(`${diff} ${code}: the paper came down ${r.dx.toFixed(0)} px across from the bike (should be ${want < 0 ? 'left' : 'right'})`);
      }
    }
    return { name: 'throws', fails };
  }

  function touch(sab) {
    const fails = [];
    g().setTouch(true);
    for (const diff of ['easy', 'normal']) {
      const M = begin({ diff, day: 3 }, sab);
      calm(M);
      M.papers = 20;
      M.bike.s = 45;
      const pad = document.getElementById('pad');
      const r = pad.getBoundingClientRect();
      if (r.width < 20) { fails.push('the pad is not on the screen'); continue; }
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2;
      const hold = (dx, dy, secs) => {
        pad.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, pointerType: 'touch', clientX: cx + dx * R * 0.7, clientY: cy + dy * R * 0.7, bubbles: true }));
        step(secs);
        pad.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, pointerType: 'touch', clientX: cx + dx * R * 0.7, clientY: cy + dy * R * 0.7, bubbles: true }));
        step(0.05);
      };
      for (const [dx, want] of [[1, 1], [-1, -1]]) {
        M.bike.x = 0;
        step(1 / 60);
        const a = scr(M);
        hold(dx, 0, 0.3);
        const b = scr(M);
        const m = { dx: b.x - a.x, dy: b.y - a.y };
        if (!(want > 0 ? rightOk(m) : leftOk(m))) fails.push(`${diff} pad ${want > 0 ? 'right' : 'left'}: moved ${m.dx.toFixed(0)},${m.dy.toFixed(0)} px`);
      }
      for (const [dy, want] of [[-1, 1], [1, -1]]) {
        M.bike.v = M.D.cruise * M.up;
        const v0 = M.bike.v;
        pad.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 8, pointerType: 'touch', clientX: cx, clientY: cy + dy * R * 0.7, bubbles: true }));
        step(0.4);
        const v1 = M.bike.v;
        pad.dispatchEvent(new PointerEvent('pointerup', { pointerId: 8, pointerType: 'touch', clientX: cx, clientY: cy + dy * R * 0.7, bubbles: true }));
        step(0.05);
        if ((v1 - v0) * want < 0.5) fails.push(`${diff} pad ${want > 0 ? 'up' : 'down'}: speed ${v0.toFixed(1)} -> ${v1.toFixed(1)}`);
      }
      for (const [id, want] of [['thL', -1], ['thR', 1]]) {
        const btn = document.getElementById(id);
        const br = btn.getBoundingClientRect();
        if (br.width < 20) { fails.push(`${id} is not on the screen`); continue; }
        M.bike.x = 0;
        const res = throwWith(M, () => {
          btn.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, pointerType: 'touch', clientX: br.left + br.width / 2, clientY: br.top + br.height / 2, bubbles: true }));
          btn.dispatchEvent(new PointerEvent('pointerup', { pointerId: 9, pointerType: 'touch', clientX: br.left + br.width / 2, clientY: br.top + br.height / 2, bubbles: true }));
        });
        if (!res) { fails.push(`${diff} ${id}: no paper thrown`); continue; }
        if (res.dx * want < 40) fails.push(`${diff} ${id}: the paper came down ${res.dx.toFixed(0)} px across (should be ${want < 0 ? 'left' : 'right'})`);
      }
    }
    g().setTouch(false);
    return { name: 'touch', fails };
  }

  // can he still ride? → and ← move him, and he keeps going up the street
  function free(M, fails, tag) {
    for (let k = 0; k < 40 && M.bike.st !== 'ok'; k++) step(0.1);
    if (M.bike.st !== 'ok') { fails.push(`${tag}: still ${M.bike.st} after 4 s`); return; }
    M.bike.x = 0;
    const s0 = M.bike.s;
    const r = press(M, 'ArrowRight', 0.3);
    M.bike.x = 0;
    const l = press(M, 'ArrowLeft', 0.3);
    if (!rightOk(r) || !leftOk(l)) fails.push(`${tag}: → moved ${r.dx.toFixed(0)} px, ← moved ${l.dx.toFixed(0)} px`);
    if (M.bike.s - s0 < 0.5 && M.state === 'ride') fails.push(`${tag}: not riding on (moved ${(M.bike.s - s0).toFixed(2)} m)`);
  }
  function stuck(sab) {
    const fails = [];
    // a tumble on each kind of obstacle
    for (const kind of ['sprinkler', 'skate', 'mower', 'puppy', 'car']) {
      const M = begin({ diff: 'normal', day: 6 }, sab);
      M.bales.length = 0;
      M.bike.s = 60; M.bike.x = 4.5;
      const o = { kind, i: M.obs.length, st: 'idle', t: 0, side: 1, s: 60.3, x: 4.5, ph: 0, dir: -1, s0: 60, span: 6, hx: 8.4, hs: 60.3 };
      if (kind === 'skate' || kind === 'puppy' || kind === 'mower') o.st = kind === 'skate' ? 'roll' : kind === 'puppy' ? 'run' : 'mow';
      if (kind === 'car') { o.st = 'wait'; o.x = 3.6; }
      M.obs = [o];
      step(0.2);
      if (M.bike.st !== 'tumble') { fails.push(`the ${kind} test didn't tumble him (setup)`); continue; }
      free(M, fails, `after a tumble on a ${kind}`);
    }
    // pause with → held, let go while paused, carry on: he must not keep steering on his own
    {
      const M = begin({ diff: 'easy', day: 2 }, sab);
      calm(M);
      M.bike.x = 0;
      kd('ArrowRight');
      step(0.1);
      tap('KeyP');
      step(0.2);
      ku('ArrowRight');
      tap('KeyP');
      step(0.05);
      const a = scr(M);
      step(0.4);
      const b = scr(M);
      if (Math.abs(b.x - a.x) > 4) fails.push(`after pausing with → held, the bike still drifts ${(b.x - a.x).toFixed(0)} px`);
      if (g().screen() !== 'play') fails.push(`P twice left the game on "${g().screen()}"`);
      free(M, fails, 'after a pause with a key held');
    }
    // the window loses focus with ← held
    {
      const M = begin({ diff: 'easy', day: 2 }, sab);
      calm(M);
      M.bike.x = 0;
      kd('ArrowLeft');
      step(0.1);
      dispatchEvent(new Event('blur'));
      const a = scr(M);
      step(0.4);
      const b = scr(M);
      ku('ArrowLeft');
      if (Math.abs(b.x - a.x) > 4) fails.push(`after the window lost focus with ← held, the bike still drifts ${(b.x - a.x).toFixed(0)} px`);
      free(M, fails, 'after the window lost focus');
    }
    // pinned against the curb
    {
      const M = begin({ diff: 'normal', day: 2 }, sab);
      calm(M);
      kd('ArrowRight');
      step(2);
      ku('ArrowRight');
      const at = M.bike.x;
      const l = press(M, 'ArrowLeft', 0.3);
      if (!leftOk(l)) fails.push(`pinned on the right curb (x ${at.toFixed(2)}), ← moved ${l.dx.toFixed(0)} px`);
      kd('ArrowLeft');
      step(2);
      ku('ArrowLeft');
      const r = press(M, 'ArrowRight', 0.3);
      if (!rightOk(r)) fails.push(`pinned on the left curb, → moved ${r.dx.toFixed(0)} px`);
    }
    // in the air off a ramp
    {
      const M = begin({ diff: 'easy', day: 0 }, sab);
      M.obs.length = 0;
      M.bales.length = 0;
      const rp = M.ramps[0];
      M.bike.s = rp.s - 1; M.bike.x = rp.x;
      let flew = false;
      for (let k = 0; k < 120 && !(flew && !M.bike.air); k++) { step(1 / 60); if (M.bike.air) flew = true; }
      if (!flew) fails.push('riding over a ramp never jumped (setup)');
      free(M, fails, 'after a jump off a ramp');
    }
    // while the companion rides along (and after he leaves)
    {
      const M = begin({ diff: 'easy', day: 1 }, sab);
      calm(M);
      tap('KeyT');
      step(0.2);
      if (!M.buddy) fails.push('T did not call the companion');
      free(M, fails, 'while the companion visits');
      for (let k = 0; k < 300 && M.buddy; k++) step(0.1);
      free(M, fails, 'after the companion left');
    }
    // the end of a day: the newspaper, Enter, and the next day rides
    {
      const M = begin({ diff: 'easy', day: 0 }, sab);
      calm(M);
      g().finishRide();
      for (let k = 0; k < 60 && g().screen() === 'play'; k++) step(0.1);
      if (g().screen() !== 'day') fails.push(`after the end of the ride the screen is "${g().screen()}"`);
      tap('Enter');
      step(0.1);
      if (g().screen() !== 'play' || g().M.day !== 1) fails.push(`Enter on the newspaper went to "${g().screen()}" day ${g().M && g().M.day}`);
      else {
        const M2 = g().M;
        if (sab) Object.assign(M2.sab, sab);
        M2.state = 'ride';
        calm(M2);
        free(M2, fails, 'on the next day');
      }
    }
    // the keyboard kid: random keys for a while on several days, then he must still ride
    const KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyZ', 'KeyX', 'Comma', 'Period', 'KeyT', 'Space', 'Enter'];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const [diff, day] of [['easy', 0], ['normal', 3], ['easy', 5], ['normal', 6]]) {
      const M = begin({ diff, day }, sab);
      const held = new Set();
      for (let k = 0; k < 120; k++) {
        const code = KEYS[Math.floor(rnd() * KEYS.length)];
        if (held.has(code)) { ku(code); held.delete(code); } else { kd(code); held.add(code); }
        step(0.1);
        if (g().screen() !== 'play') break;
      }
      for (const c of held) ku(c);
      if (g().screen() !== 'play') { if (!['day', 'results'].includes(g().screen())) fails.push(`keyboard kid on ${diff} ${PR.TUNE.days[day]} ended on "${g().screen()}"`); continue; }
      if (M.state !== 'ride') continue;
      M.lives = 9;
      calm(M);
      free(M, fails, `after the keyboard kid on ${diff} ${PR.TUNE.days[day]}`);
    }
    return { name: 'stuck', fails };
  }

  function playCheck(sab) {
    const t0 = performance.now();
    const res = [direction(sab), throws(sab), touch(sab), stuck(sab)];
    PR.Input.mirror = false;
    PR.Input.clear();
    g().menu();
    return { ok: res.every((r) => r.fails.length === 0), ms: Math.round(performance.now() - t0), res: res.map((r) => ({ name: r.name, tried: r.tried, fails: r.fails.slice(0, 12), n: r.fails.length })) };
  }
  playCheck.prove = function () {
    const rows = [
      ['inputMirror', { inputMirror: true }, '← and → swapped in the input'],
      ['stuckTumble', { stuckTumble: true }, 'he never gets up after a tumble'],
    ].map(([flag, sab, want]) => {
      const r = playCheck(sab);
      return { flag, want, caught: !r.ok, failed: r.res.filter((q) => q.n).map((q) => `${q.name} (${q.n})`).join(', '), first: (r.res.find((q) => q.n) || { fails: [''] }).fails[0] };
    });
    return { ok: rows.every((r) => r.caught), rows };
  };
  window.game.playCheck = playCheck;
})();
