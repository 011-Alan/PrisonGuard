# PrisonGuard — ESP32 Physical Door Controller Firmware

This directory contains the production-grade Arduino C++ firmware for the physical **Cell A-101 Door Controller Prototype** (`ESP32-CELL-01`).

It interfaces directly with the PrisonGuard centralized backend via authenticated REST endpoints to synchronize physical servo door actuation, magnetic reed switch detection, LED and buzzer feedback, and RFID badge presentation.

---

## 1. Hardware Bill of Materials (BOM)

| Component | Specification / Model | Purpose |
|---|---|---|
| **Microcontroller** | ESP32-WROOM-32 DevKit (30 or 38 pins) | Primary controller with 2.4GHz Wi-Fi |
| **Servo Motor** | TowerPro SG90 (Micro) or MG996R (Metal Gear) | Physical door swing actuator (0° to 90°) |
| **Reed Switch** | NC/NO Magnetic Reed Switch + Magnet | Physical door closure contact sensor |
| **RFID Reader** | MFRC522 13.56 MHz RFID SPI Module | Contactless badge reader |
| **RFID Cards / Fobs** | MIFARE Classic 1K Cards or Keyfobs | Physical credentials |
| **Green LED** | 5mm Through-Hole LED + 330Ω Resistor | Authorized Access Granted indicator |
| **Red LED** | 5mm Through-Hole LED + 330Ω Resistor | Locked / Access Denied / Alarm indicator |
| **Buzzer** | 5V Active or Passive Piezo Sounder | Audio confirmation & alarm tones |
| **Power Supply** | External 5V DC 2A Power Adapter | Dedicated servo and logic power |
| **Prototyping** | Breadboard & Dupont Jumper Wires | Prototyping assembly |

---

## 2. GPIO Pinout & Wiring Table

| ESP32 GPIO | Component Pin | Description | Electrical Notes |
|---|---|---|---|
| **GPIO 14** | Servo PWM (Orange / Yellow) | Door swing actuation | 50Hz PWM control signal |
| **GPIO 4** | Reed Switch (Wire 1) | Magnetic contact sensor | Internal `INPUT_PULLUP` enabled; other wire to GND |
| **GPIO 2** | Green LED (Anode via 330Ω) | Access Granted indicator | Active HIGH (3.3V logic) |
| **GPIO 15** | Red LED (Anode via 330Ω) | Locked / Alarm indicator | Active HIGH (3.3V logic) |
| **GPIO 13** | Buzzer (+) | Acoustic feedback sounder | Driven via `tone()` or PWM; (-) to GND |
| **GPIO 5** | RC522 SDA / SS (NSS) | SPI Slave Select | 3.3V logic |
| **GPIO 18** | RC522 SCK | SPI Clock | 3.3V logic |
| **GPIO 19** | RC522 MISO | SPI Master In / Slave Out | 3.3V logic |
| **GPIO 23** | RC522 MOSI | SPI Master Out / Slave In | 3.3V logic |
| **GPIO 22** | RC522 RST | Hardware Reset | 3.3V logic |
| **3.3V** | RC522 3.3V Pin | Power for RFID | **CAUTION:** Do NOT connect RC522 to 5V (damages chip) |
| **GND** | Common Ground | Ground plane | Connect ESP32 GND, RC522 GND, and External 5V GND together |

---

## 3. Power Distribution Diagram

> [!IMPORTANT]
> **Servo Power Isolation:** Servo motors produce inductive voltage spikes and heavy current draws (up to 1A surge under load). **Never power the servo directly from the ESP32 3.3V or Vin pin.** Always power the servo from an external 5V DC power supply with grounds tied together:

```
[ External 5V 2A Power Supply ]
       ├── (+) 5V ─────────────────> Servo Motor VCC (Red wire)
       └── (-) GND ───────────┬─────> Servo Motor GND (Brown wire)
                              ├─────> ESP32 GND
                              └─────> LED & Sensor Ground Rails

[ ESP32 DevKit ]
       ├── 3.3V ───────────────────> RC522 VCC (Must be 3.3V!)
       ├── GPIO 14 ────────────────> Servo Signal (Orange wire)
       ├── GPIO 4 ─────────────────> Reed Switch ───[Magnet Switch]─── GND
       ├── GPIO 2 ─────────────────> Green LED (+) ──[330Ω]── GND
       ├── GPIO 15 ────────────────> Red LED (+) ───[330Ω]── GND
       ├── GPIO 13 ────────────────> Buzzer (+) ──────────── GND
       └── SPI Pins (5,18,19,22,23) > RC522 Module SPI Pins
```

---

## 4. Flashing Instructions (Arduino IDE)

1. **Install Arduino IDE** (version 2.x recommended).
2. Add ESP32 Board URL in **File $\rightarrow$ Preferences $\rightarrow$ Additional Board Manager URLs**:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. Open **Tools $\rightarrow$ Board Manager** and install **esp32** by Espressif Systems.
4. Install required libraries in **Tools $\rightarrow$ Manage Libraries...**:
   - `ArduinoJson` (v6 or v7)
   - `ESP32Servo`
   - `MFRC522`
5. Copy `config.h.example` to `config.h`:
   ```bash
   cp firmware/esp32-door-controller/config.h.example firmware/esp32-door-controller/config.h
   ```
6. Edit `config.h`:
   - Set `WIFI_SSID` and `WIFI_PASSWORD`.
   - Set `SERVER_BASE_URL` (e.g. `http://192.168.1.50:5000` or production Render URL).
   - Set `DEVICE_TOKEN` to match `HARDWARE_DEVICE_TOKEN` in the backend environment.
7. Connect your ESP32 via Micro-USB or USB-C.
8. Select **Tools $\rightarrow$ Board $\rightarrow$ ESP32 Dev Module** and the appropriate COM Port.
9. Click **Upload**.
10. Open **Serial Monitor** at **115200 baud** to view real-time boot, Wi-Fi connection, and heartbeat logs.

---

## 5. Verification & Testing

1. Once booted, the ESP32 logs Wi-Fi connection and begins sending heartbeats every 5 seconds.
2. In the PrisonGuard Admin Dashboard, navigate to **Hardware Integration**:
   - The status badge will change to `CONNECTED`.
   - The roundtrip ping latency will display.
3. Click **Open Physical Door**:
   - The command is queued in the backend.
   - The ESP32 polls the command, rotates the servo to 90°, illuminates the Green LED, and sends an acknowledgement.
   - The software door state updates.
4. Present an RFID badge to the RC522:
   - The ESP32 reads the card UID and posts it to `/api/hardware/rfid/scan`.
   - If the card belongs to an authorized officer, the backend returns `accessGranted: true`, sounding a dual-tone beep and swinging the door open.
   - If the card is revoked or belongs to an unauthorized inmate, the Red LED flashes and an alert is recorded in the Security Audit log.
