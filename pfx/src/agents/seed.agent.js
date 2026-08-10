/**
 * seed.agent.js
 *
 * Canonical SeedAgent (split file)
 */

'use strict';

class SeedAgent {
  constructor(kernel, opts = {}) {
    this.kernel = kernel;
    this.id = opts.id || 'seed_agent';
    this.name = opts.name || 'SeedAgent';
    this.cartridge = opts.cartridge || 'core';
    this.alive = true;
    this.audit = [];
  }

  step() {
    const core = this.kernel.memory && this.kernel.memory['core'];
    if (!core) {
      this.audit.push({ op: 'no_core' });
      return false;
    }
    const profile = core.read('core.profile') || {};
    const keys = Object.keys(profile).sort();
    const normalized = {};
    for (let i = 0; i < keys.length; i += 1) {
      const k = keys[i];
      const v = profile[k];
      normalized[k] = (typeof v === 'object' && v !== null) ? JSON.stringify(v) : String(v);
    }
    const summary = { id: this.id, normalized, tick: this.kernel.tickCount };
    let log = core.read('seed.log');
    if (!Array.isArray(log)) log = [];
    log.push(summary);
    core.write('seed.log', log);
    this.audit.push({ op: 'wrote_seed', summary });
    return true;
  }

  snapshot() {
    return { id: this.id, name: this.name, cartridge: this.cartridge, audit: this.audit.slice() };
  }
}

module.exports = {
  SeedAgent
};
