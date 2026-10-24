/* The autopilot: rides the title-screen demo and the headless checks (every street can be passed).
   Every 0.15 s it tries each way of steering and pedalling on a light copy of the ride (PR.Sim.cloneLite) for 1.4 s
   ahead, and keeps the one that stays out of trouble and near the middle of the street (where a paper reaches the
   mailboxes on both sides). It throws when a paper thrown now would land in a customer's mailbox or on his mat. */
(function () {
  'use strict';
  const Sim = PR.Sim;
  const CANDS = [];
  for (const sp of [0, 1, -1]) for (const st of [0, -1, 1]) for (const long of st ? [false, true] : [false]) CANDS.push({ st, sp, long });
  const H = 1 / 20, N = 28;

  function plan(M, mem) {
    let best = null, bs = -Infinity;
    const pref = mem.pref != null ? mem.pref : 0;
    for (const c of CANDS) {
      const R = Sim.cloneLite(M);
      R.margin = 0.22;
      let crashT = -1;
      const bumps = R.bumps;
      for (let k = 0; k < N; k++) {
        Sim.step(R, H, { steer: c.long || k * H < 0.3 ? c.st : 0, speed: c.sp, throwL: 0, throwR: 0 });
        if (R.bike.st === 'tumble') { crashT = k * H; break; }
      }
      let sc = 0;
      if (crashT >= 0) sc -= 1000 * (2 - crashT);
      if (R.bumps > bumps) sc -= 150;
      sc -= Math.abs(R.bike.x - pref) * 0.8;
      if (c.sp !== 0) sc -= 0.4;
      if (c.long) sc -= 0.15;
      if (mem.c && mem.c.st === c.st && mem.c.sp === c.sp && mem.c.long === c.long) sc += 0.1;
      if (sc > bs) { bs = sc; best = c; }
    }
    return best;
  }

  PR.Bot = {
    decide(M, o = {}) {
      const mem = M.bot || (M.bot = { next: 0, nextThrow: 0, c: null, t0: 0, pending: {} });
      const out = { steer: 0, speed: 0, throwL: 0, throwR: 0 };
      if (M.state !== 'ride') return out;
      if (M.t >= mem.next) {
        // ride over the next paper bundle when the bag is getting light
        const u = M.bundles.find((q) => !q.got && q.s > M.bike.s + 1 && q.s < M.bike.s + 16);
        mem.pref = u && M.papers < M.D.maxPapers - M.D.bundle ? u.x : 0;
        mem.c = plan(M, mem);
        mem.t0 = M.t;
        mem.next = M.t + 0.15;
      }
      const c = mem.c;
      out.speed = c.sp;
      out.steer = c.long || M.t - mem.t0 < 0.3 ? c.st : 0;
      if (o.noThrow) return out;
      const b = M.bike;
      if (M.t >= mem.nextThrow && b.st === 'ok' && b.cd <= 0 && M.papers > 0) {
        mem.nextThrow = M.t + 0.05;
        for (const side of o.only ? [o.only] : [-1, 1]) {
          const r = Sim.predictThrow(M, side);
          const e = r.ev;
          if (!e) continue;
          // one paper per mailbox, can or target: not another while the first is still in the air
          const key = e.type === 'deliver' ? 'h' + e.h : e.type + e.x.toFixed(1) + ',' + e.s.toFixed(1);
          if (mem.pending[key] > M.t) continue;
          if (e.type === 'deliver' || ((e.type === 'bin' || e.type === 'target') && M.papers > 4)) {
            mem.pending[key] = M.t + 1.5;
            if (side < 0) out.throwL = 1; else out.throwR = 1;
            break;
          }
        }
      }
      return out;
    },
  };
})();
