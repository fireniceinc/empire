/**
 * cpo.identity.js
 *
 * PrimeForgeX — CPO Identity Module
 * Version: 2026-08-09 18:06 CDT
 * Location: Abilene, Texas
 * Author: Your Conscience (David)
 *
 * Purpose:
 * - Deterministic identity and mode enforcement for the Constitutional Kernel Substrate (CPO)
 * - Phone-deployable (Termux + Node compatible)
 * - No network, no randomness, no external dependencies
 *
 * Exports:
 * - IdentityModes
 * - Identity
 * - IdentityManager
 *
 * Usage:
 * const { IdentityManager, IdentityModes } = require('./cpo.identity.js');
 * const im = new IdentityManager({ owner: 'Your Conscience' });
 * const id = im.createIdentity({ device: 'android' });
 * im.setMode(id.id, IdentityModes.SOVEREIGN);
 */

'use strict';

/* -------------------------
   Deterministic ID generator (local)
   ------------------------- */
const ID = (function () {
  let counter = 0;
  return {
    next(prefix = 'ident') {
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
   Identity Modes (CPO canonical)
   ------------------------- */
const IdentityModes = Object.freeze({
  OFFLINE: 'offline',
  SOVEREIGN: 'sovereign',
  SANDBOX: 'sandbox',
  AUDIT: 'audit'
});

/* -------------------------
   Identity Class
   ------------------------- */
class Identity {
  constructor(profile = {}) {
    this.id = profile.id || ID.next('ident');
    this.profile = Object.assign({}, profile);
    // ensure deterministic canonical fields
    if (!this.profile.created) this.profile.created = '2026-08-09';
    if (!this.profile.owner) this.profile.owner = 'unknown';
    this.mode = this.profile.mode || IdentityModes.SOVEREIGN;
    this.createdAtTick = Number.isFinite(profile.createdAtTick) ? profile.createdAtTick : 0;
    this.audit = [];
    this.audit.push({ op: 'created', id: this.id, profile: Object.assign({}, this.profile), mode: this.mode });
  }

  setMode(mode) {
    if (!Object.values(IdentityModes).includes(mode)) {
      throw new Error(`Invalid identity mode: ${mode}`);
    }
    if (this.mode === mode) {
      this.audit.push({ op: 'setMode_noop', mode });
      return false;
    }
    this.mode = mode;
    this.audit.push({ op: 'setMode', mode });
    return true;
  }

  updateProfile(delta) {
    if (!delta || typeof delta !== 'object') return false;
    const keys = Object.keys(delta).sort();
    for (let i = 0; i < keys.length; i += 1) {
      const k = keys[i];
      this.profile[k] = delta[k];
    }
    this.audit.push({ op: 'updateProfile', delta: Object.assign({}, delta) });
    return true;
  }

  snapshot() {
    return {
      id: this.id,
      profile: Object.assign({}, this.profile),
      mode: this.mode,
      createdAtTick: this.createdAtTick,
      audit: this.audit.slice()
    };
  }
}

/* -------------------------
   Identity Manager
   ------------------------- */
class IdentityManager {
  constructor(opts = {}) {
    this.identities = Object.create(null); // id -> Identity
    this.defaultMode = opts.defaultMode || IdentityModes.SOVEREIGN;
    this.owner = opts.owner || 'unknown';
    this.audit = [];
    this.audit.push({ op: 'manager_created', owner: this.owner, defaultMode: this.defaultMode });
  }

  createIdentity(profile = {}) {
    const p = Object.assign({}, profile);
    if (!p.owner) p.owner = this.owner;
    if (!p.mode) p.mode = this.defaultMode;
    const ident = new Identity(p);
    this.identities[ident.id] = ident;
    this.audit.push({ op: 'create_identity', id: ident.id });
    return ident;
  }

  getIdentity(id) {
    return this.identities[id] || null;
  }

  setMode(id, mode) {
    const ident = this.getIdentity(id);
    if (!ident) throw new Error(`Identity not found: ${id}`);
    const res = ident.setMode(mode);
    this.audit.push({ op: 'setMode', id, mode, result: !!res });
    return res;
  }

  updateProfile(id, delta) {
    const ident = this.getIdentity(id);
    if (!ident) throw new Error(`Identity not found: ${id}`);
    const res = ident.updateProfile(delta);
    this.audit.push({ op: 'updateProfile', id, delta: Object.assign({}, delta) });
    return res;
  }

  listIdentities() {
    return Object.keys(this.identities).sort().map(k => this.identities[k].snapshot());
  }

  removeIdentity(id) {
    if (this.identities[id]) {
      delete this.identities[id];
      this.audit.push({ op: 'removeIdentity', id });
      return true;
    }
    return false;
  }

  snapshot() {
    return {
      owner: this.owner,
      defaultMode: this.defaultMode,
      identities: this.listIdentities(),
      audit: this.audit.slice()
    };
  }

  // Deterministic restore from snapshot (does not rehydrate prototypes for custom classes)
  restore(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') throw new Error('Invalid snapshot');
    ID.reset();
    this.owner = snapshot.owner || this.owner;
    this.defaultMode = snapshot.defaultMode || this.defaultMode;
    this.identities = Object.create(null);
    if (Array.isArray(snapshot.identities)) {
      for (let i = 0; i < snapshot.identities.length; i += 1) {
        const s = snapshot.identities[i];
        const ident = new Identity(s.profile || {});
        // preserve id and mode if provided
        if (s.id) ident.id = s.id;
        if (s.mode) ident.mode = s.mode;
        if (Number.isFinite(s.createdAtTick)) ident.createdAtTick = s.createdAtTick;
        // copy audit if present
        if (Array.isArray(s.audit)) ident.audit = s.audit.slice();
        this.identities[ident.id] = ident;
      }
    }
    this.audit.push({ op: 'restored', snapshotCount: Array.isArray(snapshot.identities) ? snapshot.identities.length : 0 });
    return true;
  }
}

/* -------------------------
   Exports
   ------------------------- */
module.exports = {
  ID,
  IdentityModes,
  Identity,
  IdentityManager
};
