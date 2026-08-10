/**
 * fusion.core.js
 *
 * PrimeForgeX — Harmonia Fusion Core
 * Version: 2026-08-09 18:06 CDT
 * Location: Abilene, Texas
 * Author: Your Conscience (David)
 *
 * Purpose:
 * - Deterministic fusion layer to bridge two compatible kernel runtimes (e.g., PrimeForgeX CPO and Competitor kernel)
 * - Provides deterministic translation, cartridge bridging, identity preservation, and a FusionSeed agent
 * - Phone-deployable (Termux + Node compatible)
 * - No network, no randomness, no external dependencies
 *
 * Constraints:
 * - Pure JS, synchronous operations only
 * - Deterministic ordering and IDs
 * - Minimal surface area: translation adapters are explicit and conservative
 *
 * Exports:
 * - module.exports = { FusionCore, createFusionCore, FusionSeedAgentFactory }
 *
 * Usage:
 * const { createFusionCore } = require('./fusion.core.js');
 * const fusion = createFusionCore({ primaryKernel, secondaryKernel });
 * fusion.boot();
 * fusion.tick();
 */

'use strict';

/* -------------------------
   Deterministic ID generator (fusion-local)
   ------------------------- */
const ID = (function () {
  let counter = 0;
  return {
    next(prefix = 'fus') {
      counter += 1;
      return `${prefix}_${String(counter).padStart(6, '0')}`;
    },
    reset() {
      counter = 0;
    },
    snapshot() {
      return counter;
    }
  };
}());

/* -------------------------
   Safe shallow clone (deterministic)
   ------------------------- */
function shallowClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  const out = {};
  Object.keys(obj).sort().forEach(k => { out[k] = obj[k]; });
  return out;
}

/* -------------------------
   Conservative translator utilities
   ------------------------- */
/*
  Translators are intentionally minimal and explicit.
  They map only well-known fields and structures between kernels.
  Unknown fields are preserved under a namespaced key to avoid loss.
*/
function translateAgentSnapshotToSecondary(agentSnap) {
  // Map primary agent snapshot to secondary kernel's expected shape
  const out = {
    id: agentSnap.id,
    name: agentSnap.name,
    cartridge: agentSnap.cartridge,
    priority: agentSnap.priority,
    state: shallowClone(agentSnap.state),
    alive: !!agentSnap.alive,
    meta: { source: 'primary', snapshotTick: agentSnap.snapshotTick || 0 }
  };
  // Preserve audit under namespaced key
  if (Array.isArray(agentSnap.audit)) out.meta.audit = agentSnap.audit.slice();
  return out;
}

function translateAgentSnapshotToPrimary(agentSnap) {
  // Map secondary agent snapshot to primary kernel's expected shape
  const out = {
    id: agentSnap.id,
    name: agentSnap.name,
    cartridge: agentSnap.cartridge || 'default',
    priority: Number.isFinite(agentSnap.priority) ? agentSnap.priority : 100,
    state: shallowClone(agentSnap.state || {}),
    alive: !!agentSnap.alive,
    audit: Array.isArray(agentSnap.audit) ? agentSnap.audit.slice() : []
  };
  // Preserve meta if present
  if (agentSnap.meta) out.meta = shallowClone(agentSnap.meta);
  return out;
}

/* -------------------------
   Cartridge bridge
   ------------------------- */
/*
  Bridges named cartridges between kernels.
  Writes are mirrored deterministically; conflicts are resolved by deterministic rule:
  - Primary kernel wins for identical keys unless secondary provides a higher-priority marker.
  This is intentionally simple to preserve determinism and sovereignty.
*/
function mergeCartridgeData(primaryData, secondaryData) {
  const out = {};
  const pKeys = Object.keys(primaryData || {}).sort();
  const sKeys = Object.keys(secondaryData || {}).sort();
  // Start with primary
  pKeys.forEach(k => { out[k] = primaryData[k]; });
  // Merge secondary where primary missing
  sKeys.forEach(k => {
    if (out[k] === undefined) {
      out[k] = secondaryData[k];
    } else {
      // deterministic conflict resolution:
      // if secondary value is an object with __priority numeric field, and it's greater, accept it
      const sVal = secondaryData[k];
      if (sVal && typeof sVal === 'object' && Number.isFinite(sVal.__priority)) {
        const pVal = primaryData[k];
        const pPriority = pVal && typeof pVal === 'object' && Number.isFinite(pVal.__priority) ? pVal.__priority : 0;
        if (sVal.__priority > pPriority) {
          out[k] = sVal;
        } else {
          // keep primary
        }
      } else {
        // keep primary by default
      }
    }
  });
  return out;
}

