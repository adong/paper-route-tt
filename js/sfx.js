/* TT Paper Route's own synth sounds, made with Kit.sound.tone and Kit.sound.hiss (no audio files). They are silent
   until the first tap or key (Kit.sound.init) and follow the one sound switch (M, the 🔊 button, the kit's speaker). */
(function () {
  'use strict';
  const S = () => Kit.sound;
  const notes = (list, o = {}) => list.forEach((f, k) => S().tone({ f, type: o.type || 'triangle', dur: o.dur || 0.14, vol: o.vol || 0.08, at: k * (o.gap || 0.1), lp: o.lp }));
  PR.Sfx = {
    throw() { S().hiss({ f: 1800, to: 600, filter: 'bandpass', q: 1.2, dur: 0.16, vol: 0.12 }); },
    mailbox() { S().tone({ f: 220, to: 160, type: 'square', lp: 900, dur: 0.08, vol: 0.12 }); notes([1046, 1318, 1568], { gap: 0.07, vol: 0.07, at: 0.06 }); },
    mat() { S().tone({ f: 160, to: 90, type: 'sine', dur: 0.14, vol: 0.18 }); notes([784, 988], { gap: 0.08, vol: 0.06 }); },
    bin() { S().tone({ f: 620, to: 540, type: 'square', lp: 2400, dur: 0.25, vol: 0.06 }); S().tone({ f: 930, to: 900, type: 'triangle', dur: 0.4, vol: 0.05 }); },
    target() { S().tone({ f: 300, to: 900, type: 'sine', dur: 0.18, vol: 0.12 }); notes([1318, 1568, 2093], { gap: 0.06, vol: 0.06 }); },
    nothanks() { S().tone({ f: 330, to: 300, type: 'triangle', dur: 0.18, vol: 0.06 }); },
    bonk() { S().tone({ f: 180, to: 120, type: 'square', lp: 700, dur: 0.1, vol: 0.12 }); },
    land() { S().tone({ f: 130, to: 80, type: 'sine', dur: 0.12, vol: 0.1 }); },
    crash() {
      S().tone({ f: 1200, to: 300, type: 'sine', dur: 0.5, vol: 0.09 }); // a slide whistle down
      S().tone({ f: 200, to: 600, type: 'sine', dur: 0.18, vol: 0.12, at: 0.5 });
      S().tone({ f: 600, to: 300, type: 'sine', dur: 0.15, vol: 0.08, at: 0.68 });
    },
    splash() { S().hiss({ f: 3500, to: 800, filter: 'bandpass', q: 0.7, dur: 0.45, vol: 0.2 }); },
    woof() { S().tone({ f: 380, to: 260, type: 'square', lp: 900, dur: 0.09, vol: 0.1 }); S().tone({ f: 420, to: 280, type: 'square', lp: 900, dur: 0.09, vol: 0.1, at: 0.15 }); },
    yip() { notes([880, 1175, 1397], { gap: 0.07, vol: 0.06, type: 'sine' }); },
    beep() { S().tone({ f: 660, type: 'square', lp: 1600, dur: 0.12, vol: 0.06 }); S().tone({ f: 660, type: 'square', lp: 1600, dur: 0.12, vol: 0.06, at: 0.2 }); },
    honk() { S().tone({ f: 330, type: 'sawtooth', lp: 1200, dur: 0.3, vol: 0.06 }); S().tone({ f: 415, type: 'sawtooth', lp: 1200, dur: 0.3, vol: 0.05 }); },
    skate() { for (let k = 0; k < 4; k++) S().hiss({ f: 500, to: 300, filter: 'lowpass', dur: 0.12, vol: 0.05, at: k * 0.12 }); },
    sneeze() { S().tone({ f: 400, to: 600, type: 'triangle', dur: 0.4, vol: 0.05 }); S().hiss({ f: 4200, to: 900, filter: 'bandpass', q: 0.7, dur: 0.35, vol: 0.2, at: 0.42 }); },
    whoosh() { S().hiss({ f: 600, to: 3000, filter: 'bandpass', q: 1, dur: 0.35, vol: 0.12 }); },
    bundle() { S().coin(2); },
    empty() { S().tone({ f: 300, to: 200, type: 'triangle', dur: 0.2, vol: 0.06 }); },
    missed() { S().tone({ f: 392, to: 330, type: 'sine', dur: 0.22, vol: 0.05 }); },
    jump() { S().tone({ f: 300, to: 1200, type: 'sine', dur: 0.4, vol: 0.09 }); },
    boing() { S().tone({ f: 150, to: 500, type: 'sine', dur: 0.15, vol: 0.12 }); S().tone({ f: 500, to: 200, type: 'sine', dur: 0.2, vol: 0.08, at: 0.14 }); },
    buddy() { S().powerup(); },
    treat() { S().coin(1); },
    five() { S().hiss({ f: 2600, to: 1200, filter: 'bandpass', q: 1.2, dur: 0.08, vol: 0.25 }); S().tone({ f: 880, to: 1320, type: 'triangle', dur: 0.18, vol: 0.08, at: 0.05 }); },
    ready() { S().tone({ f: 523, type: 'square', lp: 1600, dur: 0.12, vol: 0.06 }); S().tone({ f: 784, type: 'square', lp: 1600, dur: 0.18, vol: 0.06, at: 0.16 }); },
    park() { notes([523, 659, 784, 1046], { gap: 0.09, vol: 0.07 }); },
    dayDone() { notes([523, 659, 784, 1046, 784, 1046], { gap: 0.12, vol: 0.09 }); },
    win() { notes([523, 659, 784, 1046, 1318, 1046, 1318, 1568], { gap: 0.13, vol: 0.09 }); },
    over() { notes([659, 587, 523, 440], { gap: 0.2, vol: 0.07, dur: 0.22 }); },
    click() { S().click && S().click(); },
  };
})();
