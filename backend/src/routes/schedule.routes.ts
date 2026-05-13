import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  listSchedules,
  getMySchedules,
  getAssignedSchedules,
  getScheduleById,
  listTechnicians,
  createSchedule,
  updateScheduleStatus,
  deleteSchedule,
} from '../controllers/schedule.controller';

const router = Router();

// All schedule routes require authentication
router.use(authenticate);

// GET /api/technicians — Any authenticated user can see technicians (for booking)
router.get('/technicians', listTechnicians);

// GET /api/schedules/mine — Customer: my bookings
router.get('/schedules/mine', getMySchedules);

// GET /api/schedules/assigned — Technician: my assigned jobs
router.get('/schedules/assigned', getAssignedSchedules);

// GET /api/schedules — Admin: all schedules
router.get('/schedules', authorize('ADMIN'), listSchedules);

// GET /api/schedules/:id — Single schedule
router.get('/schedules/:id', getScheduleById);

// POST /api/schedules — Customer: book appointment
router.post('/schedules', authorize('CUSTOMER'), createSchedule);

// PATCH /api/schedules/:id/status — Update status (role checked in controller)
router.patch('/schedules/:id/status', updateScheduleStatus);

// DELETE /api/schedules/:id — Admin only
router.delete('/schedules/:id', authorize('ADMIN'), deleteSchedule);

export default router;
