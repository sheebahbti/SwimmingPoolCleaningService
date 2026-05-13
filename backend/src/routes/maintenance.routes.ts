import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { createMaintenanceRecord, getMaintenanceRecord } from '../controllers/maintenance.controller';

const router = Router();

router.use(authenticate);

// POST /api/maintenance — Technician logs work done
router.post('/maintenance', authorize('TECHNICIAN', 'ADMIN'), createMaintenanceRecord);

// GET /api/maintenance?scheduleId=1 — Get record for a schedule
router.get('/maintenance', getMaintenanceRecord);

export default router;
