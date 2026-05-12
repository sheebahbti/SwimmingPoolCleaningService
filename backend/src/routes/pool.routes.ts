import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { getMyPools, listPools, createPool, updatePool, deletePool } from '../controllers/pool.controller';

const router = Router();

// All pool routes require authentication
router.use(authenticate);

// GET /api/pools/mine — Customer: my pools (must be before /api/pools/:id)
router.get('/pools/mine', getMyPools);

// GET /api/pools — Admin: all pools
router.get('/pools', authorize('ADMIN'), listPools);

// POST /api/pools — Customer: add a pool
router.post('/pools', authorize('CUSTOMER'), createPool);

// PATCH /api/pools/:id — Owner or Admin (checked in controller)
router.patch('/pools/:id', updatePool);

// DELETE /api/pools/:id — Owner or Admin (checked in controller)
router.delete('/pools/:id', deletePool);

export default router;
