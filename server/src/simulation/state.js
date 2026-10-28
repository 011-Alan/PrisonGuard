import { ROOMS, WAYPOINTS } from './waypoints.js';
import { CAMERAS } from './cctv.js';

export const ACCESS_POINTS = {
  'AP-NORTH-CORR': {
    id: 'AP-NORTH-CORR',
    name: 'North Corridor Access Point',
    location: 'North Main Corridor Central',
    zone: 'NORTH_CORRIDOR',
    x: 800,
    y: 250,
    status: 'ONLINE',
    coverageRadius: 280,
    ssid: 'PRISON-NET-SECURE-WPA3',
    frequency: '5 GHz / 2.4 GHz',
    channel: 36,
    associatedControllers: ['ESP32-CELL-01', 'ESP32-CELL-02', 'ESP32-CELL-03']
  },
  'AP-YARD-SALLY': {
    id: 'AP-YARD-SALLY',
    name: 'Yard & Sally Port Access Point',
    location: 'Common Yard South Spine',
    zone: 'COMMON_YARD',
    x: 800,
    y: 550,
    status: 'ONLINE',
    coverageRadius: 260,
    ssid: 'PRISON-NET-SECURE-WPA3',
    frequency: '2.4 GHz (Long Range)',
    channel: 6,
    associatedControllers: ['ESP32-ACCESS-01', 'ESP32-PERIM-02']
  },
  'AP-ADMIN-SOC': {
    id: 'AP-ADMIN-SOC',
    name: 'Admin & SOC Secure AP',
    location: 'Administration Central',
    zone: 'ADMIN_SOC',
    x: 1100,
    y: 650,
    status: 'ONLINE',
    coverageRadius: 250,
    ssid: 'PRISON-NET-ADMIN-ISOLATED',
    frequency: '5 GHz',
    channel: 149,
    associatedControllers: ['ESP32-CAM-HUB']
  },
  'AP-WEST-MED': {
    id: 'AP-WEST-MED',
    name: 'Medical Ward Access Point',
    location: 'Medical Ward Corridor',
    zone: 'WEST_MED',
    x: 350,
    y: 500,
    status: 'ONLINE',
    coverageRadius: 240,
    ssid: 'PRISON-NET-SECURE-WPA3',
    frequency: '5 GHz',
    channel: 44,
    associatedControllers: ['ESP32-MED-01']
  },
  'AP-EAST-PERIM': {
    id: 'AP-EAST-PERIM',
    name: 'East Perimeter Relay AP',
    location: 'East Perimeter Tower Relay',
    zone: 'EAST_PERIM',
    x: 1400,
    y: 400,
    status: 'ONLINE',
    coverageRadius: 280,
    ssid: 'PRISON-NET-PERIMETER-MESH',
    frequency: '2.4 GHz (Outdoor Mesh)',
    channel: 11,
    associatedControllers: ['ESP32-PERIM-01']
  }
};

