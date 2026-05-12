import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

const SALT_ROUNDS = 10;

export async function register(req: Request, res: Response): Promise<void> {
  const { email, name, phone, role, password } = req.body || {};

  // Validate required fields
  if (!email || !name || !phone || !password) {
    res.status(400).json({ error: 'email, name, phone, and password are required' });
    return;
  }

  // Validate role
  const validRoles = ['ADMIN', 'TECHNICIAN', 'CUSTOMER'] as const;
  const userRole = role || 'CUSTOMER';
  if (!validRoles.includes(userRole)) {
    res.status(400).json({ error: 'role must be ADMIN, TECHNICIAN, or CUSTOMER' });
    return;
  }

  // Check if email already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  // Hash password and create user
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { email, name, phone, role: userRole, password: hashedPassword },
  });

  // Return user without password
  const { password: _, ...userWithoutPassword } = user;
  res.status(201).json(userWithoutPassword);
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body || {};

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  // Find user by email
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  // Compare passwords
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  // Create JWT token
  const token = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: '24h' }
  );

  const { password: _, ...userWithoutPassword } = user;
  res.json({ token, user: userWithoutPassword });
}

export async function getMe(req: Request, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, email: true, name: true, phone: true, role: true, createdAt: true },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json(user);
}
