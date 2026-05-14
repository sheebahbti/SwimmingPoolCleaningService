import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Request, Response } from 'express';

// Mock Prisma before importing the controller
jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    invoice: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Mock Stripe
jest.mock('../../lib/stripe', () => ({
  createPaymentIntent: jest.fn(),
  verifyPayment: jest.fn(),
}));

// Mock PDF
jest.mock('../../lib/pdf', () => ({
  generateInvoicePDF: jest.fn(),
}));

import prisma from '../../lib/prisma';
import { createPaymentIntent } from '../../lib/stripe';
import { listInvoices, getInvoice, payInvoice } from '../../controllers/invoice.controller';

describe('Invoice Controller', () => {
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

  describe('listInvoices', () => {
    it('should return all invoices for ADMIN', async () => {
      mockReq = {
        query: {},
        user: { userId: 1, role: 'ADMIN' },
      };

      const mockInvoices = [
        { id: 1, amount: 100, status: 'PENDING' },
        { id: 2, amount: 200, status: 'PAID' },
      ];

      (prisma.invoice.findMany as ReturnType<typeof jest.fn>).mockResolvedValue(mockInvoices);

      await listInvoices(mockReq as Request, mockRes as Response);

      expect(prisma.invoice.findMany).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith(mockInvoices);
    });

    it('should filter by status when provided', async () => {
      mockReq = {
        query: { status: 'PENDING' },
        user: { userId: 1, role: 'ADMIN' },
      };

      (prisma.invoice.findMany as ReturnType<typeof jest.fn>).mockResolvedValue([]);

      await listInvoices(mockReq as Request, mockRes as Response);

      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PENDING' }),
        })
      );
    });

    it('should scope to customer invoices for CUSTOMER role', async () => {
      const customerId = 5;
      mockReq = {
        query: {},
        user: { userId: customerId, role: 'CUSTOMER' },
      };

      (prisma.invoice.findMany as ReturnType<typeof jest.fn>).mockResolvedValue([]);

      await listInvoices(mockReq as Request, mockRes as Response);

      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            schedule: { customerId },
          }),
        })
      );
    });
  });

  describe('getInvoice', () => {
    it('should return 404 when invoice not found', async () => {
      mockReq = {
        params: { id: '999' },
        user: { userId: 1, role: 'ADMIN' },
      };

      (prisma.invoice.findUnique as ReturnType<typeof jest.fn>).mockResolvedValue(null);

      await getInvoice(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Invoice not found' });
    });

    it('should return 403 when customer tries to access another users invoice', async () => {
      mockReq = {
        params: { id: '1' },
        user: { userId: 5, role: 'CUSTOMER' },
      };

      const otherUserInvoice = {
        id: 1,
        amount: 150,
        schedule: { customer: { id: 10 } }, // Different customer
      };
      (prisma.invoice.findUnique as ReturnType<typeof jest.fn>).mockResolvedValue(otherUserInvoice);

      await getInvoice(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Access denied' });
    });

    it('should return invoice for admin regardless of owner', async () => {
      mockReq = {
        params: { id: '1' },
        user: { userId: 1, role: 'ADMIN' },
      };

      const invoice = {
        id: 1,
        amount: 150,
        schedule: { customer: { id: 99 } },
      };
      (prisma.invoice.findUnique as ReturnType<typeof jest.fn>).mockResolvedValue(invoice);

      await getInvoice(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith(invoice);
    });
  });

  describe('payInvoice', () => {
    it('should return 404 when invoice not found', async () => {
      mockReq = {
        params: { id: '999' },
        user: { userId: 1, role: 'CUSTOMER' },
      };

      (prisma.invoice.findUnique as ReturnType<typeof jest.fn>).mockResolvedValue(null);

      await payInvoice(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it('should return 400 when invoice is already paid', async () => {
      mockReq = {
        params: { id: '1' },
        user: { userId: 1, role: 'CUSTOMER' },
      };

      const paidInvoice = {
        id: 1,
        status: 'PAID',
        schedule: { customer: { id: 1 } },
      };
      (prisma.invoice.findUnique as ReturnType<typeof jest.fn>).mockResolvedValue(paidInvoice);

      await payInvoice(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Invoice is already paid' });
    });

    it('should create Stripe payment intent for valid invoice', async () => {
      mockReq = {
        params: { id: '1' },
        user: { userId: 1, role: 'CUSTOMER' },
      };

      const pendingInvoice = {
        id: 1,
        status: 'PENDING',
        amount: 150,
        schedule: { customer: { id: 1, email: 'test@test.com' } },
      };
      (prisma.invoice.findUnique as ReturnType<typeof jest.fn>).mockResolvedValue(pendingInvoice);
      (createPaymentIntent as ReturnType<typeof jest.fn>).mockResolvedValue({
        clientSecret: 'pi_test123_secret',
        paymentIntentId: 'pi_test123',
      });
      (prisma.invoice.update as ReturnType<typeof jest.fn>).mockResolvedValue({
        ...pendingInvoice,
        stripePaymentIntentId: 'pi_test123',
      });

      await payInvoice(mockReq as Request, mockRes as Response);

      expect(createPaymentIntent).toHaveBeenCalledWith(150, 1, 'test@test.com');
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          clientSecret: 'pi_test123_secret',
        })
      );
    });
  });
});