export const INITIAL_STATE = {
  // System Health & Stats
  systemHealth: 98,
  systemOnline: true,
  lastUpdated: new Date().toISOString(),

  // CCTV Surveillance System (Perception Layer)
  cameras: JSON.parse(JSON.stringify(CAMERAS)),

  // Wi-Fi Access Points (Communication Layer)
  accessPoints: JSON.parse(JSON.stringify(ACCESS_POINTS)),

  // Pending Officer-to-Central Radio Communication Requests (Workflow A)
  officerRadioRequests: [],

  // Administrator-to-Officer Task Assignments
  officerTasks: [],

  // Suspicious Activity Engine
  suspiciousActivities: [],

  // External Visitors (e.g. Detective / Inspector arrivals)
  externalVisitors: [],

  // Central Security Control Breach State Machine
  securityControlBreach: {
    isBreached: false,
    incapacitatedOfficerId: null,
    title: '',
    message: '',
    affectedControls: [],
    severity: 'NORMAL',
    activatedAt: null
  },

  // Facility Simulation Clock
  simulationClock: {
    time: '2026-10-28T09:30:00.000Z',
    displayTime: '09:30:00',
    speed: 1, // 0 = paused, 1 = 1x, 2 = 2x, 5 = 5x
    isPaused: false,
    currentPhase: {
      id: 'MORNING_ROUTINE',
      name: 'Morning Routine & Medical Rounds',
      timeRange: '08:00 - 10:30',
      description: 'Cell count confirmed. Inmates permitted in designated corridors and medical evaluations.',
      permittedZones: ['BLOCK_A', 'BLOCK_B', 'BLOCK_C', 'MEDICAL']
    },
    phases: [
      { id: 'MORNING_COUNT', name: 'Morning Cell Count & Inspection', timeRange: '06:30 - 08:00', description: 'Mandatory muster and cell inspection.' },
      { id: 'MORNING_ROUTINE', name: 'Morning Routine & Medical Rounds', timeRange: '08:00 - 10:30', description: 'Cell block checks, medical clinic triage, administrative duties.' },
      { id: 'YARD_RECREATION', name: 'Yard Exercise & Common Recreation', timeRange: '10:30 - 12:30', description: 'Supervised recreation in common yard.' },
      { id: 'LUNCH_PERIOD', name: 'Midday Meal & Escort Movement', timeRange: '12:30 - 14:00', description: 'Meal distribution under officer escort.' },
      { id: 'FACILITY_WORK', name: 'Facility Maintenance & Work Detail', timeRange: '14:00 - 17:30', description: 'Authorized work details and interview sessions.' },
      { id: 'EVENING_RECALL', name: 'Evening Cell Recall & Lockup', timeRange: '17:30 - 20:00', description: 'All inmates return to assigned cells.' },
      { id: 'NIGHT_LOCKDOWN', name: 'Night Curfew & Perimeter Surveillance', timeRange: '20:00 - 06:30', description: 'Full cell isolation, perimeter radar & beam surveillance active.' }
    ]
  },

  // Facility Emergency Lockdown State
  lockdown: {
    isActive: false,
    initiatedBy: null,
    initiatedRole: null,
    timestamp: null,
    affectedCount: 0,
    successfulCount: 0,
    failedCount: 0,
    summary: 'Facility operating under standard security profile.'
  },

  // Public Address Speakers (Actuators)
  speakers: {
    'SPEAKER-BLOCK-A': {
      id: 'SPEAKER-BLOCK-A',
      name: 'Block A Corridor PA Speaker',
      type: 'PA_SPEAKER',
      zone: 'BLOCK_A',
      location: 'Block A Corridor',
      controllerId: 'ESP32-CELL-01',
      gpio: 27,
      status: 'ONLINE',
      state: 'IDLE', // 'IDLE' | 'BROADCASTING'
      lastAnnouncement: null,
      lastPlaybackReport: null,
      x: 370,
      y: 195,
      lastUpdated: new Date().toISOString()
    },
    'SPEAKER-BLOCK-B': {
      id: 'SPEAKER-BLOCK-B',
      name: 'Block B Corridor PA Speaker',
      type: 'PA_SPEAKER',
      zone: 'BLOCK_B',
      location: 'Block B Corridor',
      controllerId: 'ESP32-CELL-02',
      gpio: 27,
      status: 'ONLINE',
      state: 'IDLE',
      lastAnnouncement: null,
      lastPlaybackReport: null,
      x: 800,
      y: 195,
      lastUpdated: new Date().toISOString()
    },
    'SPEAKER-BLOCK-C': {
      id: 'SPEAKER-BLOCK-C',
      name: 'Block C Corridor PA Speaker',
      type: 'PA_SPEAKER',
      zone: 'BLOCK_C',
      location: 'Block C Corridor',
      controllerId: 'ESP32-CELL-03',
      gpio: 27,
      status: 'ONLINE',
      state: 'IDLE',
      lastAnnouncement: null,
      lastPlaybackReport: null,
      x: 1230,
      y: 195,
      lastUpdated: new Date().toISOString()
    },
    'SPEAKER-YARD': {
      id: 'SPEAKER-YARD',
      name: 'Common Yard PA Horn',
      type: 'PA_SPEAKER',
      zone: 'YARD',
      location: 'Common Exercise Yard',
      controllerId: 'ESP32-ACCESS-01',
      gpio: 4,
      status: 'ONLINE',
      state: 'IDLE',
      lastAnnouncement: null,
      lastPlaybackReport: null,
      x: 800,
      y: 430,
      lastUpdated: new Date().toISOString()
    },
    'SPEAKER-MED': {
      id: 'SPEAKER-MED',
      name: 'Medical Ward Intercom Node',
      type: 'PA_SPEAKER',
      zone: 'MEDICAL',
      location: 'Medical Ward',
      controllerId: 'ESP32-MED-01',
      gpio: 13,
      status: 'ONLINE',
      state: 'IDLE',
      lastAnnouncement: null,
      lastPlaybackReport: null,
      x: 370,
      y: 420,
      lastUpdated: new Date().toISOString()
    },
    'SPEAKER-ADMIN': {
      id: 'SPEAKER-ADMIN',
      name: 'Admin Building PA Horn',
      type: 'PA_SPEAKER',
      zone: 'ADMIN',
      location: 'Administration Building',
      controllerId: 'ESP32-ACCESS-01',
      gpio: 5,
      status: 'ONLINE',
      state: 'IDLE',
      lastAnnouncement: null,
      lastPlaybackReport: null,
      x: 1150,
      y: 410,
      lastUpdated: new Date().toISOString()
    },
    'SPEAKER-SPINE': {
      id: 'SPEAKER-SPINE',
      name: 'Central Secure Spine PA Node',
      type: 'PA_SPEAKER',
      zone: 'SPINE',
      location: 'Central Secure Spine',
      controllerId: 'ESP32-ACCESS-01',
      gpio: 12,
      status: 'ONLINE',
      state: 'IDLE',
      lastAnnouncement: null,
      lastPlaybackReport: null,
      x: 800,
      y: 600,
      lastUpdated: new Date().toISOString()
    }
  },

  // Cell & Corridor Doors (Separating Physical Position vs Lock State)
  doors: {
    // Block A Doors
    'DOOR-A101': { id: 'DOOR-A101', name: 'Cell A-101 Door', location: 'Cell A-101', block: 'A', position: 'CLOSED', lockState: 'LOCKED', reedId: 'REED-A101', lockId: 'LOCK-A101', controllerId: 'ESP32-CELL-01', x: 285, y: 170, lastUpdated: new Date().toISOString() },
    'DOOR-A102': { id: 'DOOR-A102', name: 'Cell A-102 Door', location: 'Cell A-102', block: 'A', position: 'CLOSED', lockState: 'LOCKED', reedId: 'REED-A102', lockId: 'LOCK-A102', controllerId: 'ESP32-CELL-01', x: 340, y: 170, lastUpdated: new Date().toISOString() },
    'DOOR-A103': { id: 'DOOR-A103', name: 'Cell A-103 Door', location: 'Cell A-103', block: 'A', position: 'CLOSED', lockState: 'LOCKED', reedId: 'REED-A103', lockId: 'LOCK-A103', controllerId: 'ESP32-CELL-01', x: 395, y: 170, lastUpdated: new Date().toISOString() },
    'DOOR-A104': { id: 'DOOR-A104', name: 'Cell A-104 Door', location: 'Cell A-104', block: 'A', position: 'CLOSED', lockState: 'LOCKED', reedId: 'REED-A104', lockId: 'LOCK-A104', controllerId: 'ESP32-CELL-01', x: 450, y: 170, lastUpdated: new Date().toISOString() },

    // Block B Doors
    'DOOR-B101': { id: 'DOOR-B101', name: 'Cell B-101 Door', location: 'Cell B-101', block: 'B', position: 'CLOSED', lockState: 'LOCKED', reedId: 'REED-B101', lockId: 'LOCK-B101', controllerId: 'ESP32-CELL-02', x: 715, y: 170, lastUpdated: new Date().toISOString() },
    'DOOR-B102': { id: 'DOOR-B102', name: 'Cell B-102 Door', location: 'Cell B-102', block: 'B', position: 'CLOSED', lockState: 'LOCKED', reedId: 'REED-B102', lockId: 'LOCK-B102', controllerId: 'ESP32-CELL-02', x: 770, y: 170, lastUpdated: new Date().toISOString() },
    'DOOR-B103': { id: 'DOOR-B103', name: 'Cell B-103 Door', location: 'Cell B-103', block: 'B', position: 'CLOSED', lockState: 'LOCKED', reedId: 'REED-B103', lockId: 'LOCK-B103', controllerId: 'ESP32-CELL-02', x: 825, y: 170, lastUpdated: new Date().toISOString() },
    'DOOR-B104': { id: 'DOOR-B104', name: 'Cell B-104 Door', location: 'Cell B-104', block: 'B', position: 'CLOSED', lockState: 'LOCKED', reedId: 'REED-B104', lockId: 'LOCK-B104', controllerId: 'ESP32-CELL-02', x: 880, y: 170, lastUpdated: new Date().toISOString() },

    // Block C Doors
    'DOOR-C101': { id: 'DOOR-C101', name: 'Cell C-101 Door', location: 'Cell C-101', block: 'C', position: 'CLOSED', lockState: 'LOCKED', reedId: 'REED-C101', lockId: 'LOCK-C101', controllerId: 'ESP32-CELL-03', x: 1145, y: 170, lastUpdated: new Date().toISOString() },
    'DOOR-C102': { id: 'DOOR-C102', name: 'Cell C-102 Door', location: 'Cell C-102', block: 'C', position: 'CLOSED', lockState: 'LOCKED', reedId: 'REED-C102', lockId: 'LOCK-C102', controllerId: 'ESP32-CELL-03', x: 1200, y: 170, lastUpdated: new Date().toISOString() },
    'DOOR-C103': { id: 'DOOR-C103', name: 'Cell C-103 Door', location: 'Cell C-103', block: 'C', position: 'CLOSED', lockState: 'LOCKED', reedId: 'REED-C103', lockId: 'LOCK-C103', controllerId: 'ESP32-CELL-03', x: 1255, y: 170, lastUpdated: new Date().toISOString() },
    'DOOR-C104': { id: 'DOOR-C104', name: 'Cell C-104 Door', location: 'Cell C-104', block: 'C', position: 'CLOSED', lockState: 'LOCKED', reedId: 'REED-C104', lockId: 'LOCK-C104', controllerId: 'ESP32-CELL-03', x: 1310, y: 170, lastUpdated: new Date().toISOString() },

    // Isolation Doors
    'DOOR-ISO01': { id: 'DOOR-ISO01', name: 'Solitary Cell ISO-01 Door', location: 'Isolation ISO-01', block: 'ISO', position: 'CLOSED', lockState: 'LOCKED', reedId: 'REED-ISO01', lockId: 'LOCK-ISO01', controllerId: 'ESP32-MED-01', x: 310, y: 725, lastUpdated: new Date().toISOString() },
    'DOOR-ISO02': { id: 'DOOR-ISO02', name: 'Solitary Cell ISO-02 Door', location: 'Isolation ISO-02', block: 'ISO', position: 'CLOSED', lockState: 'LOCKED', reedId: 'REED-ISO02', lockId: 'LOCK-ISO02', controllerId: 'ESP32-MED-01', x: 390, y: 725, lastUpdated: new Date().toISOString() }
  },

  // Controllers (ESP32 Nodes)
  controllers: {
    'ESP32-CELL-01': {
      id: 'ESP32-CELL-01',
      name: 'Cell Block A Controller',
      location: 'Block A Electrical Closet',
      ip: '192.168.10.11',
      status: 'ONLINE', // 'ONLINE' | 'OFFLINE'
      lastHeartbeat: new Date().toISOString(),
      firmware: 'v2.4.1-esp32-freertos',
      uptimeSec: 86420,
      ownedDevices: ['REED-A101', 'REED-A102', 'REED-A103', 'REED-A104', 'LOCK-A101', 'LOCK-A102', 'LOCK-A103', 'LOCK-A104', 'PIR-CORR-A']
    },
    'ESP32-CELL-02': {
      id: 'ESP32-CELL-02',
      name: 'Cell Block B Controller',
      location: 'Block B Electrical Closet',
      ip: '192.168.10.12',
      status: 'ONLINE',
      lastHeartbeat: new Date().toISOString(),
      firmware: 'v2.4.1-esp32-freertos',
      uptimeSec: 86310,
      ownedDevices: ['REED-B101', 'REED-B102', 'REED-B103', 'REED-B104', 'LOCK-B101', 'LOCK-B102', 'LOCK-B103', 'LOCK-B104', 'PIR-CORR-B']
    },
    'ESP32-CELL-03': {
      id: 'ESP32-CELL-03',
      name: 'Cell Block C Controller',
      location: 'Block C Electrical Closet',
      ip: '192.168.10.13',
      status: 'ONLINE',
      lastHeartbeat: new Date().toISOString(),
      firmware: 'v2.4.1-esp32-freertos',
      uptimeSec: 86190,
      ownedDevices: ['REED-C101', 'REED-C102', 'REED-C103', 'REED-C104', 'LOCK-C101', 'LOCK-C102', 'LOCK-C103', 'LOCK-C104', 'PIR-CORR-C']
    },
    'ESP32-PERIM-01': {
      id: 'ESP32-PERIM-01',
      name: 'North & East Perimeter Node',
      location: 'North-East Guard Post',
      ip: '192.168.10.21',
      status: 'ONLINE',
      lastHeartbeat: new Date().toISOString(),
      firmware: 'v2.4.1-esp32-freertos',
      uptimeSec: 104200,
      ownedDevices: ['IR-BEAM-N', 'IR-BEAM-E', 'VIB-FENCE-N', 'VIB-FENCE-E', 'GATE-01', 'GATE-03']
    },
    'ESP32-PERIM-02': {
      id: 'ESP32-PERIM-02',
      name: 'South & West Perimeter Node',
      location: 'South-West Guard Post',
      ip: '192.168.10.22',
      status: 'ONLINE',
      lastHeartbeat: new Date().toISOString(),
      firmware: 'v2.4.1-esp32-freertos',
      uptimeSec: 104150,
      ownedDevices: ['IR-BEAM-S', 'IR-BEAM-W', 'VIB-FENCE-S', 'VIB-FENCE-W', 'GATE-02', 'GATE-04']
    },
    'ESP32-ACCESS-01': {
      id: 'ESP32-ACCESS-01',
      name: 'Access Control & Sally Port Node',
      location: 'Sally Port Guard Station',
      ip: '192.168.10.31',
      status: 'ONLINE',
      lastHeartbeat: new Date().toISOString(),
      firmware: 'v2.4.1-esp32-freertos',
      uptimeSec: 142000,
      ownedDevices: ['GATE-05', 'GATE-06', 'GATE-07', 'GATE-08', 'RFID-SALLY-OUT', 'RFID-SALLY-IN', 'RFID-BLOCK-A', 'RFID-BLOCK-B', 'RFID-BLOCK-C', 'RFID-ADMIN', 'PIR-SPINE']
    },
    'ESP32-MED-01': {
      id: 'ESP32-MED-01',
      name: 'Medical & Welfare IoT Node',
      location: 'Medical Ward Tech Room',
      ip: '192.168.10.41',
      status: 'ONLINE',
      lastHeartbeat: new Date().toISOString(),
      firmware: 'v2.4.1-esp32-freertos',
      uptimeSec: 72000,
      ownedDevices: ['DURESS-MED-01', 'PIR-MED', 'REED-ISO01', 'REED-ISO02', 'LOCK-ISO01', 'LOCK-ISO02']
    },
    'ESP32-CAM-HUB': {
      id: 'ESP32-CAM-HUB',
      name: 'CCTV Telemetry & Alarm Hub',
      location: 'Central Control Server Bay',
      ip: '192.168.10.51',
      status: 'ONLINE',
      lastHeartbeat: new Date().toISOString(),
      firmware: 'v2.4.1-esp32-freertos',
      uptimeSec: 210000,
      ownedDevices: ['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04', 'CAM-05', 'CAM-06', 'CAM-07', 'CAM-08', 'ALARM-FACILITY']
    }
  },

  // Devices & Sensors
  devices: {
    // Reed Switches (Door Magnetic Contact)
    'REED-A101': { id: 'REED-A101', name: 'Cell A-101 Door Contact', type: 'REED_SWITCH', location: 'Cell A-101', controllerId: 'ESP32-CELL-01', gpio: 14, status: 'ONLINE', value: 'CLOSED', x: 285, y: 170, lastUpdated: new Date().toISOString() },
    'REED-A102': { id: 'REED-A102', name: 'Cell A-102 Door Contact', type: 'REED_SWITCH', location: 'Cell A-102', controllerId: 'ESP32-CELL-01', gpio: 15, status: 'ONLINE', value: 'CLOSED', x: 340, y: 170, lastUpdated: new Date().toISOString() },
    'REED-A103': { id: 'REED-A103', name: 'Cell A-103 Door Contact', type: 'REED_SWITCH', location: 'Cell A-103', controllerId: 'ESP32-CELL-01', gpio: 16, status: 'ONLINE', value: 'CLOSED', x: 395, y: 170, lastUpdated: new Date().toISOString() },
    'REED-A104': { id: 'REED-A104', name: 'Cell A-104 Door Contact', type: 'REED_SWITCH', location: 'Cell A-104', controllerId: 'ESP32-CELL-01', gpio: 17, status: 'ONLINE', value: 'CLOSED', x: 450, y: 170, lastUpdated: new Date().toISOString() },

    'REED-B101': { id: 'REED-B101', name: 'Cell B-101 Door Contact', type: 'REED_SWITCH', location: 'Cell B-101', controllerId: 'ESP32-CELL-02', gpio: 14, status: 'ONLINE', value: 'CLOSED', x: 715, y: 170, lastUpdated: new Date().toISOString() },
    'REED-B102': { id: 'REED-B102', name: 'Cell B-102 Door Contact', type: 'REED_SWITCH', location: 'Cell B-102', controllerId: 'ESP32-CELL-02', gpio: 15, status: 'ONLINE', value: 'CLOSED', x: 770, y: 170, lastUpdated: new Date().toISOString() },
    'REED-B103': { id: 'REED-B103', name: 'Cell B-103 Door Contact', type: 'REED_SWITCH', location: 'Cell B-103', controllerId: 'ESP32-CELL-02', gpio: 16, status: 'ONLINE', value: 'CLOSED', x: 825, y: 170, lastUpdated: new Date().toISOString() },
    'REED-B104': { id: 'REED-B104', name: 'Cell B-104 Door Contact', type: 'REED_SWITCH', location: 'Cell B-104', controllerId: 'ESP32-CELL-02', gpio: 17, status: 'ONLINE', value: 'CLOSED', x: 880, y: 170, lastUpdated: new Date().toISOString() },

    'REED-C101': { id: 'REED-C101', name: 'Cell C-101 Door Contact', type: 'REED_SWITCH', location: 'Cell C-101', controllerId: 'ESP32-CELL-03', gpio: 14, status: 'ONLINE', value: 'CLOSED', x: 1145, y: 170, lastUpdated: new Date().toISOString() },
    'REED-C102': { id: 'REED-C102', name: 'Cell C-102 Door Contact', type: 'REED_SWITCH', location: 'Cell C-102', controllerId: 'ESP32-CELL-03', gpio: 15, status: 'ONLINE', value: 'CLOSED', x: 1200, y: 170, lastUpdated: new Date().toISOString() },
    'REED-C103': { id: 'REED-C103', name: 'Cell C-103 Door Contact', type: 'REED_SWITCH', location: 'Cell C-103', controllerId: 'ESP32-CELL-03', gpio: 16, status: 'ONLINE', value: 'CLOSED', x: 1255, y: 170, lastUpdated: new Date().toISOString() },
    'REED-C104': { id: 'REED-C104', name: 'Cell C-104 Door Contact', type: 'REED_SWITCH', location: 'Cell C-104', controllerId: 'ESP32-CELL-03', gpio: 17, status: 'ONLINE', value: 'CLOSED', x: 1310, y: 170, lastUpdated: new Date().toISOString() },

    'REED-ISO01': { id: 'REED-ISO01', name: 'Isolation Cell ISO-01 Door', type: 'REED_SWITCH', location: 'Isolation ISO-01', controllerId: 'ESP32-MED-01', gpio: 18, status: 'ONLINE', value: 'CLOSED', x: 310, y: 725, lastUpdated: new Date().toISOString() },
    'REED-ISO02': { id: 'REED-ISO02', name: 'Isolation Cell ISO-02 Door', type: 'REED_SWITCH', location: 'Isolation ISO-02', controllerId: 'ESP32-MED-01', gpio: 19, status: 'ONLINE', value: 'CLOSED', x: 390, y: 725, lastUpdated: new Date().toISOString() },

    // Cell Locks
    'LOCK-A101': { id: 'LOCK-A101', name: 'Cell A-101 Solenoid Lock', type: 'DOOR_LOCK', location: 'Cell A-101', controllerId: 'ESP32-CELL-01', gpio: 21, status: 'ONLINE', value: 'LOCKED', lastUpdated: new Date().toISOString() },
    'LOCK-A102': { id: 'LOCK-A102', name: 'Cell A-102 Solenoid Lock', type: 'DOOR_LOCK', location: 'Cell A-102', controllerId: 'ESP32-CELL-01', gpio: 22, status: 'ONLINE', value: 'LOCKED', lastUpdated: new Date().toISOString() },
    'LOCK-A103': { id: 'LOCK-A103', name: 'Cell A-103 Solenoid Lock', type: 'DOOR_LOCK', location: 'Cell A-103', controllerId: 'ESP32-CELL-01', gpio: 23, status: 'ONLINE', value: 'LOCKED', lastUpdated: new Date().toISOString() },
    'LOCK-A104': { id: 'LOCK-A104', name: 'Cell A-104 Solenoid Lock', type: 'DOOR_LOCK', location: 'Cell A-104', controllerId: 'ESP32-CELL-01', gpio: 25, status: 'ONLINE', value: 'LOCKED', lastUpdated: new Date().toISOString() },

    // PIR Motion Sensors
    'PIR-CORR-A': { id: 'PIR-CORR-A', name: 'Block A Corridor Motion Sensor', type: 'PIR_MOTION', location: 'Block A Corridor', controllerId: 'ESP32-CELL-01', gpio: 26, status: 'ONLINE', value: 'CLEAR', x: 370, y: 225, lastUpdated: new Date().toISOString() },
    'PIR-CORR-B': { id: 'PIR-CORR-B', name: 'Block B Corridor Motion Sensor', type: 'PIR_MOTION', location: 'Block B Corridor', controllerId: 'ESP32-CELL-02', gpio: 26, status: 'ONLINE', value: 'CLEAR', x: 800, y: 225, lastUpdated: new Date().toISOString() },
    'PIR-CORR-C': { id: 'PIR-CORR-C', name: 'Block C Corridor Motion Sensor', type: 'PIR_MOTION', location: 'Block C Corridor', controllerId: 'ESP32-CELL-03', gpio: 26, status: 'ONLINE', value: 'CLEAR', x: 1230, y: 225, lastUpdated: new Date().toISOString() },
    'PIR-SPINE': { id: 'PIR-SPINE', name: 'Central Spine Restricted Motion Sensor', type: 'PIR_MOTION', location: 'Central Secure Spine', controllerId: 'ESP32-ACCESS-01', gpio: 26, status: 'ONLINE', value: 'CLEAR', x: 800, y: 550, lastUpdated: new Date().toISOString() },
    'PIR-MED': { id: 'PIR-MED', name: 'Medical Ward Motion Sensor', type: 'PIR_MOTION', location: 'Medical Ward', controllerId: 'ESP32-MED-01', gpio: 27, status: 'ONLINE', value: 'CLEAR', x: 430, y: 480, lastUpdated: new Date().toISOString() },

    // Vibration Sensors
    'VIB-FENCE-N': { id: 'VIB-FENCE-N', name: 'North Fence Line Vibration Sensor', type: 'VIBRATION', location: 'North Perimeter', controllerId: 'ESP32-PERIM-01', gpio: 32, status: 'ONLINE', value: 'NORMAL', x: 500, y: 50, lastUpdated: new Date().toISOString() },
    'VIB-FENCE-E': { id: 'VIB-FENCE-E', name: 'East Fence Line Vibration Sensor', type: 'VIBRATION', location: 'East Perimeter', controllerId: 'ESP32-PERIM-01', gpio: 33, status: 'ONLINE', value: 'NORMAL', x: 1510, y: 500, lastUpdated: new Date().toISOString() },
    'VIB-FENCE-S': { id: 'VIB-FENCE-S', name: 'South Fence Line Vibration Sensor', type: 'VIBRATION', location: 'South Perimeter', controllerId: 'ESP32-PERIM-02', gpio: 32, status: 'ONLINE', value: 'NORMAL', x: 1100, y: 930, lastUpdated: new Date().toISOString() },
    'VIB-FENCE-W': { id: 'VIB-FENCE-W', name: 'West Fence Line Vibration Sensor', type: 'VIBRATION', location: 'West Perimeter', controllerId: 'ESP32-PERIM-02', gpio: 33, status: 'ONLINE', value: 'NORMAL', x: 90, y: 500, lastUpdated: new Date().toISOString() },

    // IR Break-Beam Sensors
    'IR-BEAM-N': { id: 'IR-BEAM-N', name: 'North Perimeter IR Barrier', type: 'IR_BREAK_BEAM', location: 'North Perimeter', controllerId: 'ESP32-PERIM-01', gpio: 34, status: 'ONLINE', value: 'INTACT', x: 800, y: 45, lastUpdated: new Date().toISOString() },
    'IR-BEAM-E': { id: 'IR-BEAM-E', name: 'East Perimeter IR Barrier', type: 'IR_BREAK_BEAM', location: 'East Perimeter', controllerId: 'ESP32-PERIM-01', gpio: 35, status: 'ONLINE', value: 'INTACT', x: 1495, y: 480, lastUpdated: new Date().toISOString() },
    'IR-BEAM-S': { id: 'IR-BEAM-S', name: 'South Perimeter IR Barrier', type: 'IR_BREAK_BEAM', location: 'South Perimeter', controllerId: 'ESP32-PERIM-02', gpio: 34, status: 'ONLINE', value: 'INTACT', x: 800, y: 920, lastUpdated: new Date().toISOString() },
    'IR-BEAM-W': { id: 'IR-BEAM-W', name: 'West Perimeter IR Barrier', type: 'IR_BREAK_BEAM', location: 'West Perimeter', controllerId: 'ESP32-PERIM-02', gpio: 35, status: 'ONLINE', value: 'INTACT', x: 105, y: 480, lastUpdated: new Date().toISOString() },

    // RFID Readers
    'RFID-SALLY-OUT': { id: 'RFID-SALLY-OUT', name: 'Sally Port Exterior RFID Terminal', type: 'RFID_READER', location: 'South Sally Port Outer', controllerId: 'ESP32-ACCESS-01', gpio: 18, status: 'ONLINE', value: 'READY', x: 830, y: 840, lastUpdated: new Date().toISOString() },
    'RFID-SALLY-IN': { id: 'RFID-SALLY-IN', name: 'Sally Port Interior RFID Terminal', type: 'RFID_READER', location: 'Sally Port Inner Gate', controllerId: 'ESP32-ACCESS-01', gpio: 19, status: 'ONLINE', value: 'READY', x: 830, y: 710, lastUpdated: new Date().toISOString() },
    'RFID-BLOCK-A': { id: 'RFID-BLOCK-A', name: 'Block A Access RFID Reader', type: 'RFID_READER', location: 'Block A Entrance', controllerId: 'ESP32-ACCESS-01', gpio: 21, status: 'ONLINE', value: 'READY', x: 370, y: 280, lastUpdated: new Date().toISOString() },
    'RFID-BLOCK-B': { id: 'RFID-BLOCK-B', name: 'Block B Access RFID Reader', type: 'RFID_READER', location: 'Block B Entrance', controllerId: 'ESP32-ACCESS-01', gpio: 22, status: 'ONLINE', value: 'READY', x: 800, y: 280, lastUpdated: new Date().toISOString() },
    'RFID-ADMIN': { id: 'RFID-ADMIN', name: 'Admin Building Secure RFID Reader', type: 'RFID_READER', location: 'Admin Entrance', controllerId: 'ESP32-ACCESS-01', gpio: 23, status: 'ONLINE', value: 'READY', x: 1080, y: 350, lastUpdated: new Date().toISOString() },

    // Duress & Alarms
    'DURESS-MED-01': { id: 'DURESS-MED-01', name: 'Medical Station Panic/Duress Button', type: 'DURESS_BUTTON', location: 'Medical Ward', controllerId: 'ESP32-MED-01', gpio: 36, status: 'ONLINE', value: 'IDLE', x: 470, y: 410, lastUpdated: new Date().toISOString() },
    'ALARM-FACILITY': { id: 'ALARM-FACILITY', name: 'Facility Emergency Strobe & Siren', type: 'ALARM_STROBE', location: 'Facility Wide', controllerId: 'ESP32-CAM-HUB', gpio: 4, status: 'ONLINE', value: 'STANDBY', x: 800, y: 500, lastUpdated: new Date().toISOString() },

    // CCTV Cameras
    'CAM-01': { id: 'CAM-01', name: 'CAM-01: Common Yard Wide Angle', type: 'CAMERA', location: 'Common Exercise Yard', controllerId: 'ESP32-CAM-HUB', gpio: 0, status: 'ONLINE', value: 'STREAMING', x: 680, y: 390, angle: 45, lastUpdated: new Date().toISOString() },
    'CAM-02': { id: 'CAM-02', name: 'CAM-02: North Corridor Spine', type: 'CAMERA', location: 'North Main Corridor', controllerId: 'ESP32-CAM-HUB', gpio: 0, status: 'ONLINE', value: 'STREAMING', x: 800, y: 290, angle: 90, lastUpdated: new Date().toISOString() },
    'CAM-03': { id: 'CAM-03', name: 'CAM-03: Sally Port Vehicle Intake', type: 'CAMERA', location: 'Main Sally Port', controllerId: 'ESP32-CAM-HUB', gpio: 0, status: 'ONLINE', value: 'STREAMING', x: 780, y: 780, angle: 180, lastUpdated: new Date().toISOString() },
    'CAM-04': { id: 'CAM-04', name: 'CAM-04: East Perimeter Line', type: 'CAMERA', location: 'East Perimeter', controllerId: 'ESP32-CAM-HUB', gpio: 0, status: 'ONLINE', value: 'STREAMING', x: 1475, y: 450, angle: 270, lastUpdated: new Date().toISOString() },
    'CAM-05': { id: 'CAM-05', name: 'CAM-05: West Perimeter Line', type: 'CAMERA', location: 'West Perimeter', controllerId: 'ESP32-CAM-HUB', gpio: 0, status: 'ONLINE', value: 'STREAMING', x: 100, y: 450, angle: 90, lastUpdated: new Date().toISOString() },
    'CAM-06': { id: 'CAM-06', name: 'CAM-06: Admin Entry Portal', type: 'CAMERA', location: 'Administration Building', controllerId: 'ESP32-CAM-HUB', gpio: 0, status: 'ONLINE', value: 'STREAMING', x: 1020, y: 380, angle: 135, lastUpdated: new Date().toISOString() },
    'CAM-07': { id: 'CAM-07', name: 'CAM-07: Medical Ward Triage', type: 'CAMERA', location: 'Medical Ward', controllerId: 'ESP32-CAM-HUB', gpio: 0, status: 'ONLINE', value: 'STREAMING', x: 280, y: 390, angle: 45, lastUpdated: new Date().toISOString() },
    'CAM-08': { id: 'CAM-08', name: 'CAM-08: SOC Central Command', type: 'CAMERA', location: 'Central Security Control', controllerId: 'ESP32-CAM-HUB', gpio: 0, status: 'ONLINE', value: 'STREAMING', x: 1020, y: 650, angle: 45, lastUpdated: new Date().toISOString() }
  },

  // Gates (High-Security Perimeter and Internal Gates)
  gates: {
    'GATE-01': {
      id: 'GATE-01',
      name: 'Gate 1 - North (Perimeter)',
      type: 'PERIMETER_SLIDING_GATE',
      location: 'North Perimeter Barrier',
      controllerId: 'ESP32-PERIM-01',
      state: 'CLOSED', // 'CLOSED' | 'OPENING' | 'OPEN' | 'CLOSING' | 'JAMMED'
      targetState: 'CLOSED',
      limitSwitchClosed: true,
      limitSwitchOpen: false,
      isJammed: false,
      motorCurrentAmps: 0.1,
      x: 800,
      y: 60,
      lastCommandId: null,
      lastUpdated: new Date().toISOString()
    },
    'GATE-02': {
      id: 'GATE-02',
      name: 'Gate 2 - South (Sally Port Outer)',
      type: 'VEHICLE_INTAKE_GATE',
      location: 'South Sally Port Outer',
      controllerId: 'ESP32-PERIM-02',
      state: 'OPEN',
      targetState: 'OPEN',
      limitSwitchClosed: false,
      limitSwitchOpen: true,
      isJammed: false,
      motorCurrentAmps: 0.1,
      x: 800,
      y: 840,
      lastCommandId: null,
      lastUpdated: new Date().toISOString()
    },
    'GATE-03': {
      id: 'GATE-03',
      name: 'East Gate (Perimeter)',
      type: 'SECURITY_TURNSTILE_GATE',
      location: 'East Fence Perimeter',
      controllerId: 'ESP32-PERIM-01',
      state: 'CLOSED',
      targetState: 'CLOSED',
      limitSwitchClosed: true,
      limitSwitchOpen: false,
      isJammed: false,
      motorCurrentAmps: 0.0,
      x: 1495,
      y: 500,
      lastCommandId: null,
      lastUpdated: new Date().toISOString()
    },
    'GATE-04': {
      id: 'GATE-04',
      name: 'West Gate (Perimeter)',
      type: 'MAINTENANCE_GATE',
      location: 'West Fence Perimeter',
      controllerId: 'ESP32-PERIM-02',
      state: 'CLOSED',
      targetState: 'CLOSED',
      limitSwitchClosed: true,
      limitSwitchOpen: false,
      isJammed: false,
      motorCurrentAmps: 0.0,
      x: 105,
      y: 500,
      lastCommandId: null,
      lastUpdated: new Date().toISOString()
    },
    'GATE-05': {
      id: 'GATE-05',
      name: 'Yard Gate (Rec Area)',
      type: 'HEAVY_STEEL_GATE',
      location: 'Yard Access Corridor',
      controllerId: 'ESP32-ACCESS-01',
      state: 'CLOSED',
      targetState: 'CLOSED',
      limitSwitchClosed: true,
      limitSwitchOpen: false,
      isJammed: false,
      motorCurrentAmps: 0.0,
      x: 740,
      y: 440,
      lastCommandId: null,
      lastUpdated: new Date().toISOString()
    },
    'GATE-06': {
      id: 'GATE-06',
      name: 'Sally Port Inner Gate',
      type: 'MANTrap_INTERLOCK_GATE',
      location: 'Central Spine Intake',
      controllerId: 'ESP32-ACCESS-01',
      state: 'CLOSED',
      targetState: 'CLOSED',
      limitSwitchClosed: true,
      limitSwitchOpen: false,
      isJammed: false,
      motorCurrentAmps: 0.0,
      x: 800,
      y: 710,
      lastCommandId: null,
      lastUpdated: new Date().toISOString()
    },
    'GATE-07': {
      id: 'GATE-07',
      name: 'Admin Gate (Staff Checkpoint)',
      type: 'ELECTRONIC_TURNSTILE',
      location: 'Administration Checkpoint',
      controllerId: 'ESP32-ACCESS-01',
      state: 'CLOSED',
      targetState: 'CLOSED',
      limitSwitchClosed: true,
      limitSwitchOpen: false,
      isJammed: false,
      motorCurrentAmps: 0.0,
      x: 1080,
      y: 375,
      lastCommandId: null,
      lastUpdated: new Date().toISOString()
    },
    'GATE-08': {
      id: 'GATE-08',
      name: 'Isolation Security Gate',
      type: 'HIGH_SECURITY_BARRIER',
      location: 'Solitary Confinement Entry',
      controllerId: 'ESP32-ACCESS-01',
      state: 'CLOSED',
      targetState: 'CLOSED',
      limitSwitchClosed: true,
      limitSwitchOpen: false,
      isJammed: false,
      motorCurrentAmps: 0.0,
      x: 540,
      y: 690,
      lastCommandId: null,
      lastUpdated: new Date().toISOString()
    }
  },

  // Personnel (Prisoners, Officers, Supervisors, Medical Staff)
  people: {
    // Prisoners
    'P-1044': {
      id: 'P-1044',
      name: 'Marcus Vance',
      alias: 'Apex',
      type: 'PRISONER',
      category: 'PRISONER',
      profile: 'ESCAPE_PRONE',
      assignedCell: 'Cell A-102',
      assignedDoorId: 'DOOR-A102',
      cellWaypoint: 'W_A102',
      securityRisk: 'HIGH_SECURITY',
      currentRoom: 'Cell A-102',
      currentWaypoint: 'W_A102',
      x: 340,
      y: 140,
      targetWaypoint: null,
      path: [],
      activity: 'Resting in Cell',
      status: 'NORMAL', // 'NORMAL' | 'ESCAPING' | 'DETAINED' | 'IN_TRANSIT' | 'RESTRICTED'
      health: 100,
      maxHealth: 100,
      healthState: 'HEALTHY', // 'HEALTHY' | 'INJURED' | 'INCAPACITATED' | 'RECEIVING_CARE' | 'RECOVERING' | 'RECOVERED'
      trackingStatus: 'SIMULATED TRACKING',
      beaconFrequencyHz: 433.92,
      batteryLevel: 94,
      lastLocationUpdate: new Date().toISOString(),
      associatedIncident: null,
      fictionalNote: 'Fictional demonstration profile for academic simulation.',
      caseBackground: 'Fictional logistics planner convicted in simulated financial espionage scenario. Shows compliant behavior under current custodial profile.',
      emergencyContact: 'Fictional Legal Representative: H. Vance (Attorney-at-Law)',
      interviewHistory: [
        { date: '2026-09-12', interviewer: 'Sgt. A. Cole', summary: 'Routine quarterly custodial review. Inmate requested additional library privileges.' },
        { date: '2026-10-15', interviewer: 'Lt. M. Sterling', summary: 'Work detail assignment interview for Block A laundry supervision.' }
      ],
      medicalHistory: 'Vitals stable. No chronic medical interventions required.',
      routeHistory: [
        { room: 'Cell A-102', x: 340, y: 140, timestamp: new Date(Date.now() - 3600000).toISOString() }
      ]
    },
    'P-2089': {
      id: 'P-2089',
      name: 'David Chen',
      alias: 'Specter',
      type: 'PRISONER',
      category: 'PRISONER',
      profile: 'RESTLESS',
      assignedCell: 'Cell B-102',
      assignedDoorId: 'DOOR-B102',
      cellWaypoint: 'W_B102',
      securityRisk: 'MEDIUM',
      currentRoom: 'Cell B-102',
      currentWaypoint: 'W_B102',
      x: 770,
      y: 140,
      targetWaypoint: null,
      path: [],
      activity: 'Reading / Resting',
      status: 'NORMAL',
      health: 100,
      maxHealth: 100,
      healthState: 'HEALTHY',
      trackingStatus: 'SIMULATED TRACKING',
      beaconFrequencyHz: 433.92,
      batteryLevel: 88,
      lastLocationUpdate: new Date().toISOString(),
      associatedIncident: null,
      fictionalNote: 'Fictional demonstration profile for academic simulation.',
      caseBackground: 'Fictional cyber operations specialist in simulated infrastructure breach scenario. Low physical risk profile.',
      emergencyContact: 'Fictional Sister: Linda Chen',
      interviewHistory: [
        { date: '2026-10-02', interviewer: 'Dr. E. Reed', summary: 'Welfare assessment regarding vocational training in digital maintenance.' }
      ],
      medicalHistory: 'Mild astigmatism; corrective lenses issued.',
      routeHistory: [
        { room: 'Cell B-102', x: 770, y: 140, timestamp: new Date(Date.now() - 7200000).toISOString() }
      ]
    },
    'P-3105': {
      id: 'P-3105',
      name: 'Jackson Miller',
      alias: 'Jackrabbit',
      type: 'PRISONER',
      category: 'PRISONER',
      profile: 'ROUTINE',
      assignedCell: 'Cell C-101',
      assignedDoorId: 'DOOR-C101',
      cellWaypoint: 'W_C101',
      securityRisk: 'LOW',
      currentRoom: 'Cell C-101',
      currentWaypoint: 'W_C101',
      x: 1145,
      y: 140,
      targetWaypoint: null,
      path: [],
      activity: 'Bunk Inspection',
      status: 'NORMAL',
      health: 100,
      maxHealth: 100,
      healthState: 'HEALTHY',
      trackingStatus: 'SIMULATED TRACKING',
      beaconFrequencyHz: 433.92,
      batteryLevel: 91,
      lastLocationUpdate: new Date().toISOString(),
      associatedIncident: null,
      fictionalNote: 'Fictional demonstration profile for academic simulation.',
      caseBackground: 'Fictional property trespass scenario. Assigned to kitchen work crew.',
      emergencyContact: 'Fictional Uncle: Thomas Miller',
      interviewHistory: [
        { date: '2026-08-20', interviewer: 'Capt. J. Reyes', summary: 'Good conduct review.' }
      ],
      medicalHistory: 'Standard seasonal allergy profile.',
      routeHistory: []
    },
    'P-4412': {
      id: 'P-4412',
      name: 'Sarah Connor',
      alias: 'Valkyrie',
      type: 'PRISONER',
      category: 'PRISONER',
      profile: 'SPECIAL_CARE',
      assignedCell: 'Medical Ward',
      assignedDoorId: null,
      cellWaypoint: 'W_MED_2',
      securityRisk: 'SPECIAL_CARE',
      currentRoom: 'Medical Ward - Patient Bed 1',
      currentWaypoint: 'W_MED_2',
      x: 480,
      y: 450,
      targetWaypoint: null,
      path: [],
      activity: 'Medical Observation',
      status: 'NORMAL',
      health: 85,
      maxHealth: 100,
      healthState: 'RECOVERING',
      trackingStatus: 'SIMULATED TRACKING',
      beaconFrequencyHz: 433.92,
      batteryLevel: 82,
      lastLocationUpdate: new Date().toISOString(),
      associatedIncident: 'INC-MED-01',
      fictionalNote: 'Fictional demonstration profile inspired by science-fiction literature and cinematic narrative.',
      caseBackground: 'Retained under special observational protocol following simulated incident involving automated factory defense systems and reports regarding artificial intelligence network Skynet. Demonstrates high tactical fitness and cooperative demeanor during medical evaluations.',
      emergencyContact: 'Son (Fictional): John Connor (Listed in care of approved guardian)',
      interviewHistory: [
        { date: '2026-07-14', interviewer: 'Dr. E. Reed', summary: 'Subject expressed persistent concern regarding automated weapons testing. Calm, coherent, and physically disciplined.' },
        { date: '2026-09-28', interviewer: 'Sgt. A. Cole', summary: 'Security debriefing regarding electronic perimeter integrity. Offered constructive security observations.' }
      ],
      medicalHistory: 'Previous shoulder fracture fully healed; routine physical therapy completed.',
      routeHistory: []
    },
    'P-5590': {
      id: 'P-5590',
      name: 'Tyler Durden',
      alias: 'Ghost',
      type: 'PRISONER',
      category: 'PRISONER',
      profile: 'RESTLESS',
      assignedCell: 'Isolation Cell ISO-01',
      assignedDoorId: 'DOOR-ISO01',
      cellWaypoint: 'W_ISO_CELL1',
      securityRisk: 'MAXIMUM_ISOLATION',
      currentRoom: 'Isolation Cell ISO-01',
      currentWaypoint: 'W_ISO_CELL1',
      x: 310,
      y: 695,
      targetWaypoint: null,
      path: [],
      activity: 'Solitary Confinement',
      status: 'RESTRICTED',
      health: 90,
      maxHealth: 100,
      healthState: 'HEALTHY',
      trackingStatus: 'SIMULATED TRACKING',
      beaconFrequencyHz: 433.92,
      batteryLevel: 79,
      lastLocationUpdate: new Date().toISOString(),
      associatedIncident: null,
      fictionalNote: 'Fictional demonstration profile inspired by underground resistance cinema narrative.',
      caseBackground: 'Fictional founder of Paper Street Soap Company in simulated subversive credit record erasure scenario. Subject demonstrates dual-identity ideation. Monitored in Solitary Confinement unit ISO-01 for administrative safety.',
      emergencyContact: 'Fictional Acquaintance: Marla Singer',
      interviewHistory: [
        { date: '2026-08-03', interviewer: 'Dr. E. Reed', summary: 'Evaluated sleep disturbances and dissociative episodes. Recommended quiet sensory environment.' },
        { date: '2026-10-10', interviewer: 'Capt. J. Reyes', summary: 'Discussion of rules regarding cell organization. Inmate responded with enigmatic philosophical remarks.' }
      ],
      medicalHistory: 'Chronic insomnia; melatonin therapy administered under supervision.',
      routeHistory: []
    },
    'P-6120': {
      id: 'P-6120',
      name: 'Robert Paulson',
      alias: 'Moose',
      type: 'PRISONER',
      category: 'PRISONER',
      profile: 'SOCIAL',
      assignedCell: 'Cell B-104',
      assignedDoorId: 'DOOR-B104',
      cellWaypoint: 'W_B104',
      securityRisk: 'MEDIUM',
      currentRoom: 'Common Exercise Yard',
      currentWaypoint: 'W_YARD_1',
      x: 740,
      y: 480,
      targetWaypoint: null,
      path: [],
      activity: 'Yard Recreation / Exercise',
      status: 'NORMAL',
      health: 100,
      maxHealth: 100,
      healthState: 'HEALTHY',
      trackingStatus: 'SIMULATED TRACKING',
      beaconFrequencyHz: 433.92,
      batteryLevel: 95,
      lastLocationUpdate: new Date().toISOString(),
      associatedIncident: null,
      fictionalNote: 'Fictional demonstration profile for academic simulation.',
      caseBackground: 'Former competitive bodybuilder involved in simulated support group assembly. Calm, courteous, and cooperative with staff.',
      emergencyContact: 'Support Coordinator: M. Singer',
      interviewHistory: [
        { date: '2026-09-01', interviewer: 'Lt. M. Sterling', summary: 'Applied for yard maintenance equipment coordinator position.' }
      ],
      medicalHistory: 'Endocrine hormonal supplement therapy monitored by Dr. Reed.',
      routeHistory: []
    },

    // Officers
    'OFC-702': {
      id: 'OFC-702',
      name: 'Capt. John Reyes',
      type: 'OFFICER',
      category: 'OFFICER',
      badge: 'OFC-702',
      rfidCardId: 'CARD-OFC-702',
      assignedZone: 'East Perimeter & Sally Port',
      currentRoom: 'East Perimeter Upper',
      currentWaypoint: 'W_PERIM_EAST_N',
      x: 1495,
      y: 300,
      targetWaypoint: null,
      path: [],
      activity: 'Perimeter Fence Inspection',
      officerState: 'PATROLLING', // 'PATROLLING' | 'OBSERVING' | 'RESPONDING' | 'INTERCEPTING' | 'ESCORTING' | 'REQUESTING_ACCESS' | 'SECURING_CELL' | 'MEDICAL_RECOVERY' | 'RESPONDING_TO_ADMIN_COMMAND'
      currentAssignment: null,
      messageBubble: null, // { text: '...', expiresAt: 123456, type: 'RADIO' }
      rfidBadgeAction: null, // { cardId: '...', doorId: '...', text: '...' }
      recoveryTimerSec: 0,
      patrolState: 'ACTIVE_PATROL',
      status: 'NORMAL',
      health: 100,
      maxHealth: 100,
      healthState: 'HEALTHY',
      communicationStatus: 'ONLINE', // 'ONLINE' | 'RADIO_CHECK' | 'DEGRADED' | 'OFFLINE'
      credentialStatus: 'ACTIVE',   // 'ACTIVE' | 'SUSPENDED' | 'REVOKED'
      availability: 'AVAILABLE',    // 'AVAILABLE' | 'BUSY' | 'RESPONDING' | 'INCAPACITATED' | 'COMPROMISED'
      shift: 'Day Shift (06:00 - 18:00)',
      dutyStatus: 'ON_DUTY',
      trackingStatus: 'SIMULATED TRACKING',
      beaconFrequencyHz: 868.0,
      batteryLevel: 99,
      lastLocationUpdate: new Date().toISOString(),
      associatedIncident: null,
      routeHistory: []
    },
    'OFC-514': {
      id: 'OFC-514',
      name: 'Lt. Michael Sterling',
      type: 'OFFICER',
      category: 'OFFICER',
      badge: 'OFC-514',
      rfidCardId: 'CARD-OFC-514',
      assignedZone: 'Cell Blocks A & B',
      currentRoom: 'North Main Corridor',
      currentWaypoint: 'W_NORTH_A',
      x: 370,
      y: 305,
      targetWaypoint: null,
      path: [],
      activity: 'Routine Cell Block Check',
      officerState: 'PATROLLING',
      currentAssignment: null,
      messageBubble: null,
      rfidBadgeAction: null,
      recoveryTimerSec: 0,
      patrolState: 'ACTIVE_PATROL',
      status: 'NORMAL',
      health: 100,
      maxHealth: 100,
      healthState: 'HEALTHY',
      communicationStatus: 'ONLINE',
      credentialStatus: 'ACTIVE',
      availability: 'AVAILABLE',
      shift: 'Day Shift (06:00 - 18:00)',
      dutyStatus: 'ON_DUTY',
      trackingStatus: 'SIMULATED TRACKING',
      beaconFrequencyHz: 868.0,
      batteryLevel: 97,
      lastLocationUpdate: new Date().toISOString(),
      associatedIncident: null,
      routeHistory: []
    },
    'OFC-118': {
      id: 'OFC-118',
      name: 'Officer David Kim',
      type: 'OFFICER',
      category: 'OFFICER',
      badge: 'OFC-118',
      rfidCardId: 'CARD-OFC-118',
      assignedZone: 'Medical & Sally Port Guard',
      currentRoom: 'Medical Ward Checkpoint',
      currentWaypoint: 'W_MED_ENTRY',
      x: 420,
      y: 375,
      targetWaypoint: null,
      path: [],
      activity: 'Escort Duty & Checkpoint Guard',
      officerState: 'PATROLLING',
      currentAssignment: null,
      messageBubble: null,
      rfidBadgeAction: null,
      recoveryTimerSec: 0,
      patrolState: 'ACTIVE_PATROL',
      status: 'NORMAL',
      health: 100,
      maxHealth: 100,
      healthState: 'HEALTHY',
      communicationStatus: 'ONLINE',
      credentialStatus: 'ACTIVE',
      availability: 'AVAILABLE',
      shift: 'Day Shift (06:00 - 18:00)',
      dutyStatus: 'ON_DUTY',
      trackingStatus: 'SIMULATED TRACKING',
      beaconFrequencyHz: 868.0,
      batteryLevel: 92,
      lastLocationUpdate: new Date().toISOString(),
      associatedIncident: null,
      routeHistory: []
    },

    // Supervisor
    'SUP-309': {
      id: 'SUP-309',
      name: 'Sgt. Amanda Cole',
      type: 'SUPERVISOR',
      category: 'SUPERVISOR',
      badge: 'SUP-309',
      rfidCardId: 'CARD-SUP-309',
      assignedZone: 'Central Control (SOC)',
      currentRoom: 'Control Room - SOC Terminal A',
      currentWaypoint: 'W_CONTROL_1',
      x: 1140,
      y: 720,
      targetWaypoint: null,
      path: [],
      activity: 'SOC Monitoring & Command',
      patrolState: 'STATIONARY_POST',
      status: 'NORMAL',
      health: 100,
      maxHealth: 100,
      healthState: 'HEALTHY',
      communicationStatus: 'ONLINE',
      credentialStatus: 'ACTIVE',
      availability: 'AVAILABLE',
      shift: 'Day Shift (06:00 - 18:00)',
      dutyStatus: 'ON_DUTY_SUPERVISOR',
      trackingStatus: 'SIMULATED TRACKING',
      beaconFrequencyHz: 868.0,
      batteryLevel: 100,
      lastLocationUpdate: new Date().toISOString(),
      associatedIncident: null,
      routeHistory: []
    },

    // Medical Staff
    'DOC-401': {
      id: 'DOC-401',
      name: 'Dr. Evelyn Reed, MD',
      type: 'MEDICAL_DOCTOR',
      category: 'MEDICAL',
      badge: 'DOC-401',
      rfidCardId: 'CARD-DOC-401',
      assignedZone: 'Medical & Welfare Ward',
      currentRoom: 'Medical Ward - Triage',
      currentWaypoint: 'W_MED_1',
      x: 380,
      y: 450,
      targetWaypoint: null,
      path: [],
      activity: 'Medical Clinic Rounds & Patient Review',
      patrolState: 'CLINICAL_ROUNDS',
      status: 'NORMAL',
      health: 100,
      maxHealth: 100,
      healthState: 'HEALTHY',
      communicationStatus: 'ONLINE',
      credentialStatus: 'ACTIVE',
      availability: 'AVAILABLE',
      shift: 'Medical Shift (08:00 - 17:00)',
      dutyStatus: 'ON_DUTY_MEDICAL',
      trackingStatus: 'SIMULATED TRACKING',
      beaconFrequencyHz: 868.0,
      batteryLevel: 96,
      lastLocationUpdate: new Date().toISOString(),
      associatedIncident: null,
      routeHistory: []
    },
    'NRS-402': {
      id: 'NRS-402',
      name: 'Elena Rostova, RN',
      type: 'MEDICAL_NURSE',
      category: 'MEDICAL',
      badge: 'NRS-402',
      rfidCardId: 'CARD-NRS-402',
      assignedZone: 'Medical Ward Checkpoint',
      currentRoom: 'Medical Ward Checkpoint',
      currentWaypoint: 'W_MED_ENTRY',
      x: 420,
      y: 395,
      targetWaypoint: null,
      path: [],
      activity: 'Dispensing Scheduled Medication',
      patrolState: 'MEDICATION_DISPENSE',
      status: 'NORMAL',
      health: 100,
      maxHealth: 100,
      healthState: 'HEALTHY',
      communicationStatus: 'ONLINE',
      credentialStatus: 'ACTIVE',
      availability: 'AVAILABLE',
      shift: 'Medical Shift (07:30 - 16:30)',
      dutyStatus: 'ON_DUTY_MEDICAL',
      trackingStatus: 'SIMULATED TRACKING',
      beaconFrequencyHz: 868.0,
      batteryLevel: 94,
      lastLocationUpdate: new Date().toISOString(),
      associatedIncident: null,
      routeHistory: []
    }
  },

  // Active Incidents seeded to match screenshots
  incidents: [
    {
      id: 'INC-PERIM-01',
      title: 'Motion detected at East Perimeter',
      rule: 'RULE D: Perimeter vibration combined with interrupted IR beam',
      severity: 'CRITICAL', // 'CRITICAL' | 'WARNING' | 'MEDIUM' | 'INFO'
      location: 'East Perimeter',
      coordinates: { x: 1495, y: 480 },
      associatedDevice: 'IR-BEAM-E',
      associatedPerson: 'P-1044',
      status: 'ACTIVE', // 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED'
      acknowledgedBy: null,
      resolvedBy: null,
      timestamp: new Date(Date.now() - 420000).toISOString(), // ~7 mins ago
      evidence: [
        'VIB-FENCE-E reported abnormal acceleration (threshold > 2.4g)',
        'IR-BEAM-E optical beam interrupted for 420ms',
        'ESP32-PERIM-01 published alert on topic prisonGuard/perimeter/ir-beam/state'
      ]
    },
    {
      id: 'INC-DOOR-02',
      title: 'Door opened - Block B (B-12)',
      rule: 'RULE B: Door opens without a recent authorized RFID scan',
      severity: 'WARNING',
      location: 'Block B (B-102)',
      coordinates: { x: 770, y: 170 },
      associatedDevice: 'REED-B102',
      associatedPerson: 'P-2089',
      status: 'ACTIVE',
      acknowledgedBy: null,
      resolvedBy: null,
      timestamp: new Date(Date.now() - 780000).toISOString(), // ~13 mins ago
      evidence: [
        'REED-B102 magnetic contact state changed from CLOSED to OPEN',
        'No RFID badge authorization recorded within 30-second window on reader RFID-BLOCK-B',
        'ESP32-CELL-02 reported spontaneous reed transition'
      ]
    },
    {
      id: 'INC-MED-01',
      title: 'Medical assistance requested',
      rule: 'RULE G: Medical assistance request / Duress call button triggered',
      severity: 'MEDIUM',
      location: 'Medical Ward Bed 1 (Cell C-04)',
      coordinates: { x: 470, y: 410 },
      associatedDevice: 'DURESS-MED-01',
      associatedPerson: 'P-4412',
      status: 'ACKNOWLEDGED',
      acknowledgedBy: 'S. Patel (Admin)',
      resolvedBy: null,
      timestamp: new Date(Date.now() - 1020000).toISOString(), // ~17 mins ago
      evidence: [
        'DURESS-MED-01 hardwired panic circuit engaged at Nurse Station',
        'ESP32-MED-01 GPIO 36 interrupt fired',
        'Patient telemetry requested urgent vitals assessment'
      ]
    }
  ],

  // Recent Activity Feed (matching screenshot)
  recentActivity: [
    { id: 'ACT-1', timestamp: new Date(Date.now() - 420000).toISOString(), timeFormatted: '14:26:23', event: 'Escape Alert Triggered – East Perimeter', location: 'East Perimeter', status: 'CRITICAL', color: 'red' },
    { id: 'ACT-2', timestamp: new Date(Date.now() - 600000).toISOString(), timeFormatted: '14:22:17', event: 'Gate 2 Opened – Authorized Staff Entry', location: 'Gate 2 - South', status: 'NORMAL', color: 'green' },
    { id: 'ACT-3', timestamp: new Date(Date.now() - 780000).toISOString(), timeFormatted: '14:20:11', event: 'Door Opened Unexpectedly – Block B (B-12)', location: 'Block B', status: 'WARNING', color: 'amber' },
    { id: 'ACT-4', timestamp: new Date(Date.now() - 1020000).toISOString(), timeFormatted: '14:18:50', event: 'Medical Request – Patient Ward Bed 1', location: 'Medical Ward', status: 'MEDIUM', color: 'blue' }
  ],

  // RFID Access Log History
  accessLogs: [
    { id: 'ACC-101', timestamp: new Date(Date.now() - 600000).toISOString(), readerId: 'RFID-SALLY-OUT', cardId: 'CARD-OFC-702', personName: 'Capt. John Reyes', role: 'OFFICER', location: 'South Sally Port Outer', result: 'GRANTED', reason: 'Authorized Duty Perimeter Patrol' },
    { id: 'ACC-102', timestamp: new Date(Date.now() - 1200000).toISOString(), readerId: 'RFID-BLOCK-A', cardId: 'CARD-OFC-514', personName: 'Lt. Michael Sterling', role: 'OFFICER', location: 'Block A Entrance', result: 'GRANTED', reason: 'Authorized Cell Inspection' },
    { id: 'ACC-103', timestamp: new Date(Date.now() - 1500000).toISOString(), readerId: 'RFID-ADMIN', cardId: 'UNKNOWN-CARD-99', personName: 'Unknown Credential', role: 'UNKNOWN', location: 'Admin Entrance', result: 'DENIED', reason: 'Unregistered / Invalid Security Token' }
  ],

  // Device telemetry logs
  deviceLogs: [
    { id: 'DEV-101', timestamp: new Date(Date.now() - 420000).toISOString(), deviceId: 'IR-BEAM-E', controllerId: 'ESP32-PERIM-01', event: 'STATE_CHANGE', reading: 'BROKEN', notes: 'Infrared line optical path occluded' },
    { id: 'DEV-102', timestamp: new Date(Date.now() - 421000).toISOString(), deviceId: 'VIB-FENCE-E', controllerId: 'ESP32-PERIM-01', event: 'THRESHOLD_EXCEEDED', reading: '2.4g', notes: 'Piezoelectric vibration sensor peak' },
    { id: 'DEV-103', timestamp: new Date(Date.now() - 600000).toISOString(), deviceId: 'GATE-02', controllerId: 'ESP32-PERIM-02', event: 'ACTUATOR_CONFIRMED', reading: 'OPEN', notes: 'Limit switch confirmed full travel' }
  ],

  // Active Demonstration Scenario
  activeScenario: null, // null | 'SCENARIO_A_CCTV_ALERT' | 'SCENARIO_B_ESCAPE_INTERVENTION' | ...
  scenarioElapsedSec: 0,
  scenarioSeed: 42
};

