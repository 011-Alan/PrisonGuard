import crypto from 'crypto';
import { db } from '../storage/db.js';

class AuditLogger {
  constructor() {
    this.logs = db.getAuditLogs();
    
    if (this.logs.length > 0) {
      this.lastHash = this.logs[0].hash;
    } else {
      this.lastHash = 'GENESIS_BLOCK_PRISONGUARD_2026_000000000000';
      this.log({
        type: 'SYSTEM_BOOT',
        user: { username: 'SYSTEM', role: 'SYSTEM' },
        action: 'Authoritative Security & IoT Engine Initialized',
        details: { version: '2.4.0', status: 'ONLINE', nodes: 8 }
      });
    }
  }

  log({ type, user, action, details = {} }) {
    const id = `AUDIT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const timestamp = new Date().toISOString();
    const payload = {
      id,
      timestamp,
      type,
      user: user || { username: 'ANONYMOUS', role: 'NONE' },
      action,
      details,
      previousHash: this.lastHash
    };

    const hashString = `${id}:${timestamp}:${type}:${JSON.stringify(user)}:${JSON.stringify(details)}:${this.lastHash}`;
    const hash = crypto.createHash('sha256').update(hashString).digest('hex');

    payload.hash = hash;
    this.lastHash = hash;
    this.logs.unshift(payload); // most recent first

    if (this.logs.length > 500) {
      this.logs.pop();
    }

    db.setAuditLogs(this.logs);
    return payload;
  }

  getLogs(limit = 100) {
    return this.logs.slice(0, limit);
  }

  reset() {
    this.logs = [];
    this.lastHash = 'GENESIS_BLOCK_PRISONGUARD_2026_000000000000';
    this.log({
      type: 'AUDIT_RESET',
      user: { username: 'ADMIN', role: 'ADMIN' },
      action: 'Audit logs reset to baseline genesis state',
      details: {}
    });
    return this.logs;
  }

  verifyChain() {
    const chronological = [...this.logs].reverse();
    let currentExpectedPrev = 'GENESIS_BLOCK_PRISONGUARD_2026_000000000000';

    for (let i = 0; i < chronological.length; i++) {
      const entry = chronological[i];
      if (entry.previousHash !== currentExpectedPrev) {
        return {
          valid: false,
          brokenAtIndex: i,
          brokenEntryId: entry.id,
          reason: `Previous hash mismatch at entry ${entry.id}`
        };
      }

      const hashString = `${entry.id}:${entry.timestamp}:${entry.type}:${JSON.stringify(entry.user)}:${JSON.stringify(entry.details)}:${entry.previousHash}`;
      const recalculatedHash = crypto.createHash('sha256').update(hashString).digest('hex');

      if (recalculatedHash !== entry.hash) {
        return {
          valid: false,
          brokenAtIndex: i,
          brokenEntryId: entry.id,
          reason: `Hash integrity failure at entry ${entry.id}`
        };
      }

      currentExpectedPrev = entry.hash;
    }

    return {
      valid: true,
      verifiedBlocks: chronological.length,
      currentHeadHash: this.lastHash
    };
  }
}

export const auditLogger = new AuditLogger();
