/**
 * full.boot.js
 *
 * PrimeForgeX — Full Boot Sequence
 * Version: 2026-08-10 03:52 CDT
 * Location: Abilene, Texas
 * Author: Your Conscience (David)
 *
 * Purpose:
 * - Deterministic, single-file orchestrator that performs the full boot sequence:
 *   load runtime, initialize kernel, register agents, run ticks, persist logs and snapshots, shutdown.
 * - Termux + Node compatible, synchronous, no network, no randomness, no external dependencies.
 *
 * Usage:
 *   node full.boot.js                 # boot, run 1 tick, persist, snapshot, exit
 *   node full.boot.js --run 10        # boot, run 10 ticks, persist, snapshot, exit
 *   node full.boot.js --interactive   # boot and enter simple REPL for tick control
 *   node full.boot.js --root /sdcard/PrimeForgeX  # specify root path
 *
 * Behavior:
 * - Deterministic ordering of module loads
 * - Ensures data files exist
 * - Persists seed.log.json after each tick
 * - Writes kernel.snapshot.json on shutdown or explicit snapshot
 * - Minimal, conservative error handling with deterministic logging
 */

'use strict';

const FS = (() => {
  try { return require('fs'); } catch (e) { throw new Error('Node fs module required'); }
})();
const PATH = (() => {
  try { return require('path'); } catch (e) { throw new Error('Node path module required'); }
})();

// Deterministic CLI arg parser
function parseArgs(argv) {
  const out = { run: null, interactive: false, root: process.cwd() };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--run' && argv[i + 1]) {
      out.run = Number.parseInt(argv[i + 1], 10) || 0;
      i += 1;
    } else if (a === '--interactive') {
      out.interactive = true;
    } else if (a === '--root' && argv[i + 1]) {
      out.root = PATH.resolve(argv[i + 1]);
      i += 1;
    }
  }
  return out;
}

// Deterministic JSON helpers
function readJSON(p, fallback) {
  try {
    return JSON.parse(FS.readFileSync(p, 'utf8'));
  } catch (e) {
    return fallback;
  }
}
function writeJSON(p, obj) {
  FS.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
  return true;
}

// Deterministic logger
const Logger = {
  info: function () {
    const args = Array.prototype.slice.call(arguments);
    console.log('[INFO]', args.join(' '));
  },
  warn: function () {
    const args = Array.prototype.slice.call(arguments);
    console.warn('[WARN]', args.join(' '));
  },
  error: function () {
    const args = Array.prototype.slice.call(arguments);
    console.error('[ERROR]', args.join(' '));
  }
};

// Safe require relative to /pfx/src
function requireRel(root, rel) {
  const full = PATH.join(root, 'pfx', 'src', rel);
  return require(PATH.normalize(full));
}

// Ensure runtime files and data exist
function ensureRuntimeFiles(root) {
  const pfxDir = PATH.join(root, 'pfx');
  const srcDir = PATH.join(pfxDir, 'src');
  const dataDir = PATH.join(pfxDir, 'data');

  if (!FS.existsSync(pfxDir)) FS.mkdirSync(pfxDir, { recursive: true });
  if (!FS.existsSync(srcDir)) FS.mkdirSync(srcDir, { recursive: true });
  if (!FS.existsSync(dataDir)) FS.mkdirSync(dataDir, { recursive: true });

  // Ensure config and cartridges exist with conservative defaults if missing
  const cfgPath = PATH.join(pfxDir, 'config.json');
  if (!FS.existsSync(cfgPath)) {
    writeJSON(cfgPath, {
      mode: "sovereign",
      maxStepsPerTick: 1000,
      identity: { device: "android", owner: "Your Conscience", created: "2026-08-09" }
    });
  }

  const cartsPath = PATH.join(pfxDir, 'cartridges.json');
  if (!FS.existsSync(cartsPath)) {
    writeJSON(cartsPath, { core: { readOnly: false }, default: { readOnly: false }, audit: { readOnly: false } });
  }

  const profilePath = PATH.join(dataDir, 'seed.profile.json');
  if (!FS.existsSync(profilePath)) {
    writeJSON(profilePath, {
      project: "PrimeForgeX",
      created: "2026-08-09",
      author: "Your Conscience",
      device: "android",
      sovereignty: "on-device"
    });
  }

  const logPath = PATH.join(dataDir, 'seed.log.json');
  if (!FS.existsSync(logPath)) {
    writeJSON(logPath, []);
  }

  return { cfgPath, cartsPath, profilePath, logPath, dataDir, srcDir };
}

