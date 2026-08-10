/**
 * kernel.modes.js
 *
 * Kernel mode constants and helpers for PrimeForgeX
 * Deterministic, small, and safe for on-device use.
 */

'use strict';

const KernelModes = Object.freeze({
  OFFLINE: 'offline',
  SOVEREIGN: 'sovereign',
  SANDBOX: 'sandbox',
  AUDIT: 'audit',
  MAINTENANCE: 'maintenance'
});

function isValidMode(m) {
  return Object.prototype.hasOwnProperty.call(KernelModes, String(m).toUpperCase());
}

function normalizeMode(m) {
  const s = String(m || '').toLowerCase();
  switch (s) {
    case 'offline': return KernelModes.OFFLINE;
    case 'sovereign': return KernelModes.SOVEREIGN;
    case 'sandbox': return KernelModes.SANDBOX;
    case 'audit': return KernelModes.AUDIT;
    case 'maintenance': return KernelModes.MAINTENANCE;
    default: return KernelModes.SOVEREIGN;
  }
}

module.exports = {
  KernelModes,
  isValidMode,
  normalizeMode
};
