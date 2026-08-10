/**
 * cpo.messaging.js
 *
 * Deterministic Message Bus for CPO
 */

'use strict';

const ID = (function () {
  let counter = 0;
  return {
    next(prefix = 'msg') {
      counter += 1;
      return `${prefix}_${String(counter).padStart(6, '0')}`;
    },
    reset() { counter = 0; },
    snapshot() { return counter; }
  };
}());

class MessageBus {
  constructor() {
    this.queues = Object.create(null); // agentId -> [msg]
    this.audit = [];
  }

  _ensure(agentId) {
    if (!this.queues[agentId]) this.queues[agentId] = [];
  }

  send(toAgentId, message) {
    this._ensure(toAgentId);
    const msg = Object.assign({ id: ID.next('msg'), to: toAgentId, ts: null }, message);
    this.queues[toAgentId].push(msg);
    this.audit.push({ op: 'send', to: toAgentId, id: msg.id });
    return msg.id;
  }

  receive(agentId) {
    this._ensure(agentId);
    const q = this.queues[agentId];
    if (q.length === 0) return null;
    const msg = q.shift();
    this.audit.push({ op: 'receive', agent: agentId, id: msg.id });
    return msg;
  }

  peek(agentId) {
    this._ensure(agentId);
    return this.queues[agentId].slice();
  }

  // deterministic snapshot of all queues
  dump() {
    const out = {};
    const keys = Object.keys(this.queues).sort();
    for (let i = 0; i < keys.length; i += 1) {
      out[keys[i]] = this.queues[keys[i]].slice();
    }
    return { queues: out, audit: this.audit.slice() };
  }
}

module.exports = {
  MessageBus,
  ID
};
