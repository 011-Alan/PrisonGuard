// Map coordinate system: width = 1600, height = 1000

export const ROOMS = {
  // Cell Blocks
  'BLOCK_A_CORR': { name: 'Block A Corridor', x: 260, y: 190, width: 220, height: 70, type: 'cell_corridor' },
  'CELL_A101': { name: 'Cell A-101', x: 260, y: 110, width: 50, height: 60, type: 'cell', block: 'A', cellNumber: 'A-101' },
  'CELL_A102': { name: 'Cell A-102', x: 315, y: 110, width: 50, height: 60, type: 'cell', block: 'A', cellNumber: 'A-102' },
  'CELL_A103': { name: 'Cell A-103', x: 370, y: 110, width: 50, height: 60, type: 'cell', block: 'A', cellNumber: 'A-103' },
  'CELL_A104': { name: 'Cell A-104', x: 425, y: 110, width: 50, height: 60, type: 'cell', block: 'A', cellNumber: 'A-104' },

  'BLOCK_B_CORR': { name: 'Block B Corridor', x: 690, y: 190, width: 220, height: 70, type: 'cell_corridor' },
  'CELL_B101': { name: 'Cell B-101', x: 690, y: 110, width: 50, height: 60, type: 'cell', block: 'B', cellNumber: 'B-101' },
  'CELL_B102': { name: 'Cell B-102', x: 745, y: 110, width: 50, height: 60, type: 'cell', block: 'B', cellNumber: 'B-102' },
  'CELL_B103': { name: 'Cell B-103', x: 800, y: 110, width: 50, height: 60, type: 'cell', block: 'B', cellNumber: 'B-103' },
  'CELL_B104': { name: 'Cell B-104', x: 855, y: 110, width: 50, height: 60, type: 'cell', block: 'B', cellNumber: 'B-104' },

  'BLOCK_C_CORR': { name: 'Block C Corridor', x: 1120, y: 190, width: 220, height: 70, type: 'cell_corridor' },
  'CELL_C101': { name: 'Cell C-101', x: 1120, y: 110, width: 50, height: 60, type: 'cell', block: 'C', cellNumber: 'C-101' },
  'CELL_C102': { name: 'Cell C-102', x: 1175, y: 110, width: 50, height: 60, type: 'cell', block: 'C', cellNumber: 'C-102' },
  'CELL_C103': { name: 'Cell C-103', x: 1230, y: 110, width: 50, height: 60, type: 'cell', block: 'C', cellNumber: 'C-103' },
  'CELL_C104': { name: 'Cell C-104', x: 1285, y: 110, width: 50, height: 60, type: 'cell', block: 'C', cellNumber: 'C-104' },

  // Mid Level
  'NORTH_CORRIDOR': { name: 'North Main Corridor', x: 260, y: 280, width: 1080, height: 50, type: 'main_corridor' },
  'CENTRAL_CORRIDOR': { name: 'Central Secure Spine', x: 760, y: 330, width: 80, height: 420, type: 'restricted_corridor' },

  'MEDICAL_WARD': { name: 'Medical & Welfare Ward', x: 260, y: 370, width: 340, height: 220, type: 'medical' },
  'COMMON_YARD': { name: 'Common Exercise Yard', x: 670, y: 380, width: 260, height: 260, type: 'yard' },
  'ADMIN_BUILDING': { name: 'Administration Building', x: 1000, y: 370, width: 340, height: 220, type: 'admin' },

  // Bottom Level
  'ISOLATION_UNIT': { name: 'Solitary & Isolation Unit', x: 260, y: 640, width: 340, height: 180, type: 'isolation' },
  'CELL_ISO1': { name: 'Isolation Cell ISO-01', x: 280, y: 660, width: 60, height: 65, type: 'isolation_cell' },
  'CELL_ISO2': { name: 'Isolation Cell ISO-02', x: 360, y: 660, width: 60, height: 65, type: 'isolation_cell' },

  'SALLY_PORT': { name: 'Main Sally Port & Intake', x: 670, y: 690, width: 260, height: 170, type: 'sally_port' },
  'CONTROL_ROOM': { name: 'Central Security Control (SOC)', x: 1000, y: 640, width: 340, height: 180, type: 'control' },

  // Perimeter
  'PERIMETER_NORTH': { name: 'North Perimeter Zone', x: 120, y: 40, width: 1360, height: 40, type: 'perimeter' },
  'PERIMETER_SOUTH': { name: 'South Perimeter Zone', x: 120, y: 900, width: 1360, height: 40, type: 'perimeter' },
  'PERIMETER_EAST': { name: 'East Perimeter Zone', x: 1470, y: 40, width: 50, height: 900, type: 'perimeter' },
  'PERIMETER_WEST': { name: 'West Perimeter Zone', x: 80, y: 40, width: 50, height: 900, type: 'perimeter' }
};

