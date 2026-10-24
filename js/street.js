/* The street and each day's things on it, made from a seed (the same seed always makes the same street).
   - PR.Street.make(seed): the houses for the whole week. Each yard has a house, a doormat, a mailbox by the curb and
     a driveway. Houses face the street from both sides (side -1 is the rider's left, 1 his right).
   - PR.Street.day(street, day, diff, seed): that day's obstacles (sprinklers, skateboards, robot mowers, puppies and
     cars backing out), paper bundles, bonus cans and bins, and the bonus park at the end (ramps, targets, hay bales).
   Obstacles are spread out so there is always room to ride past: js/checks.js proves every street can be passed. */
(function () {
  'use strict';
  const TU = PR.TUNE;

  // a small seeded random number generator (mulberry32): the same seed gives the same numbers
  PR.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const COLORS = ['#ff8fab', '#ffd166', '#7bdff2', '#b8f2a6', '#cdb4ff', '#ffb17a', '#9ad1ff', '#ffe9a8', '#f7a1c4', '#a0e7c8', '#ffc9de', '#c5e8ff'];
  const ROOFS = ['#e05a5a', '#5a7be0', '#3fae6b', '#8b5ad6', '#e08a3a', '#2fa8b8'];

  function make(seed) {
    const r = PR.rng(seed * 7919 + 13);
    const houses = [];
    for (let i = 0; i < TU.lots; i++) {
      for (const side of [-1, 1]) {
        houses.push({
          id: houses.length, side, i, s: TU.lot0 + i * TU.lotLen,
          color: COLORS[Math.floor(r() * COLORS.length)], roof: ROOFS[Math.floor(r() * ROOFS.length)],
          style: Math.floor(r() * 3), tree: r() < 0.6, fence: r() < 0.45, flowers: r() < 0.5,
        });
      }
    }
    const streetEnd = TU.lot0 + (TU.lots - 1) * TU.lotLen + TU.lotLen / 2 + 2;
    const parkS = streetEnd + TU.parkGap;
    return { seed, houses, streetEnd, parkS, parkEnd: parkS + TU.parkLen, end: parkS + TU.parkLen + 4 };
  }

  const nearestLot = (s) => Math.max(0, Math.min(TU.lots - 1, Math.round((s - TU.lot0) / TU.lotLen)));

  function day(street, d, diff, seed) {
    const D = TU[diff];
    const r = PR.rng(seed * 104729 + d * 7727 + (diff === 'easy' ? 1 : 2));
    const obs = [];
    const n = D.obstacles(d);
    const kinds = D.kinds(d);
    const from = 26, to = street.streetEnd - 6;
    const slot = (to - from) / n;
    const usedLots = new Set();
    for (let k = 0; k < n; k++) {
      // the first kinds of the day go in order so each one shows up; then they are picked at random
      const kind = k < kinds.length ? kinds[(k + d) % kinds.length] : kinds[Math.floor(r() * kinds.length)];
      const jit = Math.max(0, slot - D.gap) * (r() - 0.5);
      const s = from + slot * (k + 0.5) + jit;
      const side = r() < 0.5 ? -1 : 1;
      const lot = nearestLot(s);
      const ls = TU.lot0 + lot * TU.lotLen;
      if (kind === 'sprinkler') obs.push({ kind, side, s, ph: r() * 4 });
      else if (kind === 'skate') obs.push({ kind, dir: side, s, x: -side * 6.6 });
      else if (kind === 'mower') obs.push({ kind, side, s0: s - 3, span: 6, x: side * 4.7, s: s - 3 });
      else if (kind === 'puppy') { obs.push({ kind, side, hx: side * 8.4, hs: ls - 0.6, x: side * 8.4, s: ls - 0.6 }); usedLots.add(lot * 2 + (side > 0 ? 1 : 0)); }
      else if (kind === 'car') { obs.push({ kind, side, s: ls + 3.6, hx: side * 9.4, x: side * 9.4 }); usedLots.add(lot * 2 + (side > 0 ? 1 : 0)); }
    }
    obs.forEach((o, i) => { o.i = i; o.st = 'idle'; o.t = 0; });

    // paper bundles: in the street, away from the obstacles
    const bundles = [];
    const every = diff === 'easy' ? 22 : 27;
    for (let s = 20; s < street.streetEnd - 4; s += every) {
      let bs = s + (r() - 0.5) * 6;
      if (obs.some((o) => Math.abs((o.kind === 'mower' ? o.s0 + 3 : o.s) - bs) < 4.5)) bs += 6;
      bundles.push({ x: Math.round((r() - 0.5) * 5 * 10) / 10, s: bs, got: false });
    }

    // bonus cans and bins on the lawns, by the curb
    const bins = [];
    for (const h of street.houses) {
      if (usedLots.has(h.id) || r() > 0.38) continue;
      bins.push({ x: h.side * TU.bin.x, s: h.s + TU.bin.ds, side: h.side, kind: r() < 0.5 ? 'can' : 'bin', hit: false });
    }

    // the bonus park: ramps to jump, targets on both sides, hay bales to jump or ride around
    const p0 = street.parkS;
    const ramps = [], targets = [], bales = [];
    const rampAt = [p0 + 9, p0 + 25, p0 + 41];
    rampAt.forEach((s, k) => {
      const x = [0, -2.2, 2.2][(k + d) % 3];
      ramps.push({ s, x, w: 3, len: 2.4, used: false });
      bales.push({ s: s + 4.6, x, hw: 0.75, hl: 0.5 });
    });
    for (let k = 0; k < 6; k++) targets.push({ s: p0 + 6 + k * 8.6, side: k % 2 ? 1 : -1, x: (k % 2 ? 1 : -1) * 7.2, hit: false });
    bales.push({ s: p0 + 17, x: r() < 0.5 ? -4 : 4, hw: 0.75, hl: 0.5 });
    bales.push({ s: p0 + 33, x: r() < 0.5 ? -4 : 4, hw: 0.75, hl: 0.5 });
    return { obs, bundles, bins, ramps, targets, bales };
  }

  PR.Street = { make, day, nearestLot };
})();
