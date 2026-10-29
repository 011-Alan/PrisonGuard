# PrisonGuard — ESP32 Physical Door Controller Firmware

This directory contains the production-grade Arduino C++ firmware for the **PrisonGuard Physical Door Actuator Prototype** (`CELL-01-PHYSICAL`).

It integrates an **ESP32 DevKit V1** with an **SG90 micro servo**, an **RC522 RFID reader**, and **status indicator LEDs** to demonstrate physical door movement and contactless credential authorization synchronized with the PrisonGuard web dashboard.

---

## 1. Bill of Materials (Strictly Compliant)

| Component | Specification / Model | Pin / Signal | Electrical Notes |
|---|---|---|---|
| **Microcontroller** | ESP32 DevKit V1 (30-pin or 36-pin) | Micro-USB | 3.3V logic levels; 2.4 GHz Wi-Fi |
| **Servo Motor** | Tower Pro SG90 9g Micro Servo | PWM (Orange wire) $\rightarrow$ **GPIO 13** | 4.8V–6.0V DC. **Do NOT power from ESP32 3.3V!** |
| **RFID Reader** | MFRC522 13.56 MHz RFID SPI Module | SPI (SS: 5, SCK: 18, MOSI: 23, MISO: 19, RST: 22) | **Power from 3.3V ONLY**. 5V destroys chip! |
| **Red LED** | 5mm Through-Hole Red LED | Anode $\rightarrow$ **GPIO 25** (via 220Ω) | Locked / Access Denied indicator; Cathode to GND |
| **Green LED** | 5mm Through-Hole Green LED | Anode $\rightarrow$ **GPIO 26** (via 220Ω) | Authorized / Commanded Open; Cathode to GND |
| **Resistors** | 220Ω (Red-Red-Brown-Gold) | In series with LED anodes | Current-limiting resistors (approx. 7mA at 3.3V) |
| **Wiring** | Breadboard & Dupont Jumper Wires | Male-to-Male & Male-to-Female | Connect all GND pins to a common ground rail |

> [!IMPORTANT]
> **Strict Hardware Boundaries:**
> * No speaker, buzzer, motor driver, or additional display is used.
> * There is no physical prison cell or miniature door; the SG90 servo demonstrates angular door movement on the breadboard.
> * There is no position feedback sensor (limit switch or encoder); the servo position is strictly a **commanded state**, not a verified physical position.

---

## 2. Power Supply Requirements & Common Ground Architecture

> [!CAUTION]
> **Servo Power Requirement:**
> The SG90 micro servo requires 4.8V to 6.0V DC and draws up to **500mA surge current** during rotational acceleration.
> * **Never power the servo from the ESP32 3.3V pin.** The 3.3V low-dropout regulator cannot deliver adequate current and will brown out or reboot the ESP32.
> * **Powering from ESP32 Vin / 5V pin:** If powering the ESP32 via USB from a 2A+ high-current USB wall adapter or powered USB hub, the servo VCC (red wire) may be connected to the ESP32 `Vin` / `5V` pin on the breadboard. If powering from an unpowered PC USB port, use a dedicated 5V power supply.
> * **Common Ground:** All GND lines (ESP32 GND, Servo GND, LED cathodes, and external power supply GND) **must be tied together** to establish a shared 0V reference.

```
+-----------------------------------------------------------+
|              COMMON BREADBOARD POWER RAILS                |
+-----------------------------------------------------------+
  (+) 5V Rail ──────> Servo VCC (Red wire)
  (-) GND Rail ─────┬──> Servo GND (Brown wire)
                    ├──> ESP32 GND pin
                    ├──> RC522 GND pin
                    └──> 220Ω Resistor / LED Cathodes

  ESP32 3.3V Pin ───> RC522 VCC pin (Strictly 3.3V!)
```

---

## 3. GPIO Pinout & Connection Table

