import nodemailer from 'nodemailer';

// Escape HTML special characters to prevent XSS in email templates
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send an email using nodemailer
 * Fails silently with console.error — don't let email failures break bookings
 */
export async function sendEmail({ to, subject, html }: EmailOptions): Promise<boolean> {
  // Skip if SMTP not configured
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('Email skipped: SMTP credentials not configured');
    return false;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'Pool Cleaning Service <noreply@poolservice.com>',
      to,
      subject,
      html,
    });
    console.log(`Email sent to ${to}: ${subject}`);
    return true;
  } catch (err) {
    console.error('Failed to send email:', err);
    return false;
  }
}

/**
 * Send appointment confirmation email to customer
 */
export async function sendAppointmentConfirmation(
  customerEmail: string,
  customerName: string,
  technicianName: string,
  appointmentDate: Date,
  poolAddress: string
): Promise<boolean> {
  const formattedDate = appointmentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #0066cc;">Appointment Confirmed!</h1>
      <p>Hi ${escapeHtml(customerName)},</p>
      <p>Your pool cleaning appointment has been scheduled.</p>
      
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>📅 Date:</strong> ${formattedDate}</p>
        <p><strong>👷 Technician:</strong> ${escapeHtml(technicianName)}</p>
        <p><strong>📍 Pool Address:</strong> ${escapeHtml(poolAddress)}</p>
      </div>
      
      <p>Please ensure someone is available to provide access to the pool area.</p>
      <p>If you need to reschedule, please contact us at least 24 hours in advance.</p>
      
      <p style="color: #666; margin-top: 30px;">
        Thank you for choosing Pool Cleaning Service!
      </p>
    </div>
  `;

  return sendEmail({
    to: customerEmail,
    subject: `Pool Cleaning Appointment Confirmed - ${formattedDate}`,
    html,
  });
}

/**
 * Send 24-hour appointment reminder to customer
 */
export async function sendAppointmentReminder(
  customerEmail: string,
  customerName: string,
  technicianName: string,
  appointmentDate: Date,
  poolAddress: string
): Promise<boolean> {
  const formattedDate = appointmentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #f59e0b;">⏰ Appointment Tomorrow!</h1>
      <p>Hi ${escapeHtml(customerName)},</p>
      <p>This is a friendly reminder that your pool cleaning appointment is <strong>tomorrow</strong>.</p>

      <div style="background: #fffbeb; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
        <p><strong>📅 Date:</strong> ${formattedDate}</p>
        <p><strong>👷 Technician:</strong> ${escapeHtml(technicianName)}</p>
        <p><strong>📍 Pool Address:</strong> ${escapeHtml(poolAddress)}</p>
      </div>

      <p>Please ensure someone is available to provide access to the pool area.</p>

      <p style="color: #666; margin-top: 30px;">
        Thank you for choosing Pool Cleaning Service!
      </p>
    </div>
  `;

  return sendEmail({
    to: customerEmail,
    subject: `Reminder: Pool Cleaning Tomorrow - ${formattedDate}`,
    html,
  });
}

/**
 * Send daily schedule summary to technician
 */
export async function sendDailyScheduleSummary(
  techEmail: string,
  techName: string,
  date: string,
  jobs: { time: string; address: string; customerName: string }[]
): Promise<boolean> {
  const jobRows = jobs.map(
    (j) => `<tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${j.time}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${escapeHtml(j.address)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${escapeHtml(j.customerName)}</td>
    </tr>`
  ).join('');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #0066cc;">📋 Your Schedule for ${escapeHtml(date)}</h1>
      <p>Hi ${escapeHtml(techName)},</p>
      <p>You have <strong>${jobs.length} appointment${jobs.length !== 1 ? 's' : ''}</strong> today.</p>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background: #f0f4f8;">
            <th style="padding: 8px; text-align: left;">Time</th>
            <th style="padding: 8px; text-align: left;">Pool Address</th>
            <th style="padding: 8px; text-align: left;">Customer</th>
          </tr>
        </thead>
        <tbody>${jobRows}</tbody>
      </table>

      <p style="color: #666; margin-top: 30px;">Have a great day!</p>
    </div>
  `;

  return sendEmail({
    to: techEmail,
    subject: `Your Schedule for ${date} — ${jobs.length} job${jobs.length !== 1 ? 's' : ''}`,
    html,
  });
}

/**
 * Send re-engagement email to inactive customer
 */
export async function sendReEngagementEmail(
  customerEmail: string,
  customerName: string,
  daysSinceLastService: number
): Promise<boolean> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #0066cc;">🏊 We Miss You!</h1>
      <p>Hi ${escapeHtml(customerName)},</p>
      <p>It's been <strong>${daysSinceLastService} days</strong> since your last pool cleaning. 
         Regular maintenance keeps your pool safe and sparkling!</p>

      <div style="background: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
        <p style="font-size: 18px; margin: 0;">Ready to schedule your next cleaning?</p>
        <p style="margin-top: 10px;">
          <a href="#" style="background: #0066cc; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            Book Now
          </a>
        </p>
      </div>

      <p style="color: #666; margin-top: 30px;">
        Thank you for choosing Pool Cleaning Service!
      </p>
    </div>
  `;

  return sendEmail({
    to: customerEmail,
    subject: `Your pool misses you, ${customerName}! 🏊`,
    html,
  });
}
