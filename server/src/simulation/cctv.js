// CCTV Perception Layer & Simulated 2D Geometric Visibility Engine
// Provides camera inventory, field-of-view geometry, and line-of-sight obstruction checks.

export const CAMERAS = {
  'CAM-01': {
    id: 'CAM-01',
    name: 'CAM-01: Common Yard Wide Angle',
    zone: 'COMMON_YARD',
    location: 'Common Exercise Yard',
    controllerId: 'ESP32-CAM-HUB',
    x: 680,
    y: 390,
    angle: 45, // current viewing angle (degrees: 0=East, 45=SE, 90=South, 180=West, 270=North)
    defaultAngle: 45,
    minAngle: 15,
    maxAngle: 75,
    fov: 75,   // horizontal field of view in degrees
    distance: 260, // effective viewing range in map pixels
    status: 'ONLINE', // 'ONLINE' | 'OFFLINE' | 'DEGRADED'
    isSweeping: false,
    sweepDirection: 1, // 1 = clockwise, -1 = counter-clockwise
    sweepSpeed: 3,     // degrees per tick
    controlMode: 'STATIONARY', // 'STATIONARY' | 'SWEEP' | 'MANUAL'
    lastUpdated: new Date().toISOString()
  },
  'CAM-02': {
    id: 'CAM-02',
    name: 'CAM-02: North Corridor Spine',
    zone: 'NORTH_CORRIDOR',
    location: 'North Main Corridor',
    controllerId: 'ESP32-CAM-HUB',
    x: 800,
    y: 290,
    angle: 90,
    defaultAngle: 90,
    minAngle: 60,
    maxAngle: 120,
    fov: 80,
    distance: 280,
    status: 'ONLINE',
    isSweeping: false,
    sweepDirection: 1,
    sweepSpeed: 3,
    controlMode: 'STATIONARY',
    lastUpdated: new Date().toISOString()
  },
  'CAM-03': {
    id: 'CAM-03',
    name: 'CAM-03: Sally Port Vehicle Intake',
    zone: 'SALLY_PORT',
    location: 'Main Sally Port',
    controllerId: 'ESP32-CAM-HUB',
    x: 780,
    y: 730,
    angle: 90,
    defaultAngle: 90,
    minAngle: 45,
    maxAngle: 135,
    fov: 75,
    distance: 220,
    status: 'ONLINE',
    isSweeping: false,
    sweepDirection: 1,
    sweepSpeed: 3,
    controlMode: 'STATIONARY',
    lastUpdated: new Date().toISOString()
  },
  'CAM-04': {
    id: 'CAM-04',
    name: 'CAM-04: East Perimeter Line',
    zone: 'PERIMETER_EAST',
    location: 'East Perimeter',
    controllerId: 'ESP32-CAM-HUB',
    x: 1475,
    y: 450,
    angle: 270,
    defaultAngle: 270,
    minAngle: 230,
    maxAngle: 310,
    fov: 65,
    distance: 340,
    status: 'ONLINE',
    isSweeping: false,
    sweepDirection: 1,
    sweepSpeed: 2.5,
    controlMode: 'STATIONARY',
    lastUpdated: new Date().toISOString()
  },
  'CAM-05': {
    id: 'CAM-05',
    name: 'CAM-05: West Perimeter Line',
    zone: 'PERIMETER_WEST',
    location: 'West Perimeter',
    controllerId: 'ESP32-CAM-HUB',
    x: 100,
    y: 450,
    angle: 90,
    defaultAngle: 90,
    minAngle: 50,
    maxAngle: 130,
    fov: 65,
    distance: 340,
    status: 'ONLINE',
    isSweeping: false,
    sweepDirection: 1,
    sweepSpeed: 2.5,
    controlMode: 'STATIONARY',
    lastUpdated: new Date().toISOString()
  },
  'CAM-06': {
    id: 'CAM-06',
    name: 'CAM-06: Admin Entry Portal',
    zone: 'ADMIN_BUILDING',
    location: 'Administration Building',
    controllerId: 'ESP32-CAM-HUB',
    x: 1040,
    y: 390,
    angle: 120,
    defaultAngle: 120,
    minAngle: 85,
    maxAngle: 155,
    fov: 75,
    distance: 240,
    status: 'ONLINE',
    isSweeping: false,
    sweepDirection: 1,
    sweepSpeed: 3,
    controlMode: 'STATIONARY',
    lastUpdated: new Date().toISOString()
  },
  'CAM-07': {
    id: 'CAM-07',
    name: 'CAM-07: Medical Ward Triage',
    zone: 'MEDICAL_WARD',
    location: 'Medical Ward',
    controllerId: 'ESP32-CAM-HUB',
    x: 290,
    y: 390,
    angle: 45,
    defaultAngle: 45,
    minAngle: 15,
    maxAngle: 85,
    fov: 80,
    distance: 240,
    status: 'ONLINE',
    isSweeping: false,
    sweepDirection: 1,
    sweepSpeed: 3,
    controlMode: 'STATIONARY',
    lastUpdated: new Date().toISOString()
  },
  'CAM-08': {
    id: 'CAM-08',
    name: 'CAM-08: SOC Central Command',
    zone: 'CONTROL_ROOM',
    location: 'Central Security Control',
    controllerId: 'ESP32-CAM-HUB',
    x: 1040,
    y: 660,
    angle: 45,
    defaultAngle: 45,
    minAngle: 15,
    maxAngle: 75,
    fov: 75,
    distance: 220,
    status: 'ONLINE',
    isSweeping: false,
    sweepDirection: 1,
    sweepSpeed: 2.5,
    controlMode: 'STATIONARY',
    lastUpdated: new Date().toISOString()
  }
};

