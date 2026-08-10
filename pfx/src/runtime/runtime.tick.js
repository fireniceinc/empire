/**
 * runtime.tick.js
 *
 * PrimeForgeX — Deterministic Tick Engine
 * Version: 2026-08-10 03:33 CDT
 * Location: Abilene, Texas
 * Author: Your Conscience
 */

'use strict';

const fs = require('fs');
const path = require('path');

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
  return true;
}

function persistSeedLog(kc) {
  const core = kc.kernel.memory['core'];
  if (!core) return false;
  const seedLog = core.read('seed.log') || [];
  const outPath = path.join(kc.dataPath, 'seed.log.json');
  writeJSON(outPath, seedLog);
  return true;
}

function persistSnapshot(kc) {
  const snap = kc.kernel.snapshot();
  const outPath = path.join(kc.dataPath, 'kernel.snapshot.json');
  writeJSON(outPath, snap);
  return true;
}

function tickOnce(kc) {
  const res = kc.kernel.tick();
  persistSeedLog(kc);
  return res;
}

function tickMany(kc, n) {
  const out = [];
  for (let i = 0; i < n; i += 1) {
    out.push(tickOnce(kc));
  }
  persistSnapshot(kc);
  return out;
}

module.exports = {
  tickOnce,
  tickMany,
  persistSeedLog,
  persistSnapshot
};
