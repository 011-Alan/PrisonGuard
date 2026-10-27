import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { auditLogger } from '../utils/audit.js';
import { config } from '../config.js';

// In-memory rate limiting map for login endpoint: ip -> { count, firstAttempt, lockedUntil }
const loginAttemptMap = new Map();
const MAX_FAILED_ATTEMPTS = 8;
const WINDOW_MS = 60 * 1000;
const LOCKOUT_MS = 60 * 1000;

// Seeded demonstration accounts
const USERS = [
  {
    id: 'USR-001',
    username: 'admin',
    name: 'S. Patel',
    role: 'ADMIN',
    passwordHash: bcrypt.hashSync('admin123', 10),
    title: 'Senior Security Administrator',
    badge: 'SEC-ADMIN-01'
  },
  {
    id: 'USR-002',
    username: 'supervisor',
    name: 'M. Sterling',
    role: 'SUPERVISOR',
    passwordHash: bcrypt.hashSync('super123', 10),
    title: 'Operations Supervisor',
    badge: 'SEC-SUPV-02'
  },
  {
    id: 'USR-003',
    username: 'operator',
    name: 'A. Cole',
    role: 'OPERATOR',
    passwordHash: bcrypt.hashSync('op123', 10),
    title: 'Control Room Operator',
    badge: 'SEC-OP-03'
  }
];

export const login = (req, res) => {
  const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
  const now = Date.now();

  // Check rate limit
  const record = loginAttemptMap.get(ip);
  if (record) {
    if (record.lockedUntil && now < record.lockedUntil) {
      const waitSec = Math.ceil((record.lockedUntil - now) / 1000);
      return res.status(429).json({
        error: `Too many failed authentication attempts. Please wait ${waitSec} seconds.`
      });
    }
    if (now - record.firstAttempt > WINDOW_MS) {
      loginAttemptMap.delete(ip);
    }
  }

  const { username, password } = req.body || {};

  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Valid username and password strings are required' });
  }

  const user = USERS.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
  if (!user) {
    recordFailedAttempt(ip, now);
    auditLogger.log({
      type: 'AUTH_FAILED',
      user: { username, role: 'UNKNOWN' },
      action: 'Failed login attempt - User not found',
      details: { ip }
    });
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const isMatch = bcrypt.compareSync(password, user.passwordHash);
  if (!isMatch) {
    recordFailedAttempt(ip, now);
    auditLogger.log({
      type: 'AUTH_FAILED',
      user: { username: user.username, role: user.role },
      action: 'Failed login attempt - Invalid credentials',
      details: { ip }
    });
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  // Clear failed attempt record on successful login
  loginAttemptMap.delete(ip);

  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      badge: user.badge
    },
    config.jwtSecret,
    { expiresIn: '8h' }
  );

  auditLogger.log({
    type: 'AUTH_LOGIN',
    user: { username: user.username, role: user.role },
    action: `User ${user.name} logged in successfully`,
    details: { role: user.role, badge: user.badge }
  });

  return res.json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      title: user.title,
      badge: user.badge
    }
  });
};

function recordFailedAttempt(ip, now) {
  let record = loginAttemptMap.get(ip);
  if (!record || now - record.firstAttempt > WINDOW_MS) {
    record = { count: 1, firstAttempt: now, lockedUntil: null };
  } else {
    record.count += 1;
    if (record.count >= MAX_FAILED_ATTEMPTS) {
      record.lockedUntil = now + LOCKOUT_MS;
    }
  }
  loginAttemptMap.set(ip, record);
}

export const getMe = (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  return res.json({ user: req.user });
};

export const logout = (req, res) => {
  if (req.user) {
    auditLogger.log({
      type: 'AUTH_LOGOUT',
      user: { username: req.user.username, role: req.user.role },
      action: `User ${req.user.name} logged out`,
      details: {}
    });
  }
  return res.json({ message: 'Logged out successfully' });
};
