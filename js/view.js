/* The fixed arcade camera, shared by the game (js/game.js) and the headless check (tools/check.js), so the check
   measures the same picture the kids see. It looks down at the street from behind and to the right, so the street
   runs up the screen at a slant: the rider's left (the houses he throws Z at) is on the left of the screen and his
   right (X) on the right, and → moves him right on the screen. It follows the bike along the street, never sideways.
   World: x = across (+ right), y = up, z = -s (the street runs toward -z). */
(function () {
  'use strict';
  const YAW = 0.42, PITCH = 0.92, FOV = 24;
  const AHEAD = 7; // the camera looks this far ahead of the bike
  // the stretch of street that must fit on the screen, around the bike: both rows of yards and some road ahead
  const BOX = { x0: -12.5, x1: 12.5, s0: -5, s1: 21 };

  function dir() {
    return { x: Math.sin(YAW) * Math.cos(PITCH), y: Math.sin(PITCH), z: Math.cos(YAW) * Math.cos(PITCH) };
  }
  // fit: work out how far away the camera sits and how the picture is shifted so BOX fills `rect`
  // (the part of the screen the HUD, the kit's buttons and the touch controls leave free). Returns a framing.
  function fit(cam, w, h, rect) {
    cam.fov = FOV;
    cam.aspect = w / h;
    cam.clearViewOffset();
    cam.near = 1;
    cam.far = 600;
    const d = dir();
    const tgt = new THREE.Vector3(0, 0, -AHEAD);
    const place = (D) => {
      cam.position.set(tgt.x + d.x * D, tgt.y + d.y * D, tgt.z + d.z * D);
      cam.lookAt(tgt);
      cam.updateMatrixWorld();
      cam.updateProjectionMatrix();
    };
    const measure = () => {
      const box = { l: 1e9, r: -1e9, t: 1e9, b: -1e9 };
      for (const x of [BOX.x0, BOX.x1]) for (const s of [BOX.s0, BOX.s1]) for (const y of [0, 2.5]) {
        const v = new THREE.Vector3(x, y, -s).project(cam);
        const px = ((v.x + 1) / 2) * w, py = ((1 - v.y) / 2) * h;
        box.l = Math.min(box.l, px); box.r = Math.max(box.r, px); box.t = Math.min(box.t, py); box.b = Math.max(box.b, py);
      }
      return box;
    };
    const rw = Math.max(40, rect.r - rect.l), rh = Math.max(40, rect.b - rect.t);
    let D = 80;
    for (let it = 0; it < 4; it++) {
      place(D);
      const b = measure();
      D *= Math.max((b.r - b.l) / rw, (b.b - b.t) / rh);
    }
    cam.near = Math.max(1, D - 90);
    cam.far = D + 160;
    place(D);
    const box = measure();
    // shift the picture so the box's middle sits in the middle of the free rect
    const cx = (box.l + box.r) / 2, cy = (box.t + box.b) / 2;
    const ox = cx - (rect.l + rect.r) / 2, oy = cy - (rect.t + rect.b) / 2;
    cam.setViewOffset(w, h, ox, oy, w, h);
    cam.updateProjectionMatrix();
    return { D, ox, oy, w, h, base: cam.position.clone() };
  }
  // follow the bike at distance s along the street
  function follow(cam, framing, s) {
    cam.position.set(framing.base.x, framing.base.y, framing.base.z - s);
    cam.updateMatrixWorld();
  }
  // where a point of the street is on the screen, in CSS pixels
  function toScreen(cam, framing, x, y, s) {
    const v = new THREE.Vector3(x, y, -s).project(cam);
    return { x: ((v.x + 1) / 2) * framing.w, y: ((1 - v.y) / 2) * framing.h };
  }
  PR.View = { YAW, PITCH, FOV, AHEAD, BOX, fit, follow, toScreen };
})();
