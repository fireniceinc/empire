/**
 * kernel.core.js
 *
 * PrimeForgeX — Kernel Core
 * Version: 2026-08-09 18:06 CDT
 * Location: Abilene, Texas
 * Author: Your Conscience (David)
 *
 * Purpose:
 * - Minimal deterministic kernel glue for PrimeForgeX
 * - Loads CPL, CPO, Agents; initializes cartridges; provides deterministic boot and tick loop
 * - Phone-deployable (Termux + Node compatible)
 * - No network, no randomness, no external dependencies
 *
 * Constraints:
 * - Pure JS, synchronous where possible
 * - Deterministic ordering and IDs
 * - Small, single-file kernel core suitable for /pfx/src/kernel/kernel.core.js
 *
 * Exports:
 * - module.exports = { KernelCore, createKernelCore, bootFromConfig }
 *
 * Usage:
 * const { createKernelCore } = require('./kernel.core.js');
 * const kernel = createKernelCore({ configPath: './config.json' });
 * kernel.boot();
 */

'use strict';

/* -------------------------
   Basic utilities (deterministic)
   ------------------------- */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function deterministicSortKeys(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deterministicSortKeys);
  const keys = Object.keys(obj).sort();
  const out = {};
  for (let i = 0; i < keys.length; i += 1) {
    const k = keys[i];
    out[k] = deterministicSortKeys(obj[k]);
  }
  return out;
}

/* -------------------------
   Minimal file helpers (synchronous)
   ------------------------- */
const FS = (() => {
  try {
    return require('fs');
  } catch (e) {
    // Host environment may provide a shim; throw a clear error if missing
    throw new Error('Node fs module required for kernel core on-device runtime');
  }
})();

