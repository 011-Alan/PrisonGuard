import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

class PersistentStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.dir = path.dirname(filePath);
    this.data = null;
    this.ensureInitialized();
  }

  ensureInitialized() {
    try {
      if (!fs.existsSync(this.dir)) {
        fs.mkdirSync(this.dir, { recursive: true });
      }

      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.data = JSON.parse(raw);
      } else {
        this.data = this.getDefaultSchema();
        this.save();
      }
    } catch (err) {
      console.warn(`[Storage] Failed to read store file (${err.message}). Using clean baseline.`);
      this.data = this.getDefaultSchema();
    }
  }

  getDefaultSchema() {
    return {
      version: '1.0.0',
      initializedAt: new Date().toISOString(),
      lastSavedAt: new Date().toISOString(),
      auditLogs: [],
      incidents: [],
      accessLogs: [],
      deviceLogs: [],
      settings: {
        simulationSpeed: 1,
        irSensitivity: 'HIGH',
        vibrationThresholdG: 2.0
      }
    };
  }

  save() {
    try {
      if (!fs.existsSync(this.dir)) {
        fs.mkdirSync(this.dir, { recursive: true });
      }
      this.data.lastSavedAt = new Date().toISOString();
      const content = JSON.stringify(this.data, null, 2);
      try {
        const tempPath = `${this.filePath}.tmp`;
        fs.writeFileSync(tempPath, content, 'utf-8');
        fs.renameSync(tempPath, this.filePath);
      } catch (renameErr) {
        // Fallback directly on Windows if temp file rename has transient lock
        fs.writeFileSync(this.filePath, content, 'utf-8');
      }
    } catch (err) {
      console.error('[Storage Error] Failed to persist data to disk:', err);
    }
  }

  getAuditLogs() {
    return this.data.auditLogs || [];
  }

  setAuditLogs(logs) {
    this.data.auditLogs = logs;
    this.save();
  }

  getIncidents() {
    return this.data.incidents || [];
  }

  setIncidents(incidents) {
    this.data.incidents = incidents;
    this.save();
  }

  getAccessLogs() {
    return this.data.accessLogs || [];
  }

  setAccessLogs(logs) {
    this.data.accessLogs = logs;
    this.save();
  }

  getDeviceLogs() {
    return this.data.deviceLogs || [];
  }

  setDeviceLogs(logs) {
    this.data.deviceLogs = logs;
    this.save();
  }

  reset() {
    this.data = this.getDefaultSchema();
    this.save();
    return this.data;
  }
}

export const db = new PersistentStore(config.dataStorePath);
