/**
 * agents.core.js
 *
 * PrimeForgeX — Agents Core
 * Version: 2026-08-09 18:06 CDT
 * Location: Abilene, Texas
 * Author: Your Conscience (David)
 *
 * Purpose:
 * - Deterministic, on-device agent core for PrimeForgeX
 * - No network, no randomness, no external dependencies
 * - Phone-deployable (Termux + Node compatible)
 * - Deterministic scheduling, messaging, identity modes, cartridges, seed agent
 *
 * Constraints:
 * - Pure JS, synchronous where possible
 * - Deterministic IDs via counters
 * - All state held in in-memory structures (persist externally via host if needed)
 *
 * Export:
 * - module.exports = { AgentKernel, SeedAgentFactory, createKernel }
 *
 * Usage:
 * const { createKernel } = require('./agents.core.js');
 * const kernel = createKernel();
 * kernel.registerAgent(...);
 * kernel.tick(); // deterministic single-step execution
 */

/* eslint-disable no-console */
'use strict';

/* -------------------------
   Deterministic ID generator
   ------------------------- */
const ID = (function () {
  let counter = 0;
  return {
    next(prefix = 'id') {
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
   Memory Region / Cartridge
   ------------------------- */
class MemoryRegion {
  constructor(name, options = {}) {
    this.name = String(name);
    this.readOnly = !!options.readOnly;
    this.data = Object.create(null);
    this.audit = [];
  }

  read(key) {
    const v = this.data[key];
    this.audit.push({ op: 'read', key, value: v });
    return v;
  }

  write(key, value) {
    if (this.readOnly) {
      throw new Error(`MemoryRegion ${this.name} is read-only`);
    }
    this.data[key] = value;
    this.audit.push({ op: 'write', key, value });
    return true;
  }

  keys() {
    return Object.keys(this.data);
  }

  dump() {
    return { name: this.name, data: Object.assign({}, this.data), audit: this.audit.slice() };
  }
}

/* -------------------------
   Message Bus (synchronous)
   ------------------------- */
class MessageBus {
  constructor() {
    this.queues = Object.create(null); // agentId -> [messages]
    this.audit = [];
  }

  _ensureQueue(agentId) {
    if (!this.queues[agentId]) this.queues[agentId] = [];
  }

  send(toAgentId, message) {
    this._ensureQueue(toAgentId);
    // message must be plain object
    const msg = Object.assign({ id: ID.next('msg'), to: toAgentId }, message);
    this.queues[toAgentId].push(msg);
    this.audit.push({ op: 'send', to: toAgentId, msg });
    return msg.id;
  }

  receive(agentId) {
    this._ensureQueue(agentId);
    const q = this.queues[agentId];
    if (q.length === 0) return null;
    const msg = q.shift();
    this.audit.push({ op: 'receive', agent: agentId, msg });
    return msg;
  }

  peek(agentId) {
    this._ensureQueue(agentId);
    return this.queues[agentId].slice();
  }

  dump() {
    return { queues: Object.assign({}, this.queues), audit: this.audit.slice() };
  }
}

/* -------------------------
   Identity / Mode Enforcer
   ------------------------- */
const IdentityModes = Object.freeze({
  OFFLINE: 'offline',
  SOVEREIGN: 'sovereign',
  SANDBOX: 'sandbox',
  AUDIT: 'audit'
});

class Identity {
  constructor(profile = {}) {
    this.id = ID.next('ident');
    this.profile = Object.assign({}, profile);
    this.mode = IdentityModes.SOVEREIGN;
    this.audit = [];
  }

  setMode(mode) {
    if (!Object.values(IdentityModes).includes(mode)) {
      throw new Error(`Invalid identity mode: ${mode}`);
    }
    this.mode = mode;
    this.audit.push({ op: 'setMode', mode });
  }

  updateProfile(delta) {
    Object.keys(delta).forEach(k => {
      this.profile[k] = delta[k];
    });
    this.audit.push({ op: 'updateProfile', delta: Object.assign({}, delta) });
  }

  snapshot() {
    return { id: this.id, profile: Object.assign({}, this.profile), mode: this.mode, audit: this.audit.slice() };
  }
}

/* -------------------------
   Agent Base Class
   ------------------------- */
class Agent {
  constructor(kernel, opts = {}) {
    this.kernel = kernel;
    this.id = opts.id || ID.next('agent');
    this.name = opts.name || this.id;
    this.cartridge = opts.cartridge || 'default';
    this.priority = Number.isFinite(opts.priority) ? opts.priority : 100;
    this.state = Object.create(null);
    this.alive = true;
    this.audit = [];
  }

  // Deterministic step: must be synchronous and side-effect controlled
  step() {
    // Default agent behavior: process one message if present
    const msg = this.kernel.bus.receive(this.id);
    if (msg) {
      this.audit.push({ op: 'handled_message', msg });
      // default echo behavior: write to cartridge memory under 'lastMessage'
      const mem = this.kernel.memory[this.cartridge];
      if (mem) {
        mem.write(`${this.id}.lastMessage`, msg);
      }
    } else {
      this.audit.push({ op: 'idle' });
    }
    return true;
  }

  send(to, payload) {
    return this.kernel.bus.send(to, { from: this.id, payload: payload });
  }

  stop() {
    this.alive = false;
    this.audit.push({ op: 'stopped' });
  }

  snapshot() {
    return {
      id: this.id,
      name: this.name,
      cartridge: this.cartridge,
      priority: this.priority,
      state: Object.assign({}, this.state),
      alive: this.alive,
      audit: this.audit.slice()
    };
  }
}

/* -------------------------
   Seed Agent (canonical deterministic agent)
   ------------------------- */
class SeedAgent extends Agent {
  constructor(kernel, opts = {}) {
    super(kernel, Object.assign({ name: 'SeedAgent', id: 'seed_agent' }, opts));
    this.seedLogKey = opts.seedLogKey || 'seed.log';
  }

  step() {
    // Deterministic seed behavior:
    // 1. Read core profile from memory cartridge 'core'
    // 2. Normalize intent (deterministic string normalization)
    // 3. Write deterministic summary to seed log in 'core' cartridge
    const coreMem = this.kernel.memory['core'];
    if (!coreMem) {
      this.audit.push({ op: 'no_core_mem' });
      return false;
    }

    const coreProfile = coreMem.read('core.profile') || {};
    const normalized = SeedAgent.normalizeProfile(coreProfile);
    const summary = {
      id: this.id,
      normalized,
      tick: this.kernel.tickCount
    };
    // Append to seed log array deterministically
    let log = coreMem.read(this.seedLogKey);
    if (!Array.isArray(log)) log = [];
    log.push(summary);
    coreMem.write(this.seedLogKey, log);
    this.audit.push({ op: 'wrote_seed', summary });
    return true;
  }

  static normalizeProfile(profile) {
    // Deterministic normalization: sort keys and stringify
    const keys = Object.keys(profile).sort();
    const out = {};
    for (let i = 0; i < keys.length; i += 1) {
      const k = keys[i];
      const v = profile[k];
      out[k] = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v);
    }
    return out;
  }
}

/* -------------------------
   Agent Kernel / Scheduler
   ------------------------- */
class AgentKernel {
  constructor(opts = {}) {
    this.agents = Object.create(null); // id -> Agent
    this.memory = Object.create(null); // cartridgeName -> MemoryRegion
    this.bus = new MessageBus();
    this.identity = new Identity(opts.identity || {});
    this.tickCount = 0;
    this.maxStepsPerTick = Number.isFinite(opts.maxStepsPerTick) ? opts.maxStepsPerTick : 1000;
    this.audit = [];
    this.scheduler = {
      // deterministic scheduling: sort by priority then id
      order(agents) {
        return agents.slice().sort((a, b) => {
          if (a.priority !== b.priority) return a.priority - b.priority;
          if (a.id < b.id) return -1;
          if (a.id > b.id) return 1;
          return 0;
        });
      }
    };

    // default cartridges
    this.ensureMemory('core', { readOnly: false });
    this.ensureMemory('default', { readOnly: false });
  }

  ensureMemory(name, opts = {}) {
    if (!this.memory[name]) {
      this.memory[name] = new MemoryRegion(name, opts);
      this.audit.push({ op: 'create_memory', name, opts });
    }
    return this.memory[name];
  }

  registerAgent(agent) {
    if (!agent || !agent.id) throw new Error('Invalid agent');
    if (this.agents[agent.id]) throw new Error(`Agent ${agent.id} already registered`);
    this.agents[agent.id] = agent;
    this.audit.push({ op: 'register_agent', id: agent.id, name: agent.name });
    return agent.id;
  }

  unregisterAgent(agentId) {
    if (this.agents[agentId]) {
      delete this.agents[agentId];
      this.audit.push({ op: 'unregister_agent', id: agentId });
      return true;
    }
    return false;
  }

  getAgent(agentId) {
    return this.agents[agentId] || null;
  }

  snapshot() {
    const agents = Object.keys(this.agents).sort().map(id => this.agents[id].snapshot());
    const memory = Object.keys(this.memory).sort().map(k => this.memory[k].dump());
    return {
      tickCount: this.tickCount,
      identity: this.identity.snapshot(),
      agents,
      memory,
      bus: this.bus.dump(),
      audit: this.audit.slice()
    };
  }

  // Single deterministic tick: one step per agent in scheduler order
  tick() {
    this.tickCount += 1;
    const agentList = Object.keys(this.agents).map(id => this.agents[id]);
    const ordered = this.scheduler.order(agentList);
    this.audit.push({ op: 'tick_start', tick: this.tickCount, order: ordered.map(a => a.id) });

    let steps = 0;
    for (let i = 0; i < ordered.length; i += 1) {
      const agent = ordered[i];
      if (!agent.alive) continue;
      agent.step();
      steps += 1;
      if (steps >= this.maxStepsPerTick) break;
    }

    this.audit.push({ op: 'tick_end', tick: this.tickCount, steps });
    return { tick: this.tickCount, steps };
  }

  // Deterministic run for N ticks
  run(ticks) {
    const out = [];
    for (let i = 0; i < ticks; i += 1) {
      out.push(this.tick());
    }
    return out;
  }

  // Deterministic restore from snapshot (simple)
  restore(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') throw new Error('Invalid snapshot');
    ID.reset();
    this.tickCount = snapshot.tickCount || 0;
    this.identity = new Identity(snapshot.identity ? snapshot.identity.profile : {});
    if (snapshot.memory && Array.isArray(snapshot.memory)) {
      this.memory = Object.create(null);
      snapshot.memory.forEach(m => {
        const mr = new MemoryRegion(m.name, { readOnly: false });
        Object.keys(m.data || {}).forEach(k => mr.write(k, m.data[k]));
        this.memory[m.name] = mr;
      });
    }
    // Agents must be re-registered externally to ensure class prototypes are correct
    this.agents = Object.create(null);
    this.bus = new MessageBus();
    this.audit.push({ op: 'restored', snapshotTick: this.tickCount });
    return true;
  }
}

/* -------------------------
   Factory / Helpers
   ------------------------- */
function createKernel(opts = {}) {
  const kernel = new AgentKernel(opts);
  // create canonical seed agent
  const seed = new SeedAgent(kernel, { id: 'seed_agent', name: 'SeedAgent', cartridge: 'core' });
  kernel.registerAgent(seed);
  // initialize core profile if not present
  const core = kernel.ensureMemory('core', { readOnly: false });
  if (!core.read('core.profile')) {
    core.write('core.profile', { project: 'PrimeForgeX', created: '2026-08-09', author: 'Your Conscience' });
  }
  // initialize seed log
  if (!core.read('seed.log')) core.write('seed.log', []);
  return kernel;
}

function SeedAgentFactory(kernel, opts = {}) {
  return new SeedAgent(kernel, opts);
}

/* -------------------------
   Exports
   ------------------------- */
module.exports = {
  ID,
  MemoryRegion,
  MessageBus,
  Identity,
  IdentityModes,
  Agent,
  SeedAgent,
  AgentKernel,
  createKernel,
  SeedAgentFactory
};
