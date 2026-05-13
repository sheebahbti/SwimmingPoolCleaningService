import nodemailer from 'nodemailer';

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
      <p>Hi ${customerName},</p>
      <p>Your pool cleaning appointment has been scheduled.</p>
      
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>📅 Date:</strong> ${formattedDate}</p>
        <p><strong>👷 Technician:</strong> ${technicianName}</p>
        <p><strong>📍 Pool Address:</strong> ${poolAddress}</p>
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
