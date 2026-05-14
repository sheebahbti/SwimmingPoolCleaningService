import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';

// Mock Prisma before importing the controller
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
import { register, login } from '../../controllers/auth.controller';
import { createMockUser } from '../helpers';

describe('Auth Controller', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: ReturnType<typeof jest.fn>;
  let statusMock: ReturnType<typeof jest.fn>;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockRes = {
      status: statusMock,
      json: jsonMock,
    };
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should return 400 when required fields are missing', async () => {
      mockReq = { body: { email: 'test@test.com' } };

      await register(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'email, name, phone, and password are required',
      });
    });

    it('should return 400 when password is too short', async () => {
      mockReq = {
        body: {
          email: 'test@test.com',
          name: 'Test User',
          phone: '555-1234',
          password: '123',
        },
      };

      await register(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Password must be at least 6 characters',
      });
    });

    it('should return 409 when email already exists', async () => {
      mockReq = {
        body: {
          email: 'existing@test.com',
          name: 'Test User',
          phone: '555-1234',
          password: 'password123',
        },
      };

      (prisma.user.findUnique as ReturnType<typeof jest.fn>).mockResolvedValue(
        createMockUser({ email: 'existing@test.com' })
      );

      await register(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Email already registered',
      });
    });

    it('should create user with CUSTOMER role on successful registration', async () => {
      const userData = {
        email: 'new@test.com',
        name: 'New User',
        phone: '555-5678',
        password: 'password123',
      };
      mockReq = { body: userData };

      const createdUser = createMockUser({
        ...userData,
        role: 'CUSTOMER',
        password: 'hashed-password',
      });

      (prisma.user.findUnique as ReturnType<typeof jest.fn>).mockResolvedValue(null);
      (prisma.user.create as ReturnType<typeof jest.fn>).mockResolvedValue(createdUser);

      await register(mockReq as Request, mockRes as Response);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: userData.email,
          name: userData.name,
          phone: userData.phone,
          role: 'CUSTOMER',
        }),
      });
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it('should not return password in response', async () => {
      mockReq = {
        body: {
          email: 'new@test.com',
          name: 'New User',
          phone: '555-5678',
          password: 'password123',
        },
      };

      const createdUser = createMockUser({ password: 'hashed-password' });
      (prisma.user.findUnique as ReturnType<typeof jest.fn>).mockResolvedValue(null);
      (prisma.user.create as ReturnType<typeof jest.fn>).mockResolvedValue(createdUser);

      await register(mockReq as Request, mockRes as Response);

      const responseArg = jsonMock.mock.calls[0][0];
      expect(responseArg).not.toHaveProperty('password');
    });
  });

  describe('login', () => {
    it('should return 400 when email or password is missing', async () => {
      mockReq = { body: { email: 'test@test.com' } };

      await login(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'email and password are required',
      });
    });

    it('should return 401 when user is not found', async () => {
      mockReq = {
        body: { email: 'notfound@test.com', password: 'password123' },
      };

      (prisma.user.findUnique as ReturnType<typeof jest.fn>).mockResolvedValue(null);

      await login(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Invalid email or password',
      });
    });

    it('should return 401 when password is incorrect', async () => {
      mockReq = {
        body: { email: 'test@test.com', password: 'wrongpassword' },
      };

      const hashedPassword = await bcrypt.hash('correctpassword', 10);
      (prisma.user.findUnique as ReturnType<typeof jest.fn>).mockResolvedValue(
        createMockUser({ password: hashedPassword })
      );

      await login(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Invalid email or password',
      });
    });

    it('should return token and user on successful login', async () => {
      const password = 'password123';
      mockReq = {
        body: { email: 'test@test.com', password },
      };

      const hashedPassword = await bcrypt.hash(password, 10);
      const mockUser = createMockUser({
        id: 1,
        email: 'test@test.com',
        role: 'CUSTOMER',
        password: hashedPassword,
      });

      (prisma.user.findUnique as ReturnType<typeof jest.fn>).mockResolvedValue(mockUser);

      await login(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          token: expect.any(String),
          user: expect.objectContaining({
            email: 'test@test.com',
          }),
        })
      );

      // Verify the token is valid
      const responseArg = jsonMock.mock.calls[0][0];
      const decoded = jwt.verify(
        responseArg.token,
        process.env.JWT_SECRET!
      ) as { userId: number; role: string };
      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.role).toBe(mockUser.role);
    });

    it('should not return password in user response', async () => {
      const password = 'password123';
      mockReq = {
        body: { email: 'test@test.com', password },
      };

      const hashedPassword = await bcrypt.hash(password, 10);
      (prisma.user.findUnique as ReturnType<typeof jest.fn>).mockResolvedValue(
        createMockUser({ password: hashedPassword })
      );

      await login(mockReq as Request, mockRes as Response);

      const responseArg = jsonMock.mock.calls[0][0];
      expect(responseArg.user).not.toHaveProperty('password');
    });
  });
});
