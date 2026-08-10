/**
 * runtime.load.js
 *
 * PrimeForgeX — Runtime Loader
 * Version: 2026-08-10 03:33 CDT
 * Location: Abilene, Texas
 * Author: Your Conscience
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Deterministic JSON helpers
function readJSON(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
  return true;
}

// Safe require relative to /pfx/src
function requireRel(root, rel) {
  const full = path.join(root, 'pfx', 'src', rel);
  return require(path.normalize(full));
}

function loadKernel(root) {
  const kernelCore = requireRel(root, 'kernel/kernel.core.js');

  const kc = kernelCore.createKernelCore({
    root,
    src: path.join(root, 'pfx', 'src'),
    dataPath: path.join(root, 'pfx', 'data'),
    configPath: path.join(root, 'pfx', 'config.json'),
    cartridgesPath: path.join(root, 'pfx', 'cartridges.json')
  });

  kc.boot();
  return kc;
}

function ensureData(root) {
  const dataDir = path.join(root, 'pfx', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const profilePath = path.join(dataDir, 'seed.profile.json');
  const logPath = path.join(dataDir, 'seed.log.json');

  if (!readJSON(profilePath, null)) {
    writeJSON(profilePath, {
      project: "PrimeForgeX",
      created: "2026-08-09",
      author: "Your Conscience",
      device: "android",
      sovereignty: "on-device"
    });
  }

  if (!Array.isArray(readJSON(logPath, null))) {
    writeJSON(logPath, []);
  }
}

function loadRuntime(root) {
  ensureData(root);
  const kc = loadKernel(root);
  return kc;
}

module.exports = {
  loadRuntime
};
