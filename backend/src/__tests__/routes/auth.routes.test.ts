import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';

// Mock Prisma
jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import prisma from '../../lib/prisma';
import { createTestApp } from '../testApp';
import { createMockUser } from '../helpers';

const app = createTestApp();

describe('Auth Routes Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const newUser = {
        email: 'newuser@test.com',
        name: 'New User',
        phone: '555-1234',
        password: 'password123',
      };

      (prisma.user.findUnique as ReturnType<typeof jest.fn>).mockResolvedValue(null);
      (prisma.user.create as ReturnType<typeof jest.fn>).mockResolvedValue(
        createMockUser({ ...newUser, id: 1, role: 'CUSTOMER' })
      );

      const response = await request(app)
        .post('/api/auth/register')
        .send(newUser);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('email', newUser.email);
      expect(response.body).toHaveProperty('role', 'CUSTOMER');
      expect(response.body).not.toHaveProperty('password');
    });

    it('should return 400 for missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@test.com' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 409 for duplicate email', async () => {
      (prisma.user.findUnique as ReturnType<typeof jest.fn>).mockResolvedValue(
        createMockUser({ email: 'existing@test.com' })
      );

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'existing@test.com',
          name: 'Test',
          phone: '555-1234',
          password: 'password123',
        });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error', 'Email already registered');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const password = 'password123';
      const hashedPassword = await bcrypt.hash(password, 10);
      const mockUser = createMockUser({
        id: 1,
        email: 'user@test.com',
        password: hashedPassword,
        role: 'CUSTOMER',
      });

      (prisma.user.findUnique as ReturnType<typeof jest.fn>).mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@test.com', password });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', 'user@test.com');
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should return 401 for invalid credentials', async () => {
      (prisma.user.findUnique as ReturnType<typeof jest.fn>).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'wrong@test.com', password: 'wrongpassword' });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid email or password');
    });

    it('should return 400 for missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com' });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
    });
  });
});
