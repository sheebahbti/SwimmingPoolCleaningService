import { Request, Response } from 'express';
import prisma from '../lib/prisma';

// GET /api/users — Admin: list all users
export async function listUsers(req: Request, res: Response) {
  try {
    const { role } = req.query;
    const where = role ? { role: role as 'ADMIN' | 'TECHNICIAN' | 'CUSTOMER' } : {};

    const users = await prisma.user.findMany({
      where,
      select: { id: true, email: true, name: true, phone: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json(users);
  } catch {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}

// GET /api/users/:id — Admin or self
export async function getUser(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id as string);

    // Non-admin can only view themselves
    if (req.user!.role !== 'ADMIN' && req.user!.userId !== id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, phone: true, role: true, createdAt: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(user);
  } catch {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
}

// PATCH /api/users/:id — Admin or self (limited fields)
export async function updateUser(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id as string);
    const isAdmin = req.user!.role === 'ADMIN';
    const isSelf = req.user!.userId === id;

    if (!isAdmin && !isSelf) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const { name, phone, role } = req.body || {};
    const data: Record<string, string> = {};

    // Everyone can update their own name and phone
    if (name) data.name = name;
    if (phone) data.phone = phone;

    // Only admin can change roles
    if (role) {
      if (!isAdmin) {
        res.status(403).json({ error: 'Only admins can change roles' });
        return;
      }
      data.role = role;
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, phone: true, role: true, createdAt: true },
    });

    res.json(user);
  } catch {
    res.status(500).json({ error: 'Failed to update user' });
  }
}

// DELETE /api/users/:id — Admin only
export async function deleteUser(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id as string);

    // Prevent admin from deleting themselves
    if (req.user!.userId === id) {
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await prisma.user.delete({ where: { id } });
    res.json({ message: 'User deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete user' });
  }
}
