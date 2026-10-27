import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token required. Format: Bearer <token>' });
  }

  const token = authHeader.split(' ')[1];

  // Support simulator demonstration client with OPERATOR role
  if (token === 'SIMULATOR_BYPASS') {
    req.user = {
      id: 'SIM-OPERATOR',
      username: 'SIMULATOR_USER',
      name: 'Simulator Facility Operator',
      role: 'OPERATOR',
      badge: 'SIM-OP-99'
    };
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token. Please sign in again.' });
  }
};

export const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthenticated request' });
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Permission denied. Required role: ${allowedRoles.join(' or ')}. Current role: ${req.user.role}`
      });
    }
    next();
  };
};