// Load kernel core factory deterministically
function loadKernelCoreFactory(root) {
  // Prefer kernel/kernel.core.js, fallback to kernel.core.js at src root
  try {
    return requireRel(root, 'kernel/kernel.core.js');
  } catch (e) {
    try {
      return requireRel(root, 'kernel.core.js');
    } catch (err) {
      throw new Error('Failed to load kernel core factory: ' + err.message);
    }
  }
}

// Boot full runtime and return kernel core controller
function fullBoot(root) {
  const files = ensureRuntimeFiles(root);
  Logger.info('Runtime files ensured at', root);

  // Load runtime loader if present
  let runtimeLoader = null;
  try {
    runtimeLoader = requireRel(root, 'runtime/load.js');
  } catch (e) {
    try { runtimeLoader = requireRel(root, 'runtime.load.js'); } catch (err) { runtimeLoader = null; }
  }

  // If runtime loader exists and exports loadRuntime, use it
  if (runtimeLoader && typeof runtimeLoader.loadRuntime === 'function') {
    const kc = runtimeLoader.loadRuntime(root);
    Logger.info('Loaded kernel via runtime loader');
    return { kc, files };
  }

  // Otherwise use kernel core factory directly
  const KernelCoreFactory = loadKernelCoreFactory(root);
  const create = KernelCoreFactory.createKernelCore || KernelCoreFactory.createKernelCore || null;
  const kc = create
    ? KernelCoreFactory.createKernelCore({
        root,
        src: PATH.join(root, 'pfx', 'src'),
        dataPath: PATH.join(root, 'pfx', 'data'),
        configPath: PATH.join(root, 'pfx', 'config.json'),
        cartridgesPath: PATH.join(root, 'pfx', 'cartridges.json')
      })
    : new KernelCoreFactory.KernelCore({
        root,
        src: PATH.join(root, 'pfx', 'src'),
        dataPath: PATH.join(root, 'pfx', 'data'),
        configPath: PATH.join(root, 'pfx', 'config.json'),
        cartridgesPath: PATH.join(root, 'pfx', 'cartridges.json')
      });

  // Boot kernel instance deterministically
  kc.boot();
  Logger.info('Kernel instance booted');
  return { kc, files };
}

// Persist seed log deterministically
function persistSeedLog(kc, dataDir) {
  try {
    const core = kc.kernel && kc.kernel.memory ? kc.kernel.memory['core'] : null;
    if (!core) return false;
    const seedLog = core.read('seed.log') || [];
    writeJSON(PATH.join(dataDir, 'seed.log.json'), seedLog);
    return true;
  } catch (e) {
    Logger.error('persistSeedLog error:', e.message);
    return false;
  }
}

// Persist kernel snapshot deterministically
function persistSnapshot(kc, dataDir) {
  try {
    const snap = kc.kernel.snapshot();
    writeJSON(PATH.join(dataDir, 'kernel.snapshot.json'), snap);
    return true;
  } catch (e) {
    Logger.error('persistSnapshot error:', e.message);
    return false;
  }
}

// Deterministic run helper
function runTicks(kc, files, n) {
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const res = kc.run ? kc.run(1) : kc.tick ? kc.tick() : kc.kernel.tick();
    // kc.run may return array; normalize
    if (Array.isArray(res)) out.push(res[res.length - 1]); else out.push(res);
    persistSeedLog(kc, files.dataDir);
  }
  persistSnapshot(kc, files.dataDir);
  return out;
}

