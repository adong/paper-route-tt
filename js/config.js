/* Numbers that tune the game. Distances are in metres, speeds in metres per second, times in seconds.
   The street runs forward along s (0 at the start), x goes across it (+ is the rider's right), y is up.
   🐣 EASY is for Tommy (5): slower, fewer obstacles, bigger mailboxes and doormats, 5 lives.
   🔥 NORMAL is for Teddy (8). */
PR.TUNE = {
  STEP: 1 / 120, // the rules always tick at 120 Hz, whatever the screen's frame rate
  road: 3.8, // |x| < road is the street; the sidewalk runs from the curb to `walk`
  walk: 5.6,
  edge: 5.3, // how far across the bike can go (it stays on the street and the sidewalks)
  lots: 12, // houses on each side of the street
  lot0: 16, // where the first house is
  lotLen: 9, // each yard is this long
  house: { front: 11, back: 16, half: 2.5, wall: 2.4, door: 0.8 }, // a house: |x| from front to back, s within ±half
  mailbox: { x: 6.4, ds: -2.4, lo: 0.45, hi: 1.95 }, // on the lawn by the curb, a bit before the house
  mat: { x0: 9.7, x1: 10.95, ds: 0.8 }, // the doormat, in front of the door
  bin: { x: 6.8, ds: 2.0 }, // bonus cans and bins
  parkGap: 8, // from the last house to the bonus park gate
  parkLen: 58, // the bonus course
  throw: { vx: 9.5, vy: 3.6, y0: 1.3, g: 12, cd: 0.22 },
  bike: { hw: 0.34, hl: 0.8, accel: 4.5, brake: 7 },
  tumbleT: 1.4, safeT: 2.2, readyT: 1.6,
  points: { mailbox: 250, mat: 100, bin: 100, target: 200, ramp: 100, puppy: 100, skate: 50, mower: 100, perfect: 500, park: 300 },
  // the companion: pops in, signature move, treat, then rides alongside and delivers to the next 3 houses
  buddy: { hello: 1.3, treat: 0.85, houses: 3, max: 9, bye: 1.1, flight: 0.55 },
  days: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
  easy: {
    lives: 5, papers: 15, maxPapers: 25, bundle: 8, customers: 10, minCustomers: 4,
    min: 2.5, cruise: 4.0, max: 6.0, steer: 4.4, carry: 0.75, hit: 0.75, // carry: how much of the bike's speed a paper keeps
    mailR: 1.5, matPad: 0.7, binR: 1.1, targetR: 1.4,
    obstacles: (d) => 2 + Math.floor(d * 0.7), gap: 15, kinds: (d) => ['sprinkler', 'skate', 'mower', 'puppy', 'car'].slice(0, Math.min(5, 2 + d)),
    skate: 1.5, puppy: 2.0, mower: 0.9, car: 1.6, sprayOn: 1.6, sprayOff: 2.2, chase: 2.6,
  },
  normal: {
    lives: 3, papers: 10, maxPapers: 20, bundle: 5, customers: 12, minCustomers: 0,
    min: 3.5, cruise: 5.5, max: 8.5, steer: 6.0, carry: 1.0, hit: 1.0,
    mailR: 0.85, matPad: 0, binR: 0.7, targetR: 0.9,
    obstacles: (d) => 4 + d, gap: 9, kinds: (d) => ['sprinkler', 'skate', 'mower', 'puppy', 'car'].slice(0, Math.min(5, 3 + d)),
    skate: 2.6, puppy: 3.0, mower: 1.5, car: 2.3, sprayOn: 2.0, sprayOff: 1.6, chase: 3.4, dayUp: 0.03,
  },
};
