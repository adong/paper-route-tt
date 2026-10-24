/* What things look like: a chunky toy street of boxes and wedges, built with Three.js (no image files; every pattern
   is drawn on a canvas). World: x across (+ right), y up, z = -s (the street runs toward -z).
   Sections: textures · the street (ground, houses, mailboxes, mats) · the day's things (obstacles, bundles, bins,
   the bonus park) · bikes and riders · papers · effects */
(function () {
  'use strict';
  const T = THREE, G = Kit.gfx, TU = PR.TUNE;
  const Z = (s) => -s;
  const mats = {};
  const M = (c, o) => { const k = c + (o ? JSON.stringify(o) : ''); return mats[k] || (mats[k] = G.std(c, Object.assign({ roughness: 0.8 }, o))); };
  const basic = (c, o) => new T.MeshBasicMaterial(Object.assign({ color: c }, o));
  function box(w, h, d, mat, x, y, z, parent, shadow = true) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = true;
    if (parent) parent.add(m);
    return m;
  }
  function cyl(rt, rb, h, seg, mat, x, y, z, parent, shadow = true) {
    const m = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg), mat);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = true;
    if (parent) parent.add(m);
    return m;
  }
  function flat(w, d, mat, x, y, z, parent) { // a flat patch on the ground (w across x, d along the street)
    const m = new T.Mesh(new T.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    if (parent) parent.add(m);
    return m;
  }

  // ---------------------------------------------------------------- textures
  function tex(w, h, draw, rx = 1, ry = 1) {
    const [c, g] = G.makeCanvas(w, h);
    draw(g, w, h);
    const t = G.toTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.set(rx, ry);
    t.anisotropy = 4;
    return t;
  }
  function speckle(g, w, h, cols, n, size) {
    for (let k = 0; k < n; k++) { g.fillStyle = cols[k % cols.length]; g.fillRect(Math.random() * w, Math.random() * h, size, size); }
  }
  // the road: 7.6 m across, one picture every 8 m of street, a dashed yellow middle line and white edges
  const roadTex = (len) => tex(256, 256, (g, w, h) => {
    g.fillStyle = '#6b6f86'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, ['#62667c', '#7a7e94', '#5e6276'], 500, 3);
    g.fillStyle = '#ffd43b'; g.fillRect(w / 2 - 5, 30, 10, 110);
    g.fillStyle = '#f4f4f8'; g.fillRect(6, 0, 6, h); g.fillRect(w - 12, 0, 6, h);
  }, 1, len / 8);
  const walkTex = (len) => tex(128, 128, (g, w, h) => {
    g.fillStyle = '#e4e2ea'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, ['#d8d6e0', '#eceaf2'], 120, 3);
    g.fillStyle = '#c7c4d2'; g.fillRect(0, 0, w, 4); g.fillRect(0, h / 2, w, 3);
  }, 1, len / 3.2);
  const lawnTex = (len, wide) => tex(128, 128, (g, w, h) => {
    g.fillStyle = '#86d96a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#7ccf60'; g.fillRect(0, 0, w, h / 2);
    speckle(g, w, h, ['#93e276', '#74c45a', '#a1ea83'], 260, 3);
  }, wide / 4, len / 4);
  const pathTex = (len) => tex(128, 128, (g, w, h) => {
    g.fillStyle = '#e3bf86'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, ['#d6ae74', '#eccb97', '#c89f66'], 300, 3);
  }, 2, len / 4);
  const stripeTex = (a, b, n = 6) => tex(64, 64, (g, w, h) => {
    for (let k = 0; k < n; k++) { g.fillStyle = k % 2 ? a : b; g.fillRect(0, (k * h) / n, w, h / n + 1); }
  });
  const hayTex = tex(64, 64, (g, w, h) => {
    g.fillStyle = '#f2c94c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d8a92e'; g.lineWidth = 2;
    for (let k = 0; k < 30; k++) { g.beginPath(); const x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); g.lineTo(x + 8 + Math.random() * 8, y + (Math.random() - 0.5) * 6); g.stroke(); }
    g.fillStyle = '#b5532b'; g.fillRect(w * 0.3, 0, 4, h); g.fillRect(w * 0.7, 0, 4, h);
  });
  const paperTex = tex(64, 64, (g, w, h) => {
    g.fillStyle = '#f6f3ea'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#9aa0b4';
    for (let y = 6; y < h; y += 7) g.fillRect(4, y, w - 8, 2);
    g.fillStyle = '#ff5d5d'; g.fillRect(w / 2 - 4, 0, 8, h);
  });
  function signTex(text, bg, fg, w = 512, h = 128, font = 64) {
    return tex(w, h, (g) => {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#14121f'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
      g.font = `${font}px ${G.FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineJoin = 'round'; g.lineWidth = 10; g.strokeStyle = '#14121f'; g.strokeText(text, w / 2, h / 2 + 4);
      g.fillStyle = fg; g.fillText(text, w / 2, h / 2 + 4);
    });
  }
  const bullseyeTex = tex(128, 128, (g, w) => {
    const cols = ['#ff4b5c', '#ffffff', '#ff4b5c', '#ffffff', '#ffd43b'];
    cols.forEach((c, k) => { g.fillStyle = c; g.beginPath(); g.arc(w / 2, w / 2, (w / 2 - 2) * (1 - k / 5), 0, Math.PI * 2); g.fill(); });
    g.strokeStyle = '#14121f'; g.lineWidth = 4; g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 3, 0, Math.PI * 2); g.stroke();
  });
  const checkerTex = tex(64, 64, (g, w, h) => {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? '#14121f' : '#ffffff'; g.fillRect((x * w) / 4, (y * h) / 4, w / 4, h / 4); }
  }, 6, 1);

  // ---------------------------------------------------------------- the street
  function grey(hex, k) { const a = new T.Color(hex), b = new T.Color('#c9c7d4'); return '#' + a.lerp(b, k).getHexString(); }
  function makeHouse(h) {
    const g = new T.Group();
    const side = h.side;
    const cx = side * (TU.house.front + TU.house.back) / 2; // house centre across
    const depth = TU.house.back - TU.house.front, len = TU.house.half * 2, wall = TU.house.wall;
    g.position.set(0, 0, Z(h.s));
    const body = M(h.color).clone();
    const bm = box(depth, wall, len, body, cx, wall / 2, 0, g);
    const roofM = M(h.roof);
    if (h.style === 1) { // flat roof with a band
      box(depth + 0.3, 0.35, len + 0.3, roofM, cx, wall + 0.17, 0, g);
      box(depth - 1.2, 0.5, len - 1.6, M('#f4f4f8'), cx, wall + 0.55, 0, g);
    } else { // gable roof along the street
      const sh = new T.Shape();
      sh.moveTo(-depth / 2 - 0.35, 0); sh.lineTo(depth / 2 + 0.35, 0); sh.lineTo(0, 1.7); sh.lineTo(-depth / 2 - 0.35, 0);
      const geo = new T.ExtrudeGeometry(sh, { depth: len + 0.5, bevelEnabled: false });
      geo.translate(0, 0, -(len + 0.5) / 2);
      const roof = new T.Mesh(geo, roofM);
      roof.position.set(cx, wall, 0);
      roof.castShadow = true;
      g.add(roof);
      box(0.5, 1.1, 0.5, M('#b0563a'), cx + side * 1, wall + 1.2, -1.2, g);
    }
    // the street-facing wall: door, windows, the house number
    const fx = side * TU.house.front;
    const doorZ = -TU.house.door;
    box(0.12, 1.55, 1.0, M('#7a4a2b'), fx - side * 0.04, 0.78, doorZ, g);
    box(0.14, 0.12, 0.12, M('#ffd43b', { metalness: 0.5 }), fx - side * 0.1, 0.8, doorZ + 0.32, g, false);
    if (h.style === 2) { // a little porch roof
      box(1.1, 0.12, 1.8, roofM, fx - side * 0.5, 1.85, doorZ, g);
      box(0.1, 1.8, 0.1, M('#ffffff'), fx - side * 1.0, 0.9, doorZ - 0.8, g);
      box(0.1, 1.8, 0.1, M('#ffffff'), fx - side * 1.0, 0.9, doorZ + 0.8, g);
    }
    const glass = M('#9fd8ff', { roughness: 0.2, metalness: 0.1 }), frame = M('#ffffff');
    for (const wz of [1.45, -2.0]) {
      box(0.08, 0.9, 1.0, frame, fx - side * 0.03, 1.45, wz, g, false);
      box(0.1, 0.72, 0.82, glass, fx - side * 0.05, 1.45, wz, g, false);
    }
    // a window on the end the camera sees
    box(1.0, 0.8, 0.08, frame, cx, 1.45, len / 2 + 0.02, g, false);
    box(0.84, 0.64, 0.1, glass, cx, 1.45, len / 2 + 0.03, g, false);
    // the walk to the door and the doormat
    flat(TU.house.front - TU.walk, 1.2, M('#e9e2d2'), side * (TU.walk + TU.house.front) / 2, 0.015, doorZ, g);
    const mat = box(1, 0.04, 1, M('#e0564f'), 0, 0.035, 0, g, false);
    const matTop = box(1, 0.01, 1, M('#ffd166'), 0, 0.06, 0, g, false);
    // the driveway beside the house
    flat(depth + TU.house.front - TU.walk, 2.4, M('#b9b6c6'), side * (TU.walk + TU.house.back) / 2, 0.012, Z(3.6), g);
    // flowers under the windows
    if (h.flowers) for (let k = 0; k < 5; k++) {
      const f = new T.Mesh(new T.SphereGeometry(0.16, 6, 5), M(['#ff6fa8', '#ffd43b', '#b197fc', '#ff8a3c'][k % 4]));
      f.position.set(fx - side * 0.35, 0.18, 1.0 + k * 0.28 - 0.3);
      g.add(f);
    }
    // a picket fence on the lot line
    if (h.fence) {
      box(TU.house.front - 7.6, 0.1, 0.08, M('#ffffff'), side * (7.6 + TU.house.front) / 2, 0.55, TU.lotLen / 2 - 0.2, g);
      for (let x = 7.8; x < TU.house.front; x += 0.45) box(0.14, 0.75, 0.08, M('#ffffff'), side * x, 0.38, TU.lotLen / 2 - 0.2, g);
    }
    // trees: one in the back yard, sometimes one by the fence
    const tree = (x, z, r) => {
      cyl(0.18, 0.24, 1.6, 6, M('#8a5a3b'), x, 0.8, z, g);
      const top = new T.Mesh(new T.IcosahedronGeometry(r, 0), M(['#4fbf5a', '#3fae6b', '#62c75a'][Math.floor(Math.abs(x * 7 + z)) % 3]));
      top.position.set(x, 1.6 + r * 0.8, z);
      top.castShadow = true;
      g.add(top);
    };
    tree(side * 18, -2.8, 1.5);
    if (h.tree) tree(side * 19.5, 2.4, 1.8);
    // the mailbox, by the curb before the house
    const mb = new T.Group();
    mb.position.set(side * TU.mailbox.x, 0, Z(TU.mailbox.ds));
    g.add(mb);
    box(0.13, 1.0, 0.13, M('#8a5a3b'), 0, 0.5, 0, mb);
    const mcol = ['#3d8bff', '#ff4b5c', '#2fc27a', '#ffb02e'][h.id % 4];
    const bx = box(0.42, 0.36, 0.7, M(mcol, { metalness: 0.3, roughness: 0.4 }), 0, 1.15, 0, mb);
    const top = cyl(0.21, 0.21, 0.7, 10, M(mcol, { metalness: 0.3, roughness: 0.4 }), 0, 1.33, 0, mb);
    top.rotation.x = Math.PI / 2;
    top.scale.x = 1; top.scale.z = 0.6;
    box(0.36, 0.3, 0.04, M('#14121f'), 0, 1.15, 0.36, mb, false); // the slot faces the rider coming up the street
    const flag = new T.Group();
    flag.position.set(-side * 0.24, 1.15, -0.1);
    mb.add(flag);
    box(0.04, 0.5, 0.06, M('#ff3d3d'), 0, 0.25, 0, flag, false);
    box(0.04, 0.16, 0.24, M('#ff3d3d'), 0, 0.42, -0.1, flag, false);
    return { g, h, body, bm, mat, matTop, mb, flag, bx, color: h.color };
  }
  // set a house up for the day: customer (bright, flag up) or not (faded, flag down), and the target sizes
  function dressHouse(v, customer, diff) {
    const D = TU[diff];
    v.body.color.set(customer ? v.color : grey(v.color, 0.7));
    v.flag.rotation.x = customer ? 0 : -Math.PI / 2;
    v.mb.scale.setScalar(diff === 'easy' ? 1.45 : 1.1);
    const h = v.h, side = h.side, pad = D.matPad;
    const x0 = TU.mat.x0 - pad, x1 = TU.mat.x1;
    const w = x1 - x0, d = 1.5 + 2 * pad;
    for (const m of [v.mat, v.matTop]) { m.scale.set(w, 1, d); m.position.x = side * (x0 + x1) / 2; m.position.z = Z(TU.mat.ds); }
    v.matTop.scale.set(w - 0.2, 1, d - 0.2);
    v.mat.visible = v.matTop.visible = customer;
  }

  function makeStreet(scene, street) {
    const g = new T.Group();
    scene.add(g);
    const len = street.end + 60, s0 = -30;
    const zc = Z(s0 + len / 2);
    const road = flat(TU.road * 2, len, new T.MeshStandardMaterial({ map: roadTex(len), roughness: 0.9 }), 0, 0, zc, g);
    road.material.map.repeat.set(1, len / 8);
    for (const side of [-1, 1]) {
      flat(TU.walk - TU.road, len, new T.MeshStandardMaterial({ map: walkTex(len), roughness: 0.9 }), side * (TU.road + TU.walk) / 2, 0.005, zc, g);
      box(0.18, 0.1, len, M('#c3c0cf'), side * (TU.road + 0.05), 0.04, zc, g, false);
      flat(60, len, new T.MeshStandardMaterial({ map: lawnTex(len, 60), roughness: 1 }), side * (TU.walk + 30), 0.002, zc, g);
    }
    // the park's dirt path over the street at the end
    const pl = street.end - street.parkS + 30;
    flat(TU.walk * 2, pl, new T.MeshStandardMaterial({ map: pathTex(pl), roughness: 1 }), 0, 0.02, Z(street.parkS - 2 + pl / 2), g);
    const houses = street.houses.map((h) => { const v = makeHouse(h); g.add(v.g); return v; });
    // the paper shop at the start, the park gate and the finish line
    const kiosk = new T.Group();
    kiosk.position.set(-8, 0, Z(-1));
    g.add(kiosk);
    box(3.2, 2.2, 2.4, M('#ff8fab'), 0, 1.1, 0, kiosk);
    box(3.6, 0.3, 2.8, M('#ff4b5c'), 0, 2.35, 0, kiosk);
    const shopSign = new T.Mesh(new T.PlaneGeometry(3.2, 0.8), new T.MeshBasicMaterial({ map: signTex('DAILY TT', '#ffd43b', '#ff4b5c'), transparent: true }));
    shopSign.position.set(1.62, 2.9, 0);
    shopSign.rotation.y = Math.PI / 2;
    kiosk.add(shopSign);
    for (let k = 0; k < 4; k++) box(0.6, 0.12, 0.45, M('#f6f3ea'), 1.4, 0.3 + k * 0.13, -0.6 + (k % 2) * 0.1, kiosk);
    const arch = (s, text, bg, fg) => {
      const a = new T.Group();
      a.position.z = Z(s);
      g.add(a);
      for (const side of [-1, 1]) cyl(0.25, 0.25, 4.2, 8, M('#ffffff'), side * (TU.walk + 0.5), 2.1, 0, a);
      const sign = new T.Mesh(new T.PlaneGeometry(TU.walk * 2 + 1.6, 1.4), new T.MeshBasicMaterial({ map: signTex(text, bg, fg, 768, 128, 72), transparent: true, side: T.DoubleSide }));
      sign.position.set(0, 4.3, 0);
      sign.rotation.x = -0.5;
      a.add(sign);
      return { a, sign };
    };
    const gate = arch(street.parkS - 1, 'BONUS PARK', '#3fd0ff', '#ffffff');
    const finish = arch(street.end, 'FINISH', '#ffd43b', '#ff4b5c');
    const line = flat(TU.walk * 2, 0.8, new T.MeshStandardMaterial({ map: checkerTex }), 0, 0.03, Z(street.end), g);
    line.material.map.repeat.set(8, 1);
    // low fences along the park
    for (const side of [-1, 1]) {
      box(0.1, 0.12, street.end - street.parkS, M('#b5532b'), side * 5.9, 0.6, Z((street.parkS + street.end) / 2), g);
      for (let s = street.parkS; s <= street.end; s += 2.5) box(0.16, 0.85, 0.16, M('#8a4524'), side * 5.9, 0.42, Z(s), g);
    }
    return {
      g, houses, gate, finish,
      dress(customers, diff) { const c = new Set(customers); houses.forEach((v) => dressHouse(v, c.has(v.h.id), diff)); },
      cull(s) { for (const v of houses) v.g.visible = v.h.s > s - 26 && v.h.s < s + 48; },
      relabel() {
        gate.sign.material.map = signTex(Kit.lang.t('BONUS PARK'), '#3fd0ff', '#ffffff', 768, 128, 72);
        finish.sign.material.map = signTex(Kit.lang.t('FINISH'), '#ffd43b', '#ff4b5c', 768, 128, 72);
        shopSign.material.map = signTex(Kit.lang.t('DAILY TT'), '#ffd43b', '#ff4b5c');
      },
      dispose() { scene.remove(g); },
    };
  }

  // ---------------------------------------------------------------- the day's things
  function makeSprinkler(o) {
    const g = new T.Group();
    g.position.set(o.side * 7.4, 0, Z(o.s));
    cyl(0.12, 0.16, 0.25, 8, M('#2f9e44'), 0, 0.12, 0, g);
    cyl(0.06, 0.06, 0.18, 6, M('#ffd43b'), 0, 0.3, 0, g);
    // the water: a bending fan across the sidewalk, and a wet patch under it
    const geo = new T.PlaneGeometry(4.2, 2.0, 12, 1);
    const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) { const u = (p.getX(k) + 2.1) / 4.2; p.setZ(k, Math.sin(u * Math.PI) * 1.3); }
    geo.computeVertexNormals();
    const fan = new T.Mesh(geo, new T.MeshBasicMaterial({ color: '#7fd4ff', transparent: true, opacity: 0.42, side: T.DoubleSide, depthWrite: false }));
    fan.rotation.x = -Math.PI / 2;
    fan.position.set(-o.side * 2.05, 0.15, 0);
    g.add(fan);
    const wet = flat(4.0, 2.0, new T.MeshBasicMaterial({ color: '#4dabf7', transparent: true, opacity: 0.25, depthWrite: false }), -o.side * 2.0, 0.03, 0, g);
    return { g, fan, wet };
  }
  function makeSkate() {
    const g = new T.Group();
    g.scale.setScalar(1.35);
    const deck = box(0.95, 0.07, 0.3, M(['#ff5d8f', '#4dabf7', '#ffd43b'][Math.floor(Math.random() * 3)]), 0, 0.16, 0, g);
    box(0.7, 0.01, 0.2, M('#14121f'), 0, 0.2, 0, g, false);
    const wheels = [];
    for (const x of [-0.32, 0.32]) for (const z of [-0.12, 0.12]) {
      const w = cyl(0.06, 0.06, 0.06, 8, M('#f4f4f8'), x, 0.07, z, g);
      w.rotation.x = Math.PI / 2;
      wheels.push(w);
    }
    return { g, deck, wheels };
  }
  function googly(parent, x, y, z, r = 0.09) {
    const e = new T.Mesh(new T.SphereGeometry(r, 10, 8), M('#ffffff'));
    e.position.set(x, y, z);
    parent.add(e);
    const p = new T.Mesh(new T.SphereGeometry(r * 0.5, 8, 6), M('#14121f'));
    p.position.set(0, -r * 0.2, -r * 0.7);
    e.add(p);
    return e;
  }
  function makeMower() {
    const g = new T.Group();
    const body = new T.Group();
    g.add(body);
    box(0.85, 0.36, 0.95, M('#ff922b'), 0, 0.3, 0, body);
    box(0.7, 0.2, 0.7, M('#ffd43b'), 0, 0.56, 0.05, body);
    box(0.9, 0.08, 1.0, M('#2f9e44'), 0, 0.12, 0, body);
    googly(body, -0.18, 0.5, -0.49);
    googly(body, 0.18, 0.5, -0.49);
    box(0.3, 0.05, 0.02, M('#14121f'), 0, 0.33, -0.49, body, false);
    cyl(0.02, 0.02, 0.45, 4, M('#14121f'), 0.2, 0.85, 0.2, body);
    const ball = new T.Mesh(new T.SphereGeometry(0.08, 8, 6), basic('#ff3d3d'));
    ball.position.set(0.2, 1.1, 0.2);
    body.add(ball);
    for (const x of [-0.42, 0.42]) for (const z of [-0.32, 0.32]) { const w = cyl(0.13, 0.13, 0.1, 10, M('#14121f'), x, 0.13, z, body); w.rotation.z = Math.PI / 2; }
    return { g, body };
  }
  function makePuppy() {
    const g = new T.Group();
    g.scale.setScalar(1.3);
    const body = new T.Group();
    g.add(body);
    const fur = M('#e9b872'), dark = M('#7a4a2b');
    box(0.38, 0.34, 0.72, fur, 0, 0.42, 0, body);
    const head = new T.Group();
    head.position.set(0, 0.72, -0.42);
    body.add(head);
    box(0.4, 0.36, 0.38, fur, 0, 0, 0, head);
    box(0.22, 0.16, 0.2, M('#f6dfb3'), 0, -0.08, -0.24, head);
    box(0.09, 0.07, 0.06, M('#14121f'), 0, -0.02, -0.35, head, false);
    box(0.06, 0.06, 0.03, M('#14121f'), -0.1, 0.07, -0.2, head, false);
    box(0.06, 0.06, 0.03, M('#14121f'), 0.1, 0.07, -0.2, head, false);
    const tongue = box(0.08, 0.02, 0.1, M('#ff6f91'), 0.03, -0.18, -0.3, head, false);
    for (const x of [-0.2, 0.2]) { const e = box(0.08, 0.26, 0.16, dark, x * 1.05, -0.02, 0.02, head); e.rotation.z = x > 0 ? -0.25 : 0.25; }
    const legs = [];
    for (const x of [-0.12, 0.12]) for (const z of [-0.24, 0.24]) {
      const l = new T.Group();
      l.position.set(x, 0.3, z);
      body.add(l);
      box(0.11, 0.3, 0.11, fur, 0, -0.15, 0, l);
      legs.push(l);
    }
    const tail = new T.Group();
    tail.position.set(0, 0.55, 0.36);
    body.add(tail);
    box(0.07, 0.07, 0.32, fur, 0, 0.08, 0.14, tail).rotation.x = 0.7;
    const paper = cyl(0.07, 0.07, 0.42, 8, new T.MeshStandardMaterial({ map: paperTex }), 0, -0.14, -0.38, head);
    paper.rotation.z = Math.PI / 2;
    paper.visible = false;
    return { g, body, head, legs, tail, tongue, paper };
  }
  function makeCar(side) {
    const g = new T.Group();
    const col = ['#ff4b5c', '#3d8bff', '#9b6bff', '#2fc27a', '#ffb02e'][Math.floor(Math.random() * 5)];
    // the car's nose points at the house: it backs out toward the street (its back is toward x = 0)
    const r = new T.Group();
    r.rotation.y = side > 0 ? 0 : Math.PI;
    g.add(r);
    box(3.4, 0.7, 1.7, M(col, { metalness: 0.3, roughness: 0.4 }), 0, 0.55, 0, r);
    box(1.9, 0.62, 1.5, M(col, { metalness: 0.3, roughness: 0.4 }), -0.15, 1.18, 0, r);
    box(1.7, 0.46, 1.54, M('#bfe6ff', { roughness: 0.1 }), -0.15, 1.2, 0, r, false);
    for (const x of [-1.1, 1.1]) for (const z of [-0.8, 0.8]) { const w = cyl(0.32, 0.32, 0.22, 12, M('#1b1a22'), x, 0.32, z, r); w.rotation.x = Math.PI / 2; }
    for (const z of [-0.55, 0.55]) { box(0.06, 0.18, 0.3, basic('#fff3b0'), 1.71, 0.65, z, r, false); }
    const back = [];
    for (const z of [-0.55, 0.55]) back.push(box(0.06, 0.18, 0.3, basic('#ff6b6b'), -1.71, 0.65, z, r, false));
    return { g, back };
  }
  function makeBundle() {
    const g = new T.Group();
    const pm = new T.MeshStandardMaterial({ map: paperTex });
    for (let k = 0; k < 3; k++) { const p = box(0.7, 0.14, 0.5, pm, 0, 0.1 + k * 0.15, 0, g); p.rotation.y = k * 0.25; }
    box(0.08, 0.5, 0.56, M('#ff3d3d'), 0, 0.28, 0, g, false);
    const ring = new T.Mesh(new T.RingGeometry(0.62, 0.8, 24), new T.MeshBasicMaterial({ color: '#ffd43b', transparent: true, opacity: 0.8, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    g.add(ring);
    return { g, ring };
  }
  function makeBin(kind) {
    const g = new T.Group();
    let lid;
    if (kind === 'can') {
      cyl(0.32, 0.27, 0.8, 12, M('#a9b0c2', { metalness: 0.5, roughness: 0.4 }), 0, 0.4, 0, g);
      lid = cyl(0.36, 0.36, 0.08, 12, M('#c9cfdc', { metalness: 0.5, roughness: 0.4 }), 0, 0.84, 0, g);
      cyl(0.05, 0.05, 0.08, 6, M('#8a93a8'), 0, 0.08, 0, lid);
    } else {
      box(0.55, 0.85, 0.6, M('#2fc27a'), 0, 0.43, 0, g);
      lid = box(0.6, 0.08, 0.65, M('#1f9d5e'), 0, 0.9, 0, g);
    }
    return { g, lid };
  }
  function makeRamp(r) {
    const g = new T.Group();
    const sh = new T.Shape();
    sh.moveTo(0, 0); sh.lineTo(r.len, 0); sh.lineTo(r.len, 0.6); sh.lineTo(0, 0);
    const geo = new T.ExtrudeGeometry(sh, { depth: r.w, bevelEnabled: false });
    geo.translate(0, 0, -r.w / 2);
    const m = new T.Mesh(geo, new T.MeshStandardMaterial({ map: stripeTex('#ffd43b', '#ff4b5c', 6), roughness: 0.6 }));
    m.rotation.y = Math.PI / 2; // the wedge rises toward -z (up the street)
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    g.position.set(r.x, 0, Z(r.s));
    return g;
  }
  function makeTarget(tg) {
    const g = new T.Group();
    g.position.set(tg.x, 0, Z(tg.s));
    for (const z of [-0.5, 0.5]) box(0.12, 1.5, 0.12, M('#8a4524'), 0, 0.75, z, g);
    const board = cyl(0.85, 0.85, 0.12, 24, [M('#ffffff'), new T.MeshBasicMaterial({ map: bullseyeTex }), new T.MeshBasicMaterial({ map: bullseyeTex })], 0, 1.75, 0, g);
    board.rotation.z = Math.PI / 2;
    board.rotation.y = 0.35 * tg.side;
    return { g, board };
  }
  function makeBale(h) {
    const g = new T.Group();
    g.position.set(h.x, 0, Z(h.s));
    box(h.hw * 2, 0.8, h.hl * 2, new T.MeshStandardMaterial({ map: hayTex, roughness: 1 }), 0, 0.4, 0, g);
    return g;
  }

  // ---------------------------------------------------------------- bikes and riders
  function rod(x1, y1, x2, y2, t, m, z, p) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const o = new T.Mesh(new T.BoxGeometry(len, t, t), m);
    o.position.set((x1 + x2) / 2, (y1 + y2) / 2, z || 0);
    o.rotation.z = Math.atan2(y2 - y1, x2 - x1);
    p.add(o);
    return o;
  }
  // a cruiser with a front basket full of papers, built along +x (the rider group turns it up the street)
  const WR = 0.36, AXR = -0.6, AXF = 0.62;
  function makeBike(color) {
    const bike = new T.Group();
    const fr = M(color, { metalness: 0.3, roughness: 0.4 }), blk = M('#1b1a22'), chrome = M('#e8ecf2', { metalness: 0.6, roughness: 0.3 });
    const wheels = [];
    for (const ax of [AXR, AXF]) {
      const w = new T.Group();
      w.position.set(ax, WR, 0);
      w.add(new T.Mesh(new T.TorusGeometry(WR - 0.05, 0.06, 6, 20), blk));
      w.add(new T.Mesh(new T.TorusGeometry(WR - 0.12, 0.02, 4, 18), chrome));
      for (let k = 0; k < 3; k++) { const s = new T.Mesh(new T.BoxGeometry(0.03, (WR - 0.1) * 2, 0.02), chrome); s.rotation.z = (k * Math.PI) / 3; w.add(s); }
      bike.add(w);
      wheels.push(w);
    }
    const BB = [-0.02, 0.33], S = [-0.26, 0.8], H = [0.44, 0.88];
    rod(S[0], S[1], H[0], H[1], 0.08, fr, 0, bike);
    rod(H[0], H[1], BB[0], BB[1], 0.08, fr, 0, bike);
    rod(BB[0], BB[1], S[0], S[1], 0.07, fr, 0, bike);
    for (const z of [-0.07, 0.07]) { rod(BB[0], BB[1], AXR, WR, 0.045, fr, z, bike); rod(S[0], S[1], AXR, WR, 0.04, fr, z, bike); rod(H[0], H[1], AXF, WR, 0.045, chrome, z, bike); }
    const seat = new T.Mesh(new T.BoxGeometry(0.34, 0.08, 0.2), blk); seat.position.set(-0.3, 0.92, 0); bike.add(seat);
    rod(H[0], H[1], 0.36, 1.1, 0.05, chrome, 0, bike);
    const cb = new T.Mesh(new T.BoxGeometry(0.04, 0.04, 0.7), chrome); cb.position.set(0.36, 1.1, 0); bike.add(cb);
    // the front basket with papers sticking out
    const basket = new T.Group();
    basket.position.set(0.68, 0.98, 0);
    bike.add(basket);
    box(0.36, 0.26, 0.44, M('#c98a4b'), 0, 0, 0, basket, false);
    const pm = new T.MeshStandardMaterial({ map: paperTex });
    const rolls = [];
    for (let k = 0; k < 3; k++) { const r = cyl(0.07, 0.07, 0.4, 8, pm, -0.06 + k * 0.06, 0.18, -0.1 + k * 0.1, basket, false); r.rotation.x = Math.PI / 2; rolls.push(r); }
    // a paper bag on the back rack
    box(0.4, 0.06, 0.3, chrome, AXR, 0.86, 0, bike, false);
    const bag = box(0.42, 0.34, 0.5, M('#ffd43b'), AXR, 1.06, 0, bike, false);
    const crank = new T.Group(); crank.position.set(BB[0], BB[1], 0); bike.add(crank);
    for (const s of [-1, 1]) {
      const arm = new T.Mesh(new T.BoxGeometry(0.04, 0.2, 0.03), chrome); arm.position.set(0, s * 0.1, s * 0.13); crank.add(arm);
      const ped = new T.Mesh(new T.BoxGeometry(0.14, 0.03, 0.12), blk); ped.position.set(0, s * 0.2, s * 0.2); crank.add(ped);
    }
    bike.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return { bike, wheels, crank, rolls, bag };
  }
  const FRAMES = { teddy: '#e8382f', tommy: '#ff8a1f' };
  function makeRider(scene, id, o = {}) {
    const entry = Kit.roster.get(id);
    const g = new T.Group();      // at the bike's place; leans when steering
    const head = new T.Group();   // turned to ride up the street (the bike is built along +x)
    head.rotation.y = Math.PI / 2;
    g.add(head);
    const b = makeBike(FRAMES[id] || '#18d4ff');
    head.add(b.bike);
    const p = Kit.people.build(Object.assign({}, entry.look, { peace: true }));
    const body = new T.Group();
    body.position.set(-0.2, 0.3, 0);
    head.add(body);
    p.root.rotation.y = -Math.PI / 2;
    p.root.scale.setScalar(0.7);
    p.root.traverse((q) => { if (q.isMesh) q.castShadow = true; });
    body.add(p.root);
    const shadow = new T.Mesh(new T.CircleGeometry(0.9, 16), new T.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.2, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(0.5, 1.1, 1);
    let tag = null;
    if (o.tag) {
      tag = G.nameTag(entry.name, entry.tag || '#ffffff');
      tag.position.set(0, 2.5, 0);
      tag.scale.multiplyScalar(0.7);
      g.add(tag);
    }
    const sc = (o.scale || 1) * 1.35; // a bit bigger than life, so he reads well from the arcade camera
    g.scale.setScalar(sc);
    shadow.scale.multiplyScalar(sc);
    scene.add(g);
    scene.add(shadow);
    return { id, entry, g, head, body, p, b, shadow, tag, sc, ph: 0, crank: 0, wheel: 0, ball: null };
  }
  // riding: seated, hands on the bars, pedalling; e: { throwSide, throwT, mode, ph }
  function ridePose(m, k, e = {}) {
    const p = m.p;
    const to = (o, prop, v) => { o[prop] += (v - o[prop]) * k; };
    const s = Math.sin(m.crank);
    to(p.hips.rotation, 'x', -0.3);
    to(p.hips.rotation, 'y', 0);
    to(p.legL.rotation, 'x', 1.05 + s * 0.4);
    to(p.legR.rotation, 'x', 1.05 - s * 0.4);
    to(p.legL.rotation, 'z', 0);
    to(p.legR.rotation, 'z', 0);
    let la = 1.25, ra = 1.25, laz = 0, raz = 0;
    if (e.throwT != null && e.throwT < 0.35) {
      // the throwing arm swings out to that side
      const u = Math.sin(Math.min(1, e.throwT / 0.35) * Math.PI);
      if (e.throwSide < 0) { la = 1.25 + u * 0.3; laz = -u * 1.5; } else { ra = 1.25 + u * 0.3; raz = u * 1.5; }
    }
    if (e.wave) { ra = 2.9; raz = 0.35 + Math.sin(m.ph * 2.5) * 0.35; }
    if (e.five) { ra = 2.7; raz = 0.5; }
    to(p.armL.rotation, 'x', la);
    to(p.armR.rotation, 'x', ra);
    to(p.armL.rotation, 'z', laz);
    to(p.armR.rotation, 'z', raz);
    to(p.head.rotation, 'x', 0.1);
    p.hips.position.y = p.hipY;
    if (p.fingers) for (const f of p.fingers) f.visible = false;
    p.rig.scale.setScalar(1);
  }

  // ---------------------------------------------------------------- papers and effects
  function makePaper() {
    const g = new T.Group();
    const r = cyl(0.1, 0.1, 0.46, 8, new T.MeshStandardMaterial({ map: paperTex }), 0, 0, 0, g);
    r.rotation.z = Math.PI / 2;
    const band = cyl(0.105, 0.105, 0.06, 8, M('#ff3d3d'), 0, 0, 0, g, false);
    band.rotation.z = Math.PI / 2;
    return g;
  }
  function wordTexture(text, fill, stroke) {
    const [c, g] = G.makeCanvas(512, 160);
    let size = 64;
    g.font = `${size}px ${G.FONT}`;
    while (g.measureText(text).width > 480 && size > 30) { size -= 4; g.font = `${size}px ${G.FONT}`; }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 16;
    g.strokeStyle = '#14121f';
    g.strokeText(text, 256, 84);
    g.fillStyle = stroke || '#ff3d7f';
    g.fillText(text, 256, 90);
    g.fillStyle = fill || '#ffffff';
    g.fillText(text, 256, 84);
    return G.toTexture(c);
  }
  function makeParticles(scene, texture, max, blending) {
    const pool = [];
    for (let k = 0; k < max; k++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, blending: blending || T.NormalBlending }));
      s.visible = false;
      scene.add(s);
      pool.push({ s, life: 0, t: 0, vx: 0, vy: 0, vz: 0, g: 0, s0: 1, s1: 1, spin: 0 });
    }
    let next = 0;
    return {
      emit(x, y, z, o = {}) {
        const p = pool[next];
        next = (next + 1) % max;
        p.s.visible = true;
        p.s.position.set(x, y, z);
        p.t = 0;
        p.life = o.life || 0.8;
        p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0;
        p.g = o.g != null ? o.g : 0;
        p.s0 = o.s0 != null ? o.s0 : 0.5;
        p.s1 = o.s1 != null ? o.s1 : 0.1;
        p.drag = o.drag || 0;
        p.s.material.color.set(o.color || '#ffffff');
        p.s.material.rotation = Math.random() * 6;
        p.spin = o.spin || 0;
        p.alpha = o.alpha != null ? o.alpha : 1;
        return p;
      },
      burst(x, y, z, n, o = {}) {
        for (let k = 0; k < n; k++) {
          const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI * 2, sp = (o.speed || 3) * (0.4 + Math.random() * 0.8);
          this.emit(x, y, z, Object.assign({}, o, {
            vx: Math.cos(a) * sp, vy: Math.abs(Math.sin(b)) * sp * 0.6 + (o.up || 0), vz: Math.sin(a) * sp,
            color: o.colors ? o.colors[k % o.colors.length] : o.color,
          }));
        }
      },
      update(dt) {
        for (const p of pool) {
          if (!p.s.visible) continue;
          p.t += dt;
          if (p.t >= p.life) { p.s.visible = false; continue; }
          const u = p.t / p.life;
          p.vy -= p.g * dt;
          const d = Math.exp(-p.drag * dt);
          p.vx *= d; p.vy *= d; p.vz *= d;
          p.s.position.x += p.vx * dt;
          p.s.position.y += p.vy * dt;
          p.s.position.z += p.vz * dt;
          p.s.scale.setScalar(p.s0 + (p.s1 - p.s0) * u);
          p.s.material.rotation += p.spin * dt;
          p.s.material.opacity = p.alpha * (u > 0.7 ? (1 - u) / 0.3 : 1);
        }
      },
      clear() { for (const p of pool) p.s.visible = false; },
    };
  }
  // the badge over a mailbox that wants a paper today: a yellow circle with a newspaper
  function badgeTexture(emoji, bg) {
    const [c, g] = G.makeCanvas(128, 128);
    g.fillStyle = bg || '#ffd43b';
    g.strokeStyle = '#14121f';
    g.lineWidth = 8;
    g.beginPath(); g.arc(64, 60, 50, 0, Math.PI * 2); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(50, 104); g.lineTo(64, 124); g.lineTo(78, 104); g.closePath(); g.fillStyle = bg || '#ffd43b'; g.fill(); g.stroke();
    g.fillStyle = bg || '#ffd43b'; g.fillRect(48, 96, 32, 10);
    g.font = `60px ${G.EMOJI_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(emoji, 64, 64);
    return G.toTexture(c);
  }
  function squareTexture() { const [c, g] = G.makeCanvas(32, 32); g.fillStyle = '#fff'; g.fillRect(4, 4, 24, 24); return G.toTexture(c); }
  function starTexture() {
    const [c, g] = G.makeCanvas(64, 64);
    g.fillStyle = '#fff';
    g.beginPath();
    for (let k = 0; k < 10; k++) { const r = k % 2 ? 12 : 30, a = (k / 10) * Math.PI * 2 - Math.PI / 2; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
    g.fill();
    return G.toTexture(c);
  }
  function heartTexture() {
    const [c, g] = G.makeCanvas(64, 64);
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(32, 56); g.bezierCurveTo(4, 36, 6, 8, 32, 20); g.bezierCurveTo(58, 8, 60, 36, 32, 56);
    g.fill();
    return G.toTexture(c);
  }

  PR.Art = {
    Z, makeStreet, dressHouse, makeSprinkler, makeSkate, makeMower, makePuppy, makeCar, makeBundle, makeBin, makeRamp, makeTarget, makeBale,
    makeRider, ridePose, makePaper, wordTexture, badgeTexture, makeParticles, squareTexture, starTexture, heartTexture, box, cyl, M,
  };
})();