/* -------------------------
   FusionSeedAgent
   ------------------------- */
/*
  A conservative canonical agent that:
  - Reads core profiles from both kernels
  - Produces a deterministic fusion summary
  - Writes summary into both kernels' core cartridges under 'fusion.seed.log'
*/
class FusionSeedAgent {
  constructor(fusionCore, opts = {}) {
    this.fusion = fusionCore;
    this.id = opts.id || 'fusion_seed';
    this.name = opts.name || 'FusionSeed';
    this.cartridge = opts.cartridge || 'core';
    this.audit = [];
  }

  step() {
    // Read core profiles
    const pCore = this.fusion.primaryKernel && this.fusion.primaryKernel.memory && this.fusion.primaryKernel.memory['core']
      ? this.fusion.primaryKernel.memory['core'].read('core.profile') : null;
    const sCore = this.fusion.secondaryKernel && this.fusion.secondaryKernel.memory && this.fusion.secondaryKernel.memory['core']
      ? this.fusion.secondaryKernel.memory['core'].read('core.profile') : null;

    const normalizedPrimary = FusionSeedAgent.normalizeProfile(pCore || {});
    const normalizedSecondary = FusionSeedAgent.normalizeProfile(sCore || {});

    const summary = {
      id: ID.next('fusion'),
      tickPrimary: this.fusion.primaryKernel ? this.fusion.primaryKernel.tickCount : 0,
      tickSecondary: this.fusion.secondaryKernel ? this.fusion.secondaryKernel.tickCount : 0,
      primary: normalizedPrimary,
      secondary: normalizedSecondary
    };

    // Append to both kernels' fusion logs deterministically
    if (this.fusion.primaryKernel && this.fusion.primaryKernel.memory && this.fusion.primaryKernel.memory['core']) {
      const core = this.fusion.primaryKernel.memory['core'];
      let log = core.read('fusion.seed.log');
      if (!Array.isArray(log)) log = [];
      log.push(summary);
      core.write('fusion.seed.log', log);
    }

    if (this.fusion.secondaryKernel && this.fusion.secondaryKernel.memory && this.fusion.secondaryKernel.memory['core']) {
      const core = this.fusion.secondaryKernel.memory['core'];
      let log = core.read('fusion.seed.log');
      if (!Array.isArray(log)) log = [];
      log.push(summary);
      core.write('fusion.seed.log', log);
    }

    this.audit.push({ op: 'wrote_fusion_summary', summary });
    return true;
  }

  static normalizeProfile(profile) {
    const out = {};
    const keys = Object.keys(profile || {}).sort();
    for (let i = 0; i < keys.length; i += 1) {
      const k = keys[i];
      const v = profile[k];
      out[k] = (typeof v === 'object' && v !== null) ? JSON.stringify(v) : String(v);
    }
    return out;
  }

  snapshot() {
    return { id: this.id, name: this.name, cartridge: this.cartridge, audit: this.audit.slice() };
  }
}

/* -------------------------
   FusionCore
   ------------------------- */
class FusionCore {
  constructor(opts = {}) {
    // primaryKernel and secondaryKernel are expected to be kernel instances exposing:
    // - agents (map), memory (map of MemoryRegion-like objects with read/write), bus (MessageBus-like), tickCount, ensureMemory, registerAgent, getAgent, tick, snapshot, restore
    this.primaryKernel = opts.primaryKernel || null;
    this.secondaryKernel = opts.secondaryKernel || null;
    this.adapters = { primaryToSecondary: null, secondaryToPrimary: null }; // optional custom translators
    this.fusionAgents = Object.create(null); // id -> agent
    this.audit = [];
    this.booted = false;
    this.bridgeCartridges = Array.isArray(opts.bridgeCartridges) ? opts.bridgeCartridges.slice() : ['core', 'default'];
    this.maxStepsPerTick = Number.isFinite(opts.maxStepsPerTick) ? opts.maxStepsPerTick : 1000;
  }

