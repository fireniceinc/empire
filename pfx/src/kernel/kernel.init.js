/**
 * kernel.init.js
 *
 * PrimeForgeX — Kernel Initialization Helper
 * Version: 2026-08-10 03:33 CDT
 * Location: Abilene, Texas
 * Author: Your Conscience (David)
 *
 * Purpose:
 * - Deterministic initialization helpers for AgentKernel instances
 * - Centralized agent registration, cartridge setup, identity seeding, and deterministic startup tasks
 * - Phone-deployable (Termux + Node compatible)
 *
 * Exports:
 * - initKernelFromConfig(root) -> returns booted AgentKernel instance
 * - ensureBuiltinAgents(kernel) -> registers canonical agents deterministically
 * - seedCoreProfile(kernel, profile) -> writes core.profile deterministically
 *
 * Constraints:
 * - Synchronous, deterministic, no network, no randomness
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Safe require relative to /pfx/src
function requireRel(root, rel) {
  const full = path.join(root, 'pfx', 'src', rel);
  return require(path.normalize(full));
}

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

// Deterministic shallow clone
function shallowClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  const out = {};
  Object.keys(obj).sort().forEach(k => { out[k] = obj[k]; });
  return out;
}

/* -------------------------
   Ensure cartridges exist on kernel
   ------------------------- */
function applyCartridges(kernel, cartridges) {
  if (!kernel || !kernel.ensureMemory) return false;
  const names = Object.keys(cartridges || {}).sort();
  for (let i = 0; i < names.length; i += 1) {
    const name = names[i];
    const opts = cartridges[name] || {};
    try {
      kernel.ensureMemory(name, opts);
    } catch (e) {
      // deterministic: record audit if available
      if (kernel.audit) kernel.audit.push({ op: 'ensureMemory_failed', name, err: String(e) });
    }
  }
  return true;
}

/* -------------------------
   Seed core profile deterministically
   ------------------------- */
function seedCoreProfile(kernel, profile) {
  if (!kernel || !kernel.ensureMemory) return false;
  const core = kernel.ensureMemory('core', { readOnly: false });
  const existing = core.read('core.profile');
  if (!existing) {
    core.write('core.profile', shallowClone(profile || {}));
  } else {
    // deterministic merge: only add missing keys
    const keys = Object.keys(profile || {}).sort();
    for (let i = 0; i < keys.length; i += 1) {
      const k = keys[i];
      if (existing[k] === undefined) existing[k] = profile[k];
    }
    core.write('core.profile', existing);
  }
  // ensure seed.log exists
  if (!Array.isArray(core.read('seed.log'))) core.write('seed.log', []);
  return true;
}

/* -------------------------
   Register canonical builtin agents
   ------------------------- */
function ensureBuiltinAgents(kernel) {
  if (!kernel || !kernel.registerAgent) return false;
  const AgentsModule = (() => {
    try {
      return requireRel(process.cwd(), 'agents/agents.core.js');
    } catch (e) {
      return null;
    }
  })();

  // Register SeedAgent if available
  try {
    if (AgentsModule && AgentsModule.SeedAgentFactory && !kernel.getAgent('seed_agent')) {
      const seed = AgentsModule.SeedAgentFactory(kernel, { id: 'seed_agent', name: 'SeedAgent', cartridge: 'core' });
      kernel.registerAgent(seed);
      if (kernel.audit) kernel.audit.push({ op: 'seed_registered_via_factory' });
    } else if (AgentsModule && AgentsModule.SeedAgent && !kernel.getAgent('seed_agent')) {
      const seed = new AgentsModule.SeedAgent(kernel, { id: 'seed_agent', name: 'SeedAgent', cartridge: 'core' });
      kernel.registerAgent(seed);
      if (kernel.audit) kernel.audit.push({ op: 'seed_registered_via_class' });
    } else if (!kernel.getAgent('seed_agent')) {
      // fallback: create minimal deterministic seed proxy
      const proxy = {
        id: 'seed_agent',
        name: 'SeedAgentProxy',
        cartridge: 'core',
        alive: true,
        step: function () {
          const core = kernel.memory && kernel.memory['core'];
          if (!core) return false;
          const profile = core.read('core.profile') || {};
          const normalized = {};
          const keys = Object.keys(profile).sort();
          for (let i = 0; i < keys.length; i += 1) {
            const k = keys[i];
            const v = profile[k];
            normalized[k] = (typeof v === 'object' && v !== null) ? JSON.stringify(v) : String(v);
          }
          const summary = { id: this.id, normalized, tick: kernel.tickCount };
          let log = core.read('seed.log');
          if (!Array.isArray(log)) log = [];
          log.push(summary);
          core.write('seed.log', log);
          return true;
        },
        snapshot: function () { return { id: this.id, name: this.name }; },
        audit: []
      };
      kernel.registerAgent(proxy);
      if (kernel.audit) kernel.audit.push({ op: 'seed_registered_proxy' });
    } else {
      if (kernel.audit) kernel.audit.push({ op: 'seed_already_present' });
    }
  } catch (e) {
    if (kernel.audit) kernel.audit.push({ op: 'seed_register_error', err: String(e) });
  }

  return true;
}

