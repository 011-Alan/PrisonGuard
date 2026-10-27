import express from 'express';
import { login, getMe, logout } from '../auth/authController.js';
import { authenticate } from '../auth/authMiddleware.js';

const router = express.Router();

router.post('/login', login);
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logout);

export default router;
