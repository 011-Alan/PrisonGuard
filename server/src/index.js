import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import { createApiRouter } from './routes/api.js';
import { SimulationEngine } from './simulation/engine.js';
import { mqttSimulator } from './communication/mqttSimulator.js';

// Validate environment
const { warnings, errors } = config.validate();
if (errors.length > 0) {
  console.error('\n❌ CONFIGURATION ERROR(S):');
  errors.forEach(e => console.error(`  - ${e}`));
  process.exit(1);
}
if (warnings.length > 0) {
  console.warn('\n⚠️  SECURITY WARNING(S):');
  warnings.forEach(w => console.warn(`  - ${w}`));
}

const app = express();
const server = http.createServer(app);

const allowedOrigins = config.getAllowedOrigins();

// CORS configuration supporting credentials and separate domains
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser agents (cURL, mobile, server-to-server tests)
    if (!origin) return callback(null, true);

    const cleanOrigin = origin.replace(/\/$/, '');
    if (
      allowedOrigins.includes(cleanOrigin) ||
      (config.nodeEnv === 'development' && cleanOrigin.startsWith('http://localhost:')) ||
      (config.nodeEnv === 'development' && cleanOrigin.startsWith('http://127.0.0.1:'))
    ) {
      return callback(null, cleanOrigin);
    }

    return callback(new Error(`CORS policy blocked access from origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '1mb' }));

// Socket.IO server with validated origins
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.replace(/\/$/, '');
      if (
        allowedOrigins.includes(cleanOrigin) ||
        (config.nodeEnv === 'development' && cleanOrigin.startsWith('http://localhost:')) ||
        (config.nodeEnv === 'development' && cleanOrigin.startsWith('http://127.0.0.1:'))
      ) {
        return callback(null, cleanOrigin);
      }
      return callback(new Error(`Socket.IO blocked origin: ${origin}`));
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Initialize Authoritative Simulation Engine
const engine = new SimulationEngine(io);

// Forward MQTT packets to connected clients
mqttSimulator.on('message', (packet) => {
  io.emit('mqtt:packet', packet);
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', createApiRouter(engine));

// Root Health Check & Readiness probe
app.get('/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'PrisonGuard Authoritative IoT & Security Server',
    environment: config.nodeEnv,
    uptimeSeconds: Math.floor(process.uptime()),
    systemHealth: engine.state.systemHealth,
    controllersOnline: Object.values(engine.state.controllers).filter(c => c.status === 'ONLINE').length,
    activeIncidents: engine.state.incidents.filter(i => i.status === 'ACTIVE').length,
    timestamp: new Date().toISOString()
  });
});

// Socket.IO lifecycle
io.on('connection', (socket) => {
  // Authoritative snapshot on initial handshake
  socket.emit('state:full', engine.state);
  socket.emit('mqtt:packets', mqttSimulator.getRecentPackets(30));

  socket.on('disconnect', (reason) => {
    // Client disconnect handling
  });
});

const PORT = config.port;
if (!server.listening) {
  server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🛡️  PRISONGUARD AUTHORITATIVE IoT & SIMULATION ENGINE`);
    console.log(`======================================================`);
    console.log(`📡 Server running on:    http://localhost:${PORT}`);
    console.log(`🌐 Environment:          ${config.nodeEnv}`);
    console.log(`🔒 Allowed Origins:      ${allowedOrigins.join(', ')}`);
    console.log(`⚡ WebSocket Status:      ACTIVE (Socket.IO)`);
    console.log(`📁 Persistence Store:    ${config.dataStorePath}`);
    console.log(`======================================================\n`);
  });
}

export { app, server, engine };
