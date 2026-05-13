import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  listInvoices,
  getInvoice,
  createInvoice,
  payInvoice,
  confirmPayment,
  updateInvoiceStatus,
  downloadInvoicePDF,
} from '../controllers/invoice.controller';

const router = Router();

router.use(authenticate);

// GET /api/invoices — Admin: all, Customer: mine
router.get('/invoices', listInvoices);

// GET /api/invoices/:id — Single invoice
router.get('/invoices/:id', getInvoice);

// GET /api/invoices/:id/pdf — Download PDF
router.get('/invoices/:id/pdf', downloadInvoicePDF);

// POST /api/invoices — Admin: create invoice
router.post('/invoices', authorize('ADMIN'), createInvoice);

// POST /api/invoices/:id/pay — Customer: initiate Stripe payment
router.post('/invoices/:id/pay', authorize('CUSTOMER'), payInvoice);

// POST /api/invoices/:id/confirm — Customer: confirm payment
router.post('/invoices/:id/confirm', authorize('CUSTOMER'), confirmPayment);

// PATCH /api/invoices/:id/status — Admin: manually update status
router.patch('/invoices/:id/status', authorize('ADMIN'), updateInvoiceStatus);

export default router;
