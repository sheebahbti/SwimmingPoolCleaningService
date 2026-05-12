import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { listUsers, getUser, updateUser, deleteUser } from '../controllers/user.controller';

const router = Router();

// All user routes require authentication
router.use(authenticate);

// GET /api/users — Admin only
router.get('/users', authorize('ADMIN'), listUsers);

// GET /api/users/:id — Admin or self (checked in controller)
router.get('/users/:id', getUser);

// PATCH /api/users/:id — Admin or self (checked in controller)
router.patch('/users/:id', updateUser);

// DELETE /api/users/:id — Admin only
router.delete('/users/:id', authorize('ADMIN'), deleteUser);

export default router;
