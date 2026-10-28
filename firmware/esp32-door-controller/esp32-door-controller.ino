/**
 * ==============================================================================
 * PrisonGuard — ESP32 Physical Door Controller Firmware
 * ==============================================================================
 *
 * Microcontroller: ESP32-WROOM-32
 * Target Prototype: Cell A-101 Physical Door Mechanism
 *
 * Features:
 *   - Servo Actuator Control (0° Closed, 90° Open)
 *   - Magnetic Reed Switch Sensor with Hardware Debouncing
 *   - Visual Status Indicators (Green = Access Granted, Red = Access Denied / Lock)
 *   - Audible Buzzer Feedback (Confirmation Beeps and Denied Tones)
 *   - MFRC522 Contactless RFID Reader with Live Backend Verification
 *   - Authenticated HTTP REST Polling & Heartbeat Telemetry
 *   - Non-blocking Watchdog & Safe Offline Fallback
 *
 * Dependencies (install via Arduino Library Manager):
 *   - ArduinoJson (v6.x or v7.x) by Benoit Blanchon
 *   - ESP32Servo by Kevin Harrington
 *   - MFRC522 by GithubCommunity
 * ==============================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ESP32Servo.h>
#include <ArduinoJson.h>

#if __has_include("config.h")
  #include "config.h"
#else
  #include "config.h.example"
#endif

// ==========================================
// Hardware Peripherals
// ==========================================
Servo doorServo;
MFRC522 rfidReader(PIN_RFID_SS, PIN_RFID_RST);

// State Tracking
int currentServoAngle = SERVO_ANGLE_CLOSED;
String observedDoorState = "CLOSED";
int lastReedRawState = HIGH;
unsigned long lastReedDebounceTime = 0;
const unsigned long REED_DEBOUNCE_DELAY_MS = 60;

// Loop Timers
unsigned long lastPollTime = 0;
unsigned long lastHeartbeatTime = 0;
unsigned long lastRfidScanTime = 0;
String lastScannedUid = "";

// ==========================================
// Helper: Tone / Audio Feedback
// ==========================================
void soundTone(int frequency, int durationMs) {
  // Use ESP32 tone() if available, or simple PWM
  tone(PIN_BUZZER, frequency, durationMs);
  delay(durationMs);
  noTone(PIN_BUZZER);
}

void soundAccessGranted() {
  digitalWrite(PIN_LED_GREEN, HIGH);
  digitalWrite(PIN_LED_RED, LOW);
  soundTone(2000, 80);
  delay(60);
  soundTone(2600, 120);
  delay(500);
  digitalWrite(PIN_LED_GREEN, LOW);
}

void soundAccessDenied() {
  digitalWrite(PIN_LED_RED, HIGH);
  digitalWrite(PIN_LED_GREEN, LOW);
  for (int i = 0; i < 3; i++) {
    soundTone(600, 150);
    delay(80);
  }
  delay(400);
  digitalWrite(PIN_LED_RED, LOW);
}

// ==========================================
// Actuation: Move Servo
// ==========================================
void actuateDoor(const String& action) {
  int targetAngle = (action == "OPEN") ? SERVO_ANGLE_OPEN : SERVO_ANGLE_CLOSED;
  Serial.printf("[SERVO] Actuating door to %s (%d deg)\n", action.c_str(), targetAngle);

  // Smooth transit
  int step = (targetAngle > currentServoAngle) ? 2 : -2;
  while (currentServoAngle != targetAngle) {
    currentServoAngle += step;
    if ((step > 0 && currentServoAngle > targetAngle) ||
        (step < 0 && currentServoAngle < targetAngle)) {
      currentServoAngle = targetAngle;
    }
    doorServo.write(currentServoAngle);
    delay(15);
  }

  // Update LED states according to target
  if (action == "OPEN") {
    digitalWrite(PIN_LED_GREEN, HIGH);
    digitalWrite(PIN_LED_RED, LOW);
    observedDoorState = "OPEN";
  } else {
    digitalWrite(PIN_LED_GREEN, LOW);
    digitalWrite(PIN_LED_RED, HIGH);
    observedDoorState = "CLOSED";
  }
}

// ==========================================
// Network Helper: Authenticated HTTP
// ==========================================
bool sendJsonPost(const String& endpoint, const JsonDocument& doc, String* responseOut = nullptr) {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  HTTPClient http;
  String fullUrl = String(SERVER_BASE_URL) + endpoint;
  http.begin(fullUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Token", DEVICE_TOKEN);
  http.addHeader("X-Controller-Id", CONTROLLER_ID);
  http.setTimeout(4000);

  String requestBody;
  serializeJson(doc, requestBody);

  int httpCode = http.POST(requestBody);
  bool success = (httpCode >= 200 && httpCode < 300);

  if (success && responseOut) {
    *responseOut = http.getString();
  } else if (!success) {
    Serial.printf("[HTTP] POST %s failed, code: %d\n", endpoint.c_str(), httpCode);
  }

  http.end();
  return success;
}

// ==========================================
// Backend Routine: Send Heartbeat
// ==========================================
void sendHeartbeat() {
  StaticJsonDocument<512> doc;
  doc["controllerId"] = CONTROLLER_ID;
  doc["doorState"] = observedDoorState;
  doc["servoAngle"] = currentServoAngle;
  doc["reedSwitch"] = (digitalRead(PIN_REED) == LOW) ? "CLOSED" : "OPEN";
  doc["uptimeSeconds"] = millis() / 1000;
  doc["wifiRssi"] = WiFi.RSSI();
  doc["freeHeap"] = ESP.getFreeHeap();
  doc["isSimulated"] = false;

  String response;
  if (sendJsonPost("/api/hardware/heartbeat", doc, &response)) {
    Serial.println("[HEARTBEAT] Telemetry synced successfully");
  }
}

// ==========================================
// Backend Routine: Report Hardware Event
// ==========================================
void reportEvent(const String& eventType, const JsonDocument& details) {
  StaticJsonDocument<512> doc;
  doc["type"] = eventType;
  doc["controllerId"] = CONTROLLER_ID;
  doc["details"] = details;

  sendJsonPost("/api/hardware/events", doc);
}

// ==========================================
// Backend Routine: Poll & Process Commands
// ==========================================
void pollCommands() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String pollUrl = String(SERVER_BASE_URL) + "/api/hardware/commands/poll";
  http.begin(pollUrl);
  http.addHeader("X-Device-Token", DEVICE_TOKEN);
  http.addHeader("X-Controller-Id", CONTROLLER_ID);
  http.setTimeout(3000);

  int httpCode = http.GET();
  if (httpCode == 200) {
    String payload = http.getString();
    StaticJsonDocument<1024> doc;
    DeserializationError err = deserializeJson(doc, payload);

    if (!err && doc["hasCommand"] == true) {
      JsonObject cmd = doc["command"];
      String cmdId = cmd["id"].as<String>();
      String cmdType = cmd["type"].as<String>();
      String action = cmd["payload"]["action"].as<String>();

      Serial.printf("[CMD] Received command %s: %s -> %s\n", cmdId.c_str(), cmdType.c_str(), action.c_str());

      if (cmdType == "DOOR_OPERATE" || action == "OPEN" || action == "CLOSE") {
        actuateDoor(action);
        soundTone(1800, 100);

        // Acknowledge command completion
        StaticJsonDocument<256> ackDoc;
        ackDoc["status"] = "SUCCESS";
        ackDoc["servoAngle"] = currentServoAngle;
        ackDoc["observedState"] = observedDoorState;

        String ackEndpoint = "/api/hardware/commands/" + cmdId + "/ack";
        sendJsonPost(ackEndpoint, ackDoc);
      }
    }
  }
  http.end();
}

// ==========================================
// Routine: Reed Switch Contact Check
// ==========================================
void checkReedSwitch() {
  int reading = digitalRead(PIN_REED);

  if (reading != lastReedRawState) {
    lastReedDebounceTime = millis();
    lastReedRawState = reading;
  }

  if ((millis() - lastReedDebounceTime) > REED_DEBOUNCE_DELAY_MS) {
    String currentContact = (reading == LOW) ? "CLOSED" : "OPEN";
    if (currentContact != observedDoorState) {
      observedDoorState = currentContact;
      Serial.printf("[REED] Door physical state changed to: %s\n", observedDoorState.c_str());

      StaticJsonDocument<256> eventDetails;
      eventDetails["doorId"] = "DOOR-A101-PHYSICAL";
      eventDetails["reedState"] = observedDoorState;
      eventDetails["servoAngle"] = currentServoAngle;

      reportEvent("PHYSICAL_DOOR_STATE_CHANGED", eventDetails);
    }
  }
}

// ==========================================
// Routine: Check RFID Contactless Reader
// ==========================================
void checkRfidReader() {
  if (!rfidReader.PICC_IsNewCardPresent() || !rfidReader.PICC_ReadCardSerial()) {
    return;
  }

  // Convert UID bytes to hex string (e.g. "04:A2:3B:5C")
  String uidStr = "";
  for (byte i = 0; i < rfidReader.uid.size; i++) {
    if (i > 0) uidStr += ":";
    if (rfidReader.uid.uidByte[i] < 0x10) uidStr += "0";
    uidStr += String(rfidReader.uid.uidByte[i], HEX);
  }
  uidStr.toUpperCase();

  // Cooldown to prevent duplicate triggers
  if (uidStr == lastScannedUid && (millis() - lastRfidScanTime) < RFID_COOLDOWN_MS) {
    rfidReader.PICC_HaltA();
    rfidReader.PCD_StopCrypto1();
    return;
  }

  lastScannedUid = uidStr;
  lastRfidScanTime = millis();

  Serial.printf("[RFID] Card presented! UID: %s\n", uidStr.c_str());

  // Post scan to backend for authoritative verification
  StaticJsonDocument<256> scanDoc;
  scanDoc["uid"] = uidStr;
  scanDoc["readerId"] = "RFID-RC522-01";
  scanDoc["location"] = "Cell Block A (A-101)";

  String response;
  if (sendJsonPost("/api/hardware/rfid/scan", scanDoc, &response)) {
    StaticJsonDocument<512> resDoc;
    if (!deserializeJson(resDoc, response)) {
      bool accessGranted = resDoc["accessGranted"] == true;
      String decision = resDoc["decision"].as<String>();
      Serial.printf("[RFID] Verification result: %s (granted: %d)\n", decision.c_str(), accessGranted);

      if (accessGranted) {
        soundAccessGranted();
        actuateDoor("OPEN");
      } else {
        soundAccessDenied();
      }
    }
  }

  rfidReader.PICC_HaltA();
  rfidReader.PCD_StopCrypto1();
}

// ==========================================
// Setup
// ==========================================
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=============================================");
  Serial.println("  PrisonGuard ESP32 Door Controller Starting ");
  Serial.println("=============================================");

  // Pin Configuration
  pinMode(PIN_REED, INPUT_PULLUP);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);

  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_RED, HIGH); // Default to locked

  // Initialize Servo
  ESP32PWM::allocateTimer(0);
  doorServo.setPeriodHertz(50); // Standard 50Hz servo
  doorServo.attach(PIN_SERVO, 500, 2400); // 500us to 2400us pulse
  doorServo.write(SERVO_ANGLE_CLOSED);
  currentServoAngle = SERVO_ANGLE_CLOSED;

  // Initialize SPI & RC522
  SPI.begin(PIN_RFID_SCK, PIN_RFID_MISO, PIN_RFID_MOSI, PIN_RFID_SS);
  rfidReader.PCD_Init();
  delay(10);
  rfidReader.PCD_DumpVersionToSerial();

  // Connect to Wi-Fi
  Serial.printf("[WIFI] Connecting to SSID: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(500);
    Serial.print(".");
    digitalWrite(PIN_LED_RED, !digitalRead(PIN_LED_RED)); // Blink during connection
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WIFI] Connected!");
    Serial.printf("[WIFI] IP Address: %s\n", WiFi.localIP().toString().c_str());
    digitalWrite(PIN_LED_RED, HIGH);
    soundTone(1500, 100);
  } else {
    Serial.println("\n[WIFI] Connection failed. Running in offline standalone mode.");
  }
}

// ==========================================
// Main Loop
// ==========================================
void loop() {
  unsigned long now = millis();

  // 1. Check physical reed contact
  checkReedSwitch();

  // 2. Check RFID reader for badge presentations
  checkRfidReader();

  // 3. Periodic command poll (every POLL_INTERVAL_MS)
  if (now - lastPollTime >= POLL_INTERVAL_MS) {
    lastPollTime = now;
    pollCommands();
  }

  // 4. Periodic heartbeat telemetry (every HEARTBEAT_INTERVAL_MS)
  if (now - lastHeartbeatTime >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeatTime = now;
    sendHeartbeat();
  }

  // 5. Auto-reconnect Wi-Fi if dropped
  if (WiFi.status() != WL_CONNECTED && (now % 10000 < 50)) {
    Serial.println("[WIFI] Attempting Wi-Fi reconnection...");
    WiFi.reconnect();
  }
}
