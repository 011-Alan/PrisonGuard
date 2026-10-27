export const ROOMS = {
  'BLOCK_A_CORR': { name: 'Block A Corridor', x: 250, y: 190, width: 240, height: 80, type: 'cell_corridor' },
  'CELL_A101': { name: 'Cell A-101', x: 260, y: 110, width: 50, height: 65, type: 'cell' },
  'CELL_A102': { name: 'Cell A-102', x: 315, y: 110, width: 50, height: 65, type: 'cell' },
  'CELL_A103': { name: 'Cell A-103', x: 370, y: 110, width: 50, height: 65, type: 'cell' },
  'CELL_A104': { name: 'Cell A-104', x: 425, y: 110, width: 50, height: 65, type: 'cell' },

  'BLOCK_B_CORR': { name: 'Block B Corridor', x: 680, y: 190, width: 240, height: 80, type: 'cell_corridor' },
  'CELL_B101': { name: 'Cell B-101', x: 690, y: 110, width: 50, height: 65, type: 'cell' },
  'CELL_B102': { name: 'Cell B-102', x: 745, y: 110, width: 50, height: 65, type: 'cell' },
  'CELL_B103': { name: 'Cell B-103', x: 800, y: 110, width: 50, height: 65, type: 'cell' },
  'CELL_B104': { name: 'Cell B-104', x: 855, y: 110, width: 50, height: 65, type: 'cell' },

  'BLOCK_C_CORR': { name: 'Block C Corridor', x: 1110, y: 190, width: 240, height: 80, type: 'cell_corridor' },
  'CELL_C101': { name: 'Cell C-101', x: 1120, y: 110, width: 50, height: 65, type: 'cell' },
  'CELL_C102': { name: 'Cell C-102', x: 1175, y: 110, width: 50, height: 65, type: 'cell' },
  'CELL_C103': { name: 'Cell C-103', x: 1230, y: 110, width: 50, height: 65, type: 'cell' },
  'CELL_C104': { name: 'Cell C-104', x: 1285, y: 110, width: 50, height: 65, type: 'cell' },

  'NORTH_CORRIDOR': { name: 'North Main Corridor', x: 250, y: 280, width: 1100, height: 50, type: 'main_corridor' },
  'CENTRAL_CORRIDOR': { name: 'Central Secure Spine', x: 760, y: 330, width: 80, height: 360, type: 'restricted_corridor' },

  'MEDICAL_WARD': { name: 'Medical & Welfare Ward', x: 250, y: 370, width: 350, height: 230, type: 'medical' },
  'COMMON_YARD': { name: 'Common Exercise Yard', x: 660, y: 370, width: 280, height: 280, type: 'yard' },
  'ADMIN_BUILDING': { name: 'Administration Building', x: 1000, y: 370, width: 350, height: 230, type: 'admin' },

  'ISOLATION_UNIT': { name: 'Solitary & Isolation Unit', x: 250, y: 640, width: 350, height: 190, type: 'isolation' },
  'SALLY_PORT': { name: 'Main Sally Port & Intake', x: 660, y: 690, width: 280, height: 180, type: 'sally_port' },
  'CONTROL_ROOM': { name: 'Central Security Control (SOC)', x: 1000, y: 640, width: 350, height: 190, type: 'control' }
};

export const WAYPOINTS = {
  'W_A101': { id: 'W_A101', x: 285, y: 140, room: 'Cell A-101' },
  'W_A102': { id: 'W_A102', x: 340, y: 140, room: 'Cell A-102' },
  'W_A103': { id: 'W_A103', x: 395, y: 140, room: 'Cell A-103' },
  'W_A104': { id: 'W_A104', x: 450, y: 140, room: 'Cell A-104' },
  'W_B101': { id: 'W_B101', x: 715, y: 140, room: 'Cell B-101' },
  'W_B102': { id: 'W_B102', x: 770, y: 140, room: 'Cell B-102' },
  'W_C101': { id: 'W_C101', x: 1145, y: 140, room: 'Cell C-101' },
  'W_MED_1': { id: 'W_MED_1', x: 380, y: 450, room: 'Medical Ward - Triage' },
  'W_YARD_1': { id: 'W_YARD_1', x: 740, y: 480, room: 'Common Exercise Yard' },
  'W_CONTROL_1': { id: 'W_CONTROL_1', x: 1140, y: 720, room: 'Control Room - SOC' }
};
