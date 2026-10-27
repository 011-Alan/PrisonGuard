# PrisonGuard System Architecture

## 1. Architectural Overview

PrisonGuard is an enterprise IoT security and correctional facility operations platform designed with a decoupled, three-tier architecture:

```
┌──────────────────────────────────────┐     ┌──────────────────────────────────────┐
│       Website A: Admin Portal        │     │    Website B: Facility Simulator     │
│   (React 18 + Tailwind + Lucide)     │     │       (React 18 + Vector 2D SVG)     │
│   Deploy Target: Vercel (Project 1)  │     │   Deploy Target: Vercel (Project 2)  │
└──────────────────┬───────────────────┘     └──────────────────┬───────────────────┘
                   │                                            │
                   │ WebSocket (Socket.IO) & REST (HTTP/JSON)   │
                   └────────────────────┬───────────────────────┘
                                        │
                                        ▼
                   ┌────────────────────────────────────────────┐
                   │    PrisonGuard Core Authoritative Server   │
                   │    (Node.js + Express + Socket.IO Server)  │
                   │    Deploy Target: Render / Railway / Docker│
                   └────────────────────┬───────────────────────┘
                                        │
            ┌───────────────────────────┴───────────────────────────┐
            ▼                                                       ▼
┌───────────────────────┐                               ┌───────────────────────┐
│  Simulation & Sensor  │                               │    Persistent Store   │
│     Fusion Engine     │                               │ (JSON File / DB Sync) │
│ - Rules Engine (A–G)  │                               │ - User Accounts (RBAC)│
│ - Pathfinding Graph   │                               │ - SHA-256 Audit Chain │
│ - Simulated MQTT Bus  │                               │ - Security Incidents  │
└───────────────────────┘                               └───────────────────────┘
```

---

## 2. Component Roles & Independence

### Website A: Admin Portal (`apps/admin`)
- **Role:** Security Operations Center (SOC) dashboard.
- **Port:** `5173` (local dev) | Custom domain (production).
- **Independence:** Can be built and run completely independently. It does not require Website B to be open. If the backend is temporarily offline, it presents an informative offline status indicator and automatically reconnects upon recovery.
- **Key Modules:** Live system metrics, facility occupancy, active alerts list, gate actuation controls with confirmation modals, RFID access logs, personnel roster with inspector drawer, IoT controller fleet health, live MQTT packet sniffer, and cryptographic audit log verification.

### Website B: 2D Facility Simulator (`apps/simulator`)
- **Role:** Interactive 2D architectural facility simulation.
- **Port:** `5174` (local dev) | Custom domain (production).
- **Independence:** Can be built and run completely independently. Does not require Website A to be open.
- **Key Modules:** 1600 × 1000 top-down SVG floor plan with pan and zoom navigation, clickable personnel tracking beacons (with "Follow Person" and "Show Route"), IoT sensor overlay (reed switches, PIR motion, IR break-beams, vibration sensors, RFID terminals, ESP32 nodes), gate status and manual jamming controls, and automated scenario runner.

### Core Backend (`server`)
- **Role:** Authoritative state engine, REST API, WebSocket distribution, and persistence manager.
- **Port:** `5000` (configurable via `PORT` environment variable).
- **Key Modules:** Express HTTP router, Socket.IO server, JWT authentication & role-based authorization, sensor fusion rule evaluation, append-only SHA-256 audit log, and file-backed atomic persistence.

---

## 3. Communication Protocols & Data Flow

### 1. Sensor Event Flow (Edge to Cloud to UI)
```
[Virtual Sensor Trigger]
  │  (simulated GPIO interrupt)
  ▼
[ESP32 Controller Node]
  │  (publishes MQTT packet)
  ▼
[Simulated MQTT Bus]
  │  (topics: prisonGuard/sensor/+/state)
  ▼
[Sensor Fusion Engine]
  │  (evaluates deterministic Rules A through G)
  ▼
[State Mutation & Audit Log Entry]
  │  (SHA-256 chained record persisted to disk)
  ▼
[Socket.IO Broadcast]
  │  (event: 'state:full' or 'state:tick')
  ▼
[Admin Dashboard & Simulator Synchronized (< 50ms)]
```

### 2. Administrative Command Flow (Dashboard to Device)
```
[Admin Portal UI]
  │  (Operator clicks "Open Gate" on G-01)
  ▼
[REST POST /api/gates/GATE-01/command]
  │  (Bearer JWT + Role validation: OPERATOR / SUPERVISOR / ADMIN)
  ▼
[Backend Authoritative Engine]
  │  (Checks controller availability; flags command as EXECUTING)
  ▼
[Actuator State Transition]
  │  (Gate state: OPENING, motor current: 2.1A, travel duration: 2.5s)
  ▼
[Simulated Limit Switch Confirmation]
  │  (End-travel switch trips: limitSwitchOpen = true; command CONFIRMED)
  ▼
[Socket.IO Real-time Sync & MQTT Ack]
  │  (Broadcasts confirmed state; logs to audit trail)
  ▼
[Both Websites Reflect OPEN State without Page Refresh]
```

---

## 4. State Management Principles

1. **Single Source of Truth:** The backend memory and persistence store represent the authoritative state. Neither frontend stores authoritative state in browser `localStorage`.
2. **Optimistic Locking & Duplicate Prevention:** Gate and door commands check whether an identical transition is already in progress before creating new commands.
3. **Resilience to Network Loss:** Frontends retrieve full state snapshots (`/api/state`) upon establishing or re-establishing WebSocket connections.
4. **Cascading Failure Modeling:** Disconnecting an ESP32 node causes all subordinate sensors to transition to `OFFLINE / UNKNOWN` status, preventing false "SAFE" readings.