function readJSON(path, fallback) {
  try {
    const raw = FS.readFileSync(path, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function writeJSON(path, obj) {
  const raw = JSON.stringify(obj, null, 2);
  FS.writeFileSync(path, raw, 'utf8');
  return true;
}

/* -------------------------
   KernelCore Class
   ------------------------- */
class KernelCore {
  constructor(opts = {}) {
    this.root = opts.root || process.cwd();
    this.src = opts.src || `${this.root}/pfx/src`;
    this.dataPath = opts.dataPath || `${this.root}/pfx/data`;
    this.configPath = opts.configPath || `${this.root}/pfx/config.json`;
    this.cartridgesPath = opts.cartridgesPath || `${this.root}/pfx/cartridges.json`;
    this.tickLimit = Number.isFinite(opts.tickLimit) ? opts.tickLimit : 1000;
    this.kernel = null; // AgentKernel instance
    this.modules = Object.create(null);
    this.audit = [];
    this.booted = false;
  }

  /* -------------------------
     Module loading (deterministic)
     ------------------------- */
  _requireRel(relPath) {
    // Deterministic require wrapper; resolves relative to src
    const full = `${this.src}/${relPath}`;
    // Normalize path to remove duplicate slashes
    const normalized = full.replace(/\/+/g, '/');
    // Use require with resolved path
    // Caller must ensure files exist in runtime bundle
    return require(normalized);
  }

  loadRuntimes() {
    // Load agents core and cpo/cpl kernels deterministically
    // Order matters: cpl -> cpo -> agents -> kernel glue
    this.audit.push({ op: 'load_start' });

    // CPL
    try {
      this.modules.cpl = this._requireRel('cpl/cpl.core.js');
      this.audit.push({ op: 'loaded', module: 'cpl' });
    } catch (e) {
      throw new Error(`Failed to load CPL runtime: ${e.message}`);
    }

    // CPO
    try {
      this.modules.cpo = this._requireRel('cpo/cpo.kernel.js');
      this.audit.push({ op: 'loaded', module: 'cpo' });
    } catch (e) {
      throw new Error(`Failed to load CPO kernel: ${e.message}`);
    }

    // Agents
    try {
      this.modules.agents = this._requireRel('agents/agents.core.js');
      this.audit.push({ op: 'loaded', module: 'agents' });
    } catch (e) {
      throw new Error(`Failed to load Agents runtime: ${e.message}`);
    }

    // Kernel glue (optional additional kernel files)
    try {
      // If a kernel glue file exists, load it; otherwise rely on AgentKernel from agents.core
      try {
        this.modules.kernelGlue = this._requireRel('kernel/kernel.core.js');
        this.audit.push({ op: 'loaded', module: 'kernelGlue' });
      } catch (inner) {
        // Not fatal; use AgentKernel from agents.core
        this.modules.kernelGlue = null;
        this.audit.push({ op: 'kernelGlue_missing' });
      }
    } catch (e) {
      // swallow
    }

    this.audit.push({ op: 'load_end' });
    return true;
  }

  /* -------------------------
     Configuration and cartridges
     ------------------------- */
  loadConfig() {
    const cfg = readJSON(this.configPath, null);
    if (!cfg) {
      throw new Error(`Missing or invalid config at ${this.configPath}`);
    }
    this.config = deterministicSortKeys(cfg);
    this.audit.push({ op: 'config_loaded', path: this.configPath });
    return this.config;
  }

  loadCartridges() {
    const carts = readJSON(this.cartridgesPath, null);
    if (!carts) {
      throw new Error(`Missing or invalid cartridges at ${this.cartridgesPath}`);
    }
    this.cartridges = deterministicSortKeys(carts);
    this.audit.push({ op: 'cartridges_loaded', path: this.cartridgesPath });
    return this.cartridges;
  }

  ensureDataFiles() {
    // Ensure data directory exists and seed files exist
    try {
      if (!FS.existsSync(this.dataPath)) FS.mkdirSync(this.dataPath, { recursive: true });
    } catch (e) {
      throw new Error(`Failed to ensure data directory: ${e.message}`);
    }

    const seedProfilePath = `${this.dataPath}/seed.profile.json`;
    const seedLogPath = `${this.dataPath}/seed.log.json`;

    const defaultProfile = { project: 'PrimeForgeX', created: '2026-08-09', author: 'Your Conscience' };
    const profile = readJSON(seedProfilePath, null);
    if (!profile) writeJSON(seedProfilePath, defaultProfile);

    const log = readJSON(seedLogPath, null);
    if (!Array.isArray(log)) writeJSON(seedLogPath, []);

    this.audit.push({ op: 'data_files_ensured', seedProfilePath, seedLogPath });
    return true;
  }

  /* -------------------------
     Kernel instantiation
     ------------------------- */
  createKernelInstance() {
    // Prefer AgentKernel from agents module; fallback to cpo kernel if provided
    const Agents = this.modules.agents;
    const CPO = this.modules.cpo;

    if (!Agents || !Agents.createKernel) {
      // Agents.core.js exports createKernel; if not present, try AgentKernel class
      if (Agents && Agents.AgentKernel) {
        this.kernel = new Agents.AgentKernel({ identity: this.config.identity || {} });
      } else if (CPO && CPO.AgentKernel) {
        this.kernel = new CPO.AgentKernel({ identity: this.config.identity || {} });
      } else {
        throw new Error('No AgentKernel factory found in runtime modules');
      }
    } else {
      this.kernel = Agents.createKernel({ identity: this.config.identity || {}, maxStepsPerTick: this.config.maxStepsPerTick || 1000 });
    }

    // Initialize cartridges from cartridges.json
    Object.keys(this.cartridges).forEach(name => {
      const opts = this.cartridges[name] || {};
      this.kernel.ensureMemory(name, opts);
    });

    // Load seed profile into core cartridge
    const seedProfile = readJSON(`${this.dataPath}/seed.profile.json`, {});
    const core = this.kernel.ensureMemory('core', { readOnly: false });
    if (!core.read('core.profile')) core.write('core.profile', seedProfile);

    // Ensure seed.log exists in core
    if (!Array.isArray(core.read('seed.log'))) core.write('seed.log', []);

    this.audit.push({ op: 'kernel_created' });
    return this.kernel;
  }

  /* -------------------------
     Agent registration helpers
     ------------------------- */
  registerBuiltinAgents() {
    // SeedAgent is created by createKernel in agents.core; ensure it's present
    const k = this.kernel;
    if (!k.getAgent('seed_agent')) {
      // Create canonical seed agent via factory if available
      const Agents = this.modules.agents;
      if (Agents && Agents.SeedAgentFactory) {
        const seed = Agents.SeedAgentFactory(k, { id: 'seed_agent', name: 'SeedAgent', cartridge: 'core' });
        k.registerAgent(seed);
        this.audit.push({ op: 'seed_registered' });
      } else if (k.getAgent && k.registerAgent) {
        // fallback: attempt to instantiate SeedAgent class
        if (Agents && Agents.SeedAgent) {
          const seed = new Agents.SeedAgent(k, { id: 'seed_agent', name: 'SeedAgent', cartridge: 'core' });
          k.registerAgent(seed);
          this.audit.push({ op: 'seed_registered_fallback' });
        }
      }
    } else {
      this.audit.push({ op: 'seed_already_registered' });
    }
    return true;
  }

  /* -------------------------
     Boot sequence
     ------------------------- */
  boot() {
    if (this.booted) return { ok: true, reason: 'already_booted' };
    // Load runtimes
    this.loadRuntimes();
    // Load config and cartridges
    this.loadConfig();
    this.loadCartridges();
    // Ensure data files
    this.ensureDataFiles();
    // Create kernel instance
    this.createKernelInstance();
    // Register builtin agents
    this.registerBuiltinAgents();
    // Finalize boot
    this.booted = true;
    this.audit.push({ op: 'boot_complete', tickLimit: this.tickLimit });
    return { ok: true };
  }

  /* -------------------------
     Deterministic tick control
     ------------------------- */
  tickOnce() {
    if (!this.booted) throw new Error('Kernel not booted');
    const res = this.kernel.tick();
    // After each tick, persist seed.log deterministically
    const core = this.kernel.memory['core'];
    if (core) {
      const seedLog = core.read('seed.log') || [];
      writeJSON(`${this.dataPath}/seed.log.json`, seedLog);
    }
    this.audit.push({ op: 'tick_persist', tick: this.kernel.tickCount });
    return res;
  }

  runTicks(n) {
    if (!this.booted) throw new Error('Kernel not booted');
    const out = [];
    for (let i = 0; i < n; i += 1) {
      out.push(this.tickOnce());
    }
    return out;
  }

  shutdown() {
    // Deterministic shutdown: snapshot and persist core memory
    if (!this.booted) return { ok: true, reason: 'not_booted' };
    const snap = this.kernel.snapshot();
    writeJSON(`${this.dataPath}/kernel.snapshot.json`, snap);
    this.booted = false;
    this.audit.push({ op: 'shutdown', tick: this.kernel.tickCount });
    return { ok: true, snapshotPath: `${this.dataPath}/kernel.snapshot.json` };
  }

  restoreFromSnapshot(path) {
    const snap = readJSON(path, null);
    if (!snap) throw new Error(`Invalid snapshot at ${path}`);
    // Restore kernel state using AgentKernel.restore
    if (!this.kernel || !this.kernel.restore) {
      throw new Error('Kernel instance does not support restore');
    }
    this.kernel.restore(snap);
    // Re-register agents externally if needed
    this.audit.push({ op: 'restored_from_snapshot', path });
    return true;
  }
}

/* -------------------------
   Factory helpers
   ------------------------- */
function createKernelCore(opts = {}) {
  return new KernelCore(opts);
}

function bootFromConfig(rootPath) {
  const kc = createKernelCore({ root: rootPath });
  kc.boot();
  return kc;
}

/* -------------------------
   Exports
   ------------------------- */
module.exports = {
  KernelCore,
  createKernelCore,
  bootFromConfig
};
