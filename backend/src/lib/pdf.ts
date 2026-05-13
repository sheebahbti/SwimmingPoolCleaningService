import PDFDocument from 'pdfkit';

interface InvoiceData {
  invoiceId: number;
  date: string;
  dueDate: string;
  customerName: string;
  customerEmail: string;
  poolAddress: string;
  technicianName: string;
  serviceDate: string;
  amount: number;
  status: string;
}

/**
 * Generate an invoice PDF and return it as a Buffer.
 */
export function generateInvoicePDF(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc
      .fontSize(24)
      .fillColor('#0066cc')
      .text('Pool Cleaning Service', { align: 'center' })
      .moveDown(0.5);

    doc
      .fontSize(18)
      .fillColor('#333')
      .text('INVOICE', { align: 'center' })
      .moveDown(1);

    // Invoice info
    doc.fontSize(11).fillColor('#555');
    doc.text(`Invoice #: INV-${String(data.invoiceId).padStart(4, '0')}`, 50);
    doc.text(`Date: ${data.date}`);
    doc.text(`Due Date: ${data.dueDate}`);
    doc.text(`Status: ${data.status}`);
    doc.moveDown(1);

    // Divider
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#ddd');
    doc.moveDown(0.5);

    // Customer info
    doc.fontSize(13).fillColor('#333').text('Bill To:');
    doc.fontSize(11).fillColor('#555');
    doc.text(data.customerName);
    doc.text(data.customerEmail);
    doc.moveDown(1);

    // Service details table
    doc.fontSize(13).fillColor('#333').text('Service Details:');
    doc.moveDown(0.5);

    const tableTop = doc.y;

    // Table header
    doc
      .fontSize(10)
      .fillColor('#fff')
      .rect(50, tableTop, 500, 20)
      .fill('#0066cc');

    doc.fillColor('#fff');
    doc.text('Description', 60, tableTop + 5, { width: 200 });
    doc.text('Pool Address', 260, tableTop + 5, { width: 150 });
    doc.text('Amount', 430, tableTop + 5, { width: 100, align: 'right' });

    // Table row
    const rowTop = tableTop + 25;
    doc
      .fillColor('#f9f9f9')
      .rect(50, rowTop, 500, 25)
      .fill('#f9f9f9');

    doc.fillColor('#333').fontSize(10);
    doc.text(`Pool Cleaning — ${data.serviceDate}`, 60, rowTop + 7, { width: 200 });
    doc.text(data.poolAddress, 260, rowTop + 7, { width: 150 });
    doc.text(`$${data.amount.toFixed(2)}`, 430, rowTop + 7, { width: 100, align: 'right' });

    // Total
    doc.moveDown(3);
    doc
      .fontSize(14)
      .fillColor('#333')
      .text(`Total: $${data.amount.toFixed(2)}`, 400, doc.y, { width: 150, align: 'right' });

    doc.moveDown(1);
    doc.text(`Technician: ${data.technicianName}`, 50);

    // Footer
    doc.moveDown(3);
    doc
      .fontSize(9)
      .fillColor('#999')
      .text('Thank you for choosing Pool Cleaning Service!', 50, doc.y, { align: 'center' })
      .text('Payment is due within 14 days of the service date.', { align: 'center' });

    doc.end();
  });
}