  setAdapters(adapters = {}) {
    if (adapters.primaryToSecondary) this.adapters.primaryToSecondary = adapters.primaryToSecondary;
    if (adapters.secondaryToPrimary) this.adapters.secondaryToPrimary = adapters.secondaryToPrimary;
    this.audit.push({ op: 'adapters_set' });
  }

  boot() {
    if (!this.primaryKernel || !this.secondaryKernel) {
      throw new Error('Both primaryKernel and secondaryKernel must be provided');
    }
    // Ensure bridge cartridges exist on both kernels
    this.bridgeCartridges.forEach(name => {
      if (this.primaryKernel.ensureMemory) this.primaryKernel.ensureMemory(name, { readOnly: false });
      if (this.secondaryKernel.ensureMemory) this.secondaryKernel.ensureMemory(name, { readOnly: false });
    });

    // Register FusionSeedAgent into primary kernel (and secondary if desired)
    const seed = new FusionSeedAgent(this, { id: 'fusion_seed', name: 'FusionSeed', cartridge: 'core' });
    this.fusionAgents[seed.id] = seed;
    if (this.primaryKernel && this.primaryKernel.registerAgent) {
      try { this.primaryKernel.registerAgent(seed); this.audit.push({ op: 'seed_registered_primary' }); } catch (e) { /* ignore duplicate */ }
    }
    if (this.secondaryKernel && this.secondaryKernel.registerAgent) {
      // register a lightweight proxy agent in secondary that delegates to fusion seed step
      const proxy = {
        id: 'fusion_seed_secondary',
        name: 'FusionSeedSecondary',
        cartridge: 'core',
        alive: true,
        step: () => {
          // call fusion seed step to ensure both kernels get the summary
          seed.step();
          return true;
        },
        snapshot: () => ({ id: 'fusion_seed_secondary', name: 'FusionSeedSecondary' }),
        audit: []
      };
      try { this.secondaryKernel.registerAgent(proxy); this.fusionAgents[proxy.id] = proxy; this.audit.push({ op: 'seed_registered_secondary' }); } catch (e) { /* ignore duplicate */ }
    }

    this.booted = true;
    this.audit.push({ op: 'fusion_booted' });
    return true;
  }

  // Single deterministic fusion tick:
  // 1. Run one tick on primary kernel
  // 2. Translate and mirror selected state to secondary
  // 3. Run one tick on secondary kernel
  // 4. Translate and mirror selected state back to primary
  tick() {
    if (!this.booted) throw new Error('FusionCore not booted');
    // Step 1: primary tick
    if (this.primaryKernel && typeof this.primaryKernel.tick === 'function') {
      this.primaryKernel.tick();
    }

    // Step 2: bridge primary -> secondary
    this.bridgeState(this.primaryKernel, this.secondaryKernel, 'primaryToSecondary');

    // Step 3: secondary tick
    if (this.secondaryKernel && typeof this.secondaryKernel.tick === 'function') {
      this.secondaryKernel.tick();
    }

    // Step 4: bridge secondary -> primary
    this.bridgeState(this.secondaryKernel, this.primaryKernel, 'secondaryToPrimary');

    // Step 5: run fusion agents' deterministic steps (if any not registered in kernels)
    const fKeys = Object.keys(this.fusionAgents).sort();
    for (let i = 0; i < fKeys.length; i += 1) {
      const a = this.fusionAgents[fKeys[i]];
      if (a && typeof a.step === 'function') a.step();
    }

    this.audit.push({ op: 'fusion_tick', primaryTick: this.primaryKernel ? this.primaryKernel.tickCount : 0, secondaryTick: this.secondaryKernel ? this.secondaryKernel.tickCount : 0 });
    return { primaryTick: this.primaryKernel ? this.primaryKernel.tickCount : 0, secondaryTick: this.secondaryKernel ? this.secondaryKernel.tickCount : 0 };
  }