// IoT Network Communication Topology Definitions
// Models the 4-layer communication hierarchy:
// Layer 1: Sensors & Actuators <-> ESP32 Controllers (Simulated GPIO, Wiegand, I2C)
// Layer 2: ESP32 Controllers <-> Wi-Fi Access Points (802.11n Wi-Fi, Simulated MQTT)
// Layer 3: Wi-Fi Access Points <-> Shared Backend Service (Gigabit Facility VLAN 10)
// Layer 4: Shared Backend Service <-> Central Security Control (Admin Portal) (Real WebSocket & HTTP REST)
export const IOT_TOPOLOGY_METADATA = {
  backend: {
    id: 'BACKEND-CORE',
    name: 'PrisonGuard Authoritative Backend Service',
    location: 'Central Control Server Bay (Rack U4)',
    ip: '192.168.10.2',
    port: 5000,
    status: 'ONLINE',
    x: 1200,
    y: 720,
    transport: 'Node.js Express + Socket.IO v4 Engine',
    uptimeSec: 86400
  },
  centralControl: {
    id: 'SOC-CONSOLE-01',
    name: 'Central Security Operations Console',
    location: 'Central Security Control (SOC Room)',
    ip: '192.168.10.100',
    status: 'ONLINE',
    x: 1140,
    y: 720,
    role: 'ADMINISTRATOR / OPERATOR',
    transport: 'Vite React Web Application (SPA)'
  }
};