| Peripheral | Peripheral Pin | ESP32 DevKit V1 Pin | Jumper Wire Type | Purpose & Electrical Notes |
|---|---|---|---|---|
| **SG90 Servo** | Signal (Orange) | **GPIO 13** | Male-to-Male | 50Hz PWM signal (500µs–2400µs pulse width) |
| **SG90 Servo** | Power (Red) | **Vin (5V)** / Regulated 5V | Male-to-Male | 4.8V–6.0V power rail |
| **SG90 Servo** | Ground (Brown) | **GND** | Male-to-Male | Common Ground return |
| **Red LED** | Anode (+) | **GPIO 25** (via 220Ω) | Male-to-Male | Active HIGH: Door locked or access denied |
| **Red LED** | Cathode (-) | **GND** | Male-to-Male | Connected to GND rail |
| **Green LED** | Anode (+) | **GPIO 26** (via 220Ω) | Male-to-Male | Active HIGH: Door commanded open / access granted |
| **Green LED** | Cathode (-) | **GND** | Male-to-Male | Connected to GND rail |
| **RC522 RFID** | VCC | **3.3V** | Male-to-Female | **CAUTION:** 3.3V ONLY! Do not connect to 5V! |
| **RC522 RFID** | GND | **GND** | Male-to-Female | Connected to common GND rail |
| **RC522 RFID** | RST | **GPIO 22** | Male-to-Female | Hardware reset control |
| **RC522 RFID** | SDA / SS | **GPIO 5** | Male-to-Female | SPI Chip Select (CS0 / SS) |
| **RC522 RFID** | SCK | **GPIO 18** | Male-to-Female | SPI Clock (SCK) |
| **RC522 RFID** | MOSI | **GPIO 23** | Male-to-Female | SPI Master Out / Slave In |
| **RC522 RFID** | MISO | **GPIO 19** | Male-to-Female | SPI Master In / Slave Out |
| **RC522 RFID** | IRQ | *Unconnected* | — | Not used in polling mode |

---

## 4. Arduino IDE Setup Instructions

### Step 1: Install Arduino IDE
Download and install **Arduino IDE 2.x** from [arduino.cc](https://www.arduino.cc/en/software).

### Step 2: Install ESP32 Board Package
1. In Arduino IDE, go to **File $\rightarrow$ Preferences**.
2. In **Additional Boards Manager URLs**, paste:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. Open **Tools $\rightarrow$ Board $\rightarrow$ Boards Manager...**.
4. Search for **esp32** by Espressif Systems and click **Install**.

### Step 3: Select Board & Port
1. Connect your ESP32 DevKit to your computer via USB.
2. Select **Tools $\rightarrow$ Board $\rightarrow$ ESP32 Arduino $\rightarrow$ ESP32 Dev Module**.
3. Select **Tools $\rightarrow$ Port** (e.g. `COM3` on Windows).
4. Recommended upload settings:
   * **Upload Speed:** `921600` (or `115200` if upload fails)
   * **CPU Frequency:** `240MHz`
   * **Flash Frequency:** `80MHz`

### Step 4: Install Required Libraries
Open **Tools $\rightarrow$ Manage Libraries...** (Ctrl+Shift+I) and install:
1. **ArduinoJson** by Benoit Blanchon (Version `6.x` or `7.x`)
2. **ESP32Servo** by Kevin Harrington (Version `1.x` or `3.x`)
3. **MFRC522** by GithubCommunity (Version `1.4.x`)

### Step 5: Configure Firmware
1. In this directory, copy `config.h.example` to `config.h`:
   ```bash
   cp firmware/esp32-door-controller/config.h.example firmware/esp32-door-controller/config.h
   ```
2. Edit `config.h`:
   * Set `WIFI_SSID` and `WIFI_PASSWORD` to your 2.4 GHz Wi-Fi network.
   * Set `SERVER_BASE_URL`:
     * For local testing on the same Wi-Fi router: `http://<YOUR_COMPUTER_IP>:5000` (run `ipconfig` to find your LAN IPv4).
     * For deployed cloud server: `https://prisonguard-server.onrender.com`
   * Verify `DEVICE_TOKEN` matches `HARDWARE_DEVICE_TOKEN` in the backend environment.

### Step 6: Compile and Upload
1. Click **Verify** (checkmark icon) to verify clean compilation.
2. Click **Upload** (arrow icon). If the ESP32 fails to enter bootloader mode automatically, press and hold the **BOOT** button on the ESP32 board until the IDE displays `Connecting...`.
3. Open **Tools $\rightarrow$ Serial Monitor** and set the baud rate to **115200**.

---

## 5. Security & Verification Lifecycle

* **Fail-Closed Security**: If the Wi-Fi connection drops or the backend cannot be reached, the firmware strictly rejects all RFID access attempts, flashes the Red LED, and keeps the servo closed.
* **Idempotency**: The firmware tracks `lastExecutedCommandId` to prevent double-actuation if a retry occurs.
* **Non-Blocking Architecture**: The firmware loop uses `millis()` timers; servo transit occurs at 15ms per degree without blocking network polling or RFID scans.
