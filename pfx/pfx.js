const path = require('path');
const { bootFromConfig } = require('./src/kernel/kernel.core.js');

function main() {
  const root = process.cwd();
  const kc = bootFromConfig(root);

  // Default: run 1 deterministic tick
  kc.runTicks(1);

  // Persist seed log
  const core = kc.kernel.memory['core'];
  if (core) {
    const seedLog = core.read('seed.log') || [];
    const fs = require('fs');
    fs.writeFileSync(path.join(root, 'pfx', 'data', 'seed.log.json'), JSON.stringify(seedLog, null, 2));
  }

  kc.shutdown();
}

main();
