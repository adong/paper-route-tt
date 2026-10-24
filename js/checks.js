/* The headless check of the rules (node tools/check.js, or game.check() in the page). Each check returns a list of
   problems; [] means it passed. game.prove() / node tools/check.js run each one again with its rule broken on
   purpose (M.sab / W.sab), and each of those runs must fail.
     flight   papers land in a mailbox or on a doormat by their flight: hundreds of throws around a house, each
              compared with the parabola worked out here without the rules (borderline ones are skipped)
     week     a week keeps and loses customers by the rules: delivered houses stay, missed ones stop, a perfect day
              brings one back, EASY keeps a few; NORMAL with no customers left ends the week
     passable every street (each day, EASY and NORMAL) can be ridden to the end of the park with no crash and no
              bump, and nothing static blocks the whole street anywhere
     frames   the same keys give exactly the same ride at 30, 60 and 120 frames a second
     sides    Z (throw left) lands on the left of the screen and X on the right, and → moves the bike right on the
              screen, through the game's real camera (js/view.js) on a wide, a tall and a short screen
     buddy    the companion rides along and delivers to the next 3 houses, then leaves */
(function () {
  'use strict';
  const TU = PR.TUNE, Sim = PR.Sim, Week = PR.Week;
  const NO = { steer: 0, speed: 0, throwL: 0, throwR: 0 };

  function runUntil(M, cond, secs, inp) {
    for (let k = 0; k < secs * 120 && !cond(M); k++) { Sim.step(M, TU.STEP, inp ? inp(M) : NO); M.events.length = 0; }
  }

  // ---------------------------------------------------------------- flight
  // the paper's path worked out on paper: what it should hit. Returns 'mailbox' | 'mat' | 'ground', or null when
  // it passes too close to an edge to call (the rules tick at 120 Hz, this samples much finer).
  function expectFlight(M, h, x0, s0, v, grow) {
    const T = TU.throw, side = h.side, m = Sim.mailAt(h), mb = TU.mailbox;
    const vx = side * T.vx, vs = v * M.D.carry, R = M.D.mailR + grow;
    const mat = Sim.matBox(M, h);
    const dt = 1 / 4000;
    let bx = null; // after a bonk on the house wall: it bounces back a little and drops
    for (let t = 0; t < 2; t += dt) {
      let x = x0 + vx * t, s = s0 + vs * t;
      const y = T.y0 + T.vy * t - (T.g * t * t) / 2;
      if (bx) { x = bx.x - vx * 0.1 * (t - bx.t); s = bx.s + vs * 0.3 * (t - bx.t); }
      else if (y >= mb.lo - grow && y <= mb.hi + grow && Math.hypot(x - m.x, s - m.s) < R) return 'mailbox';
      if (!bx && Math.abs(x) >= TU.house.front && y < TU.house.wall + 1.4) {
        const lot = PR.Street.nearestLot(s);
        const off = Math.abs(TU.lot0 + lot * TU.lotLen - s) - TU.house.half;
        if (Math.abs(off) < Math.abs(grow)) return grow < 0 ? 'edge' : 'edge2'; // too close to the corner to call
        if (off <= 0) bx = { x: side * TU.house.front, s, t };
      }
      if (y < 0) {
        const inMat = x > mat.xa - grow && x < mat.xb + grow && s > mat.sa - grow && s < mat.sb + grow;
        return inMat ? 'mat' : 'ground';
      }
    }
    return 'ground';
  }
  function flight(sab) {
    const fails = [];
    const seen = { mailbox: 0, mat: 0, ground: 0, skipped: 0, nothanks: 0 };
    for (const diff of ['easy', 'normal']) {
      const W = Week.create({ diff, seed: 2 });
      for (const side of [-1, 1]) {
        const h0 = W.street.houses.find((q) => q.side === side && q.i === 5);
        W.customers = [h0.id];
        for (let dx = -4; dx <= 4.01; dx += 0.5) {
          for (let ds = -14; ds <= 2.01; ds += 0.5) {
            const M = Week.ride(W, { sab });
            M.state = 'ride';
            M.obs = []; M.bins = []; M.targets = []; M.bundles = [];
            const h = M.houses[h0.id];
            const b = M.bike;
            b.x = side * dx; b.s = h.s + ds; b.v = M.D.cruise * M.up;
            const x0 = b.x, s0 = b.s + b.v * TU.STEP; // the bike rolls one tick before the paper leaves the hand
            const lo = expectFlight(M, h, x0, s0, b.v, -0.15), hi = expectFlight(M, h, x0, s0, b.v, 0.15);
            if (lo !== hi) { seen.skipped++; continue; }
            const want = lo;
            Sim.step(M, TU.STEP, side < 0 ? { steer: 0, speed: 0, throwL: 1, throwR: 0 } : { steer: 0, speed: 0, throwL: 0, throwR: 1 });
            let got = 'ground';
            for (let k = 0; k < 400 && M.flying.length; k++) {
              for (const e of M.events) if (e.type === 'deliver' && e.h === h.id) got = e.kind;
              M.events.length = 0;
              Sim.step(M, TU.STEP, NO);
            }
            for (const e of M.events) if (e.type === 'deliver' && e.h === h.id) got = e.kind;
            seen[want]++;
            if (got !== want && fails.length < 8) fails.push(`${diff} ${side < 0 ? 'left' : 'right'} house, thrown from x ${x0.toFixed(1)} s ${(ds).toFixed(1)}: the flight says ${want}, the game says ${got}`);
          }
        }
        // a house that didn't order: a paper through its mailbox slot delivers nothing
        const M = Week.ride(W, { sab });
        M.state = 'ride';
        M.obs = []; M.bins = []; M.targets = [];
        const other = M.houses[W.street.houses.find((q) => q.side === side && q.i === 7).id];
        other.customer = false;
        const m = Sim.mailAt(other);
        const b = M.bike;
        b.x = 0; b.v = M.D.cruise * M.up;
        const tm = Math.abs(m.x) / TU.throw.vx;
        b.s = m.s - b.v * M.D.carry * tm - b.v * TU.STEP;
        Sim.step(M, TU.STEP, side < 0 ? { steer: 0, speed: 0, throwL: 1, throwR: 0 } : { steer: 0, speed: 0, throwL: 0, throwR: 1 });
        let res = null;
        for (let k = 0; k < 400 && M.flying.length; k++) {
          for (const e of M.events) if (e.type === 'nothanks' || e.type === 'deliver') res = e.type;
          M.events.length = 0;
          Sim.step(M, TU.STEP, NO);
        }
        for (const e of M.events) if (e.type === 'nothanks' || e.type === 'deliver') res = e.type;
        if (res !== 'nothanks') fails.push(`${diff}: a paper in a non-customer's mailbox gave "${res}" (should be nothanks)`);
        else seen.nothanks++;
      }
    }
    for (const k of ['mailbox', 'mat', 'ground']) if (seen[k] < 6) fails.push(`only ${seen[k]} throws should have hit "${k}": the test grid is too small`);
    flight.seen = seen;
    return fails;
  }

  // ---------------------------------------------------------------- week
  function playDay(W, policy, sab) {
    const M = Week.ride(W, { sab });
    runUntil(M, (q) => q.state === 'end' || q.state === 'over', 200, (q) => PR.Bot.decide(q, policy === 'none' ? { noThrow: true } : policy === 'left' ? { only: -1 } : {}));
    return M;
  }
  function week(sab) {
    const fails = [];
    const seen = { perfect: 0, partial: 0, zero: 0, fresh: 0, nocust: 0 };
    const plan = ['all', 'left', 'all', 'none', 'all', 'left', 'all'];
    for (const diff of ['easy', 'normal']) {
      const D = TU[diff];
      const W = Week.create({ diff, seed: 3, sab });
      for (let d = 0; d < 7 && W.state === 'on'; d++) {
        const before = W.customers.slice();
        const M = playDay(W, plan[d]);
        if (M.state !== 'end') { fails.push(`${diff} ${TU.days[d]}: the autopilot didn't finish (${M.state})`); break; }
        const got = new Set(M.houses.filter((h) => h.got).map((h) => h.id));
        Week.endDay(W, M);
        const next = new Set(W.customers);
        const kept = before.filter((id) => got.has(id)), lost = before.filter((id) => !got.has(id));
        const tag = `${diff} ${TU.days[d]}`;
        for (const id of kept) if (!next.has(id)) fails.push(`${tag}: house ${id} got its paper but stopped ordering`);
        for (const id of lost) if (next.has(id)) fails.push(`${tag}: house ${id} was missed but still orders`);
        for (const id of got) if (!before.includes(id)) fails.push(`${tag}: house ${id} got a delivery without ordering`);
        const extra = W.customers.filter((id) => !kept.includes(id));
        const perfect = lost.length === 0 && before.length > 0;
        const want = Math.max(kept.length + (perfect ? 1 : 0), Math.min(D.minCustomers, TU.lots * 2));
        if (W.customers.length !== want) fails.push(`${tag}: ${W.customers.length} customers after the day, the rules say ${want} (kept ${kept.length}${perfect ? ' + 1 back for a perfect day' : ''}, at least ${D.minCustomers})`);
        for (const id of extra) if (before.includes(id) && !perfect) fails.push(`${tag}: house ${id} came back without a perfect day`);
        if (perfect) seen.perfect++;
        else if (kept.length) seen.partial++;
        else seen.zero++;
        if (extra.length > (perfect ? 1 : 0)) seen.fresh++;
        if (W.customers.length === 0) {
          if (W.state !== 'nocust') fails.push(`${tag}: no customers left but the week goes on`);
          else seen.nocust++;
        }
      }
    }
    for (const k of ['perfect', 'partial', 'zero', 'fresh', 'nocust']) if (!seen[k]) fails.push(`the test week never had a "${k}" day`);
    week.seen = seen;
    return fails;
  }

  // ---------------------------------------------------------------- passable
  function staticGaps(M) {
    const fails = [];
    const need = TU.bike.hw * M.D.hit * 2 + 0.3;
    for (let s = 0; s < M.end; s += 0.25) {
      const blocks = [];
      for (const h of M.bales) if (Math.abs(h.s - s) < h.hl + TU.bike.hl) blocks.push([h.x - h.hw, h.x + h.hw]);
      for (const o of M.obs) {
        if (o.kind === 'sprinkler' && Math.abs(o.s - s) < 1 + TU.bike.hl) blocks.push(o.side < 0 ? [-9, -3.4] : [3.4, 9]);
        if (o.kind === 'car' && Math.abs(o.s - s) < 0.95 + TU.bike.hl) blocks.push(o.side < 0 ? [-9, -0.5] : [0.5, 9]);
      }
      blocks.sort((a, b) => a[0] - b[0]);
      let x = -TU.edge - TU.bike.hw, gap = 0;
      for (const [a, b] of blocks) { gap = Math.max(gap, a - x); x = Math.max(x, b); }
      gap = Math.max(gap, TU.edge + TU.bike.hw - x);
      if (gap < need) { fails.push(`no way through at s ${s.toFixed(1)} (widest gap ${gap.toFixed(2)} m)`); break; }
    }
    return fails;
  }
  function passable(sab, o = {}) {
    const fails = [];
    const rows = [];
    for (const diff of ['easy', 'normal']) {
      for (let d = 0; d < (o.days || 7); d++) {
        for (let seed = 1; seed <= (o.seeds || 12); seed++) {
          const W = Week.create({ diff, seed });
          W.day = d;
          const M = Week.ride(W, { sab });
          for (const f of staticGaps(M)) fails.push(`${diff} ${TU.days[d]} seed ${seed}: ${f}`);
        }
        const W = Week.create({ diff, seed: 1 });
        W.day = d;
        const M = Week.ride(W, { sab });
        runUntil(M, (q) => q.state === 'end' || q.state === 'over', 200, (q) => PR.Bot.decide(q));
        rows.push({ diff, day: d, state: M.state, t: +M.t.toFixed(1), crashes: M.crashes, bumps: M.bumps, delivered: M.delivered });
        if (M.state !== 'end' || M.crashes || M.bumps) fails.push(`${diff} ${TU.days[d]}: the autopilot ${M.state === 'end' ? 'finished' : 'did not finish'} with ${M.crashes} crashes and ${M.bumps} bumps`);
      }
    }
    passable.rows = rows;
    return fails;
  }

  // ---------------------------------------------------------------- frames
  function rideAt(fps, diff, sab) {
    const W = Week.create({ diff, seed: 4 });
    W.day = 2;
    const M = Week.ride(W, { sab });
    const frames = fps * 26;
    for (let f = 0; f < frames; f++) {
      // the keys change only on a 30 fps frame boundary, so every frame rate sees the same presses
      const g = Math.floor((f * 30) / fps), onEdge = (f * 30) % fps === 0;
      const inp = { steer: [0, 1, 0, -1, -1, 0, 1, 0][Math.floor(g / 15) % 8], speed: [0, 1, 0, -1][Math.floor(g / 45) % 4], throwL: 0, throwR: 0 };
      if (onEdge && g > 0 && g % 18 === 0) { if ((g / 18) % 2) inp.throwL = 1; else inp.throwR = 1; }
      if (onEdge && g === 150) Sim.callBuddy(M, 'help');
      Sim.advance(M, 1 / fps, inp);
      M.events.length = 0;
    }
    const b = M.bike;
    return JSON.stringify({
      t: M.t, state: M.state, x: b.x, s: b.s, v: b.v, y: b.y, st: b.st, papers: M.papers, score: M.score, lives: M.lives,
      got: M.houses.map((h) => h.got), obs: M.obs.map((o) => [o.st, o.x, o.s]), flying: M.flying.map((p) => [p.x, p.s]), buddy: M.buddy && [M.buddy.st, M.buddy.left],
    });
  }
  function frames(sab) {
    const fails = [];
    for (const diff of ['easy', 'normal']) {
      const r = [30, 60, 120].map((f) => rideAt(f, diff, sab));
      if (r[0] !== r[1] || r[1] !== r[2]) {
        const a = JSON.parse(r[0]), c = JSON.parse(r[2]);
        fails.push(`${diff}: 30 fps ends at s ${a.s.toFixed(3)} score ${a.score}, 120 fps at s ${c.s.toFixed(3)} score ${c.score}`);
      }
      const a = JSON.parse(r[1]);
      if (a.s < 60 || a.score <= 0) fails.push(`${diff}: the scripted ride didn't get anywhere (s ${a.s.toFixed(1)}, score ${a.score})`);
    }
    return fails;
  }

  // ---------------------------------------------------------------- sides (through the real camera)
  const SCREENS = [[1200, 750], [390, 844], [740, 360]];
  function sides(sab) {
    const fails = [];
    if (typeof THREE === 'undefined' || !PR.View) return ['no THREE / PR.View to project with'];
    for (const diff of ['easy', 'normal']) {
      const W = Week.create({ diff, seed: 1 });
      for (const side of [-1, 1]) {
        const M = Week.ride(W, { sab });
        M.state = 'ride';
        M.obs = []; M.bins = []; M.targets = [];
        const b = M.bike;
        b.x = side * -1; b.s = 40; b.v = M.D.cruise;
        const x0 = b.x, s0 = b.s;
        Sim.step(M, TU.STEP, side < 0 ? { steer: 0, speed: 0, throwL: 1, throwR: 0 } : { steer: 0, speed: 0, throwL: 0, throwR: 1 });
        const p = M.flying[0];
        if (!p) { fails.push(`${diff}: no paper thrown`); continue; }
        let land = null;
        for (let k = 0; k < 400 && !land; k++) { Sim.step(M, TU.STEP, NO); if (p.done) land = { x: p.x, s: p.s }; }
        const name = side < 0 ? 'Z (left)' : 'X (right)';
        if (!land) { fails.push(`${diff} ${name}: the paper never came down`); continue; }
        if ((land.x - x0) * side < 3) fails.push(`${diff} ${name}: thrown from x ${x0}, landed at x ${land.x.toFixed(1)}`);
        for (const [w, h] of SCREENS) {
          const cam = new THREE.PerspectiveCamera();
          const fr = PR.View.fit(cam, w, h, { l: 0, r: w, t: 0, b: h });
          PR.View.follow(cam, fr, s0);
          const a = PR.View.toScreen(cam, fr, x0, 0, s0), c = PR.View.toScreen(cam, fr, land.x, 0, land.s);
          if ((c.x - a.x) * side < 20) fails.push(`${diff} ${name} on a ${w}x${h} screen: the paper lands ${(c.x - a.x).toFixed(0)} px across from the bike`);
          // the houses on that side are on that side of the screen too
          const hs = M.houses.find((q) => q.side === side && q.s > s0);
          const hp = PR.View.toScreen(cam, fr, side * 13, 0, hs.s);
          if ((hp.x - a.x) * side < 20) fails.push(`${diff} ${side < 0 ? 'left' : 'right'} houses on a ${w}x${h} screen are ${(hp.x - a.x).toFixed(0)} px across from the bike`);
        }
      }
      // steering: hold → (and ←) and see where the bike goes on the screen
      for (const st of [1, -1]) {
        const M = Week.ride(W, { sab });
        M.state = 'ride';
        M.obs = [];
        M.bike.s = 40; M.bike.x = 0; M.bike.v = M.D.cruise;
        const [w, h] = SCREENS[0];
        const cam = new THREE.PerspectiveCamera();
        const fr = PR.View.fit(cam, w, h, { l: 0, r: w, t: 0, b: h });
        PR.View.follow(cam, fr, M.bike.s);
        const a = PR.View.toScreen(cam, fr, M.bike.x, 0, M.bike.s);
        for (let k = 0; k < 36; k++) Sim.step(M, TU.STEP, { steer: st, speed: 0, throwL: 0, throwR: 0 });
        PR.View.follow(cam, fr, M.bike.s);
        const c = PR.View.toScreen(cam, fr, M.bike.x, 0, M.bike.s);
        const dx = c.x - a.x, dy = c.y - a.y;
        if (dx * st < 10 || Math.abs(dy) > Math.abs(dx)) fails.push(`${diff}: holding ${st > 0 ? '→' : '←'} moved the bike ${dx.toFixed(0)},${dy.toFixed(0)} px on the screen`);
      }
    }
    return fails;
  }

  // ---------------------------------------------------------------- buddy
  function buddy() {
    const fails = [];
    for (const diff of ['easy', 'normal']) {
      const W = Week.create({ diff, seed: 1 });
      W.customers = W.street.houses.map((h) => h.id); // everybody orders, so "the next 3 houses" are the next 3 yards
      const M = Week.ride(W);
      M.state = 'ride';
      M.obs = []; M.bundles = []; M.bins = [];
      M.bike.s = 30;
      M.papers = 0;
      Sim.callBuddy(M, 'help');
      const byBuddy = [];
      let left = false;
      for (let k = 0; k < 120 * 30 && !left; k++) {
        Sim.step(M, TU.STEP, NO);
        for (const e of M.events) { if (e.type === 'deliver' && e.by === 'b') byBuddy.push(e.h); if (e.type === 'buddyOut') left = true; }
        M.events.length = 0;
      }
      if (byBuddy.length !== 3) fails.push(`${diff}: the companion delivered to ${byBuddy.length} houses (should be 3)`);
      const ahead = M.houses.filter((h) => h.s + TU.mailbox.ds > 30 + 2).sort((a, b) => a.s - b.s || a.side - b.side).slice(0, 3).map((h) => h.id);
      if (byBuddy.slice().sort((a, b) => a - b).join() !== ahead.slice().sort((a, b) => a - b).join()) fails.push(`${diff}: he delivered to ${byBuddy} but the next 3 houses were ${ahead}`);
      if (!left) fails.push(`${diff}: the companion never left`);
      if (M.papers !== 0) fails.push(`${diff}: the companion used the rider's papers`);
    }
    return fails;
  }

  const CHECKS = { flight, week, passable, frames, sides, buddy };
  // each rule broken on purpose, and the check that must catch it
  const BREAKS = [
    ['flight', { noMailbox: true }, 'mailboxes catch nothing'],
    ['flight', { autoDeliver: true }, 'a throw delivers wherever it lands'],
    ['week', { keepMissed: true }, 'missed houses keep ordering'],
    ['week', { dropDelivered: true }, 'a delivered house stops ordering'],
    ['week', { noComeback: true }, 'a perfect day brings nobody back'],
    ['passable', { wall: true }, 'hay bales right across the street'],
    ['frames', { perFrameDrag: true }, 'a slow-down applied once per frame'],
    ['sides', { swapThrow: true }, 'Z throws right and X left'],
    ['sides', { mirror: true }, '← and → swapped'],
  ];

  PR.Checks = {
    CHECKS,
    all(o = {}) {
      const res = {};
      for (const [k, f] of Object.entries(CHECKS)) {
        if (o.only && !o.only.includes(k)) continue;
        const t0 = Date.now();
        res[k] = f(undefined, o);
        res[k].ms = Date.now() - t0;
      }
      return { ok: Object.values(res).every((r) => r.length === 0), res, seen: { flight: flight.seen, week: week.seen }, rows: passable.rows };
    },
    prove() {
      const rows = BREAKS.map(([k, sab, want]) => {
        const probs = k === 'passable' ? CHECKS[k](sab, { seeds: 1, days: 1 }) : CHECKS[k](sab);
        return { check: k, flag: Object.keys(sab)[0], want, caught: probs.length > 0, why: probs[0] || '' };
      });
      return { ok: rows.every((r) => r.caught), rows };
    },
  };
})();