// Major solid visual obstructions (walls and closed barriers)
// Line segments: [x1, y1, x2, y2]
export const MAP_WALL_SEGMENTS = [
  // Cell Block A exterior dividing wall
  { x1: 260, y1: 175, x2: 480, y2: 175, name: 'Block A Cell Front Wall', doorExcluded: true },
  // Cell Block B exterior dividing wall
  { x1: 690, y1: 175, x2: 910, y2: 175, name: 'Block B Cell Front Wall', doorExcluded: true },
  // Cell Block C exterior dividing wall
  { x1: 1120, y1: 175, x2: 1340, y2: 175, name: 'Block C Cell Front Wall', doorExcluded: true },
  // Corridor bottom wall dividing North Corridor from Mid Ward/Yard/Admin
  { x1: 260, y1: 330, x2: 670, y2: 330, name: 'North Corridor South Wall - West' },
  { x1: 930, y1: 330, x2: 1340, y2: 330, name: 'North Corridor South Wall - East' },
  // Yard West & East Boundary Walls
  { x1: 670, y1: 380, x2: 670, y2: 640, name: 'Yard West Wall' },
  { x1: 930, y1: 380, x2: 930, y2: 640, name: 'Yard East Wall' },
  // Medical Ward East Wall
  { x1: 600, y1: 370, x2: 600, y2: 590, name: 'Medical Ward East Wall' },
  // Admin West Wall
  { x1: 1000, y1: 370, x2: 1000, y2: 590, name: 'Admin West Wall' },
  // Isolation Ward Wall
  { x1: 260, y1: 640, x2: 600, y2: 640, name: 'Isolation Unit North Wall' },
  // Control Room West Wall
  { x1: 1000, y1: 640, x2: 1000, y2: 820, name: 'Control Room West Wall' }
];

// Helper: 2D line segment intersection
export function checkLineIntersection(p1, p2, p3, p4) {
  const x1 = p1.x, y1 = p1.y;
  const x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y;
  const x4 = p4.x, y4 = p4.y;

  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  if (denom === 0) return false; // Parallel or collinear

  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;

  // Segment intersection occurs when both ua and ub are strictly between 0 and 1
  return (ua > 0.05 && ua < 0.95 && ub >= 0 && ub <= 1);
}

// Compute visibility of entities for a camera
export function computeCameraVisibility(camera, entities = [], doors = {}) {
  if (camera.status === 'OFFLINE') {
    return [];
  }

  const visible = [];
  const camPos = { x: camera.x, y: camera.y };
  const halfFov = camera.fov / 2;

  // Active closed doors that block line of sight
  const doorObstructions = [];
  for (const [id, door] of Object.entries(doors)) {
    if (door.position === 'CLOSED') {
      // 30px barrier perpendicular to door position
      doorObstructions.push({
        x1: door.x - 18,
        y1: door.y,
        x2: door.x + 18,
        y2: door.y,
        name: door.name
      });
    }
  }

  const allObstacles = [...MAP_WALL_SEGMENTS, ...doorObstructions];

  for (const entity of entities) {
    if (!entity || entity.x === undefined || entity.y === undefined) continue;

    const dx = entity.x - camera.x;
    const dy = entity.y - camera.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // 1. Distance check
    if (dist > camera.distance || dist < 10) continue;

    // 2. FOV Angle check
    // Angle in degrees from camera to entity [0, 360)
    let angleToEntity = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (angleToEntity < 0) angleToEntity += 360;

    let angleDiff = angleToEntity - camera.angle;
    // Normalize to [-180, 180]
    while (angleDiff > 180) angleDiff -= 360;
    while (angleDiff < -180) angleDiff += 360;

    if (Math.abs(angleDiff) > halfFov) {
      // Outside field of view cone (e.g. behind camera)
      continue;
    }

    // 3. Occlusion Line-of-Sight Check
    const entityPos = { x: entity.x, y: entity.y };
    let isOccluded = false;

    for (const wall of allObstacles) {
      const p3 = { x: wall.x1, y: wall.y1 };
      const p4 = { x: wall.x2, y: wall.y2 };

      if (checkLineIntersection(camPos, entityPos, p3, p4)) {
        isOccluded = true;
        break;
      }
    }

    if (!isOccluded) {
      // Compute camera-relative coordinates for slanted 2D perspective projection
      // Local coordinate system: forward along camera direction = +Y, right = +X
      const rad = ((camera.angle - 90) * Math.PI) / 180;
      const localX = dx * Math.cos(-rad) - dy * Math.sin(-rad);
      const localY = dx * Math.sin(-rad) + dy * Math.cos(-rad);

      visible.push({
        id: entity.id,
        name: entity.name,
        type: entity.type || entity.category,
        category: entity.category || entity.type,
        status: entity.status,
        activity: entity.activity,
        currentRoom: entity.currentRoom,
        x: entity.x,
        y: entity.y,
        distance: Math.round(dist),
        bearing: Math.round(angleToEntity),
        relativeX: Math.round(localX),
        relativeY: Math.round(localY)
      });
    }
  }

  return visible;
}
