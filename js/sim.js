/* The rules: one rider's ride down the street for one day, and the week around it. No drawing here: js/game.js
   reads the state and turns the events into pictures and sounds, and js/checks.js tests the rules headless.
   - The rules tick at 120 Hz (TUNE.STEP). PR.Sim.advance(M, frameSeconds, input) runs whole ticks for a frame, so
     30, 60 and 120 frames a second give exactly the same ride for the same keys.
   - Papers fly: thrown sideways from the bike, they keep some of its speed and fall. Where they go decides what they
     do: through a mailbox's slot, onto a doormat, against a can, a target, a puppy, or just onto the lawn.
   - A week: Monday to Sunday. Houses you deliver to stay customers, missed ones stop ordering, a perfect day brings
     one house back (PR.Week.endDay).
   Input each frame: { steer: -1 | 0 | 1, speed: -1 | 0 | 1, throwL: presses, throwR: presses }. */
(function () {
  'use strict';
  const TU = PR.TUNE;
  const STEP = TU.STEP;
  const TICK_US = 8333; // one tick in microseconds (1/120 s, rounded): frames add up whole microseconds
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function create(o) {
    const D = TU[o.diff];
    const street = o.street;
    const L = PR.Street.day(street, o.day, o.diff, o.seed);
    const cust = new Set(o.customers || []);
    const up = 1 + (D.dayUp || 0) * o.day;
    const M = {
      diff: o.diff, D, day: o.day, street, seed: o.seed, hero: o.hero || 'teddy', demo: !!o.demo, up,
      sab: Object.assign({}, o.sab || {}),
      t: 0, accUs: 0, state: 'ready', stateT: 0, inPark: false, end: street.end,
      bike: { x: 0, s: 2, y: 0, vy: 0, v: 0, st: 'ok', t: 0, inv: 0, cd: 0, q: [], air: false, lean: 0, ramp: null, bump: 0, throwT: 9, throwSide: 0 },
      lives: o.lives != null ? o.lives : D.lives,
      papers: o.papers != null ? o.papers : D.papers,
      score: o.score || 0, startScore: o.score || 0,
      houses: street.houses.map((h) => ({ id: h.id, side: h.side, s: h.s, customer: cust.has(h.id), got: null, passed: false, missed: false, tgt: false })),
      obs: L.obs, bundles: L.bundles, bins: L.bins, ramps: L.ramps, targets: L.targets, bales: L.bales,
      flying: [], buddy: null, events: [], crashes: 0, bumps: 0, delivered: 0, thrown: 0,
    };
    // the broken street for the check: hay bales right across the road
    if (M.sab.wall) for (let x = -5.25; x <= 5.3; x += 1.5) M.bales.push({ s: 60, x, hw: 0.75, hl: 0.5 });
    return M;
  }

  const ev = (M, type, o) => { if (!M.lite) M.events.push(Object.assign({ type }, o)); };
  const speedTarget = (M, sp) => (sp > 0 ? M.D.max : sp < 0 ? M.D.min : M.D.cruise) * M.up;

  // ---------------------------------------------------------------- the bike
  function moveBike(M, dt, inp) {
    const b = M.bike, D = M.D;
    if (b.st === 'tumble') {
      b.t += dt;
      if (M.sab.stuckTumble) b.t = Math.min(b.t, 0.5); // the broken rule for the play check: he never gets up
      b.v = 0;
      b.lean = 0;
      if (b.t >= TU.tumbleT) {
        if (M.lives <= 0) { if (M.state === 'ride') { M.state = 'over'; M.stateT = 0; ev(M, 'over'); } return; }
        b.st = 'ok';
        b.inv = TU.safeT;
        b.v = D.min * M.up;
        ev(M, 'back');
      }
      return;
    }
    const target = speedTarget(M, inp.speed);
    if (b.bump > 0) b.bump -= dt;
    if (b.v < target) b.v = Math.min(target, b.v + TU.bike.accel * dt);
    else b.v = Math.max(target, b.v - TU.bike.brake * dt);
    const steer = M.sab.mirror ? -inp.steer : inp.steer;
    b.x = clamp(b.x + steer * D.steer * dt, -TU.edge, TU.edge);
    b.lean += (steer - b.lean) * Math.min(1, dt * 10);
    b.s += b.v * dt;
    // ramps in the bonus park: up the wedge, off the lip, into the air
    if (!b.air) {
      let on = null;
      for (const r of M.ramps) if (Math.abs(b.x - r.x) < r.w / 2 && b.s >= r.s && b.s < r.s + r.len) on = r;
      if (on) { b.y = ((b.s - on.s) / on.len) * 0.6; b.ramp = on; }
      else if (b.ramp) {
        const r = b.ramp;
        b.ramp = null;
        if (b.s >= r.s + r.len) {
          b.air = true;
          b.y = 0.6;
          b.vy = 4.2 + b.v * 0.15;
          if (!r.used) { r.used = true; M.score += TU.points.ramp; ev(M, 'jump', { pts: TU.points.ramp }); }
        } else b.y = 0;
      } else b.y = 0;
    } else {
      b.y += b.vy * dt;
      b.vy -= TU.throw.g * dt;
      if (b.y <= 0) { b.y = 0; b.vy = 0; b.air = false; ev(M, 'land'); }
    }
    b.inv = Math.max(0, b.inv - dt);
  }

  // ---------------------------------------------------------------- obstacles
  function sprayOn(M, o) {
    const per = M.D.sprayOn + M.D.sprayOff;
    return ((M.t + o.ph) % per) < M.D.sprayOn;
  }
  function moveObstacles(M, dt) {
    const b = M.bike, D = M.D, up = M.up;
    for (const o of M.obs) {
      o.t += dt;
      switch (o.kind) {
        case 'sprinkler': o.on = sprayOn(M, o); break;
        case 'skate': {
          const v = D.skate * up;
          if (o.st === 'idle' && b.s > o.s - (D.cruise * 6.6) / D.skate) { o.st = 'roll'; ev(M, 'skate', { o: o.i }); }
          if (o.st === 'roll') { o.x += o.dir * v * dt; if (Math.abs(o.x) > 7.4) o.st = 'gone'; }
          if (o.st === 'away') { o.x += o.dir * 6 * dt; if (Math.abs(o.x) > 14) o.st = 'gone'; }
          break;
        }
        case 'mower': {
          if (o.st === 'away') break;
          if (o.st === 'idle') o.st = 'mow';
          const v = D.mower * up;
          o.u = (o.u || 0) + v * dt;
          const k = o.u % (o.span * 2);
          o.s = o.s0 + (k < o.span ? k : o.span * 2 - k);
          o.dir = k < o.span ? 1 : -1;
          break;
        }
        case 'puppy': {
          const v = D.puppy * up;
          if (o.st === 'idle' && b.s > o.hs - 12 && b.s < o.hs + 1) { o.st = 'run'; o.t = 0; ev(M, 'woof', { o: o.i }); }
          if (o.st === 'run') {
            const dx = b.x - o.x, ds = b.s + 0.4 - o.s, d = Math.hypot(dx, ds) || 1;
            o.x += (dx / d) * v * dt;
            o.s += (ds / d) * v * dt;
            o.x = clamp(o.x, -8.6, 8.6);
            o.face = Math.atan2(dx, ds);
            if (o.t > D.chase || b.s > o.s + 4) o.st = 'back';
          }
          if (o.st === 'back' || o.st === 'happy') {
            const dx = o.hx - o.x, ds = o.hs - o.s, d = Math.hypot(dx, ds);
            if (d < 0.1) { o.st = o.st === 'happy' ? 'done' : 'sit'; o.x = o.hx; o.s = o.hs; }
            else { const st = Math.min(d, v * 1.2 * dt); o.x += (dx / d) * st; o.s += (ds / d) * st; o.face = Math.atan2(dx, ds); }
          }
          break;
        }
        case 'car': {
          const v = D.car * up, out = o.side * 2.3;
          if (o.st === 'idle' && b.s > o.s - (D.cruise * 6.9) / D.car - 8) { o.st = 'out'; ev(M, 'beep', { o: o.i }); }
          if (o.st === 'out') { o.x += Math.sign(out - o.x) * v * dt; if ((o.x - out) * o.side <= 0) { o.x = out; o.st = 'wait'; o.t = 0; ev(M, 'honk', { o: o.i }); } }
          if (o.st === 'wait' && o.t > 1.5) o.st = 'in';
          if (o.st === 'in') { o.x += Math.sign(o.hx - o.x) * v * 1.3 * dt; if ((o.hx - o.x) * o.side <= 0) { o.x = o.hx; o.st = 'done'; } }
          break;
        }
      }
    }
  }
  // the box an obstacle blocks right now (centre x, s and half sizes), or null
  function obsBox(M, o) {
    switch (o.kind) {
      case 'sprinkler': return o.on ? { x: o.side * 5.45, s: o.s, hx: 2.05, hs: 1.0 } : null;
      case 'skate': return o.st === 'roll' ? { x: o.x, s: o.s, hx: 0.45, hs: 0.22 } : null;
      case 'mower': return o.st === 'mow' ? { x: o.x, s: o.s, hx: 0.5, hs: 0.45 } : null;
      case 'puppy': return o.st === 'run' ? { x: o.x, s: o.s, hx: 0.42, hs: 0.42 } : null;
      case 'car': return o.st === 'out' || o.st === 'wait' || o.st === 'in' ? { x: o.x, s: o.s, hx: 1.8, hs: 0.95 } : null;
    }
    return null;
  }
  function collide(M) {
    const b = M.bike;
    if (b.st !== 'ok' || M.state !== 'ride') return;
    const hw = TU.bike.hw * M.D.hit + (M.margin || 0), hl = TU.bike.hl * M.D.hit + (M.margin || 0);
    if (b.inv <= 0 && !b.air) {
      for (const o of M.obs) {
        if (Math.abs(o.s - b.s) > 8) continue;
        const r = obsBox(M, o);
        if (!r || Math.abs(r.x - b.x) > r.hx + hw || Math.abs(r.s - b.s) > r.hs + hl) continue;
        crash(M, o);
        return;
      }
    }
    // hay bales in the park: a soft BOING, no life lost
    if (b.bump <= 0 && b.y < 0.7) {
      for (const h of M.bales) {
        if (Math.abs(h.x - b.x) > h.hw + hw || Math.abs(h.s - b.s) > h.hl + hl) continue;
        b.bump = 0.8;
        b.v = M.D.min * 0.7;
        M.bumps++;
        ev(M, 'boing', { x: h.x, s: h.s });
        return;
      }
    }
  }
  function crash(M, o) {
    const b = M.bike;
    b.st = 'tumble';
    b.t = 0;
    b.q.length = 0;
    M.lives = Math.max(0, M.lives - 1);
    M.crashes++;
    if (o.kind === 'puppy') o.st = 'back';
    if (o.kind === 'skate') o.st = 'away';
    ev(M, 'crash', { why: o.kind, o: o.i, lives: M.lives });
  }

  // ---------------------------------------------------------------- papers
  function throwPaper(M, side, from, vel, by) {
    const p = { x: from.x, y: TU.throw.y0, s: from.s, vx: vel.x, vy: vel.y, vs: vel.s, by, side, t: 0, done: false };
    M.flying.push(p);
    M.thrown++;
    ev(M, 'throw', { side, by, p });
    return p;
  }
  function playerThrow(M, side) {
    const b = M.bike;
    if (M.papers <= 0) { ev(M, 'empty'); return; }
    M.papers--;
    b.cd = TU.throw.cd;
    b.throwT = 0;
    b.throwSide = side;
    const sd = M.sab.swapThrow ? -side : side;
    throwPaper(M, side, b, { x: sd * TU.throw.vx, y: TU.throw.vy, s: b.v * M.D.carry }, 'p');
    if (M.sab.autoDeliver) { // the broken rule for the check: the nearest customer gets it, wherever the paper goes
      const h = M.houses.find((q) => q.customer && !q.got && q.side === side && Math.abs(q.s - b.s) < 12);
      if (h) deliver(M, h, 'mailbox', 'p');
    }
  }
  const mailAt = (h) => ({ x: h.side * TU.mailbox.x, s: h.s + TU.mailbox.ds });
  function matBox(M, h) {
    const pad = M.D.matPad;
    const x0 = TU.mat.x0 - pad, x1 = TU.mat.x1;
    return { xa: h.side > 0 ? x0 : -x1, xb: h.side > 0 ? x1 : -x0, sa: h.s + TU.mat.ds - 0.75 - pad, sb: h.s + TU.mat.ds + 0.75 + pad };
  }
  function deliver(M, h, kind, by) {
    if (h.got) return false;
    h.got = kind;
    h.missed = false;
    const pts = TU.points[kind];
    M.score += pts;
    M.delivered++;
    ev(M, 'deliver', { h: h.id, kind, by, pts });
    if (by === 'b' && M.buddy) {
      M.buddy.left--;
      if (M.buddy.left <= 0 && M.buddy.st === 'help') { M.buddy.st = 'bye'; M.buddy.t = 0; ev(M, 'buddyBye'); }
    }
    return true;
  }
  // one paper for one tick; returns what it did when it stops
  function flyPaper(M, p, dt) {
    const g = TU.throw.g;
    p.x += p.vx * dt;
    p.s += p.vs * dt;
    p.y += p.vy * dt;
    p.vy -= g * dt;
    p.t += dt;
    // a puppy, a skateboard or a mower in the way: soaked, puffed, sneezy, and off it goes
    if (p.y < 1.3) {
      for (const o of M.obs) {
        if (Math.abs(o.s - p.s) > 1.2) continue;
        const live = (o.kind === 'puppy' && (o.st === 'run' || o.st === 'idle' || o.st === 'sit')) || (o.kind === 'skate' && o.st === 'roll') || (o.kind === 'mower' && o.st === 'mow');
        if (!live || Math.abs(o.x - p.x) > 0.75 || Math.abs(o.s - p.s) > 0.75) continue;
        p.done = true;
        const pts = TU.points[o.kind];
        M.score += pts;
        o.st = o.kind === 'puppy' ? 'happy' : 'away';
        if (o.kind === 'skate') o.dir = Math.sign(p.vx) || o.dir;
        ev(M, 'soak', { o: o.i, kind: o.kind, pts, x: p.x, s: p.s, by: p.by });
        return 'obstacle';
      }
    }
    // a mailbox: the paper goes through the slot if it passes close enough at the right height
    if (!M.sab.noMailbox && p.y >= TU.mailbox.lo && p.y <= TU.mailbox.hi) {
      const R = M.D.mailR;
      for (const h of M.houses) {
        if (h.side !== Math.sign(p.x) || Math.abs(h.s + TU.mailbox.ds - p.s) > R) continue;
        const m = mailAt(h);
        if ((p.x - m.x) ** 2 + (p.s - m.s) ** 2 > R * R) continue;
        p.done = true;
        p.x = m.x; p.s = m.s; p.y = 1.15;
        if (h.customer && !h.got) deliver(M, h, 'mailbox', p.by);
        else ev(M, h.customer ? 'already' : 'nothanks', { h: h.id, x: m.x, s: m.s });
        return 'mailbox';
      }
    }
    // bonus cans and bins, and the park's targets
    if (p.y < 1.4) {
      for (const c of M.bins) {
        if (c.hit || Math.abs(c.s - p.s) > M.D.binR || (p.x - c.x) ** 2 + (p.s - c.s) ** 2 > M.D.binR ** 2) continue;
        c.hit = true;
        p.done = true;
        M.score += TU.points.bin;
        ev(M, 'bin', { x: c.x, s: c.s, kind: c.kind, pts: TU.points.bin, by: p.by });
        return 'bin';
      }
    }
    if (p.y > 0.4 && p.y < 2.7) {
      for (const tg of M.targets) {
        if (tg.hit || Math.abs(tg.s - p.s) > M.D.targetR || (p.x - tg.x) ** 2 + (p.s - tg.s) ** 2 > M.D.targetR ** 2) continue;
        tg.hit = true;
        p.done = true;
        M.score += TU.points.target;
        ev(M, 'target', { x: tg.x, s: tg.s, pts: TU.points.target, by: p.by });
        if (p.by === 'b' && M.buddy) { M.buddy.left--; if (M.buddy.left <= 0 && M.buddy.st === 'help') { M.buddy.st = 'bye'; M.buddy.t = 0; ev(M, 'buddyBye'); } }
        return 'target';
      }
    }
    // a house wall: bonk, and it drops (never breaks anything)
    if (!p.bonked && Math.abs(p.x) >= TU.house.front && p.y < TU.house.wall + 1.4 && p.s < M.street.streetEnd) {
      const lot = PR.Street.nearestLot(p.s);
      if (Math.abs(TU.lot0 + lot * TU.lotLen - p.s) <= TU.house.half) {
        p.bonked = true;
        p.x = Math.sign(p.x) * (TU.house.front - 0.02);
        p.vx = -p.vx * 0.1;
        p.vs *= 0.3;
        ev(M, 'bonk', { x: p.x, s: p.s, y: p.y });
      }
    }
    if (p.y <= 0) {
      p.y = 0;
      p.done = true;
      for (const h of M.houses) {
        if (h.side !== Math.sign(p.x) || Math.abs(h.s - p.s) > 4) continue;
        const r = matBox(M, h);
        if (p.x < r.xa || p.x > r.xb || p.s < r.sa || p.s > r.sb) continue;
        if (h.customer && !h.got) { deliver(M, h, 'mat', p.by); return 'mat'; }
      }
      ev(M, 'landed', { x: p.x, s: p.s, by: p.by });
      return 'ground';
    }
    if (Math.abs(p.x) > 20 || p.t > 4) { p.done = true; return 'gone'; }
    return null;
  }
  function movePapers(M, dt) {
    for (const p of M.flying) if (!p.done) p.result = flyPaper(M, p, dt);
    if (M.flying.length > 24 || M.flying.some((p) => p.done)) M.flying = M.flying.filter((p) => !p.done);
  }

  // ---------------------------------------------------------------- the companion
  // Called with T (or his face): he pops in at your side, does his signature move, tosses a treat, then rides along
  // and delivers to the next 3 houses. Calling again while he rides adds 3 more. With two players T is a high five.
  function callBuddy(M, mode) {
    if (M.state !== 'ride' && M.state !== 'ready') return false;
    const B = TU.buddy;
    if (mode === 'five') {
      if (M.buddy && M.buddy.st !== 'gone') return false;
      M.buddy = { mode, st: 'five', t: 0, x: M.bike.x, s: M.bike.s - 0.3, side: M.bike.x > 0 ? -1 : 1, left: 0, cd: 0 };
      ev(M, 'buddyIn', { five: true });
      return true;
    }
    if (M.buddy && (M.buddy.st === 'in' || M.buddy.st === 'help')) {
      M.buddy.left = Math.min(B.max, M.buddy.left + B.houses);
      ev(M, 'buddyMore', { left: M.buddy.left });
      return true;
    }
    if (M.buddy && M.buddy.st === 'bye') { M.buddy.st = 'help'; M.buddy.left = B.houses; ev(M, 'buddyMore', { left: M.buddy.left }); return true; }
    const side = M.bike.x > 0.5 ? -1 : 1;
    M.buddy = { mode, st: 'in', t: 0, x: clamp(M.bike.x + side * 1.5, -TU.edge, TU.edge), s: M.bike.s - 0.3, side, left: B.houses, cd: 0, treated: false };
    ev(M, 'buddyIn', { five: false });
    return true;
  }
  function buddyTarget(M, bd) {
    // the next customer who still needs a paper, a little way ahead, on either side
    let best = null, bs = 1e9;
    for (const h of M.houses) {
      if (!h.customer || h.got || h.tgt) continue;
      const m = mailAt(h);
      const ds = m.s - bd.s;
      if (ds < 2 || ds > 7.5) continue;
      if (ds < bs) { bs = ds; best = { x: m.x, s: m.s, y: 1.15, h }; }
    }
    if (best) return best;
    for (const tg of M.targets) {
      if (tg.hit || tg.tgt) continue;
      const ds = tg.s - bd.s;
      if (ds < 2 || ds > 7.5) continue;
      if (ds < bs) { bs = ds; best = { x: tg.x, s: tg.s, y: 1.5, tg }; }
    }
    return best;
  }
  function moveBuddy(M, dt) {
    const bd = M.buddy;
    if (!bd) return;
    const B = TU.buddy, b = M.bike;
    bd.t += dt;
    // keep alongside: on the side with room, a little behind
    let want = b.x + bd.side * 1.5;
    if (Math.abs(want) > TU.edge) { bd.side = -bd.side; want = b.x + bd.side * 1.5; }
    bd.x += (clamp(want, -TU.edge, TU.edge) - bd.x) * Math.min(1, dt * 6);
    bd.s = b.s - 0.3;
    bd.cd -= dt;
    if (bd.st === 'in') {
      if (!bd.treated && bd.t >= B.treat) { bd.treated = true; M.score += 100; ev(M, 'treat', { pts: 100 }); }
      if (bd.t >= B.hello) { bd.st = 'help'; bd.t = 0; ev(M, 'buddySays', { left: bd.left }); }
    } else if (bd.st === 'help') {
      // never more papers in the air than houses he still has to do
      if (bd.cd <= 0 && M.flying.filter((p) => p.by === 'b' && !p.done).length < bd.left) {
        const tg = buddyTarget(M, bd);
        if (tg) {
          const T = B.flight, g = TU.throw.g;
          const vel = { x: (tg.x - bd.x) / T, y: (tg.y - TU.throw.y0 + 0.5 * g * T * T) / T, s: (tg.s - bd.s) / T };
          if (tg.h) tg.h.tgt = true; else tg.tg.tgt = true;
          throwPaper(M, Math.sign(tg.x), bd, vel, 'b');
          bd.cd = 0.3;
          bd.throwT = 0;
          bd.throwSide = Math.sign(tg.x);
        }
      }
      if (M.state === 'end') { bd.st = 'bye'; bd.t = 0; }
    } else if (bd.st === 'five') {
      if (!bd.fived && bd.t >= 0.7) { bd.fived = true; M.papers = Math.min(M.D.maxPapers, M.papers + 3); M.score += 50; ev(M, 'highFive', { papers: 3 }); }
      if (bd.t >= 1.7) { bd.st = 'bye'; bd.t = 0; }
    } else if (bd.st === 'bye') {
      if (bd.t >= B.bye) { M.buddy = null; ev(M, 'buddyOut'); }
    }
    if (bd.throwT != null) bd.throwT += dt;
  }

  // ---------------------------------------------------------------- one tick
  function step(M, dt, inp) {
    M.t += dt;
    M.stateT += dt;
    const b = M.bike;
    if (M.state === 'ready') {
      if (M.stateT >= TU.readyT) { M.state = 'ride'; M.stateT = 0; b.v = M.D.cruise * M.up * 0.5; ev(M, 'go'); }
      return;
    }
    if (M.state === 'end' || M.state === 'over') { if (!M.lite) { movePapers(M, dt); moveBuddy(M, dt); } return; }
    moveBike(M, dt, inp);
    moveObstacles(M, dt);
    b.cd = Math.max(0, b.cd - dt);
    b.throwT += dt;
    if (!M.lite) {
      if (inp.throwL) b.q.push(-1);
      if (inp.throwR) b.q.push(1);
      if (b.q.length > 2) b.q.splice(0, b.q.length - 2);
      if (b.q.length && b.cd <= 0 && b.st === 'ok' && M.state === 'ride') playerThrow(M, b.q.shift());
    }
    collide(M);
    if (M.lite) return;
    for (const u of M.bundles) {
      if (u.got || b.st !== 'ok' || Math.abs(u.s - b.s) > 1.0 || Math.abs(u.x - b.x) > 0.95) continue;
      u.got = true;
      const before = M.papers;
      M.papers = Math.min(M.D.maxPapers, M.papers + M.D.bundle);
      ev(M, 'bundle', { n: M.papers - before, x: u.x, s: u.s });
    }
    movePapers(M, dt);
    moveBuddy(M, dt);
    for (const h of M.houses) {
      if (h.passed || b.s < h.s + 5) continue;
      h.passed = true;
      if (h.customer && !h.got) { h.missed = true; ev(M, 'missed', { h: h.id }); }
    }
    if (!M.inPark && b.s >= M.street.parkS - 2) {
      M.inPark = true;
      const before = M.papers;
      M.papers = Math.max(M.papers, 10);
      ev(M, 'park', { n: M.papers - before });
    }
    if (b.s >= M.end && M.state === 'ride') {
      M.state = 'end';
      M.stateT = 0;
      M.score += TU.points.park;
      for (const h of M.houses) if (!h.passed) { h.passed = true; if (h.customer && !h.got) h.missed = true; }
      ev(M, 'end', { pts: TU.points.park });
    }
  }

  // run whole 120 Hz ticks for one frame of `dt` seconds; throws pressed this frame go to the first tick.
  // Returns how many ticks ran (0 when the frame was shorter than a tick: the presses wait for the next frame).
  function advance(M, dt, inp) {
    M.accUs += Math.round(dt * 1e6);
    let n = 0;
    const one = { steer: inp.steer, speed: inp.speed, throwL: inp.throwL, throwR: inp.throwR };
    while (M.accUs >= TICK_US) {
      M.accUs -= TICK_US;
      step(M, STEP, one);
      one.throwL = one.throwR = 0;
      n++;
    }
    if (M.sab.perFrameDrag && n) M.bike.v *= 0.995; // the broken rule for the check: a slow-down once per frame
    return n;
  }

  // a light copy for looking ahead (the autopilot): the bike, the obstacles near it and the park, no papers or events
  function cloneLite(M) {
    const R = Object.create(null);
    Object.assign(R, M);
    R.lite = true;
    R.bike = Object.assign({}, M.bike, { q: [] });
    R.obs = M.obs.filter((o) => o.s > M.bike.s - 6 && o.s < M.bike.s + 40).map((o) => Object.assign({}, o));
    R.ramps = M.ramps.map((r) => Object.assign({}, r));
    R.events = [];
    return R;
  }

  // where a paper thrown now to `side` would end up, without throwing it (for the autopilot and the checks)
  function predictThrow(M, side) {
    const R = Object.assign(Object.create(null), M);
    R.lite = false;
    R.events = [];
    R.score = 0;
    R.delivered = 0;
    R.buddy = null;
    R.houses = M.houses.map((h) => Object.assign({}, h));
    R.obs = M.obs.map((o) => Object.assign({}, o));
    R.bins = M.bins.map((c) => Object.assign({}, c));
    R.targets = M.targets.map((c) => Object.assign({}, c));
    const b = M.bike;
    const sd = M.sab.swapThrow ? -side : side;
    const p = { x: b.x, y: TU.throw.y0, s: b.s, vx: sd * TU.throw.vx, vy: TU.throw.vy, vs: b.v * M.D.carry, side, by: 'p', t: 0 };
    let res = null;
    for (let k = 0; k < 600 && !res; k++) res = flyPaper(R, p, STEP);
    const e = R.events.find((q) => q.type === 'deliver' || q.type === 'bin' || q.type === 'target' || q.type === 'nothanks' || q.type === 'already');
    return { res, x: p.x, s: p.s, ev: e || null };
  }

  PR.Sim = {
    create, step, advance, callBuddy, cloneLite, predictThrow, obsBox, matBox, mailAt, sprayOn,
    left(M) { return M.houses.filter((h) => h.customer && !h.got && !h.passed).length; },
  };

  // ---------------------------------------------------------------- the week
  function pickHouses(street, n, seed, not) {
    const r = PR.rng(seed);
    const pool = street.houses.map((h) => h.id).filter((id) => !not.has(id));
    const out = [];
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    return out;
  }
  PR.Week = {
    create(o) {
      const D = TU[o.diff];
      const seed = o.seed != null ? o.seed : 1;
      const street = PR.Street.make(seed);
      const W = {
        diff: o.diff, hero: o.hero || 'teddy', seed, street, day: 0, lives: D.lives, score: 0, dayScore: 0, state: 'on',
        customers: pickHouses(street, D.customers, seed * 3 + 1, new Set()).sort((a, b) => a - b), history: [], sab: o.sab || {},
      };
      return W;
    },
    ride(W, o = {}) {
      W.dayScore = W.score;
      return create({ street: W.street, day: W.day, diff: W.diff, lives: W.lives, score: W.score, customers: W.customers, seed: W.seed, hero: W.hero, sab: Object.assign({}, W.sab, o.sab), demo: o.demo });
    },
    // the day is over (the rider reached the end of the park): who stays a customer, who stops, who comes back
    endDay(W, M) {
      const D = TU[W.diff];
      const was = W.customers.slice();
      const got = new Set(M.houses.filter((h) => h.got && h.customer).map((h) => h.id));
      let kept = was.filter((id) => got.has(id));
      let lost = was.filter((id) => !got.has(id));
      if (W.sab.keepMissed) { kept = was.slice(); lost = []; }
      if (W.sab.dropDelivered) kept = kept.slice(1);
      const next = kept.slice();
      const perfect = lost.length === 0 && was.length > 0;
      let comeback = null;
      if (perfect && !W.sab.noComeback) {
        const c = pickHouses(W.street, 1, W.seed * 17 + W.day * 5 + 3, new Set(next));
        if (c.length) { comeback = c[0]; next.push(comeback); }
      }
      // new neighbours (EASY keeps at least a few customers); never the ones who just stopped
      const fresh = next.length < D.minCustomers ? pickHouses(W.street, D.minCustomers - next.length, W.seed * 29 + W.day * 11, new Set(next.concat(lost))) : [];
      next.push(...fresh);
      W.customers = next.sort((a, b) => a - b);
      W.lives = M.lives;
      W.score = M.score + (perfect ? TU.points.perfect : 0);
      const sum = { day: W.day, was, kept, lost, comeback, fresh, perfect, score: W.score, dayPts: W.score - W.dayScore, crashes: M.crashes };
      W.history.push(sum);
      W.day++;
      if (W.customers.length === 0) W.state = 'nocust';
      else if (W.day >= 7) W.state = 'done';
      sum.state = W.state;
      return sum;
    },
    // out of lives: the week stops here (KEEP GOING rides the same day again with full lives)
    over(W, M) { W.state = 'over'; W.lives = 0; W.score = M.score; },
    keepGoing(W) { W.state = 'on'; W.lives = TU[W.diff].lives; W.score = W.dayScore; },
  };
})();