// Navigation Waypoint Graph for deterministic walking
export const WAYPOINTS = {
  // Cells Block A
  'W_A101': { id: 'W_A101', x: 285, y: 140, room: 'Cell A-101', neighbors: ['W_A_CORR_1'] },
  'W_A102': { id: 'W_A102', x: 340, y: 140, room: 'Cell A-102', neighbors: ['W_A_CORR_2'] },
  'W_A103': { id: 'W_A103', x: 395, y: 140, room: 'Cell A-103', neighbors: ['W_A_CORR_3'] },
  'W_A104': { id: 'W_A104', x: 450, y: 140, room: 'Cell A-104', neighbors: ['W_A_CORR_4'] },
  'W_A_CORR_1': { id: 'W_A_CORR_1', x: 285, y: 225, room: 'Block A Corridor', neighbors: ['W_A101', 'W_A_CORR_2', 'W_NORTH_A'] },
  'W_A_CORR_2': { id: 'W_A_CORR_2', x: 340, y: 225, room: 'Block A Corridor', neighbors: ['W_A102', 'W_A_CORR_1', 'W_A_CORR_3'] },
  'W_A_CORR_3': { id: 'W_A_CORR_3', x: 395, y: 225, room: 'Block A Corridor', neighbors: ['W_A103', 'W_A_CORR_2', 'W_A_CORR_4'] },
  'W_A_CORR_4': { id: 'W_A_CORR_4', x: 450, y: 225, room: 'Block A Corridor', neighbors: ['W_A104', 'W_A_CORR_3', 'W_NORTH_A'] },
  'W_NORTH_A': { id: 'W_NORTH_A', x: 370, y: 305, room: 'North Main Corridor', neighbors: ['W_A_CORR_1', 'W_A_CORR_4', 'W_NORTH_MID_1', 'W_MED_ENTRY'] },

  // Cells Block B
  'W_B101': { id: 'W_B101', x: 715, y: 140, room: 'Cell B-101', neighbors: ['W_B_CORR_1'] },
  'W_B102': { id: 'W_B102', x: 770, y: 140, room: 'Cell B-102', neighbors: ['W_B_CORR_2'] },
  'W_B103': { id: 'W_B103', x: 825, y: 140, room: 'Cell B-103', neighbors: ['W_B_CORR_3'] },
  'W_B104': { id: 'W_B104', x: 880, y: 140, room: 'Cell B-104', neighbors: ['W_B_CORR_4'] },
  'W_B_CORR_1': { id: 'W_B_CORR_1', x: 715, y: 225, room: 'Block B Corridor', neighbors: ['W_B101', 'W_B_CORR_2', 'W_NORTH_B'] },
  'W_B_CORR_2': { id: 'W_B_CORR_2', x: 770, y: 225, room: 'Block B Corridor', neighbors: ['W_B102', 'W_B_CORR_1', 'W_B_CORR_3'] },
  'W_B_CORR_3': { id: 'W_B_CORR_3', x: 825, y: 225, room: 'Block B Corridor', neighbors: ['W_B103', 'W_B_CORR_2', 'W_B_CORR_4'] },
  'W_B_CORR_4': { id: 'W_B_CORR_4', x: 880, y: 225, room: 'Block B Corridor', neighbors: ['W_B104', 'W_B_CORR_3', 'W_NORTH_B'] },
  'W_NORTH_B': { id: 'W_NORTH_B', x: 800, y: 305, room: 'North Main Corridor', neighbors: ['W_B_CORR_2', 'W_NORTH_MID_1', 'W_NORTH_MID_2', 'W_CENTRAL_TOP'] },

  // Cells Block C
  'W_C101': { id: 'W_C101', x: 1145, y: 140, room: 'Cell C-101', neighbors: ['W_C_CORR_1'] },
  'W_C102': { id: 'W_C102', x: 1200, y: 140, room: 'Cell C-102', neighbors: ['W_C_CORR_2'] },
  'W_C103': { id: 'W_C103', x: 1255, y: 140, room: 'Cell C-103', neighbors: ['W_C_CORR_3'] },
  'W_C104': { id: 'W_C104', x: 1310, y: 140, room: 'Cell C-104', neighbors: ['W_C_CORR_4'] },
  'W_C_CORR_1': { id: 'W_C_CORR_1', x: 1145, y: 225, room: 'Block C Corridor', neighbors: ['W_C101', 'W_C_CORR_2', 'W_NORTH_C'] },
  'W_C_CORR_2': { id: 'W_C_CORR_2', x: 1200, y: 225, room: 'Block C Corridor', neighbors: ['W_C102', 'W_C_CORR_1', 'W_C_CORR_3'] },
  'W_C_CORR_3': { id: 'W_C_CORR_3', x: 1255, y: 225, room: 'Block C Corridor', neighbors: ['W_C103', 'W_C_CORR_2', 'W_C_CORR_4'] },
  'W_C_CORR_4': { id: 'W_C_CORR_4', x: 1310, y: 225, room: 'Block C Corridor', neighbors: ['W_C104', 'W_C_CORR_3', 'W_NORTH_C'] },
  'W_NORTH_C': { id: 'W_NORTH_C', x: 1230, y: 305, room: 'North Main Corridor', neighbors: ['W_C_CORR_2', 'W_NORTH_MID_2', 'W_ADMIN_ENTRY'] },

  // North Corridor Connectors
  'W_NORTH_MID_1': { id: 'W_NORTH_MID_1', x: 580, y: 305, room: 'North Main Corridor', neighbors: ['W_NORTH_A', 'W_NORTH_B', 'W_YARD_GATE'] },
  'W_NORTH_MID_2': { id: 'W_NORTH_MID_2', x: 1020, y: 305, room: 'North Main Corridor', neighbors: ['W_NORTH_B', 'W_NORTH_C', 'W_ADMIN_ENTRY'] },

  // Central Spine
  'W_CENTRAL_TOP': { id: 'W_CENTRAL_TOP', x: 800, y: 360, room: 'Central Secure Spine', neighbors: ['W_NORTH_B', 'W_CENTRAL_MID'] },
  'W_CENTRAL_MID': { id: 'W_CENTRAL_MID', x: 800, y: 510, room: 'Central Secure Spine', neighbors: ['W_CENTRAL_TOP', 'W_CENTRAL_BOT', 'W_YARD_GATE'] },
  'W_CENTRAL_BOT': { id: 'W_CENTRAL_BOT', x: 800, y: 660, room: 'Central Secure Spine', neighbors: ['W_CENTRAL_MID', 'W_SALLY_GATE_IN', 'W_ISO_ENTRY', 'W_CONTROL_ENTRY'] },

  // Common Yard
  'W_YARD_GATE': { id: 'W_YARD_GATE', x: 740, y: 440, room: 'Yard Access Gate (G-05)', neighbors: ['W_CENTRAL_MID', 'W_YARD_1'] },
  'W_YARD_1': { id: 'W_YARD_1', x: 740, y: 480, room: 'Common Exercise Yard', neighbors: ['W_YARD_GATE', 'W_YARD_2', 'W_YARD_3'] },
  'W_YARD_2': { id: 'W_YARD_2', x: 860, y: 480, room: 'Common Exercise Yard', neighbors: ['W_YARD_1', 'W_YARD_4'] },
  'W_YARD_3': { id: 'W_YARD_3', x: 740, y: 570, room: 'Common Exercise Yard', neighbors: ['W_YARD_1', 'W_YARD_4'] },
  'W_YARD_4': { id: 'W_YARD_4', x: 860, y: 570, room: 'Common Exercise Yard', neighbors: ['W_YARD_2', 'W_YARD_3'] },

  // Medical Ward
  'W_MED_ENTRY': { id: 'W_MED_ENTRY', x: 420, y: 375, room: 'Medical Ward Checkpoint', neighbors: ['W_NORTH_A', 'W_MED_1'] },
  'W_MED_1': { id: 'W_MED_1', x: 380, y: 450, room: 'Medical Ward - Triage', neighbors: ['W_MED_ENTRY', 'W_MED_2', 'W_MED_3'] },
  'W_MED_2': { id: 'W_MED_2', x: 480, y: 450, room: 'Medical Ward - Patient Bed 1', neighbors: ['W_MED_1'] },
  'W_MED_3': { id: 'W_MED_3', x: 380, y: 530, room: 'Medical Ward - Patient Bed 2', neighbors: ['W_MED_1'] },

  // Admin Building
  'W_ADMIN_ENTRY': { id: 'W_ADMIN_ENTRY', x: 1080, y: 375, room: 'Admin Checkpoint (G-06)', neighbors: ['W_NORTH_MID_2', 'W_NORTH_C', 'W_ADMIN_1'] },
  'W_ADMIN_1': { id: 'W_ADMIN_1', x: 1150, y: 450, room: 'Admin - Main Lobby', neighbors: ['W_ADMIN_ENTRY', 'W_ADMIN_2'] },
  'W_ADMIN_2': { id: 'W_ADMIN_2', x: 1250, y: 450, room: 'Admin - Warden Office', neighbors: ['W_ADMIN_1'] },

  // Isolation Unit
  'W_ISO_ENTRY': { id: 'W_ISO_ENTRY', x: 540, y: 690, room: 'Isolation Access Corridor', neighbors: ['W_CENTRAL_BOT', 'W_ISO_1'] },
  'W_ISO_1': { id: 'W_ISO_1', x: 420, y: 720, room: 'Isolation Holding Area', neighbors: ['W_ISO_ENTRY', 'W_ISO_CELL1', 'W_ISO_CELL2'] },
  'W_ISO_CELL1': { id: 'W_ISO_CELL1', x: 310, y: 695, room: 'Isolation Cell ISO-01', neighbors: ['W_ISO_1'] },
  'W_ISO_CELL2': { id: 'W_ISO_CELL2', x: 390, y: 695, room: 'Isolation Cell ISO-02', neighbors: ['W_ISO_1'] },

  // Control Room
  'W_CONTROL_ENTRY': { id: 'W_CONTROL_ENTRY', x: 1040, y: 690, room: 'Control Room Security Portal', neighbors: ['W_CENTRAL_BOT', 'W_CONTROL_1'] },
  'W_CONTROL_1': { id: 'W_CONTROL_1', x: 1140, y: 720, room: 'Control Room - SOC Terminal A', neighbors: ['W_CONTROL_ENTRY', 'W_CONTROL_2'] },
  'W_CONTROL_2': { id: 'W_CONTROL_2', x: 1250, y: 720, room: 'Control Room - Server Bay', neighbors: ['W_CONTROL_1'] },

  // Sally Port (Vehicle & Staff Intake)
  'W_SALLY_GATE_IN': { id: 'W_SALLY_GATE_IN', x: 800, y: 710, room: 'Sally Port Inner Gate (G-04)', neighbors: ['W_CENTRAL_BOT', 'W_SALLY_BAY'] },
  'W_SALLY_BAY': { id: 'W_SALLY_BAY', x: 800, y: 770, room: 'Vehicle Inspection Bay', neighbors: ['W_SALLY_GATE_IN', 'W_SALLY_GATE_OUT'] },
  'W_SALLY_GATE_OUT': { id: 'W_SALLY_GATE_OUT', x: 800, y: 840, room: 'Sally Port Outer Gate (G-02)', neighbors: ['W_SALLY_BAY', 'W_PERIM_SOUTH_MID'] },

  // Perimeter Walkway Nodes
  'W_PERIM_NORTH_MID': { id: 'W_PERIM_NORTH_MID', x: 800, y: 60, room: 'North Perimeter Gate (G-01)', neighbors: ['W_PERIM_NORTH_W', 'W_PERIM_NORTH_E'] },
  'W_PERIM_NORTH_W': { id: 'W_PERIM_NORTH_W', x: 180, y: 60, room: 'North-West Guard Tower', neighbors: ['W_PERIM_NORTH_MID', 'W_PERIM_WEST_N'] },
  'W_PERIM_NORTH_E': { id: 'W_PERIM_NORTH_E', x: 1420, y: 60, room: 'North-East Guard Tower', neighbors: ['W_PERIM_NORTH_MID', 'W_PERIM_EAST_N'] },

  'W_PERIM_WEST_N': { id: 'W_PERIM_WEST_N', x: 105, y: 300, room: 'West Perimeter Upper', neighbors: ['W_PERIM_NORTH_W', 'W_PERIM_WEST_S'] },
  'W_PERIM_WEST_S': { id: 'W_PERIM_WEST_S', x: 105, y: 700, room: 'West Perimeter Lower', neighbors: ['W_PERIM_WEST_N', 'W_PERIM_SOUTH_W'] },

  'W_PERIM_EAST_N': { id: 'W_PERIM_EAST_N', x: 1495, y: 300, room: 'East Perimeter Upper', neighbors: ['W_PERIM_NORTH_E', 'W_PERIM_EAST_S'] },
  'W_PERIM_EAST_S': { id: 'W_PERIM_EAST_S', x: 1495, y: 700, room: 'East Perimeter Lower', neighbors: ['W_PERIM_EAST_N', 'W_PERIM_SOUTH_E'] },

  'W_PERIM_SOUTH_MID': { id: 'W_PERIM_SOUTH_MID', x: 800, y: 920, room: 'South Perimeter Checkpoint', neighbors: ['W_SALLY_GATE_OUT', 'W_PERIM_SOUTH_W', 'W_PERIM_SOUTH_E'] },
  'W_PERIM_SOUTH_W': { id: 'W_PERIM_SOUTH_W', x: 180, y: 920, room: 'South-West Guard Tower', neighbors: ['W_PERIM_SOUTH_MID', 'W_PERIM_WEST_S'] },
  'W_PERIM_SOUTH_E': { id: 'W_PERIM_SOUTH_E', x: 1420, y: 920, room: 'South-East Guard Tower', neighbors: ['W_PERIM_SOUTH_MID', 'W_PERIM_EAST_S'] }
};

// Breadth-First-Search Pathfinding
export function findShortestPath(startId, endId) {
  if (!WAYPOINTS[startId] || !WAYPOINTS[endId]) return [startId];
  if (startId === endId) return [startId];

  const queue = [[startId]];
  const visited = new Set([startId]);

  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1];

    if (current === endId) {
      return path;
    }

    const neighbors = WAYPOINTS[current]?.neighbors || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([...path, neighbor]);
      }
    }
  }

  return [startId];
}
