import { Request, Response } from 'express';
import prisma from '../lib/prisma';

// POST /api/maintenance — Log work done after an appointment
export async function createMaintenanceRecord(req: Request, res: Response): Promise<void> {
  try {
    const { scheduleId, workDone, chemicalsUsed, photoBeforeUrl, photoAfterUrl } = req.body;

    if (!scheduleId || !workDone) {
      res.status(400).json({ error: 'scheduleId and workDone are required' });
      return;
    }

    const record = await prisma.maintenanceRecord.create({
      data: {
        scheduleId,
        workDone,
        chemicalsUsed: chemicalsUsed || null,
        photoBeforeUrl: photoBeforeUrl || null,
        photoAfterUrl: photoAfterUrl || null,
        completedAt: new Date(),
      },
    });

    // Mark the schedule as COMPLETED
    await prisma.schedule.update({
      where: { id: scheduleId },
      data: { status: 'COMPLETED' },
    });

    res.status(201).json(record);
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Maintenance record already exists for this schedule' });
      return;
    }
    res.status(500).json({ error: 'Failed to create maintenance record' });
  }
}

// GET /api/maintenance?scheduleId=1 — Get record for a schedule
export async function getMaintenanceRecord(req: Request, res: Response): Promise<void> {
  try {
    const scheduleId = Number(req.query.scheduleId);

    if (!scheduleId) {
      res.status(400).json({ error: 'scheduleId query parameter is required' });
      return;
    }

    const record = await prisma.maintenanceRecord.findUnique({
      where: { scheduleId },
    });

    if (!record) {
      res.status(404).json({ error: 'Maintenance record not found' });
      return;
    }

    res.json(record);
  } catch {
    res.status(500).json({ error: 'Failed to fetch maintenance record' });
  }
}
