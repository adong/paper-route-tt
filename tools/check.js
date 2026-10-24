#!/usr/bin/env node
/* The headless check in node (no browser, no npm):
     node tools/check.js          every rule check in js/checks.js, then each one again with its rule broken on
                                  purpose (each of those must be caught). Exits 1 if anything fails.
     node tools/check.js --only=flight,week   just those checks (no proving)
   Loads the game's rule files and three.js (for the camera maths of the "sides" check) into a sandbox. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { console, Math, Date, JSON };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['kit/three.min.js', 'js/title.js', 'js/config.js', 'js/street.js', 'js/sim.js', 'js/bot.js', 'js/view.js', 'js/checks.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const C = ctx.PR.Checks;
const args = process.argv.slice(2);
const only = (args.find((a) => a.startsWith('--only=')) || '').split('=')[1];
let bad = 0;
const t0 = Date.now();

const all = C.all(only ? { only: only.split(',') } : {});
for (const [k, probs] of Object.entries(all.res)) {
  console.log(`${probs.length ? 'FAIL' : 'pass'}  ${k.padEnd(9)} ${String(probs.ms).padStart(6)} ms`);
  for (const p of probs.slice(0, 10)) console.log('        ' + p);
}
if (all.seen.flight) console.log(`\nflight: ${JSON.stringify(all.seen.flight)}`);
if (all.seen.week) console.log(`week: ${JSON.stringify(all.seen.week)}`);
if (all.rows) {
  console.log('passable (the autopilot rides every day):');
  for (const r of all.rows) console.log(`  ${r.diff.padEnd(6)} ${String(r.day + 1)}: ${r.state} in ${r.t}s, ${r.crashes} crashes, ${r.bumps} bumps, ${r.delivered} delivered`);
}
if (!all.ok) bad++;

if (!only) {
  const pr = C.prove();
  console.log(`\nprove: ${pr.rows.filter((r) => r.caught).length} of ${pr.rows.length} broken rules caught`);
  for (const r of pr.rows) console.log(`  ${r.caught ? 'caught' : 'MISSED'}  ${r.check.padEnd(9)} ${r.flag.padEnd(13)} ${r.want}${r.caught ? '  (' + r.why + ')' : ''}`);
  if (!pr.ok) bad++;
}
console.log(`\n${bad ? 'FAILED' : 'ALL PASS'} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(bad ? 1 : 0);
