# PrisonGuard Security & Cryptographic Architecture

## 1. Threat Model & Security Defenses

| Threat Category | Potential Vector | Implemented Mitigation |
| :--- | :--- | :--- |
| **Credential Brute-Forcing** | Automated login password spray on `/api/auth/login` | In-memory sliding window rate limiter (max 8 failed attempts / 60 seconds triggers a 60-second block with HTTP 429). |
| **Cross-Origin Resource Sharing (CORS)** | Malicious external websites sending authenticated requests | Explicit CORS origin whitelist; credentials allowed only for verified domains; wildcards prohibited. |
| **Tampering with Audit Logs** | Post-incident tampering with historical security entries | Append-only sequential journal cryptographically linked using SHA-256 hash chaining. |
| **Privilege Escalation** | Operators attempting administrative facility lockdown or configuration changes | Server-side role-based authorization middleware enforcing least-privilege RBAC. |
| **Actuator Motor Jam / Obstruction** | False confirmation of physical gate closure | Two-stage verification: commanded state vs. end-travel limit switch physical sensor confirmation. |
| **Silent Controller Outage** | ESP32 power or Wi-Fi drops while devices report false "SAFE" | Keep-alive heartbeat monitoring; controller outage sets subordinate sensors to `OFFLINE / UNKNOWN`. |

---

## 2. Role-Based Access Control (RBAC) Matrix

| Action / Capability | `OPERATOR` | `SUPERVISOR` | `ADMIN` |
| :--- | :---: | :---: | :---: |
| View System Dashboard & Real-time Telemetry | ✅ | ✅ | ✅ |
| Inspect Clickable Personnel Beacons & History | ✅ | ✅ | ✅ |
| Standard Gate Open / Close Actuation | ✅ | ✅ | ✅ |
| Simulate Card Swipes & Sensor Triggers | ✅ | ✅ | ✅ |
| Acknowledge Active Incidents | ✅ | ✅ | ✅ |
| Resolve Active Incidents | ✅ | ✅ | ✅ |
| Broadcast Public Announcements | ❌ | ✅ | ✅ |
| Disconnect / Reconnect ESP32 Controllers | ❌ | ✅ | ✅ |
| Inject Gate Mechanical Jams (Fault Testing) | ❌ | ✅ | ✅ |
| Reset Facility Simulation Baseline | ❌ | ❌ | ✅ |
| Verify Cryptographic Audit Hash Chain | ✅ | ✅ | ✅ |

---

## 3. Cryptographic Audit Hash Chaining

Every administrative command, authentication attempt, sensor alert, and incident resolution generates a cryptographic block:

$$\text{Hash}_i = \text{SHA256}(\text{ID}_i \parallel \text{Timestamp}_i \parallel \text{Type}_i \parallel \text{User}_i \parallel \text{Details}_i \parallel \text{Hash}_{i-1})$$

The genesis block is hardcoded as:
`GENESIS_BLOCK_PRISONGUARD_2026_000000000000`

### Chain Integrity Verification:
The `verifyChain()` function traverses every block in chronological order:
1. Re-computes the SHA-256 digest of each block's contents.
2. Asserts that the computed digest matches `block.hash`.
3. Asserts that `block.previousHash` matches the previous block's hash.
4. If any single character in a past event is altered or deleted, verification immediately breaks and flags the compromised block ID.
