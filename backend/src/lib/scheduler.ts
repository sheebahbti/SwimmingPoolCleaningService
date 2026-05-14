import cron from 'node-cron';
import prisma from './prisma';
import {
  sendAppointmentReminder,
  sendDailyScheduleSummary,
  sendReEngagementEmail,
  sendEmail,
} from './email';

/**
 * Send reminder emails to customers with appointments tomorrow.
 * Runs daily at 8:00 AM.
 */
async function sendAppointmentReminders(): Promise<void> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const startOfDay = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 23, 59, 59, 999);

  const schedules = await prisma.schedule.findMany({
    where: {
      date: { gte: startOfDay, lte: endOfDay },
      status: 'SCHEDULED',
    },
    include: {
      customer: { select: { email: true, name: true } },
      technician: { select: { name: true } },
      pool: { select: { address: true } },
    },
  });

  console.log(`[Reminders] Found ${schedules.length} appointments for tomorrow`);

  for (const s of schedules) {
    await sendAppointmentReminder(
      s.customer.email,
      s.customer.name,
      s.technician.name,
      s.date,
      s.pool.address
    );
  }
}

/**
 * Send daily schedule summary to each technician with appointments today.
 * Runs daily at 6:00 AM.
 */
async function sendDailySchedules(): Promise<void> {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

  const schedules = await prisma.schedule.findMany({
    where: {
      date: { gte: startOfDay, lte: endOfDay },
      status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
    },
    include: {
      technician: { select: { id: true, email: true, name: true } },
      customer: { select: { name: true } },
      pool: { select: { address: true } },
    },
    orderBy: { date: 'asc' },
  });

  // Group by technician
  const byTech = new Map<number, {
    email: string;
    name: string;
    jobs: { time: string; address: string; customerName: string }[];
  }>();

  for (const s of schedules) {
    if (!byTech.has(s.technician.id)) {
      byTech.set(s.technician.id, {
        email: s.technician.email,
        name: s.technician.name,
        jobs: [],
      });
    }
    byTech.get(s.technician.id)!.jobs.push({
      time: s.date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      address: s.pool.address,
      customerName: s.customer.name,
    });
  }

  console.log(`[Daily Summary] Sending to ${byTech.size} technician(s)`);

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  for (const tech of byTech.values()) {
    await sendDailyScheduleSummary(tech.email, tech.name, dateStr, tech.jobs);
  }
}

/**
 * Send re-engagement emails to customers with no appointment in 30+ days.
 * Runs weekly on Mondays at 9:00 AM.
 */
async function sendReEngagementEmails(): Promise<void> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Find customers whose most recent completed schedule is older than 30 days
  const customers = await prisma.user.findMany({
    where: {
      role: 'CUSTOMER',
      schedulesAsCustomer: {
        every: {
          date: { lt: thirtyDaysAgo },
        },
        some: {}, // must have at least one schedule
      },
    },
    select: {
      email: true,
      name: true,
      schedulesAsCustomer: {
        orderBy: { date: 'desc' },
        take: 1,
        select: { date: true },
      },
    },
  });

  console.log(`[Re-engagement] Found ${customers.length} inactive customer(s)`);

  for (const c of customers) {
    const lastDate = c.schedulesAsCustomer[0]?.date;
    if (!lastDate) continue;

    const daysSince = Math.floor(
      (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    await sendReEngagementEmail(c.email, c.name, daysSince);
  }
}

/**
 * Mark overdue invoices and send reminders.
 * Runs daily at 9:00 AM.
 */
async function processOverdueInvoices(): Promise<void> {
  const now = new Date();

  // Mark PENDING invoices past due date as OVERDUE
  const { count } = await prisma.invoice.updateMany({
    where: {
      status: 'PENDING',
      dueDate: { lt: now },
    },
    data: { status: 'OVERDUE' },
  });

  if (count > 0) {
    console.log(`[Overdue] Marked ${count} invoice(s) as OVERDUE`);
  }

  // Send reminders for all OVERDUE invoices
  const overdue = await prisma.invoice.findMany({
    where: { status: 'OVERDUE' },
    include: {
      schedule: {
        include: {
          customer: { select: { email: true, name: true } },
          pool: { select: { address: true } },
        },
      },
    },
  });

  console.log(`[Overdue] Sending reminders for ${overdue.length} overdue invoice(s)`);

  for (const inv of overdue) {
    const daysOverdue = Math.floor(
      (now.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    await sendEmail({
      to: inv.schedule.customer.email,
      subject: `Overdue Invoice #INV-${String(inv.id).padStart(4, '0')} — Payment Required`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #ef4444;">⚠️ Payment Overdue</h1>
          <p>Hi ${inv.schedule.customer.name},</p>
          <p>Your invoice for pool cleaning at <strong>${inv.schedule.pool.address}</strong> is 
             <strong>${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue</strong>.</p>
          <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
            <p><strong>Invoice:</strong> #INV-${String(inv.id).padStart(4, '0')}</p>
            <p><strong>Amount:</strong> $${Number(inv.amount).toFixed(2)}</p>
            <p><strong>Due Date:</strong> ${inv.dueDate.toLocaleDateString('en-US')}</p>
          </div>
          <p>Please make your payment at your earliest convenience.</p>
          <p style="color: #666; margin-top: 30px;">Thank you,<br>Pool Cleaning Service</p>
        </div>
      `,
    });
  }
}

/**
 * Register all cron jobs. Call once at server startup.
 */
export function startCronJobs(): void {
  // Daily at 6:00 AM — technician schedule summary
  cron.schedule('0 6 * * *', () => {
    console.log('[Cron] Running daily schedule summary...');
    sendDailySchedules().catch((err) => console.error('[Cron] Daily summary failed:', err));
  });

  // Daily at 8:00 AM — 24-hour appointment reminders
  cron.schedule('0 8 * * *', () => {
    console.log('[Cron] Running appointment reminders...');
    sendAppointmentReminders().catch((err) => console.error('[Cron] Reminders failed:', err));
  });

  // Every Monday at 9:00 AM — re-engagement emails
  cron.schedule('0 9 * * 1', () => {
    console.log('[Cron] Running re-engagement emails...');
    sendReEngagementEmails().catch((err) => console.error('[Cron] Re-engagement failed:', err));
  });

  // Daily at 9:00 AM — mark overdue invoices + send reminders
  cron.schedule('0 9 * * *', () => {
    console.log('[Cron] Processing overdue invoices...');
    processOverdueInvoices().catch((err) => console.error('[Cron] Overdue invoices failed:', err));
  });

  console.log('Cron jobs scheduled: daily summary (6 AM), reminders (8 AM), overdue invoices (9 AM), re-engagement (Mon 9 AM)');
}