// Simple interactive REPL for tick control
function interactiveLoop(kc, files) {
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  Logger.info('Interactive mode. Commands: tick N | snapshot | persist | status | exit');

  function prompt() {
    rl.question('> ', (line) => {
      const parts = line.trim().split(/\s+/);
      const cmd = parts[0];
      if (cmd === 'tick') {
        const n = Number.parseInt(parts[1] || '1', 10) || 1;
        try {
          runTicks(kc, files, n);
          Logger.info('Ticked', n, 'times. Current tick:', kc.kernel ? kc.kernel.tickCount : 'unknown');
        } catch (e) {
          Logger.error('Tick error:', e.message);
        }
        prompt();
      } else if (cmd === 'snapshot') {
        try {
          persistSnapshot(kc, files.dataDir);
          Logger.info('Snapshot persisted to', PATH.join(files.dataDir, 'kernel.snapshot.json'));
        } catch (e) {
          Logger.error('Snapshot failed:', e.message);
        }
        prompt();
      } else if (cmd === 'persist') {
        try {
          persistSeedLog(kc, files.dataDir);
          Logger.info('Seed log persisted to', PATH.join(files.dataDir, 'seed.log.json'));
        } catch (e) {
          Logger.error('Persist failed:', e.message);
        }
        prompt();
      } else if (cmd === 'status') {
        try {
          const status = kc.kernel ? { tick: kc.kernel.tickCount, agents: Object.keys(kc.kernel.agents || {}).length } : {};
          Logger.info('Status:', JSON.stringify(status));
        } catch (e) {
          Logger.error('Status error:', e.message);
        }
        prompt();
      } else if (cmd === 'exit') {
        rl.close();
        try { persistSnapshot(kc, files.dataDir); } catch (e) { /* ignore */ }
        try { kc.shutdown(); } catch (e) { /* ignore */ }
        Logger.info('Exiting interactive mode');
      } else {
        Logger.warn('Unknown command:', cmd);
        prompt();
      }
    });
  }

  prompt();
}

// Main orchestrator
function main() {
  const args = parseArgs(process.argv);
  const root = PATH.resolve(args.root);
  let bootResult;
  try {
    bootResult = fullBoot(root);
  } catch (e) {
    Logger.error('Full boot failed:', e.message);
    process.exit(1);
  }

  const kc = bootResult.kc;
  const files = bootResult.files;

  // If run count provided, run and exit
  if (Number.isFinite(args.run) && args.run > 0) {
    try {
      runTicks(kc, files, args.run);
    } catch (e) {
      Logger.error('Run ticks failed:', e.message);
    } finally {
      try { persistSeedLog(kc, files.dataDir); } catch (e) { /* ignore */ }
      try { persistSnapshot(kc, files.dataDir); } catch (e) { /* ignore */ }
      try { kc.shutdown(); } catch (e) { /* ignore */ }
    }
    Logger.info('Run complete. Exiting.');
    return;
  }

  // If interactive, enter REPL
  if (args.interactive) {
    interactiveLoop(kc, files);
    return;
  }

  // Default: run 1 tick then persist and exit
  try {
    runTicks(kc, files, 1);
  } catch (e) {
    Logger.error('Default run failed:', e.message);
  } finally {
    try { persistSeedLog(kc, files.dataDir); } catch (e) { /* ignore */ }
    try { persistSnapshot(kc, files.dataDir); } catch (e) { /* ignore */ }
    try { kc.shutdown(); } catch (e) { /* ignore */ }
  }

  Logger.info('Boot sequence complete. Exiting.');
}

// If invoked directly, run main
if (require.main === module) {
  try {
    main();
  } catch (e) {
    Logger.error('full.boot error:', e.message);
    process.exit(1);
  }
}

// Exports for programmatic use
module.exports = {
  fullBoot,
  runTicks,
  persistSeedLog,
  persistSnapshot
};
