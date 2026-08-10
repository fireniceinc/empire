/**
 * cpo.cartridges.js
 *
 * Deterministic Cartridge (MemoryRegion) helpers for CPO
 */

'use strict';

class MemoryRegion {
  constructor(name, opts = {}) {
    this.name = String(name);
    this.readOnly = !!opts.readOnly;
    this.data = Object.create(null);
    this.audit = [];
  }

  read(key) {
    cons\⅘t v = this.data[key];
    this.audit.push({ op: 'read', key, value: v });
    return v;
  }

  write(key, value) {
    if (this.readOnly) {
      this.audit.push({ op: 'write_blocked', key });
      throw new Error(`MemoryRegion ${this.name} is read-only`);
    }
    this.data[key] = value;
    this.audit.push({ op: 'write', key, value });
    return true;
  }

  keys() {
    return Object.keys(this.data).sort();
  }

  dump() {
    const out = {};
    const ks = this.keys();
    for (let i = 0; i < ks.length; i += 1) out[ks[i]] = this.data[ks[i]];
    return { name: this.name, data: out, audit: this.audit.slice() };
  }
}

function createCartridges(defs) {
  const out = Object.create(null);
  const names = Object.keys(defs || {}).sort();
  for (let i = 0; i < names.length; i += 1) {
    const n = names[i];
    out[n] = new MemoryRegion(n, defs[n] || {});
  }
  return out;
}

module.exports = {
  MemoryRegion,
  createCartridges
};