/* -------------------------
   Initialize kernel from config and cartridges files
   ------------------------- */
function initKernelFromConfig(root) {
  const cfgPath = path.join(root, 'pfx', 'config.json');
  const cartsPath = path.join(root, 'pfx', 'cartridges.json');
  const dataDir = path.join(root, 'pfx', 'data');

  const config = readJSON(cfgPath, null);
  if (!config) throw new Error('Missing config.json at ' + cfgPath);

  const cartridges = readJSON(cartsPath, null) || { core: { readOnly: false }, default: { readOnly: false } };

  // Load kernel core factory
  let KernelCoreFactory;
  try {
    KernelCoreFactory = requireRel(root, 'kernel/kernel.core.js');
  } catch (e) {
    // fallback to top-level kernel.core.js
    KernelCoreFactory = requireRel(root, 'kernel.core.js');
  }

  const kc = KernelCoreFactory.createKernelCore
    ? KernelCoreFactory.createKernelCore({
        root,
        src: path.join(root, 'pfx', 'src'),
        dataPath: dataDir,
        configPath: cfgPath,
        cartridgesPath: cartsPath
      })
    : new KernelCoreFactory.KernelCore({
        root,
        src: path.join(root, 'pfx', 'src'),
        dataPath: dataDir,
        configPath: cfgPath,
        cartridgesPath: cartsPath
      });

  // Apply cartridges deterministically
  applyCartridges(kc, cartridges);

  // Ensure data directory and seed files
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const profilePath = path.join(dataDir, 'seed.profile.json');
  const logPath = path.join(dataDir, 'seed.log.json');
  const profile = readJSON(profilePath, null) || { project: 'PrimeForgeX', created: '2026-08-09', author: 'Your Conscience' };
  if (!readJSON(profilePath, null)) writeJSON(profilePath, profile);
  if (!Array.isArray(readJSON(logPath, null))) writeJSON(logPath, []);

  // Boot kernel instance
  kc.boot();

  // Seed core profile into kernel
  seedCoreProfile(kc, profile);

  // Register builtin agents deterministically
  ensureBuiltinAgents(kc);

  // Set identity mode if provided in config
  try {
    if (config.identity && kc.identity && typeof kc.identity.setMode === 'function' && config.mode) {
      // Map config.mode to known modes if possible
      const mode = String(config.mode || '').toLowerCase();
      const known = kc.identity && kc.identity.mode ? kc.identity.mode : null;
      // Only set if valid
      try {
        kc.identity.setMode(mode);
      } catch (e) {
        // ignore invalid mode
      }
    }
  } catch (e) {
    if (kc.audit) kc.audit.push({ op: 'identity_set_error', err: String(e) });
  }

  // Persist initial seed.log deterministically
  try {
    const core = kc.memory && kc.memory['core'];
    if (core) {
      const seedLog = core.read('seed.log') || [];
      writeJSON(path.join(dataDir, 'seed.log.json'), seedLog);
    }
  } catch (e) {
    if (kc.audit) kc.audit.push({ op: 'persist_seedlog_error', err: String(e) });
  }

  return kc;
}

/* -------------------------
   Exports
   ------------------------- */
module.exports = {
  initKernelFromConfig,
  ensureBuiltinAgents,
  seedCoreProfile
};
