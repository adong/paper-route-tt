/* The game you see: the scene, the camera, the riders, the day's things, effects, the HUD, the screens, the week's
   flow (and taking turns with two players), the companion's visits, the main loop and the window.game test hooks.
   The rules live in js/sim.js; this file reads its state and turns its events into pictures and sounds.
   Sections: setup · cast · words and effects · syncing · events · HUD · screens · flow · loop · input · hooks */
(function () {
  'use strict';
  const T = THREE;
  const gfx = Kit.gfx;
  const People = Kit.people;
  const A = PR.Art;
  const TU = PR.TUNE;
  const I = PR.Input;
  const SFX = PR.Sfx;
  const Sim = PR.Sim;
  const Week = PR.Week;
  const V = PR.View;
  const Z = A.Z;
  const $ = (id) => document.getElementById(id);
  const damp = (k, dt) => 1 - Math.exp(-k * dt);
  const TREATS = [['🍦', 'ICE CREAM'], ['💧', 'WATER'], ['🧃', 'JUICE BOX'], ['🍪', 'COOKIE'], ['🍉', 'WATERMELON'], ['🍌', 'BANANA']];
  const nameOf = (id) => Kit.roster.get(id).name;
  const DAYS = TU.days;

  // ---------------------------------------------------------------- saved settings
  const SAVE_KEY = 'paperRouteTT.v1';
  const saved = { diff: 'easy', hero: 'teddy', two: false, diffs: { teddy: 'easy', tommy: 'easy' }, best: { easy: 0, normal: 0 } };
  try { Object.assign(saved, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) { /* storage blocked */ }
  saved.best = Object.assign({ easy: 0, normal: 0 }, saved.best);
  saved.diffs = Object.assign({ teddy: 'easy', tommy: 'easy' }, saved.diffs);
  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(saved)); } catch (e) { /* storage blocked */ } };

  const G = {
    screen: 'loading', two: !!saved.two, diff: saved.diff === 'normal' ? 'normal' : 'easy', hero: saved.hero === 'tommy' ? 'tommy' : 'teddy',
    diffs: saved.diffs, weeks: [], turn: 0, W: null, M: null, demo: false, demoN: 0, time: 0, hold: false, autoPause: true, touch: false,
    end: null, fr: null, camS: 0, celebrate: null, shake: 0, lastSum: null, resKind: null, tip: false,
  };

  // ---------------------------------------------------------------- setup
  const canvas = $('game');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio || 1, 1.25), 2));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  scene.background = new T.Color('#8fd877');
  const camera = new T.PerspectiveCamera(V.FOV, 1, 1, 600);
  const hemi = new T.HemisphereLight('#ffffff', '#7fb060', 0.82);
  scene.add(hemi);
  const sun = new T.DirectionalLight('#fff4e0', 0.95);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 });
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);

  const fx = {
    confetti: A.makeParticles(scene, A.squareTexture(), 320),
    stars: A.makeParticles(scene, A.starTexture(), 140),
    water: A.makeParticles(scene, gfx.dotTexture(), 220),
    puff: A.makeParticles(scene, gfx.dotTexture(), 100),
    hearts: A.makeParticles(scene, A.heartTexture(), 60),
  };
  const PASTEL = ['#ffffff', '#ffe066', '#ff9ecd', '#8fe3ff', '#a8f08a', '#d0a8ff', '#ffc38a'];
  let thumbs = {};
  const emo = {};
  const emojiTex = (e) => emo[e] || (emo[e] = gfx.emojiTexture(e));
  const badge = (e, bg) => emo['b' + e] || (emo['b' + e] = A.badgeTexture(e, bg));

  // ---------------------------------------------------------------- cast
  let street = null; // the houses for the week (both brothers ride the same street)
  function ensureStreet(W) {
    if (!street || street.seed !== W.street.seed) {
      if (street) street.view.dispose();
      street = { seed: W.street.seed, view: A.makeStreet(scene, W.street) };
      street.view.relabel();
    }
    street.view.dress(W.customers, W.diff);
  }
  const riders = {};
  function rider(key, id, o) { return riders[key] || (riders[key] = A.makeRider(scene, id, o)); }
  function playerView(M) { return rider('p:' + M.hero, M.hero); }
  function buddyView(M) {
    const id = Kit.roster.buddyFor(M.hero);
    return rider('b:' + id, id, { scale: Kit.roster.get(id).buddyScale, tag: true });
  }
  function resetRiders() {
    for (const k in riders) {
      const m = riders[k];
      m.g.visible = m.shadow.visible = false;
      m.g.rotation.set(0, 0, 0);
      m.body.position.set(-0.2, 0.3, 0);
      m.p.root.rotation.y = -Math.PI / 2;
      m.b.bike.visible = true;
      if (m.ball) { scene.remove(m.ball.s); m.ball = null; }
    }
  }

  const day = { group: null, obs: [], bundles: [], bins: [], targets: [], markers: {}, pending: {} };
  function buildDay(M) {
    if (day.group) scene.remove(day.group);
    const g = (day.group = new T.Group());
    scene.add(g);
    day.obs = M.obs.map(obsView);
    day.bundles = M.bundles.map((u) => { const v = A.makeBundle(); v.g.position.set(u.x, 0, Z(u.s)); g.add(v.g); return v; });
    day.bins = M.bins.map((c) => { const v = A.makeBin(c.kind); v.g.position.set(c.x, 0, Z(c.s)); v.t = 0; g.add(v.g); return v; });
    M.ramps.forEach((r) => g.add(A.makeRamp(r)));
    day.targets = M.targets.map((tg) => { const v = A.makeTarget(tg); v.t = 0; g.add(v.g); return v; });
    M.bales.forEach((h) => g.add(A.makeBale(h)));
    // a 📰 floats over the mailbox of every house that ordered a paper today
    day.markers = {};
    const sc = M.diff === 'easy' ? 1.45 : 1.1;
    for (const h of M.houses) {
      if (!h.customer) continue;
      const s = new T.Sprite(new T.SpriteMaterial({ map: badge('📰'), depthWrite: false }));
      s.scale.setScalar(1.5);
      s.position.set(h.side * TU.mailbox.x, 1.9 * sc + 0.9, Z(h.s + TU.mailbox.ds));
      s.userData = { y: s.position.y, t: Math.random() * 6, done: 0 };
      g.add(s);
      day.markers[h.id] = s;
    }
    for (const v of paperViews.values()) releasePaper(v.g);
    paperViews.clear();
    for (const l of landed) releasePaper(l.g);
    landed.length = 0;
    for (const tr of treats) scene.remove(tr.s);
    treats.length = 0;
    for (const w of words) w.s.visible = false;
    Object.values(fx).forEach((f) => f.clear());
  }

  function obsView(o) {
    let v;
    if (o.kind === 'sprinkler') v = A.makeSprinkler(o);
    else if (o.kind === 'skate') v = A.makeSkate();
    else if (o.kind === 'mower') v = A.makeMower();
    else if (o.kind === 'puppy') v = A.makePuppy();
    else v = A.makeCar(o.side);
    v.t = 0;
    v.kind = o.kind;
    v.o = o;
    day.group.add(v.g);
    return v;
  }

  // papers: a small pool of rolled-up newspapers
  const paperPool = [];
  const paperViews = new Map();
  const landed = [];
  function getPaper() {
    const g = paperPool.pop() || A.makePaper();
    g.visible = true;
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(g);
    return g;
  }
  function releasePaper(g) { scene.remove(g); paperPool.push(g); }

  // ---------------------------------------------------------------- words and effects
  const words = [];
  const wordTex = {};
  function word(text, x, y, s, o = {}) {
    if (G.demo && !o.demo) return null;
    const t = Kit.lang.t(text);
    const key = t + '|' + (o.fill || '') + (o.stroke || '');
    const tex = wordTex[key] || (wordTex[key] = A.wordTexture(t, o.fill, o.stroke));
    let w = words.find((q) => !q.s.visible);
    if (!w) {
      w = { s: new T.Sprite(new T.SpriteMaterial({ depthWrite: false, depthTest: false, transparent: true })), t: 0 };
      w.s.renderOrder = 10;
      scene.add(w.s);
      words.push(w);
    }
    w.s.material.map = tex;
    w.s.material.needsUpdate = true;
    w.s.visible = true;
    w.s.position.set(x, y, Z(s));
    w.t = 0;
    w.life = o.life || 1.1;
    w.size = (o.size || 1) * 3.6;
    w.vy = o.vy != null ? o.vy : 1.4;
    return w;
  }
  function updateWords(dt) {
    for (const w of words) {
      if (!w.s.visible) continue;
      w.t += dt;
      if (w.t >= w.life) { w.s.visible = false; continue; }
      const u = w.t / w.life;
      const pop = u < 0.15 ? 0.4 + (u / 0.15) * 0.75 : u < 0.25 ? 1.15 - (u - 0.15) : 1;
      w.s.scale.set(w.size * pop, w.size * pop * 0.3125, 1);
      w.s.position.y += w.vy * dt;
      w.s.material.opacity = u > 0.75 ? (1 - u) / 0.25 : 1;
    }
  }
  const confettiAt = (x, y, s, n) => fx.confetti.burst(x, y, Z(s), n, { speed: 5, up: 4, g: 9, life: 1.6, s0: 0.3, s1: 0.2, spin: 6, colors: PASTEL, drag: 0.6 });
  const starsAt = (x, y, s, n = 8) => fx.stars.burst(x, y, Z(s), n, { speed: 2.6, up: 1, life: 0.8, s0: 0.5, s1: 0.1, spin: 5, colors: ['#ffe066', '#ffffff'] });
  const puffAt = (x, y, s, n = 6) => fx.puff.burst(x, y, Z(s), n, { speed: 1.4, life: 0.7, s0: 0.7, s1: 2.0, color: '#ffffff', alpha: 0.85 });
  const splashAt = (x, y, s, n = 14) => fx.water.burst(x, y, Z(s), n, { speed: 3, up: 3, g: 10, life: 0.8, s0: 0.35, s1: 0.15, colors: ['#7fd4ff', '#4dabf7', '#ffffff'] });
  const heartsAt = (x, y, s, n = 5) => fx.hearts.burst(x, y, Z(s), n, { speed: 1.2, up: 1.5, life: 1.2, s0: 0.45, s1: 0.2, colors: ['#ff5d8f', '#ff8fab'] });

  // the companion's treat: it flies from his hand to over your head, then pops in stars
  const treats = [];
  function tossTreat(from, toView) {
    const [emoji, label] = gfx.pick(TREATS);
    const s = new T.Sprite(new T.SpriteMaterial({ map: emojiTex(emoji), depthWrite: false }));
    s.scale.setScalar(1.0);
    s.position.copy(from);
    scene.add(s);
    treats.push({ s, t: 0, from: from.clone(), view: toView });
    return [emoji, label];
  }
  const tmpV = new T.Vector3();
  function updateTreats(dt) {
    for (let k = treats.length - 1; k >= 0; k--) {
      const tr = treats[k];
      tr.t += dt;
      const r = tr.view.g.position;
      tmpV.set(r.x, r.y + 2.3, r.z);
      if (tr.t < 0.55) {
        const u = tr.t / 0.55;
        tr.s.position.lerpVectors(tr.from, tmpV, u);
        tr.s.position.y += Math.sin(u * Math.PI) * 1.5;
      } else {
        tr.s.position.copy(tmpV);
        tr.s.position.y += Math.sin(tr.t * 6) * 0.1;
      }
      if (tr.t > 2.2) {
        fx.stars.burst(tr.s.position.x, tr.s.position.y, tr.s.position.z, 6, { speed: 2.6, up: 1, life: 0.8, s0: 0.5, s1: 0.1, spin: 5, colors: ['#ffe066', '#ffffff'] });
        scene.remove(tr.s);
        tr.s.material.dispose();
        treats.splice(k, 1);
      }
    }
  }
  // Teddy's jump shot: a 🏀 flies up out of his hands
  function shootBall(m) {
    if (m.ball) scene.remove(m.ball.s);
    const s = new T.Sprite(new T.SpriteMaterial({ map: emojiTex('🏀'), depthWrite: false }));
    s.scale.setScalar(0.7);
    m.g.updateMatrixWorld(true);
    People.handWorld(m.p, 1, s.position);
    scene.add(s);
    m.ball = { s, t: 0, vx: (Math.random() - 0.5) * 1.5, vy: 8 };
    SFX.five();
  }
  function updateBall(m, dt) {
    if (!m.ball) return;
    const b = m.ball;
    b.t += dt;
    b.vy -= 14 * dt;
    b.s.position.x += b.vx * dt;
    b.s.position.y += b.vy * dt;
    b.s.material.rotation += dt * 6;
    if (b.t > 1.2) { scene.remove(b.s); b.s.material.dispose(); m.ball = null; }
  }

  // ---------------------------------------------------------------- syncing the scene to the rules
  // standing beside his bike, facing the camera, doing his signature move (Teddy: boxing then a jump shot; Tommy: Y)
  function signature(m, dt, t) {
    const k = damp(10, dt);
    m.body.position.x += (0.2 - m.body.position.x) * k;
    m.body.position.y += (0 - m.body.position.y) * k;
    m.body.position.z += (1.25 - m.body.position.z) * k;
    m.p.root.rotation.y = V.YAW + Math.PI / 2;
    m.g.rotation.z += (0 - m.g.rotation.z) * k;
    const sig = m.entry.signature || ['wave'];
    const mode = sig[Math.floor(t / 1.8) % sig.length];
    if (mode === 'jumpshot') {
      const u = (t % 1.8) / 1.8;
      m.body.position.y = Math.max(0, Math.sin(u * Math.PI)) * 0.45;
      if (u > 0.35 && !m.shot) { m.shot = true; shootBall(m); }
      if (u < 0.2) m.shot = false;
    }
    People.pose(m.p, m.ph * 1.6, mode, damp(14, dt));
  }
  // his signature move while riding (the companion's hello): arms do the move, legs keep pedalling
  function rideSignature(m, dt, t) {
    const sig = m.entry.signature || ['wave'];
    const mode = t < 0.75 ? sig[0] : sig[sig.length - 1];
    People.pose(m.p, m.ph * 1.6, mode, damp(16, dt));
    const s = Math.sin(m.crank);
    m.p.legL.rotation.x = 0.35 + s * 0.35;
    m.p.legR.rotation.x = 0.35 - s * 0.35;
    m.p.hips.position.y = m.p.hipY;
    if (mode === 'jumpshot' && !m.shot && t > 0.8) { m.shot = true; shootBall(m); }
  }
  function spinWheels(m, v, dt) {
    m.wheel += (v * dt) / 0.36;
    m.crank += (v * dt) / 0.95;
    m.ph += dt * 6;
    for (const w of m.b.wheels) w.rotation.z = -m.wheel;
    m.b.crank.rotation.z = -m.crank;
  }
  function syncPlayer(M, dt) {
    const b = M.bike;
    const m = playerView(M);
    m.g.visible = m.shadow.visible = true;
    m.g.position.set(b.x, b.y, Z(b.s));
    m.shadow.position.set(b.x, 0.03, Z(b.s));
    spinWheels(m, b.v, dt);
    const rolls = Math.min(3, Math.ceil(M.papers / 5));
    m.b.rolls.forEach((r, k) => (r.visible = k < rolls));
    if (G.end && G.end.kind === 'end') {
      signature(m, dt, G.end.t);
    } else if (b.st === 'tumble') {
      // tipped over in a heap, stars over his head, then back up
      const u = Math.min(1, b.t / 0.22), up = b.t > TU.tumbleT - 0.35 ? (b.t - (TU.tumbleT - 0.35)) / 0.35 : 0;
      m.g.rotation.z = -m.fallSide * 1.35 * u * (1 - up);
      People.pose(m.p, m.ph, 'fall', damp(14, dt));
      if (Math.random() < dt * 8) starsAt(b.x, 1.4, b.s, 2);
    } else {
      m.g.rotation.z += (-b.lean * 0.22 - m.g.rotation.z) * damp(10, dt);
      A.ridePose(m, damp(16, dt), { throwSide: b.throwSide, throwT: b.throwT, five: M.buddy && M.buddy.st === 'five' && M.buddy.t > 0.4 && M.buddy.t < 1.2 });
    }
    m.g.visible = !(b.inv > 0 && Math.floor(G.time * 12) % 2);
    updateBall(m, dt);
  }
  function syncBuddy(M, dt) {
    const bd = M.buddy;
    const m = buddyView(M);
    updateBall(m, dt);
    if (!bd) { m.g.visible = m.shadow.visible = false; return; }
    m.g.visible = m.shadow.visible = true;
    m.g.position.set(bd.x, 0, Z(bd.s));
    m.shadow.position.set(bd.x, 0.03, Z(bd.s));
    spinWheels(m, M.bike.v, dt);
    m.g.rotation.z += (0 - m.g.rotation.z) * damp(8, dt);
    if (bd.st === 'in') rideSignature(m, dt, bd.t);
    else if (bd.st === 'five') A.ridePose(m, damp(16, dt), { five: bd.t > 0.4 && bd.t < 1.2 });
    else if (bd.st === 'bye') A.ridePose(m, damp(16, dt), { wave: true });
    else { m.shot = false; A.ridePose(m, damp(16, dt), { throwSide: bd.throwSide, throwT: bd.throwT }); }
    if (bd.st === 'bye' && bd.t > TU.buddy.bye - 0.15 && !m.puffed) { m.puffed = true; puffAt(bd.x, 1, bd.s, 10); }
    if (bd.st !== 'bye') m.puffed = false;
  }
  function syncObstacles(M, dt) {
    M.obs.forEach((o, i) => {
      let v = day.obs[i];
      if (!v || v.o !== o) { if (v) day.group.remove(v.g); v = day.obs[i] = obsView(o); } // the list was changed (the play check does)
      v.t += dt;
      switch (o.kind) {
        case 'sprinkler': {
          v.fan.visible = v.wet.visible = !!o.on;
          v.fan.material.opacity = 0.34 + Math.sin(v.t * 18) * 0.08;
          if (o.on && Math.abs(o.s - M.bike.s) < 30 && Math.random() < dt * 30) {
            const u = Math.random();
            fx.water.emit(o.side * (7.4 - u * 4), 0.2 + Math.sin(u * Math.PI) * 1.3, Z(o.s + (Math.random() - 0.5) * 1.8), { vy: -1, g: 6, life: 0.5, s0: 0.25, s1: 0.1, color: Math.random() < 0.5 ? '#9fe2ff' : '#ffffff' });
          }
          break;
        }
        case 'skate': {
          v.g.visible = o.st !== 'gone';
          v.g.position.set(o.x, 0, Z(o.s));
          if (o.st === 'roll') v.wheels.forEach((w) => (w.rotation.y += dt * 20));
          if (o.st === 'away') {
            v.away = (v.away || 0) + dt;
            v.g.position.y = Math.sin(Math.min(1, v.away) * Math.PI) * 2.2 + v.away * 1.5;
            v.g.rotation.z += dt * 12 * o.dir;
          }
          break;
        }
        case 'mower': {
          if (o.st === 'away') {
            v.away = (v.away || 0) + dt;
            v.g.position.y = v.away * v.away * 1.6;
            v.g.rotation.y += dt * 3;
            v.g.visible = v.away < 4;
            if (Math.random() < dt * 10) fx.puff.emit(o.x, v.g.position.y + 0.3, Z(o.s), { vy: -0.5, life: 0.8, s0: 0.4, s1: 1.2, color: '#e9ecef', alpha: 0.7 });
          } else {
            v.g.position.set(o.x, 0, Z(o.s));
            v.g.rotation.y = o.dir > 0 ? 0 : Math.PI;
            v.body.position.y = Math.abs(Math.sin(v.t * 14)) * 0.03;
          }
          break;
        }
        case 'puppy': {
          v.g.position.set(o.x, 0, Z(o.s));
          v.g.visible = true;
          const moving = o.st === 'run' || o.st === 'back' || o.st === 'happy';
          if (moving) v.g.rotation.y = -(o.face || 0);
          else v.g.rotation.y += (o.side * Math.PI / 2 - v.g.rotation.y) * damp(4, dt); // sits facing the street
          v.legs.forEach((l, k) => (l.rotation.x = moving ? Math.sin(v.t * 18 + (k % 3) * 2) * 0.7 : 0));
          v.tail.rotation.y = Math.sin(v.t * (o.st === 'happy' || o.st === 'done' ? 22 : 12)) * 0.6;
          v.body.rotation.x = moving ? 0 : -0.25;
          v.body.position.y = moving ? Math.abs(Math.sin(v.t * 18)) * 0.06 : 0;
          v.paper.visible = o.st === 'happy' || o.st === 'done';
          v.tongue.visible = o.st !== 'idle';
          if ((o.st === 'happy' || o.st === 'done') && Math.random() < dt * 2) heartsAt(o.x, 1.2, o.s, 1);
          break;
        }
        case 'car': {
          v.g.position.set(o.x, 0, Z(o.s));
          const backing = o.st === 'out';
          v.back.forEach((l) => l.material.color.set(backing && Math.floor(v.t * 6) % 2 ? '#ffffff' : '#ff6b6b'));
          break;
        }
      }
    });
    M.bundles.forEach((u, i) => {
      const v = day.bundles[i];
      v.g.visible = !u.got;
      v.g.rotation.y += dt * 1.2;
      v.ring.material.opacity = 0.55 + Math.sin(G.time * 6) * 0.3;
    });
    M.bins.forEach((c, i) => {
      const v = day.bins[i];
      if (!c.hit) return;
      v.t += dt;
      v.lid.position.y = (c.kind === 'can' ? 0.84 : 0.9) + Math.max(0, Math.sin(Math.min(1, v.t / 0.8) * Math.PI)) * 1.4;
      v.lid.rotation.x = Math.min(1, v.t / 0.8) * Math.PI * 2;
    });
    M.targets.forEach((tg, i) => {
      const v = day.targets[i];
      if (!tg.hit) return;
      v.t += dt;
      v.board.rotation.y = 0.35 * tg.side + (v.t < 1.2 ? v.t * 14 : 0);
    });
    for (const h of M.houses) {
      const s = day.markers[h.id];
      if (!s) continue;
      const u = s.userData;
      u.t += dt;
      if (h.got) {
        if (!u.done) { u.done = 1; s.material.map = badge('✅', '#8ce99a'); s.material.needsUpdate = true; }
        u.done += dt;
        s.visible = u.done < 1.6;
        s.position.y = u.y + (u.done - 1) * 1.2;
      } else {
        s.visible = !h.passed;
        s.position.y = u.y + Math.sin(u.t * 3) * 0.2;
      }
    }
  }
  function syncPapers(M, dt) {
    for (const p of M.flying) {
      let v = paperViews.get(p);
      if (!v) { v = { g: getPaper(), spin: (Math.random() < 0.5 ? -1 : 1) * 14 }; v.g.rotation.y = Math.random() * 3; paperViews.set(p, v); }
      v.g.position.set(p.x, p.y + 0.1, Z(p.s));
      v.g.rotation.x += dt * v.spin;
    }
    for (const [p, v] of paperViews) {
      if (M.flying.includes(p)) continue;
      paperViews.delete(p);
      if (p.result === 'ground' || p.result === 'mat') {
        v.g.position.set(p.x, 0.1, Z(p.s));
        v.g.rotation.set(0, Math.random() * 3, 0);
        landed.push({ g: v.g, t: 0 });
      } else releasePaper(v.g);
    }
    for (let k = landed.length - 1; k >= 0; k--) {
      landed[k].t += dt;
      if (landed[k].t > 6) { releasePaper(landed[k].g); landed.splice(k, 1); }
    }
  }
  function syncCelebrate(dt) {
    const c = G.celebrate;
    if (!c) return;
    c.t += dt;
    const m = rider('p:' + c.id, c.id);
    m.g.visible = m.shadow.visible = true;
    m.g.position.set(c.x, 0, Z(c.s));
    m.shadow.position.set(c.x, 0.03, Z(c.s));
    signature(m, dt, c.t);
    m.ph += dt * 6;
    updateBall(m, dt);
    if (c.confetti && Math.random() < dt * 5) confettiAt(c.x + (Math.random() - 0.5) * 8, 4 + Math.random() * 2, c.s + (Math.random() - 0.3) * 8, 16);
  }

  // ---------------------------------------------------------------- events
  const sfx = (name, ...a) => { if (!G.demo) SFX[name](...a); };
  const houseAt = (M, id) => M.houses[id];
  const CRASH = {
    sprinkler: ['SPLASH!', 'GOT SOAKED'], skate: ['WHOOPS!', 'SLIPPED ON A SKATEBOARD'], mower: ['BUMP!', 'BUMPED A ROBOT MOWER'],
    puppy: ['LICK LICK!', 'GOT LICKED BY A PUPPY'], car: ['BEEP! OOPS!', 'BUMPED A CAR'],
  };
  function handleEvents(M) {
    const b = M.bike;
    for (const e of M.events) {
      switch (e.type) {
        case 'go': hideBanner(); if (!G.demo && !G.tip && M.day === 0) { G.tip = true; toast(G.touch ? 'TAP THE PAPER BUTTONS TO THROW!' : 'THROW WITH Z (LEFT) AND X (RIGHT)!', 'good'); } break;
        case 'throw': sfx('throw'); break;
        case 'deliver': {
          const h = houseAt(M, e.h);
          const kind = e.kind === 'mailbox';
          const x = kind ? h.side * TU.mailbox.x : h.side * 10.3, s = kind ? h.s + TU.mailbox.ds : h.s + TU.mat.ds;
          word(kind ? 'IN THE MAILBOX!' : 'ON THE MAT!', x, 3.2, s, { size: 0.8, fill: '#ffd43b', stroke: '#2fc27a' });
          word('+' + e.pts, x, 4.4, s, { size: 0.6, fill: '#ffffff', stroke: '#2fc27a', life: 1.3 });
          confettiAt(x, 1.6, s, G.demo ? 8 : 24);
          sfx(kind ? 'mailbox' : 'mat');
          if (e.by === 'b') toast(`${nameOf(Kit.roster.buddyFor(M.hero))} DELIVERED ONE!`, 'buddy');
          break;
        }
        case 'nothanks': word('NO PAPER HERE!', e.x, 3, e.s, { size: 0.6, fill: '#ffffff', stroke: '#868e96' }); sfx('nothanks'); break;
        case 'already': word('GOT ONE ALREADY!', e.x, 3, e.s, { size: 0.6, fill: '#ffffff', stroke: '#868e96' }); sfx('nothanks'); break;
        case 'bonk': word('BONK!', e.x, e.y + 1, e.s, { size: 0.55, fill: '#ffffff', stroke: '#ff922b', life: 0.7 }); sfx('bonk'); break;
        case 'bin': word(e.kind === 'can' ? 'CLANG! +' + e.pts : 'BONK! +' + e.pts, e.x, 2.6, e.s, { size: 0.7, fill: '#ffd43b', stroke: '#4dabf7' }); confettiAt(e.x, 1.2, e.s, 18); sfx('bin'); break;
        case 'target': word('BULLSEYE! +' + e.pts, e.x, 3.4, e.s, { size: 0.8, fill: '#ffd43b', stroke: '#ff4b5c' }); confettiAt(e.x, 1.8, e.s, 26); starsAt(e.x, 1.8, e.s, 8); sfx('target'); break;
        case 'soak': {
          const o = M.obs[e.o];
          if (e.kind === 'puppy') { word('GOOD PUPPY!', e.x, 2.2, e.s, { size: 0.7, fill: '#ffffff', stroke: '#ff5d8f' }); heartsAt(e.x, 1, e.s, 8); sfx('yip'); }
          else if (e.kind === 'mower') { word('ACHOO!', e.x, 2.2, e.s, { size: 0.8, fill: '#ffffff', stroke: '#2fc27a' }); puffAt(e.x, 0.8, e.s, 14); sfx('sneeze'); }
          else { word('WHOOSH!', e.x, 2, e.s, { size: 0.7, fill: '#ffffff', stroke: '#4dabf7' }); starsAt(e.x, 0.6, e.s, 8); sfx('whoosh'); }
          word('+' + e.pts, e.x, 3.2, e.s, { size: 0.5, fill: '#ffd43b', stroke: '#2fc27a' });
          if (o) confettiAt(o.x, 0.8, o.s, 12);
          break;
        }
        case 'crash': {
          const [w, why] = CRASH[e.why] || ['OOPS!', 'TUMBLED'];
          const m = playerView(M);
          m.fallSide = b.x > 0 ? -1 : 1;
          word(w, b.x, 2.6, b.s, { size: 0.9, fill: '#ffffff', stroke: e.why === 'sprinkler' ? '#4dabf7' : '#ff5d8f' });
          if (e.why === 'sprinkler') splashAt(b.x, 1.2, b.s, 26);
          if (e.why === 'puppy') heartsAt(b.x, 1.4, b.s, 6);
          starsAt(b.x, 1.4, b.s, 10);
          G.shake = 0.25;
          if (!G.demo) {
            toast(`${nameOf(M.hero)} ${why}! HEE HEE!`, 'oops');
            $('hearts').classList.remove('hit');
            void $('hearts').offsetWidth;
            $('hearts').classList.add('hit');
          }
          sfx(e.why === 'sprinkler' ? 'splash' : 'crash');
          if (e.why === 'sprinkler') sfx('crash');
          break;
        }
        case 'back': starsAt(b.x, 1.2, b.s, 8); break;
        case 'over': G.end = { kind: 'over', t: 0 }; banner('OOPS!<small>out of lives</small>', '', 0); sfx('over'); break;
        case 'bundle': word(`+${e.n} PAPERS`, e.x, 2.4, e.s, { size: 0.7, fill: '#ffffff', stroke: '#ff922b' }); starsAt(e.x, 0.8, e.s, 8); sfx('bundle'); break;
        case 'empty': if (!G.demo) { toast('NO PAPERS LEFT! RIDE OVER A BUNDLE 📰', 'oops'); const c = $('papers'); c.classList.remove('hit'); void c.offsetWidth; c.classList.add('hit'); } sfx('empty'); break;
        case 'missed': { const h = houseAt(M, e.h); word('MISSED!', h.side * 8, 3, h.s, { size: 0.6, fill: '#ffffff', stroke: '#868e96', life: 1.4 }); sfx('missed'); break; }
        case 'park': if (!G.demo) { banner('BONUS PARK!<small>jump the ramps · hit the targets</small>', 'park', 2200); if (e.n > 0) toast(`+${e.n} BONUS PAPERS!`, 'good'); } sfx('park'); break;
        case 'jump': word('WHEEE! +' + e.pts, b.x, 3, b.s, { size: 0.8, fill: '#ffd43b', stroke: '#9b6bff' }); sfx('jump'); break;
        case 'land': puffAt(b.x, 0.2, b.s, 5); sfx('land'); break;
        case 'boing': word('BOING!', e.x, 2, e.s, { size: 0.7, fill: '#ffffff', stroke: '#f59f00' }); sfx('boing'); break;
        case 'woof': { const o = M.obs[e.o]; word('WOOF WOOF!', o.x, 2, o.s, { size: 0.6, fill: '#ffffff', stroke: '#ff922b' }); sfx('woof'); break; }
        case 'beep': { const o = M.obs[e.o]; word('BEEP BEEP!', o.x, 2.6, o.s, { size: 0.6, fill: '#ffffff', stroke: '#ff4b5c' }); sfx('beep'); break; }
        case 'honk': sfx('honk'); break;
        case 'skate': sfx('skate'); break;
        case 'end': {
          G.end = { kind: 'end', t: 0 };
          const last = M.day === 6;
          if (!G.demo) banner(`${DAYS[M.day]} DONE!<small>+${e.pts} for finishing</small>`, 'win', 0);
          confettiAt(b.x, 3, b.s, G.demo ? 20 : 80);
          sfx(last ? 'win' : 'dayDone');
          break;
        }
        case 'buddyIn': {
          const v = buddyView(M);
          v.shot = false;
          puffAt(M.buddy.x, 1, M.buddy.s, 8);
          confettiAt(M.buddy.x, 1.5, M.buddy.s, 22);
          toast(e.five ? `✋ ${nameOf(v.id)} RIDES BY!` : `${nameOf(v.id)} IS HERE!`, 'buddy');
          sfx('buddy');
          break;
        }
        case 'treat': {
          const v = buddyView(M);
          v.g.updateMatrixWorld(true);
          const [emoji, label] = tossTreat(People.handWorld(v.p, 1, new T.Vector3()), playerView(M));
          toast(`${emoji} ${label} FROM ${nameOf(v.id)}!`, 'good');
          sfx('treat');
          break;
        }
        case 'buddySays': toast(`${nameOf(buddyView(M).id)} SAYS: I'LL DO THE NEXT ${e.left} HOUSES!`, 'buddy'); break;
        case 'buddyMore': toast(`${nameOf(buddyView(M).id)} SAYS: ${e.left} MORE HOUSES!`, 'buddy'); break;
        case 'buddyBye': toast(`${nameOf(buddyView(M).id)} SAYS: BYE BYE!`, 'buddy'); break;
        case 'buddyOut': break;
        case 'highFive': {
          word('HIGH FIVE!', b.x, 3, b.s, { size: 0.9, fill: '#ffd43b', stroke: '#ff5d8f' });
          starsAt(b.x, 2, b.s, 10);
          toast(`✋ HIGH FIVE! +${e.papers} PAPERS`, 'good');
          for (const i of [0, 1]) { const el = $('pb' + i); el.classList.remove('five'); void el.offsetWidth; el.classList.add('five'); }
          sfx('five');
          break;
        }
        default:
      }
    }
  }

  // ---------------------------------------------------------------- camera
  function safeRect(w, h) {
    const play = G.screen === 'play' || G.screen === 'pause';
    const small = h < 460;
    const r = { l: 8, r: w - 8, t: play ? (small ? 58 : 92) : 10, b: h - 8 };
    const kb = document.getElementById('kit-help-btn'); // the kit's ? button, with A文 and the speaker under it
    const kr = kb && kb.getBoundingClientRect();
    if (kr && kr.width && w > h) r.l = Math.max(r.l, kr.right + 8);
    if (G.touch && play) {
      if (h > w) r.b = h - (small ? 150 : 190);
      else { r.l = Math.max(r.l, small ? 150 : 190); r.r = w - (small ? 150 : 190); }
    }
    return r;
  }
  function fit() {
    const w = innerWidth || 800, h = innerHeight || 600;
    renderer.setSize(w, h, false);
    G.fr = V.fit(camera, w, h, safeRect(w, h));
    G.fitKey = w + 'x' + h + G.screen + G.touch;
    follow();
  }
  function refit() { if (G.fitKey !== (innerWidth || 800) + 'x' + (innerHeight || 600) + G.screen + G.touch) fit(); }
  function follow() {
    if (!G.fr) return;
    V.follow(camera, G.fr, G.camS);
    if (G.shake > 0) camera.position.x += (Math.random() - 0.5) * G.shake * 0.6;
    const tz = camera.position.z - G.fr.base.z - V.AHEAD;
    sun.position.set(-14, 30, tz + 16);
    sun.target.position.set(0, 0, tz);
    sun.target.updateMatrixWorld();
  }
  // where a point of the street is on the screen (CSS pixels): the play check measures with this
  function toScreen(x, s, y = 0) { follow(); return V.toScreen(camera, G.fr, x, y, s); }
  // the same, with the camera where it was when the bike was at camS
  function toScreenAt(x, s, camS) { const k = G.camS; G.camS = camS; const p = toScreen(x, s); G.camS = k; follow(); return p; }

  // ---------------------------------------------------------------- HUD
  const cacheText = {};
  const setText = (el, key, v) => { if (cacheText[key] !== v) { cacheText[key] = v; el.textContent = v; } };
  function toast(text, cls) {
    if (G.demo) return;
    const box = $('toasts');
    while (box.children.length >= 3) box.firstChild.remove();
    const d = document.createElement('div');
    d.className = 'toast ' + (cls || '');
    d.textContent = text;
    box.appendChild(d);
    setTimeout(() => d.remove(), 2200);
  }
  function banner(html, cls, ms) {
    const b = $('banner');
    b.innerHTML = html;
    b.className = 'banner show ' + (cls || '');
    clearTimeout(banner.tm);
    if (ms) banner.tm = setTimeout(hideBanner, ms);
  }
  function hideBanner() { $('banner').className = 'banner'; }
  function setupHud(M) {
    const other = Kit.roster.buddyFor(M.hero);
    $('pb0').querySelector('img').src = thumbs[M.hero] || '';
    setText($('pb0').querySelector('.nm'), 'nm0', nameOf(M.hero));
    $('pb1').style.visibility = G.two ? 'visible' : 'hidden';
    $('pb1').querySelector('img').src = thumbs[other] || '';
    setText($('pb1').querySelector('.nm'), 'nm1', nameOf(other));
    $('budBtn').querySelector('img').src = thumbs[other] || '';
    setText($('budBtn').querySelector('small'), 'budnm', G.two ? 'HIGH FIVE' : nameOf(other));
    document.body.classList.toggle('two', G.two);
  }
  function updateHud(M) {
    setText($('dayChip'), 'day', DAYS[M.day]);
    setText($('papers'), 'papers', `📰 ${M.papers}`);
    const cust = M.houses.filter((h) => h.customer).length, got = M.houses.filter((h) => h.got).length;
    setText($('custChip'), 'cust', `🏠 ${got}/${cust}`);
    setText($('hearts'), 'hearts', '❤️'.repeat(Math.min(M.lives, 8)));
    setText($('score'), 'score', `SCORE ${M.score}`);
    setText($('hi'), 'hi', `HI-SCORE ${Math.max(saved.best[M.diff] || 0, M.score)}`);
    setText($('pb0').querySelector('.pts'), 'pts0', String(M.score));
    if (G.two) {
      const o = G.weeks[1 - G.turn];
      setText($('pb1').querySelector('.pts'), 'pts1', o.state === 'on' ? String(o.score) : `${o.score} ✓`);
    }
    $('papers').classList.toggle('low', M.papers <= 2);
    $('budBtn').classList.toggle('on', !!M.buddy);
  }

  // ---------------------------------------------------------------- screens
  const SCREENS = ['title', 'pause', 'day', 'results'];
  function show(name) {
    G.screen = name;
    for (const s of SCREENS) $(s).classList.toggle('hidden', s !== name);
    $('hud').classList.toggle('hidden', name !== 'play' && name !== 'pause');
    $('budBtn').classList.toggle('hidden', !(name === 'play' || name === 'pause'));
    $('touch').style.visibility = name === 'play' ? 'visible' : 'hidden';
    document.body.classList.toggle('two-on', G.two);
    fit();
  }
  function renderTitle() {
    document.querySelectorAll('#lv1 .lvl').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.level === G.diff)));
    document.querySelectorAll('.hero').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.hero === G.hero)));
    document.querySelectorAll('#lv2 .lv').forEach((b) => b.setAttribute('aria-checked', String(G.diffs[b.dataset.who] === b.dataset.level)));
    $('mode1').classList.toggle('focus', !G.two);
    $('mode2').classList.toggle('focus', G.two);
    $('mode1').classList.toggle('pulse', !G.two);
    $('mode2').classList.toggle('pulse', G.two);
    document.body.classList.toggle('two-on', G.two);
  }
  function setLogo() { $('logoMain').textContent = Kit.lang.is('zh') ? PR.ZH : PR.TITLE.toUpperCase(); }
  function titleScreen() {
    G.end = null;
    G.celebrate = null;
    hideBanner();
    renderTitle();
    show('title');
    startDemo();
    Kit.sound.music('title');
  }
  function startDemo() {
    G.demo = true;
    G.demoN++;
    const W = Week.create({ diff: 'easy', hero: G.hero, seed: 40 + (G.demoN % 5) });
    W.day = G.demoN % 4;
    G.W = W;
    G.M = Week.ride(W, { demo: true });
    resetRiders();
    ensureStreet(W);
    buildDay(G.M);
    G.M.state = 'ride';
    G.M.bike.v = TU.easy.cruise;
    G.camS = G.M.bike.s;
  }
  // the day's newspaper: who kept ordering, who stopped, who came back
  function dayScreen(sum, W, out) {
    const name = nameOf(W.hero);
    const dayName = DAYS[sum ? sum.day : W.day];
    let head;
    if (out) head = `${name} IS OUT OF LIVES!`;
    else if (sum.perfect) head = `PERFECT ${dayName}!`;
    else head = `${name} DELIVERS ${sum.kept.length} ${sum.kept.length === 1 ? 'PAPER' : 'PAPERS'}!`;
    $('paperDay').textContent = `${dayName} · THE DAILY TT`;
    $('headline').textContent = head;
    $('dayFace').src = thumbs[W.hero] || '';
    const rows = [];
    if (!out) {
      rows.push(`<div>📰 ${sum.kept.length} of ${sum.was.length} customers got a paper</div>`);
      if (sum.lost.length) rows.push(`<div class="sad">😢 ${sum.lost.length} stopped ordering</div>`);
      if (sum.comeback != null) rows.push(`<div class="new">⭐ A perfect day! One house ordered again</div>`);
      if (sum.fresh.length) rows.push(`<div class="new">🏡 ${sum.fresh.length} new neighbours ordered a paper</div>`);
    } else rows.push(`<div>${name} stops here this week.</div>`);
    rows.push(`<div><b>SCORE</b> ${W.score}</div>`);
    $('dayStats').innerHTML = rows.join('');
    // the street as little houses: left side on top, right side below, start on the left
    const street = W.street;
    const set = (ids) => new Set(ids || []);
    const kept = set(sum && sum.kept), lost = set(sum && sum.lost), fresh = set(sum && sum.fresh.concat(sum.comeback != null ? [sum.comeback] : []));
    const html = [];
    for (const side of [-1, 1]) {
      html.push('<div class="row">');
      for (const h of street.houses.filter((q) => q.side === side)) {
        const c = fresh.has(h.id) ? 'new' : kept.has(h.id) ? 'kept' : lost.has(h.id) ? 'lost' : W.customers.includes(h.id) ? 'kept' : 'none';
        const mark = { new: '★', kept: '✓', lost: '✗', none: '' }[c];
        html.push(`<span class="hs ${c}" style="--c:${h.color}">${mark}</span>`);
      }
      html.push('</div>');
    }
    $('mini').innerHTML = html.join('');
    let next;
    if (G.two) {
      const others = G.weeks.filter((w) => w.state === 'on');
      const o = G.weeks[1 - G.turn];
      next = o.state === 'on' ? `${nameOf(o.hero)}'S TURN ▶` : others.length ? `${DAYS[W.day]} ▶` : 'SEE WHO WON ▶';
    } else next = W.state === 'on' ? `${DAYS[W.day]} ▶` : 'SEE THE WEEK ▶';
    $('nextBtn').textContent = next;
    show('day');
    Kit.sound.music('over');
  }
  function results(kind) {
    G.resKind = kind;
    const W = G.weeks[0];
    let win = null, title, sub;
    if (kind === 'two') {
      const [a, b] = G.weeks;
      win = a.score === b.score ? null : a.score > b.score ? a : b;
      title = win ? `${nameOf(win.hero)} WINS!` : "IT'S A TIE!";
      sub = `${nameOf(a.hero)} ${a.score} · ${nameOf(b.hero)} ${b.score}`;
    } else if (kind === 'win') { win = W; title = 'WEEK DONE!'; sub = 'Every paper day, Monday to Sunday!'; }
    else if (kind === 'nocust') { title = 'NO MORE CUSTOMERS!'; sub = 'Everybody stopped ordering. Try again!'; }
    else { title = 'OOPS!'; sub = 'Out of lives. Keep going or try again!'; }
    $('resTitle').textContent = title;
    $('resSub').textContent = sub;
    const face = win ? win.hero : W.hero;
    $('resFace').src = thumbs[face] || '';
    const rows = [];
    for (const w of G.weeks) {
      const best = saved.best[w.diff] || 0;
      const isNew = w.score > best;
      if (isNew) saved.best[w.diff] = w.score;
      w.isNew = isNew;
      w.best = Math.max(best, w.score);
    }
    persist();
    for (const w of G.weeks) {
      const pre = G.two ? `<b>${nameOf(w.hero)}</b> ` : '';
      rows.push(`<div>${pre}<b>SCORE</b> ${w.score} · 🏠 ${w.customers.length} customers</div>`);
      rows.push(`<div><b>HI-SCORE</b> ${w.best}${w.isNew ? ' <span class="new">NEW!</span>' : ''}</div>`);
    }
    $('resStats').innerHTML = rows.join('');
    $('keepBtn').classList.toggle('hidden', kind !== 'over');
    $('againBtn').textContent = 'PLAY AGAIN';
    // the winner does his signature move at the finish line, with confetti
    G.celebrate = win ? { id: win.hero, x: 0, s: G.M ? G.M.end : 0, t: 0, confetti: true } : null;
    if (win) {
      for (const k in riders) riders[k].g.visible = riders[k].shadow.visible = false;
      const m = rider('p:' + win.hero, win.hero);
      m.body.position.set(-0.2, 0.3, 0);
      m.b.bike.visible = true;
      G.camS = G.celebrate.s - 6;
      confettiAt(0, 4, G.celebrate.s, 100);
      SFX.win();
    } else SFX.over();
    show('results');
    Kit.sound.music('over');
  }

  // ---------------------------------------------------------------- flow
  function startGame(two) {
    Kit.sound.init();
    G.two = !!two;
    saved.two = G.two;
    saved.diff = G.diff;
    saved.hero = G.hero;
    persist();
    const seed = 1 + Math.floor(Math.random() * 99999);
    G.weeks = G.two
      ? ['teddy', 'tommy'].map((id) => Week.create({ diff: G.diffs[id], hero: id, seed }))
      : [Week.create({ diff: G.diff, hero: G.hero, seed })];
    G.turn = 0;
    startRide();
  }
  function startRide() {
    G.demo = false;
    G.end = null;
    G.celebrate = null;
    G.paused = false;
    I.clear();
    const W = (G.W = G.weeks[G.turn]);
    G.M = Week.ride(W);
    resetRiders();
    ensureStreet(W);
    buildDay(G.M);
    G.camS = G.M.bike.s;
    setupHud(G.M);
    show('play');
    banner(`${DAYS[W.day]}<small>${G.two ? `${nameOf(W.hero)}'S TURN!` : 'READY!'}</small>`, '', 0);
    SFX.ready();
    Kit.sound.music('play');
  }
  function finishDay() {
    const W = G.W, M = G.M;
    if (G.end.kind === 'over') {
      Week.over(W, M);
      if (!G.two) return results('over');
      G.lastSum = null;
      return dayScreen(null, W, true);
    }
    const sum = Week.endDay(W, M);
    G.lastSum = sum;
    dayScreen(sum, W, false);
  }
  function nextFromDay() {
    if (G.two) {
      const on = G.weeks.map((w) => w.state === 'on');
      if (!on[0] && !on[1]) return results('two');
      let t = (G.turn + 1) % 2;
      if (!on[t]) t = G.turn;
      G.turn = t;
      return startRide();
    }
    const W = G.weeks[0];
    if (W.state === 'on') return startRide();
    results(W.state === 'done' ? 'win' : W.state === 'nocust' ? 'nocust' : 'over');
  }
  function keepGoing() { const W = G.weeks[0]; Week.keepGoing(W); startRide(); }
  function pause(on) {
    if (on && G.screen !== 'play') return;
    if (!on && G.screen !== 'pause') return;
    G.paused = on;
    I.clear();
    show(on ? 'pause' : 'play');
    Kit.sound.music(on ? 'pause' : 'play');
  }
  function toMenu() { I.clear(); titleScreen(); }
  function callBuddy() {
    if (!G.M || G.demo || G.screen !== 'play') return false;
    Kit.sound.init();
    const ok = Sim.callBuddy(G.M, G.two ? 'five' : 'help');
    handleEvents(G.M); // its news comes between frames: show it now
    G.M.events.length = 0;
    return ok;
  }

  // ---------------------------------------------------------------- loop
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (G.hold || G.screen === 'loading') return;
    tick(dt);
    draw();
  }
  function logic(dt) {
    const M = G.M;
    if (!M) return;
    if (G.screen === 'play') {
      const inp = I.read(dt);
      if (Sim.advance(M, dt, inp)) I.used();
      handleEvents(M);
      M.events.length = 0;
      if (G.end) {
        G.end.t += dt;
        if (G.end.t > (G.end.kind === 'end' ? 3.0 : 2.2)) finishDay();
      }
    } else if (G.screen === 'title' && G.demo) {
      Sim.advance(M, dt, PR.Bot.decide(M));
      handleEvents(M);
      M.events.length = 0;
      if (M.state !== 'ride' && M.state !== 'ready') startDemo();
    }
  }
  function tick(dt) {
    G.time += dt;
    logic(dt);
    const M = G.M;
    if (M && !G.celebrate) {
      G.camS = M.bike.s; // the fixed arcade camera rides along exactly, so the bike stays put on the screen
      syncPlayer(M, dt);
      syncBuddy(M, dt);
      syncObstacles(M, dt);
      syncPapers(M, dt);
      if (G.screen === 'play' || G.screen === 'pause') updateHud(M);
    }
    syncCelebrate(dt);
    if (street) street.view.cull(G.camS);
    updateTreats(dt);
    updateWords(dt);
    Object.values(fx).forEach((f) => f.update(dt));
    G.shake = Math.max(0, G.shake - dt);
  }
  function draw() {
    refit();
    follow();
    renderer.render(scene, camera);
  }

  // ---------------------------------------------------------------- input
  function setTouch(on) {
    if (G.touch === on) return;
    G.touch = on;
    document.body.classList.toggle('touch', on);
    fit();
  }
  function muteIcon() { document.querySelectorAll('.muteBtn').forEach((b) => (b.textContent = Kit.sound.isMuted() ? '🔇' : '🔊')); }
  function toggleMute() { Kit.sound.init(); Kit.sound.toggleMute(); muteIcon(); }
  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const code = e.code;
    if (code === 'KeyM') { if (!e.repeat) toggleMute(); return; }
    if (G.screen === 'play') {
      if (code === 'KeyP' || code === 'Escape') { e.preventDefault(); pause(true); return; }
      if (code === 'KeyT') { e.preventDefault(); if (!e.repeat) callBuddy(); return; }
      if (I.down(code, e.repeat)) e.preventDefault();
      return;
    }
    if (e.repeat) return;
    if (G.screen === 'pause') {
      e.preventDefault();
      if (code === 'KeyP' || code === 'Escape' || code === 'Space' || code === 'Enter') pause(false);
      else if (code === 'KeyQ') toMenu();
      return;
    }
    if (G.screen === 'title') {
      if (code === 'ArrowLeft' || code === 'ArrowRight') { G.two = code === 'ArrowRight'; renderTitle(); }
      else if (code === 'ArrowUp' || code === 'ArrowDown' || code === 'KeyW' || code === 'KeyS') { G.diff = G.diff === 'easy' ? 'normal' : 'easy'; saved.diff = G.diff; persist(); renderTitle(); }
      else if (code === 'KeyA' || code === 'KeyD') { G.hero = G.hero === 'teddy' ? 'tommy' : 'teddy'; saved.hero = G.hero; persist(); renderTitle(); }
      else if (code === 'Digit1') startGame(false);
      else if (code === 'Digit2') startGame(true);
      else if (code === 'Enter' || code === 'Space') startGame(G.two);
      else return;
      e.preventDefault();
      return;
    }
    if (G.screen === 'day') {
      if (code === 'Enter' || code === 'Space') { e.preventDefault(); nextFromDay(); }
      else if (code === 'Escape' || code === 'KeyQ') { e.preventDefault(); toMenu(); }
      return;
    }
    if (G.screen === 'results') {
      if (code === 'Enter' || code === 'Space') { e.preventDefault(); if (G.resKind === 'over') keepGoing(); else startGame(G.two); }
      else if (code === 'Escape' || code === 'KeyQ') { e.preventDefault(); toMenu(); }
    }
  }
  function wire() {
    addEventListener('keydown', onKey);
    addEventListener('keyup', (e) => I.up(e.code));
    addEventListener('blur', () => I.clear());
    addEventListener('resize', fit);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) return;
      I.clear();
      if (G.screen === 'play' && G.autoPause) pause(true);
    });
    addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') setTouch(true); Kit.sound.init(); }, true);
    $('mode1').addEventListener('click', () => startGame(false));
    $('mode2').addEventListener('click', () => startGame(true));
    document.querySelectorAll('#lv1 .lvl').forEach((b) => b.addEventListener('click', () => { G.diff = b.dataset.level; saved.diff = G.diff; persist(); renderTitle(); }));
    document.querySelectorAll('#lv2 .lv').forEach((b) => b.addEventListener('click', () => { G.diffs[b.dataset.who] = b.dataset.level; saved.diffs = G.diffs; persist(); renderTitle(); }));
    document.querySelectorAll('.hero').forEach((b) => b.addEventListener('click', () => { G.hero = b.dataset.hero; saved.hero = G.hero; persist(); renderTitle(); }));
    $('pauseBtn').addEventListener('click', () => pause(true));
    $('resumeBtn').addEventListener('click', () => pause(false));
    $('quitBtn').addEventListener('click', toMenu);
    $('nextBtn').addEventListener('click', nextFromDay);
    $('dayMenuBtn').addEventListener('click', toMenu);
    $('againBtn').addEventListener('click', () => startGame(G.two));
    $('keepBtn').addEventListener('click', keepGoing);
    $('menuBtn').addEventListener('click', toMenu);
    document.querySelectorAll('.muteBtn').forEach((b) => b.addEventListener('click', toggleMute));
    Kit.sound.onMute(muteIcon);
    const bud = $('budBtn');
    bud.addEventListener('pointerdown', (e) => { e.preventDefault(); bud.classList.add('down'); callBuddy(); });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) bud.addEventListener(ev, () => bud.classList.remove('down'));
    $('pb1').querySelector('.face').addEventListener('pointerdown', () => { if (G.two) callBuddy(); });
    // the touch pad: left and right steer, up is faster, down is slower
    const pad = $('pad');
    const setPad = (e) => {
      const r = pad.getBoundingClientRect();
      const R = r.width / 2;
      let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R);
      const d = Math.hypot(dx, dy);
      if (d > R * 0.55) { dx *= (R * 0.55) / d; dy *= (R * 0.55) / d; }
      I.pad.steer = dx > R * 0.16 ? 1 : dx < -R * 0.16 ? -1 : 0;
      I.pad.speed = dy < -R * 0.24 ? 1 : dy > R * 0.24 ? -1 : 0;
      pad.querySelector('.knob').style.transform = `translate(${dx}px, ${dy}px)`;
    };
    const padOff = () => { I.pad.steer = I.pad.speed = 0; pad.querySelector('.knob').style.transform = ''; };
    pad.addEventListener('pointerdown', (e) => { e.preventDefault(); try { pad.setPointerCapture(e.pointerId); } catch (er) { /* fine */ } setPad(e); });
    pad.addEventListener('pointermove', (e) => { if (!pad.hasPointerCapture || pad.hasPointerCapture(e.pointerId)) setPad(e); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) pad.addEventListener(ev, padOff);
    for (const [id, side] of [['thL', -1], ['thR', 1]]) {
      const btn = $(id);
      btn.addEventListener('pointerdown', (e) => { e.preventDefault(); btn.classList.add('down'); if (G.screen === 'play') I.press(side); });
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) btn.addEventListener(ev, () => btn.classList.remove('down'));
    }
    Kit.lang.onChange(() => { setLogo(); for (const k in wordTex) { wordTex[k].dispose(); delete wordTex[k]; } if (street) street.view.relabel(); });
  }

  function boot() {
    thumbs = Kit.portraits([Kit.roster.get('teddy'), Kit.roster.get('tommy')], { size: 160 });
    document.querySelectorAll('.hero').forEach((b) => (b.querySelector('img').src = thumbs[b.dataset.hero] || ''));
    document.querySelectorAll('#lv2 .who img').forEach((im) => (im.src = thumbs[im.dataset.who] || ''));
    $('tagline').textContent = PR.SUBTITLE;
    setLogo();
    wire();
    muteIcon();
    if (/[?&]touch=1/.test(location.search) || (window.matchMedia && matchMedia('(pointer: coarse)').matches)) setTouch(true);
    $('loading').remove();
    titleScreen();
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- test hooks (window.game)
  const STEP = 1 / 60;
  window.game = {
    // start playing straight away: game.start({ two, diff, hero, diffs, day, seed, skipReady })
    start(o = {}) {
      if (o.diff) G.diff = o.diff;
      if (o.hero) G.hero = o.hero;
      if (o.diffs) Object.assign(G.diffs, o.diffs);
      G.two = !!o.two;
      const seed = o.seed || 7;
      G.weeks = G.two ? ['teddy', 'tommy'].map((id) => Week.create({ diff: G.diffs[id], hero: id, seed })) : [Week.create({ diff: G.diff, hero: G.hero, seed })];
      for (const W of G.weeks) W.day = o.day || 0;
      G.turn = 0;
      startRide();
      if (o.skipReady) { G.M.state = 'ride'; G.M.stateT = 0; G.M.bike.v = G.M.D.cruise * G.M.up; hideBanner(); }
      return this.info();
    },
    // run the game for this many seconds (the same frame code as the real loop, keys included)
    step(secs = STEP, o = {}) {
      const dt = o.dt || STEP;
      const n = Math.max(1, Math.round(secs / dt));
      for (let k = 0; k < n; k++) tick(dt);
      if (o.draw !== false) draw();
      return this.info();
    },
    hold(on = true) { G.hold = on; last = performance.now(); },
    autoPause(on) { G.autoPause = on; },
    check: (o) => PR.Checks.all(o),
    prove: () => PR.Checks.prove(),
    get M() { return G.M; },
    get G() { return G; },
    screen: () => G.screen,
    toScreen,
    toScreenAt,
    menu: toMenu,
    pause,
    callBuddy,
    setTouch,
    fit,
    nextFromDay,
    keepGoing,
    results,
    // jump to the end of today's ride (the day's newspaper comes next)
    finishRide() { const M = G.M; M.bike.s = M.end - 0.5; M.state = 'ride'; return this.step(0.1); },
    info() {
      const M = G.M;
      return {
        screen: G.screen, two: G.two, turn: G.turn, demo: G.demo, lang: Kit.lang.get(),
        state: M && M.state, day: M && M.day, diff: M && M.diff, hero: M && M.hero, score: M && M.score, lives: M && M.lives, papers: M && M.papers,
        bike: M ? { x: +M.bike.x.toFixed(3), s: +M.bike.s.toFixed(3), v: +M.bike.v.toFixed(3), st: M.bike.st, inv: +M.bike.inv.toFixed(2) } : null,
        buddy: M && M.buddy ? { st: M.buddy.st, left: M.buddy.left } : null,
        weeks: G.weeks.map((w) => ({ hero: w.hero, diff: w.diff, day: w.day, state: w.state, score: w.score, customers: w.customers.length })),
      };
    },
  };
  boot();
})();
