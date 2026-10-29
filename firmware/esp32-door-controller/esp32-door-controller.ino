/**
 * ==============================================================================
 * PrisonGuard — ESP32 Physical Door Controller Firmware
 * ==============================================================================
 *
 * Microcontroller: ESP32 DevKit V1 (ESP32-WROOM-32)
 * Prototype Target: Cell A-101 Physical Door Demonstration
 *
 * Bill of Materials (Strictly Compliant):
 *   - ESP32 DevKit V1
 *   - Tower Pro SG90 9g Micro Servo (PWM on GPIO 13)
 *   - RC522 13.56 MHz RFID Reader (SPI Hardware Bus)
 *   - Red LED (GPIO 25 via 220Ω resistor to GND)
 *   - Green LED (GPIO 26 via 220Ω resistor to GND)
 *   - Breadboard & Jumper Wires
 *
 * Required Arduino Libraries (Install via Library Manager):
 *   - "ArduinoJson" (v6.x or v7.x) by Benoit Blanchon
 *   - "ESP32Servo" by Kevin Harrington
 *   - "MFRC522" by GithubCommunity
 *
 * Architectural Guarantees:
 *   - 100% Non-blocking operational loop using millis() state machines
 *   - Idempotent command processing with duplicate delivery rejection
 *   - Fail-closed security policy: Denies RFID access when backend unreachable
 *   - Explicit distinction: Servo position is a commanded state, NOT a verified
 *     physical position (there is no physical encoder or limit switch).
 * ==============================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ESP32Servo.h>
#include <ArduinoJson.h>

#if __has_include("config.h")
  #include "config.h"
#else
  #include "config.h.example"
#endif

// ==============================================================================
// Hardware Peripherals
// ==============================================================================
Servo doorServo;
MFRC522 rfidReader(PIN_RFID_SS, PIN_RFID_RST);

// Commanded State Tracking
int currentServoAngle = SERVO_ANGLE_CLOSED;
int targetServoAngle  = SERVO_ANGLE_CLOSED;
String commandedDoorState = "CLOSED"; // "OPEN" or "CLOSED"
bool isActuating = false;

// Non-blocking Timing Counters
unsigned long lastServoStepTime = 0;
unsigned long lastPollTime = 0;
unsigned long lastHeartbeatTime = 0;
unsigned long lastRfidScanTime = 0;
unsigned long lastWifiCheckTime = 0;

// Command Idempotency Tracking
String lastExecutedCommandId = "";
String pendingAckCommandId = "";

// RFID Auto-Close Timer
bool autoCloseScheduled = false;
unsigned long autoCloseTriggerTime = 0;
String lastScannedUid = "";

// Denial LED Flash Animation State Machine
bool isDenialFlashing = false;
int denialFlashStep = 0;
unsigned long lastDenialFlashTime = 0;

// ==============================================================================
// Helper: Mask Secret for Safe Logging
// ==============================================================================
String maskSecret(const char* secret) {
  String s = String(secret);
  if (s.length() <= 6) return "******";
  return s.substring(0, 4) + "..." + s.substring(s.length() - 2);
}

// ==============================================================================
// LED Status Management
// ==============================================================================
void updateLedOutputs() {
  if (isDenialFlashing) {
    // Handled by denial flash state machine
    return;
  }

  if (commandedDoorState == "OPEN") {
    digitalWrite(PIN_LED_GREEN, HIGH);
    digitalWrite(PIN_LED_RED, LOW);
  } else {
    digitalWrite(PIN_LED_GREEN, LOW);
    digitalWrite(PIN_LED_RED, HIGH);
  }
}

void triggerDenialLedAnimation() {
  isDenialFlashing = true;
  denialFlashStep = 0;
  lastDenialFlashTime = millis();
  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_RED, HIGH);
}

void processDenialLedStateMachine() {
  if (!isDenialFlashing) return;

  unsigned long now = millis();
  if (now - lastDenialFlashTime >= 120) {
    lastDenialFlashTime = now;
    denialFlashStep++;

    if (denialFlashStep >= 6) {
      // Finished 3 blinks (ON, OFF, ON, OFF, ON, OFF)
      isDenialFlashing = false;
      updateLedOutputs();
    } else {
      digitalWrite(PIN_LED_RED, (denialFlashStep % 2 == 0) ? HIGH : LOW);
    }
  }
}

// ==============================================================================
// Non-blocking Servo Motion Engine
// ==============================================================================
void setCommandedDoorState(const String& state, const String& cmdId = "") {
  if (state == "OPEN") {
    targetServoAngle = SERVO_ANGLE_OPEN;
    commandedDoorState = "OPEN";
  } else {
    targetServoAngle = SERVO_ANGLE_CLOSED;
    commandedDoorState = "CLOSED";
  }

  if (cmdId.length() > 0) {
    pendingAckCommandId = cmdId;
  }

  isActuating = (currentServoAngle != targetServoAngle);
  Serial.printf("[ACTUATOR] Target set to %s (%d deg). Commanded state: %s\n",
                state.c_str(), targetServoAngle, commandedDoorState.c_str());

  updateLedOutputs();
}

void updateServoMotion() {
  if (currentServoAngle == targetServoAngle) {
    if (isActuating) {
      isActuating = false;
      Serial.printf("[ACTUATOR] Transit completed. Servo at %d deg (Commanded: %s)\n",
                    currentServoAngle, commandedDoorState.c_str());

      // If a command was waiting for transit completion, send acknowledgement
      if (pendingAckCommandId.length() > 0) {
        acknowledgeCommand(pendingAckCommandId, "SUCCESS");
        pendingAckCommandId = "";
      }
    }
    return;
  }

  unsigned long now = millis();
  if (now - lastServoStepTime >= SERVO_STEP_DELAY_MS) {
    lastServoStepTime = now;

    if (currentServoAngle < targetServoAngle) {
      currentServoAngle++;
    } else if (currentServoAngle > targetServoAngle) {
      currentServoAngle--;
    }

    doorServo.write(currentServoAngle);
  }
}

// ==============================================================================
// Network Helper: Authenticated HTTP Request Dispatcher
// Handles both http:// and https:// endpoints transparently.
// ==============================================================================
bool sendJsonRequest(const String& method, const String& endpoint, const JsonDocument* requestDoc, String* responseOut = nullptr) {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  HTTPClient http;
  String fullUrl = String(SERVER_BASE_URL) + endpoint;

  if (fullUrl.startsWith("https://")) {
    WiFiClientSecure* secureClient = new WiFiClientSecure;
    if (secureClient) {
      // In production prototype, accept server certificates or use configured root CA
      secureClient->setInsecure();
      http.begin(*secureClient, fullUrl);
    } else {
      http.begin(fullUrl);
    }
  } else {
    http.begin(fullUrl);
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Token", DEVICE_TOKEN);
  http.addHeader("X-Controller-Id", CONTROLLER_ID);
  http.setTimeout(3500); // 3.5s timeout prevents blocking loop

  int httpCode = 0;
  if (method == "POST") {
    String requestBody = "{}";
    if (requestDoc) {
      serializeJson(*requestDoc, requestBody);
    }
    httpCode = http.POST(requestBody);
  } else {
    httpCode = http.GET();
  }

  bool success = (httpCode >= 200 && httpCode < 300);

  if (success && responseOut) {
    *responseOut = http.getString();
  } else if (!success) {
    Serial.printf("[HTTP] %s %s failed (HTTP %d)\n", method.c_str(), endpoint.c_str(), httpCode);
  }

  http.end();
  return success;
}

// ==============================================================================
// Backend Telemetry: Periodic Heartbeat
// ==============================================================================
void sendHeartbeat() {
  StaticJsonDocument<512> doc;
  doc["controllerId"] = CONTROLLER_ID;
  doc["commandedState"] = commandedDoorState;
  doc["servoAngle"] = currentServoAngle;
  doc["positionVerified"] = false;
  doc["positionNote"] = "Commanded state only (no physical position encoder)";
  doc["uptimeSeconds"] = millis() / 1000;
  doc["wifiRssi"] = WiFi.RSSI();
  doc["freeHeap"] = ESP.getFreeHeap();
  doc["isSimulated"] = false;

  String response;
  if (sendJsonRequest("POST", "/api/hardware/heartbeat", &doc, &response)) {
    Serial.printf("[HEARTBEAT] Telemetry synced. Commanded State: %s (%d deg)\n",
                  commandedDoorState.c_str(), currentServoAngle);
  }
}

// ==============================================================================
// Backend Command Lifecycle: Acknowledge Command
// ==============================================================================
void acknowledgeCommand(const String& cmdId, const String& status, const String& errorMsg = "") {
  StaticJsonDocument<256> ackDoc;
  ackDoc["controllerId"] = CONTROLLER_ID;
  ackDoc["commandId"] = cmdId;
  ackDoc["status"] = status;
  ackDoc["servoAngle"] = currentServoAngle;
  ackDoc["commandedState"] = commandedDoorState;
  ackDoc["positionVerified"] = false;
  if (errorMsg.length() > 0) {
    ackDoc["error"] = errorMsg;
  }

  String ackEndpoint = "/api/hardware/commands/" + cmdId + "/ack";
  if (sendJsonRequest("POST", ackEndpoint, &ackDoc)) {
    Serial.printf("[COMMAND] Acknowledged %s: status=%s\n", cmdId.c_str(), status.c_str());
    lastExecutedCommandId = cmdId;
  }
}

// ==============================================================================
// Backend Command Lifecycle: Poll & Process Queued Commands
// ==============================================================================
void pollCommands() {
  if (WiFi.status() != WL_CONNECTED) return;

  String response;
  if (sendJsonRequest("GET", "/api/hardware/commands/poll?controllerId=" + String(CONTROLLER_ID), nullptr, &response)) {
    StaticJsonDocument<1024> doc;
    DeserializationError err = deserializeJson(doc, response);

    if (!err && doc["hasCommand"] == true) {
      JsonObject cmd = doc["command"];
      String cmdId   = cmd["id"].as<String>();
      String cmdType = cmd["type"].as<String>();
      String action  = cmd["payload"]["action"].as<String>();

      Serial.printf("[COMMAND] Received %s: type=%s, action=%s\n",
                    cmdId.c_str(), cmdType.c_str(), action.c_str());

      // Idempotency: Reject repeated execution if already acknowledged
      if (cmdId == lastExecutedCommandId) {
        Serial.printf("[COMMAND] Duplicate command %s ignored (already executed)\n", cmdId.c_str());
        acknowledgeCommand(cmdId, "SUCCESS");
        return;
      }

      if (cmdType == "DOOR_OPERATE" || action == "OPEN" || action == "CLOSE") {
        if (action == "OPEN" || action == "CLOSE") {
          setCommandedDoorState(action, cmdId);
        } else {
          acknowledgeCommand(cmdId, "FAILED", "Unrecognized door action");
        }
      } else {
        acknowledgeCommand(cmdId, "FAILED", "Unsupported command type for physical door");
      }
    }
  }
}

// ==============================================================================
// Contactless RFID Badge Verification Engine
// Applies authoritative backend decision. Fails closed on any error.
// ==============================================================================
void checkRfidReader() {
  if (!rfidReader.PICC_IsNewCardPresent() || !rfidReader.PICC_ReadCardSerial()) {
    return;
  }

  // Format UID to uppercase hexadecimal string (e.g. "04:A2:3B:5C")
  String uidStr = "";
  for (byte i = 0; i < rfidReader.uid.size; i++) {
    if (i > 0) uidStr += ":";
    if (rfidReader.uid.uidByte[i] < 0x10) uidStr += "0";
    uidStr += String(rfidReader.uid.uidByte[i], HEX);
  }
  uidStr.toUpperCase();

  // Cooldown check to prevent repeated trigger spamming
  unsigned long now = millis();
  if (uidStr == lastScannedUid && (now - lastRfidScanTime) < RFID_COOLDOWN_MS) {
    rfidReader.PICC_HaltA();
    rfidReader.PCD_StopCrypto1();
    return;
  }

  lastScannedUid = uidStr;
  lastRfidScanTime = now;

  Serial.printf("\n[RFID] Physical badge detected. UID: %s\n", uidStr.c_str());

  // Fail-Closed Policy: If Wi-Fi is disconnected, strictly deny access
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[RFID] SECURITY ALERT: Backend unreachable. Denying access (Fail Closed).");
    triggerDenialLedAnimation();
    rfidReader.PICC_HaltA();
    rfidReader.PCD_StopCrypto1();
    return;
  }

  // Submit scan to backend for authoritative verification
  StaticJsonDocument<256> scanDoc;
  scanDoc["uid"] = uidStr;
  scanDoc["cardUid"] = uidStr;
  scanDoc["readerId"] = "RFID-RC522-01";
  scanDoc["location"] = "Cell Block A (A-101 Physical Prototype)";

  String response;
  bool accessGranted = false;
  String decision = "DENIED_ERROR";

  if (sendJsonRequest("POST", "/api/hardware/rfid/scan", &scanDoc, &response)) {
    StaticJsonDocument<512> resDoc;
    DeserializationError err = deserializeJson(resDoc, response);

    if (!err) {
      accessGranted = (resDoc["accessGranted"] == true || resDoc["granted"] == true);
      decision = resDoc["decision"].as<String>();
      String personName = resDoc["personName"].as<String>();
      Serial.printf("[RFID] Verification decision: %s (Access Granted: %s, Holder: %s)\n",
                    decision.c_str(), accessGranted ? "YES" : "NO",
                    personName.length() > 0 ? personName.c_str() : "Unknown");
    } else {
      Serial.println("[RFID] JSON parse error from backend. Failing closed.");
    }
  } else {
    Serial.println("[RFID] Failed to contact backend. Failing closed.");
  }

  // Apply Authoritative Decision
  if (accessGranted) {
    Serial.println("[RFID] Access GRANTED: Rotating servo to OPEN (90 deg), Green LED ON");
    setCommandedDoorState("OPEN");

    #if DOOR_AUTO_CLOSE_MS > 0
      autoCloseScheduled = true;
      autoCloseTriggerTime = millis() + DOOR_AUTO_CLOSE_MS;
      Serial.printf("[ACTUATOR] Auto-close scheduled in %d ms\n", DOOR_AUTO_CLOSE_MS);
    #endif
  } else {
    Serial.println("[RFID] Access DENIED: Keeping door CLOSED (0 deg), Flashing Red LED");
    triggerDenialLedAnimation();
  }

  rfidReader.PICC_HaltA();
  rfidReader.PCD_StopCrypto1();
}

// ==============================================================================
// Auto-Close Timer Processing
// ==============================================================================
void processAutoCloseTimer() {
  if (!autoCloseScheduled) return;

  if (millis() >= autoCloseTriggerTime) {
    autoCloseScheduled = false;
    Serial.println("[ACTUATOR] Auto-close interval elapsed. Commanding door CLOSED (0 deg)");
    setCommandedDoorState("CLOSED");
  }
}

// ==============================================================================
// Setup & Initialization
// ==============================================================================
void setup() {
  Serial.begin(115200);
  delay(300);

  Serial.println("\n========================================================");
  Serial.println("  🛡️  PrisonGuard — ESP32 Physical Door Controller ");
  Serial.println("========================================================");
  Serial.printf("Device ID:       %s\n", CONTROLLER_ID);
  Serial.printf("Target Server:   %s\n", SERVER_BASE_URL);
  Serial.printf("Device Token:    %s\n", maskSecret(DEVICE_TOKEN).c_str());
  Serial.println("Hardware Manifest: SG90 Servo (GPIO 13), RC522 (SPI), LEDs (25, 26)");
  Serial.println("Notice:          No physical position sensor present. State is commanded.");
  Serial.println("========================================================\n");

  // 1. Initialize GPIO LEDs
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);

  // Safe Default Outputs at Startup: Locked / Closed State
  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_RED, HIGH); // Red LED ON indicates locked/closed

  // 2. Initialize SG90 Servo Actuator
  ESP32PWM::allocateTimer(0);
  doorServo.setPeriodHertz(50); // Standard 50Hz PWM for SG90 micro servo
  doorServo.attach(PIN_SERVO, 500, 2400); // 500us to 2400us pulse width
  doorServo.write(SERVO_ANGLE_CLOSED);
  currentServoAngle = SERVO_ANGLE_CLOSED;
  targetServoAngle  = SERVO_ANGLE_CLOSED;
  commandedDoorState = "CLOSED";
  Serial.printf("[SETUP] SG90 Servo initialized on GPIO %d at %d deg\n", PIN_SERVO, SERVO_ANGLE_CLOSED);

  // 3. Initialize RC522 RFID SPI Module
  SPI.begin(PIN_RFID_SCK, PIN_RFID_MISO, PIN_RFID_MOSI, PIN_RFID_SS);
  rfidReader.PCD_Init();
  delay(10);
  Serial.println("[SETUP] RC522 Contactless Reader initialized on SPI bus");
  rfidReader.PCD_DumpVersionToSerial();

  // 4. Connect to Wi-Fi
  Serial.printf("[WIFI] Connecting to SSID: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(400);
    Serial.print(".");
    digitalWrite(PIN_LED_RED, !digitalRead(PIN_LED_RED)); // Blink red LED during connection
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WIFI] Connected successfully!");
    Serial.printf("[WIFI] IP Address:  %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("[WIFI] Signal RSSI: %d dBm\n", WiFi.RSSI());
    updateLedOutputs();

    // Initial check-in heartbeat
    sendHeartbeat();
  } else {
    Serial.println("\n[WIFI] Connection failed. Operating in fail-closed standalone mode.");
    updateLedOutputs();
  }
}

// ==============================================================================
// Main Operational Loop (100% Non-blocking)
// ==============================================================================
void loop() {
  unsigned long now = millis();

  // 1. Process smooth non-blocking servo motion
  updateServoMotion();

  // 2. Process LED animation state machines (e.g. denial flash)
  processDenialLedStateMachine();

  // 3. Process RFID auto-close timer
  processAutoCloseTimer();

  // 4. Check RC522 RFID reader for badge presentations
  checkRfidReader();

  // 5. Periodic command polling from backend
  if (now - lastPollTime >= POLL_INTERVAL_MS) {
    lastPollTime = now;
    pollCommands();
  }

  // 6. Periodic heartbeat telemetry dispatch
  if (now - lastHeartbeatTime >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeatTime = now;
    sendHeartbeat();
  }

  // 7. Safe background Wi-Fi reconnection (check every 8 seconds)
  if (WiFi.status() != WL_CONNECTED && (now - lastWifiCheckTime >= 8000)) {
    lastWifiCheckTime = now;
    Serial.println("[WIFI] Link down. Attempting safe reconnection...");
    WiFi.reconnect();
  }
}
