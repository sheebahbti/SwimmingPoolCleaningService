import { Request, Response } from 'express';
import prisma from '../lib/prisma';

const scheduleInclude = {
  customer: { select: { id: true, name: true, email: true } },
  technician: { select: { id: true, name: true, email: true } },
  pool: { select: { id: true, address: true, size: true, type: true } },
};

// GET /api/schedules — Admin: all schedules
export async function listSchedules(req: Request, res: Response) {
  try {
    const { status } = req.query;
    const where = status ? { status: status as 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' } : {};

    const schedules = await prisma.schedule.findMany({
      where,
      include: scheduleInclude,
      orderBy: { date: 'asc' },
    });

    res.json(schedules);
  } catch {
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
}

// GET /api/schedules/mine — Customer: my schedules
export async function getMySchedules(req: Request, res: Response) {
  try {
    const schedules = await prisma.schedule.findMany({
      where: { customerId: req.user!.userId },
      include: scheduleInclude,
      orderBy: { date: 'asc' },
    });

    res.json(schedules);
  } catch {
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
}

// GET /api/schedules/assigned — Technician: my assigned schedules
export async function getAssignedSchedules(req: Request, res: Response) {
  try {
    const schedules = await prisma.schedule.findMany({
      where: { technicianId: req.user!.userId },
      include: scheduleInclude,
      orderBy: { date: 'asc' },
    });

    res.json(schedules);
  } catch {
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
}

// GET /api/technicians — List available technicians (for booking)
export async function listTechnicians(_req: Request, res: Response) {
  try {
    const technicians = await prisma.user.findMany({
      where: { role: 'TECHNICIAN' },
      select: { id: true, name: true, email: true, phone: true },
      orderBy: { name: 'asc' },
    });

    res.json(technicians);
  } catch {
    res.status(500).json({ error: 'Failed to fetch technicians' });
  }
}

// POST /api/schedules — Customer: book an appointment
export async function createSchedule(req: Request, res: Response) {
  try {
    const { technicianId, poolId, date, notes } = req.body || {};

    if (!technicianId || !poolId || !date) {
      res.status(400).json({ error: 'technicianId, poolId, and date are required' });
      return;
    }

    const appointmentDate = new Date(date);
    if (isNaN(appointmentDate.getTime())) {
      res.status(400).json({ error: 'Invalid date format' });
      return;
    }

    if (appointmentDate <= new Date()) {
      res.status(400).json({ error: 'Appointment date must be in the future' });
      return;
    }

    // Verify the pool belongs to this customer
    const pool = await prisma.pool.findUnique({ where: { id: poolId } });
    if (!pool || pool.customerId !== req.user!.userId) {
      res.status(400).json({ error: 'Invalid pool' });
      return;
    }

    // Verify technician exists
    const technician = await prisma.user.findUnique({ where: { id: technicianId } });
    if (!technician || technician.role !== 'TECHNICIAN') {
      res.status(400).json({ error: 'Invalid technician' });
      return;
    }

    // Conflict detection: check if technician has another appointment within 2 hours
    const twoHoursBefore = new Date(appointmentDate.getTime() - 2 * 60 * 60 * 1000);
    const twoHoursAfter = new Date(appointmentDate.getTime() + 2 * 60 * 60 * 1000);

    const conflict = await prisma.schedule.findFirst({
      where: {
        technicianId,
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
        date: { gte: twoHoursBefore, lte: twoHoursAfter },
      },
    });

    if (conflict) {
      res.status(409).json({ error: 'Technician has a conflicting appointment at that time' });
      return;
    }

    const schedule = await prisma.schedule.create({
      data: {
        customerId: req.user!.userId,
        technicianId,
        poolId,
        date: appointmentDate,
        notes: notes || null,
      },
      include: scheduleInclude,
    });

    res.status(201).json(schedule);
  } catch {
    res.status(500).json({ error: 'Failed to create schedule' });
  }
}

// PATCH /api/schedules/:id/status — Update schedule status
export async function updateScheduleStatus(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id as string);
    const { status } = req.body || {};

    if (!status) {
      res.status(400).json({ error: 'status is required' });
      return;
    }

    const validStatuses = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
      return;
    }

    const schedule = await prisma.schedule.findUnique({ where: { id } });
    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    // Access control: admin can change any, technician can change their assigned, customer can cancel their own
    const { userId, role } = req.user!;
    if (role === 'CUSTOMER') {
      if (schedule.customerId !== userId || status !== 'CANCELLED') {
        res.status(403).json({ error: 'Customers can only cancel their own appointments' });
        return;
      }
    } else if (role === 'TECHNICIAN') {
      if (schedule.technicianId !== userId) {
        res.status(403).json({ error: 'You can only update your assigned appointments' });
        return;
      }
    }

    // Validate status transitions
    const transitions: Record<string, string[]> = {
      SCHEDULED: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
    };

    if (!transitions[schedule.status].includes(status)) {
      res.status(400).json({ error: `Cannot transition from ${schedule.status} to ${status}` });
      return;
    }

    const updated = await prisma.schedule.update({
      where: { id },
      data: { status },
      include: scheduleInclude,
    });

    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Failed to update schedule' });
  }
}

// DELETE /api/schedules/:id — Admin: delete a schedule
export async function deleteSchedule(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id as string);

    const schedule = await prisma.schedule.findUnique({ where: { id } });
    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    await prisma.schedule.delete({ where: { id } });
    res.json({ message: 'Schedule deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
}
