/**
 * runtime.boot.js
 *
 * PrimeForgeX — Runtime Boot
 * Version: 2026-08-09 18:06 CDT
 * Location: Abilene, Texas
 * Author: Your Conscience (David)
 *
 * Purpose:
 * - Minimal deterministic boot loader for PrimeForgeX on-device runtime
 * - Loads kernel core, starts deterministic tick loop, persists seed log and snapshot
 * - Termux + Node compatible, synchronous, no network, no randomness
 *
 * Usage:
 * node runtime.boot.js            # boots, runs default ticks, then exits
 * node runtime.boot.js --run 10   # run 10 ticks then exit
 * node runtime.boot.js --interactive  # start simple REPL for tick control
 *
 * Constraints:
 * - All file paths are relative to process.cwd() by default
 * - Deterministic behavior only; no timers that introduce nondeterminism
 */

'use strict';

const FS = (() => {
  try {
    return require('fs');
  } catch (e) {
    throw new Error('Node fs module required for runtime boot');
  }
})();

const PATH = (() => {
  try {
    return require('path');
  } catch (e) {
    throw new Error('Node path module required for runtime boot');
  }
})();

// Simple deterministic CLI arg parser
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
      out.root = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

// Deterministic sleep replacement (busy loop limited by ticks) - avoid real timers
function deterministicWait() {
  // no-op to keep deterministic single-threaded behavior
  return true;
}

// Safe require wrapper for runtime modules relative to src
function requireRel(root, rel) {
  const full = PATH.join(root, 'pfx', 'src', rel);
  // Normalize
  const normalized = PATH.normalize(full);
  return require(normalized);
}

// Minimal logger (deterministic)
const Logger = {
  info: function () {
    const args = Array.prototype.slice.call(arguments);
    // Keep deterministic ordering and simple output
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

// Persist JSON helper
function writeJSON(path, obj) {
  const raw = JSON.stringify(obj, null, 2);
  FS.writeFileSync(path, raw, 'utf8');
  return true;
}

function readJSON(path, fallback) {
  try {
    const raw = FS.readFileSync(path, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

// Boot sequence
function boot(rootPath) {
  Logger.info('Boot starting at root:', rootPath);

  // Load kernel core factory
  let KernelCoreFactory;
  try {
    KernelCoreFactory = requireRel(rootPath, 'kernel/kernel.core.js');
  } catch (e) {
    // Fallback to kernel.core at top-level src if not present
    try {
      KernelCoreFactory = requireRel(rootPath, 'kernel.core.js');
    } catch (err) {
      throw new Error('Failed to load kernel core: ' + err.message);
    }
  }

  // Create kernel core instance
  const kc = KernelCoreFactory.createKernelCore
    ? KernelCoreFactory.createKernelCore({ root: rootPath })
    : new KernelCoreFactory.KernelCore({ root: rootPath });

  // Boot kernel
  const bootRes = kc.boot();
  if (!bootRes || !bootRes.ok) {
    throw new Error('Kernel boot failed: ' + JSON.stringify(bootRes));
  }
  Logger.info('Kernel booted');

  return kc;
}

// Deterministic run helper
function runTicks(kc, n) {
  Logger.info('Running ticks:', n);
  const out = kc.runTicks(n);
  Logger.info('Run complete. Last tick:', kc.kernel ? kc.kernel.tickCount : 'unknown');
  return out;
}

// Simple interactive REPL for tick control (synchronous prompt)
function interactiveLoop(kc) {
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  Logger.info('Entering interactive mode. Commands: tick N | snapshot | persist | exit');

  function prompt() {
    rl.question('> ', (line) => {
      const parts = line.trim().split(/\s+/);
      const cmd = parts[0];
      if (cmd === 'tick') {
        const n = Number.parseInt(parts[1] || '1', 10) || 1;
        try {
          const res = kc.runTicks(n);
          Logger.info('Ticked', n, 'times. Current tick:', kc.kernel.tickCount);
        } catch (e) {
          Logger.error('Tick error:', e.message);
        }
        prompt();
      } else if (cmd === 'snapshot') {
        try {
          const snapPath = PATH.join(kc.dataPath, 'kernel.snapshot.json');
          const snap = kc.kernel.snapshot();
          writeJSON(snapPath, snap);
          Logger.info('Snapshot written to', snapPath);
        } catch (e) {
          Logger.error('Snapshot failed:', e.message);
        }
        prompt();
      } else if (cmd === 'persist') {
        try {
          const core = kc.kernel.memory['core'];
          if (core) {
            const seedLog = core.read('seed.log') || [];
            writeJSON(PATH.join(kc.dataPath, 'seed.log.json'), seedLog);
            Logger.info('Seed log persisted');
          } else {
            Logger.warn('No core cartridge found');
          }
        } catch (e) {
          Logger.error('Persist failed:', e.message);
        }
        prompt();
      } else if (cmd === 'exit') {
        rl.close();
        try {
          kc.shutdown();
        } catch (e) {
          // ignore
        }
        Logger.info('Exiting interactive mode');
      } else {
        Logger.warn('Unknown command:', cmd);
        prompt();
      }
    });
  }

  prompt();
}

// Main entry
function main() {
  const args = parseArgs(process.argv);
  const root = PATH.resolve(args.root);
  // Ensure pfx/data exists
  const dataPath = PATH.join(root, 'pfx', 'data');
  if (!FS.existsSync(dataPath)) {
    try {
      FS.mkdirSync(dataPath, { recursive: true });
    } catch (e) {
      throw new Error('Failed to create data directory: ' + e.message);
    }
  }

  // Boot kernel core
  const kc = boot(root);

  // If run count provided, run and exit
  if (Number.isFinite(args.run) && args.run > 0) {
    runTicks(kc, args.run);
    // Persist seed log deterministically
    try {
      const core = kc.kernel.memory['core'];
      if (core) {
        const seedLog = core.read('seed.log') || [];
        writeJSON(PATH.join(kc.dataPath, 'seed.log.json'), seedLog);
      }
      kc.shutdown();
    } catch (e) {
      Logger.error('Persist/shutdown error:', e.message);
    }
    return;
  }

  // If interactive, enter REPL
  if (args.interactive) {
    interactiveLoop(kc);
    return;
  }

  // Default behavior: run a small deterministic number of ticks then persist and exit
  const defaultTicks = 1;
  runTicks(kc, defaultTicks);

  // Persist seed log
  try {
    const core = kc.kernel.memory['core'];
    if (core) {
      const seedLog = core.read('seed.log') || [];
      writeJSON(PATH.join(kc.dataPath, 'seed.log.json'), seedLog);
    }
  } catch (e) {
    Logger.error('Persist error:', e.message);
  }

  // Snapshot and shutdown
  try {
    kc.shutdown();
  } catch (e) {
    Logger.error('Shutdown error:', e.message);
  }

  Logger.info('Boot sequence complete. Exiting.');
}

// If invoked directly, run main
if (require.main === module) {
  try {
    main();
  } catch (e) {
    Logger.error('Runtime boot failed:', e.message);
    process.exit(1);
  }
}

// Exports for programmatic use
module.exports = {
  boot,
  runTicks,
  interactiveLoop,
  main
};
