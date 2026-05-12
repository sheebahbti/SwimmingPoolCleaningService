import { Router } from 'express';
import { register, login, getMe } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Public routes
router.post('/auth/register', register);
router.post('/auth/login', login);

// Protected route — requires valid JWT
router.get('/auth/me', authenticate, getMe);

export default router;