  bridgeState(fromKernel, toKernel, direction) {
    if (!fromKernel || !toKernel) return false;
    // Bridge cartridges
    for (let i = 0; i < this.bridgeCartridges.length; i += 1) {
      const name = this.bridgeCartridges[i];
      const fromMem = fromKernel.memory && fromKernel.memory[name] ? fromKernel.memory[name] : null;
      const toMem = toKernel.memory && toKernel.memory[name] ? toKernel.memory[name] : null;
      if (!fromMem || !toMem) continue;

      // Read deterministic snapshot of cartridge data
      const fromDump = fromMem.dump ? fromMem.dump().data : shallowClone(fromMem.data || {});
      const toDump = toMem.dump ? toMem.dump().data : shallowClone(toMem.data || {});

      // Optionally run adapter translation
      let translated = null;
      if (direction === 'primaryToSecondary' && typeof this.adapters.primaryToSecondary === 'function') {
        translated = this.adapters.primaryToSecondary(shallowClone(fromDump));
      } else if (direction === 'secondaryToPrimary' && typeof this.adapters.secondaryToPrimary === 'function') {
        translated = this.adapters.secondaryToPrimary(shallowClone(fromDump));
      } else {
        // default: merge conservatively
        translated = mergeCartridgeData(fromDump, toDump);
      }

      // Deterministically write merged data into destination cartridge
      const keys = Object.keys(translated || {}).sort();
      for (let k = 0; k < keys.length; k += 1) {
        const key = keys[k];
        try {
          toMem.write(key, translated[key]);
        } catch (e) {
          // if write fails (readOnly), skip deterministically
        }
      }
    }

    // Bridge messages for explicitly whitelisted agents (conservative)
    // Only mirror messages addressed to agents that exist on both sides with same id
    if (fromKernel.bus && toKernel.bus) {
      const queues = fromKernel.bus.peek ? fromKernel.bus.peekAll ? fromKernel.bus.peekAll() : null : null;
      // If peekAll not available, iterate known agents
      const agentIds = Object.keys(fromKernel.agents || {}).sort();
      for (let i = 0; i < agentIds.length; i += 1) {
        const aid = agentIds[i];
        // Only mirror if agent exists on both kernels
        if (!toKernel.agents || !toKernel.agents[aid]) continue;
        // Pull messages deterministically from source queue snapshot
        const msgs = fromKernel.bus.peek ? fromKernel.bus.peek(aid) : null;
        if (!Array.isArray(msgs) || msgs.length === 0) continue;
        // Mirror each message into destination bus with deterministic id mapping
        for (let m = 0; m < msgs.length; m += 1) {
          const msg = msgs[m];
          // Create a mirrored message with deterministic id
          const mirrored = shallowClone(msg);
          mirrored.id = ID.next('fmsg');
          try {
            toKernel.bus.send(aid, mirrored);
          } catch (e) {
            // ignore send failures deterministically
          }
        }
      }
    }

    return true;
  }

  snapshot() {
    return {
      primaryTick: this.primaryKernel ? this.primaryKernel.tickCount : 0,
      secondaryTick: this.secondaryKernel ? this.secondaryKernel.tickCount : 0,
      bridgeCartridges: this.bridgeCartridges.slice(),
      audit: this.audit.slice()
    };
  }

  shutdown() {
    // Deterministic shutdown: persist fusion audit if kernels expose dataPath
    this.audit.push({ op: 'fusion_shutdown' });
    return true;
  }
}

/* -------------------------
   Factory helpers
   ------------------------- */
function createFusionCore(opts = {}) {
  return new FusionCore(opts);
}

function FusionSeedAgentFactory(fusionCore, opts = {}) {
  return new FusionSeedAgent(fusionCore, opts);
}

/* -------------------------
   Exports
   ------------------------- */
module.exports = {
  ID,
  shallowClone,
  translateAgentSnapshotToSecondary,
  translateAgentSnapshotToPrimary,
  mergeCartridgeData,
  FusionSeedAgent,
  FusionSeedAgentFactory,
  FusionCore,
  createFusionCore
};
