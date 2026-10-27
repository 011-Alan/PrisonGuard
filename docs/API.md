# PrisonGuard API & WebSocket Specification

## Base URL Configuration
- **Development:** `http://localhost:5000`
- **Production:** Configured via `VITE_API_BASE_URL` on frontends.

---

## 1. Authentication Endpoints

### `POST /api/auth/login`
Authenticates an administrator, supervisor, or operator. Includes rate limiting protection (max 8 failed attempts / 60 seconds).

**Request Body:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response (HTTP 200 OK):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsIn...",
  "user": {
    "id": "USR-001",
    "username": "admin",
    "name": "S. Patel",
    "role": "ADMIN",
    "title": "Senior Security Administrator",
    "badge": "SEC-ADMIN-01"
  }
}
```

### `GET /api/auth/me`
Retrieves current authenticated profile from JWT token.
- **Header:** `Authorization: Bearer <token>`

### `POST /api/auth/logout`
Logs user out and records administrative audit log entry.
- **Header:** `Authorization: Bearer <token>`

---

## 2. Facility State & Telemetry

### `GET /api/state`
Returns the full authoritative snapshot of the facility, including controllers, devices, gates, personnel, active incidents, and activity logs.

### `GET /health`
System readiness and liveness probe for Docker / Kubernetes / Render.
**Response (HTTP 200 OK):**
```json
{
  "status": "ONLINE",
  "service": "PrisonGuard Authoritative IoT & Security Server",
  "environment": "development",
  "uptimeSeconds": 342,
  "systemHealth": 98,
  "controllersOnline": 8,
  "activeIncidents": 3,
  "timestamp": "2026-10-27T17:00:00.000Z"
}
```

### `GET /api/waypoints`
Returns room geometry boundaries and walkable navigation waypoint graph.

---

## 3. Physical Access & Actuation Controls

### `POST /api/gates/:id/command`
Commands a perimeter sliding gate or security turnstile to open or close.
- **Required Roles:** `OPERATOR`, `SUPERVISOR`, `ADMIN`
- **Request Body:**
```json
{
  "targetState": "OPEN"
}
```
*Allowed `targetState` values:* `"OPEN"`, `"CLOSE"`.

### `POST /api/gates/:id/jam`
Simulates mechanical motor stall / foreign obstacle jamming on a gate (triggers Sensor Fusion Rule E).
- **Required Roles:** `OPERATOR`, `SUPERVISOR`, `ADMIN`

### `POST /api/doors/:id/command`
Commands an electronic solenoid cell door lock.
- **Required Roles:** `OPERATOR`, `SUPERVISOR`, `ADMIN`
- **Request Body:**
```json
{
  "action": "UNLOCK"
}
```
*Allowed `action` values:* `"LOCK"`, `"UNLOCK"`.

---

## 4. IoT Sensor Telemetry & Simulation

### `POST /api/sensors/:id/trigger`
Simulates a physical state transition on a sensor.
**Request Body:**
```json
{
  "value": "OPEN"
}
```
*Examples:*
- Reed Switch: `"OPEN"` / `"CLOSED"`
- PIR Motion: `"DETECTED"` / `"CLEAR"`
- IR Optical Barrier: `"BROKEN"` / `"INTACT"`
- Vibration: `"TRIPPED"` / `"NORMAL"`
- Duress Button: `"PRESSED"`

### `POST /api/controllers/:id/toggle`
Simulates power or network outage on an ESP32 node (triggers Rule F cascading failure).
- **Required Roles:** `SUPERVISOR`, `ADMIN`
- **Request Body:**
```json
{
  "isOnline": false
}
```

### `POST /api/rfid/scan`
Simulates presentation of a 13.56MHz contactless RFID security badge to a wall terminal.
**Request Body:**
```json
{
  "readerId": "RFID-BLOCK-A",
  "cardId": "CARD-OFC-514"
}
```

---

## 5. Security Incident Management

### `POST /api/incidents/:id/ack`
Acknowledges an active security incident.
- **Required Roles:** `OPERATOR`, `SUPERVISOR`, `ADMIN`

### `POST /api/incidents/:id/resolve`
Marks an incident as resolved with operator accountability.
- **Required Roles:** `OPERATOR`, `SUPERVISOR`, `ADMIN`

---

## 6. Audit & Packet Sniffer Logs

### `GET /api/logs/audit?limit=100`
Returns sequential audit records and runs cryptographic SHA-256 chain verification.
**Response:**
```json
{
  "logs": [ ... ],
  "verification": {
    "valid": true,
    "verifiedBlocks": 24,
    "currentHeadHash": "7f8b9..."
  }
}
```

### `GET /api/logs/mqtt?limit=60`
Returns recent simulated MQTT topic packets with topic, direction, QoS, and payload.

---

## 7. Socket.IO Events Reference

| Event Name | Direction | Payload Description |
| :--- | :--- | :--- |
| `state:full` | Server → Client | Complete snapshot emitted on connection. |
| `state:tick` | Server → Client | Periodic 1Hz update (heartbeats, uptime, system health %). |
| `people:update` | Server → Client | Live personnel coordinates and room sectors. |
| `mqtt:packet` | Server → Client | Live packet published across the simulated MQTT bus. |
| `announcement:new` | Server → Client | Real-time broadcast public address alert. |
