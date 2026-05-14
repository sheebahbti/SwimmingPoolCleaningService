import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { createPaymentIntent, verifyPayment } from '../lib/stripe';
import { generateInvoicePDF } from '../lib/pdf';

const invoiceInclude = {
  schedule: {
    include: {
      customer: { select: { id: true, name: true, email: true } },
      technician: { select: { id: true, name: true } },
      pool: { select: { address: true } },
    },
  },
};

// GET /api/invoices — Admin: all invoices, Customer: my invoices
export async function listInvoices(req: Request, res: Response): Promise<void> {
  try {
    const { status } = req.query;
    const where: Record<string, unknown> = {};

    if (status) where.status = status;

    // Customers only see their own invoices
    if (req.user!.role === 'CUSTOMER') {
      where.schedule = { customerId: req.user!.userId };
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: invoiceInclude,
      orderBy: { id: 'desc' },
    });

    res.json(invoices);
  } catch {
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
}

// GET /api/invoices/:id — Single invoice (scoped by role)
export async function getInvoice(req: Request, res: Response): Promise<void> {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: Number(req.params.id) },
      include: invoiceInclude,
    });

    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    // Customers can only view their own invoices
    if (req.user!.role === 'CUSTOMER' && invoice.schedule.customer.id !== req.user!.userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json(invoice);
  } catch {
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
}

// POST /api/invoices — Admin: manually create invoice for a schedule
export async function createInvoice(req: Request, res: Response): Promise<void> {
  try {
    const { scheduleId, amount } = req.body;

    if (!scheduleId || !amount) {
      res.status(400).json({ error: 'scheduleId and amount are required' });
      return;
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14); // Due in 14 days

    const invoice = await prisma.invoice.create({
      data: {
        scheduleId,
        amount,
        dueDate,
      },
      include: invoiceInclude,
    });

    res.status(201).json(invoice);
  } catch (error: unknown) {
    if (error instanceof Object && 'code' in error && error.code === 'P2002') {
      res.status(409).json({ error: 'Invoice already exists for this schedule' });
      return;
    }
    res.status(500).json({ error: 'Failed to create invoice' });
  }
}

// POST /api/invoices/:id/pay — Customer: initiate Stripe payment
export async function payInvoice(req: Request, res: Response): Promise<void> {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: Number(req.params.id) },
      include: invoiceInclude,
    });

    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    if (invoice.status === 'PAID') {
      res.status(400).json({ error: 'Invoice is already paid' });
      return;
    }

    const result = await createPaymentIntent(
      Number(invoice.amount),
      invoice.id,
      invoice.schedule.customer.email
    );

    if (!result) {
      res.status(503).json({ error: 'Payment service not configured' });
      return;
    }

    // Save payment intent ID
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { stripePaymentIntentId: result.paymentIntentId },
    });

    res.json({ clientSecret: result.clientSecret });
  } catch {
    res.status(500).json({ error: 'Failed to initiate payment' });
  }
}

// POST /api/invoices/:id/confirm — Confirm payment after Stripe checkout
export async function confirmPayment(req: Request, res: Response): Promise<void> {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: Number(req.params.id) },
    });

    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    if (!invoice.stripePaymentIntentId) {
      res.status(400).json({ error: 'No payment initiated for this invoice' });
      return;
    }

    const paid = await verifyPayment(invoice.stripePaymentIntentId);

    if (!paid) {
      res.status(400).json({ error: 'Payment not completed' });
      return;
    }

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: 'PAID', paidAt: new Date() },
      include: invoiceInclude,
    });

    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
}

// PATCH /api/invoices/:id/status — Admin: manually update status
export async function updateInvoiceStatus(req: Request, res: Response): Promise<void> {
  try {
    const { status } = req.body;
    const validStatuses = ['PENDING', 'PAID', 'OVERDUE'];

    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
      return;
    }

    const invoice = await prisma.invoice.update({
      where: { id: Number(req.params.id) },
      data: {
        status,
        paidAt: status === 'PAID' ? new Date() : undefined,
      },
      include: invoiceInclude,
    });

    res.json(invoice);
  } catch {
    res.status(500).json({ error: 'Failed to update invoice status' });
  }
}

// GET /api/invoices/:id/pdf — Download invoice as PDF
export async function downloadInvoicePDF(req: Request, res: Response): Promise<void> {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: Number(req.params.id) },
      include: invoiceInclude,
    });

    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    const pdf = await generateInvoicePDF({
      invoiceId: invoice.id,
      date: new Date().toLocaleDateString('en-US'),
      dueDate: invoice.dueDate.toLocaleDateString('en-US'),
      customerName: invoice.schedule.customer.name,
      customerEmail: invoice.schedule.customer.email,
      poolAddress: invoice.schedule.pool.address,
      technicianName: invoice.schedule.technician.name,
      serviceDate: invoice.schedule.date.toLocaleDateString('en-US'),
      amount: Number(invoice.amount),
      status: invoice.status,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.id}.pdf`);
    res.send(pdf);
  } catch {
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
}
