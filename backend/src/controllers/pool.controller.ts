import { Request, Response } from 'express';
import prisma from '../lib/prisma';

// GET /api/pools/mine — Customer: list my pools
export async function getMyPools(req: Request, res: Response) {
  try {
    const pools = await prisma.pool.findMany({
      where: { customerId: req.user!.userId },
      orderBy: { id: 'desc' },
    });
    res.json(pools);
  } catch {
    res.status(500).json({ error: 'Failed to fetch pools' });
  }
}

// GET /api/pools — Admin: list all pools
export async function listPools(req: Request, res: Response) {
  try {
    const pools = await prisma.pool.findMany({
      include: { customer: { select: { id: true, name: true, email: true } } },
      orderBy: { id: 'desc' },
    });
    res.json(pools);
  } catch {
    res.status(500).json({ error: 'Failed to fetch pools' });
  }
}

// POST /api/pools — Customer: add a pool
export async function createPool(req: Request, res: Response) {
  try {
    const { address, size, type, notes } = req.body || {};

    if (!address || !size || !type) {
      res.status(400).json({ error: 'address, size, and type are required' });
      return;
    }

    const pool = await prisma.pool.create({
      data: {
        customerId: req.user!.userId,
        address,
        size,
        type,
        notes: notes || null,
      },
    });

    res.status(201).json(pool);
  } catch {
    res.status(500).json({ error: 'Failed to create pool' });
  }
}

// PATCH /api/pools/:id — Owner or Admin
export async function updatePool(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id as string);

    const pool = await prisma.pool.findUnique({ where: { id } });
    if (!pool) {
      res.status(404).json({ error: 'Pool not found' });
      return;
    }

    // Only owner or admin can edit
    if (req.user!.role !== 'ADMIN' && pool.customerId !== req.user!.userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const { address, size, type, notes } = req.body || {};
    const data: Record<string, string | null> = {};
    if (address) data.address = address;
    if (size) data.size = size;
    if (type) data.type = type;
    if (notes !== undefined) data.notes = notes || null;

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    const updated = await prisma.pool.update({ where: { id }, data });
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Failed to update pool' });
  }
}

// DELETE /api/pools/:id — Owner or Admin
export async function deletePool(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id as string);

    const pool = await prisma.pool.findUnique({ where: { id } });
    if (!pool) {
      res.status(404).json({ error: 'Pool not found' });
      return;
    }

    if (req.user!.role !== 'ADMIN' && pool.customerId !== req.user!.userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    await prisma.pool.delete({ where: { id } });
    res.json({ message: 'Pool deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete pool' });
  }
}
