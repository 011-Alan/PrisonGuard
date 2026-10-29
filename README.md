# PRISONGUARD
## IoT-Based Smart Prison Security, Safety and Operations Management System

[![Build & Test Status](https://img.shields.io/badge/tests-38%20passed-brightgreen?style=flat-square)](server/test/run-all.js)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg?style=flat-square)](package.json)
[![Architecture: Decoupled 3--Tier](https://img.shields.io/badge/architecture-3--tier%20monorepo-orange.svg?style=flat-square)](docs/ARCHITECTURE.md)

PrisonGuard is an enterprise IoT security and smart correctional facility operations management demonstration. The platform demonstrates how access control, physical security sensors, ESP32 microcontrollers, MQTT/WebSocket telemetry, linear gate actuators, personnel location tracking, security incidents, and administrative monitoring operate cohesively in a modern correctional environment.

The platform consists of **three independently runnable and deployable services**:
1. **Website A: Admin Portal (`apps/admin`)** – Security Operations Center (SOC) dashboard.
2. **Website B: Facility Simulator (`apps/simulator`)** – Top-down interactive 2D prison floor plan with clickable tracking beacons, IoT sensor overlay, and gate actuators.
3. **Core Authoritative Server (`server`)** – Node.js, Express, Socket.IO, SHA-256 hash audit chaining, and simulated MQTT telemetry bus.

---

## 📑 Documentation Index

- **[System Architecture & Data Flow](docs/ARCHITECTURE.md)** – Comprehensive architecture, component isolation, and state synchronization.
- **[REST API & WebSocket Catalogue](docs/API.md)** – Endpoints, request/response schemas, error codes, and Socket.IO events.
- **[Independent Deployment Guide](docs/DEPLOYMENT.md)** – Step-by-step deployment to Vercel (frontends) and Render / Docker (backend).
- **[Security Architecture & Threat Model](docs/SECURITY.md)** – RBAC matrix, rate limiting, and cryptographic SHA-256 audit log chaining.

---

## ⚡ Quick Start (Local Development)

### Prerequisites
- Node.js (v18.0.0 or higher)
- npm (v9.0.0 or higher)

### 1. Install All Dependencies
```bash
npm run install:all
```

### 2. Start All Services Concurrently
```bash
npm run dev
# or: node start-all.js
```

### 3. Or Start Services Individually in Dedicated Terminals
```bash
# Terminal 1: Backend Server (Port 5000)
npm run dev:server

# Terminal 2: Admin Portal (Port 5173)
npm run dev:admin

# Terminal 3: Facility Simulator (Port 5174)
npm run dev:simulator
```

### 4. Access the Applications
- **Admin Portal (Website A):** [http://localhost:5173](http://localhost:5173)
- **Facility Simulator (Website B):** [http://localhost:5174](http://localhost:5174)
- **Backend Health Probe:** [http://localhost:5000/health](http://localhost:5000/health)

---

## 🔐 Demonstration Credentials (Server-Side RBAC)

On the Admin Portal login page, you can type credentials or click the **1-Click Demo Account** buttons:

| Username | Password | Role | Description |
| :--- | :--- | :--- | :--- |
| **`admin`** | `admin123` | **ADMIN** | Full administrative and control privileges |
| **`supervisor`** | `super123` | **SUPERVISOR** | Incident review, broadcast announcements, operations |
| **`operator`** | `op123` | **OPERATOR** | Standard gate and device inspection controls |

---

## 🧪 Automated Test Suite

PrisonGuard includes an automated end-to-end integration and security test suite covering health probes, authentication, RBAC boundaries, command lifecycles, sensor fusion rules, and audit chain verification.

Run all tests:
```bash
npm test
```
*Output: 38 passed, 0 failed.*

---

## 🏗️ Production Build Commands

Both frontends can be built independently for production deployment:

```bash
# Build both frontends
npm run build

# Or build individually
npm run build:admin      # Output: apps/admin/dist
npm run build:simulator  # Output: apps/simulator/dist
```

---

## 🛠️ ESP32 Physical Hardware Integration (Cell A-101 Prototype)

PrisonGuard features an optional, decoupled physical hardware integration layer that binds an **ESP32 DevKit V1** microcontroller to Cell A-101.

### Physical Bill of Materials (Strictly Compliant)
* **ESP32 DevKit V1** (Wi-Fi + Bluetooth)
* **Tower Pro SG90 9g Micro Servo** (Actuates 0° closed to 90° open) $\rightarrow$ **GPIO 13**
* **RC522 13.56 MHz RFID Reader** $\rightarrow$ SPI: SS (**GPIO 5**), SCK (**18**), MOSI (**23**), MISO (**19**), RST (**22**), Power: **3.3V ONLY**
* **Red Indicator LED** (Locked / Access Denied) $\rightarrow$ **GPIO 25** via 220Ω resistor
* **Green Indicator LED** (Commanded Open / Access Granted) $\rightarrow$ **GPIO 26** via 220Ω resistor
* *Notice:* No buzzer, speaker, motor driver, physical cell door, or reed switch sensor is used. Servo position represents an authoritative **commanded state** (position unverified).

### Non-Blocking Architecture & Fail-Closed Security
* **Decoupled Operation:** The software simulation operates 100% non-blocking. If the ESP32 is powered off or disconnected, the simulator continues normal execution without latency or failure.
* **Fail-Closed Policy:** If the microcontroller drops Wi-Fi or cannot reach the backend, it strictly denies all RFID access requests.
* **Idempotent Commands:** Prevents duplicate servo actuation on retries.

### Running the Hardware Simulator or Physical Firmware
1. **Software Mock Controller:**
   ```bash
   node server/scripts/simulate-esp32.js
   ```
2. **Physical ESP32 Firmware:**
   * Open `firmware/esp32-door-controller/esp32-door-controller.ino` in Arduino IDE.
   * Copy `config.h.example` to `config.h` and configure Wi-Fi and backend URL.
   * Upload to ESP32 Dev Module.

---

## 🌐 Environment Variables Summary

### Backend (`server/.env`)
| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | Listening port for Express & Socket.IO | `5000` |
| `NODE_ENV` | Environment mode (`development` or `production`) | `development` |
| `JWT_SECRET` | Secret key for signing authentication tokens | *Required in prod* |
| `ALLOWED_ORIGINS` | Comma-separated allowed frontend origins for CORS | `http://localhost:5173,http://localhost:5174` |
| `ADMIN_ORIGIN` | Exact URL of the Admin Portal | `http://localhost:5173` |
| `SIMULATOR_ORIGIN` | Exact URL of the 2D Simulator | `http://localhost:5174` |
| `DATA_STORE_PATH` | File path for persistent JSON state storage | `./data/prisonguard_store.json` |

### Admin Frontend (`apps/admin/.env`)
| Variable | Description | Default |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Base HTTP endpoint for the backend API | `http://localhost:5000` |
| `VITE_WS_URL` | WebSocket / Socket.IO endpoint | `http://localhost:5000` |
| `VITE_SIMULATOR_URL` | Cross-link URL to open the 2D Simulator | `http://localhost:5174` |

### Simulator Frontend (`apps/simulator/.env`)
| Variable | Description | Default |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Base HTTP endpoint for the backend API | `http://localhost:5000` |
| `VITE_WS_URL` | WebSocket / Socket.IO endpoint | `http://localhost:5000` |
| `VITE_ADMIN_URL` | Cross-link URL to open the Admin Portal | `http://localhost:5173` |

---

## 📦 Safe Git Commands for Review & Commit

To initialize Git (if not yet initialized), review modified files, and safely commit to GitHub:

```bash
# 1. Initialize Git repository
git init

# 2. Check tracked and ignored files (verify node_modules and .env are ignored)
git status

# 3. Stage all source files, documentation, and configs
git add .

# 4. Review staged files
git status

# 5. Commit changes
git commit -m "feat: complete PrisonGuard independent deployment architecture and GitHub readiness"

# 6. Add your remote repository and push (replace URL with your repository)
# git remote add origin https://github.com/<your-username>/PrisonGuard.git
# git branch -M main
# git push -u origin main
```
