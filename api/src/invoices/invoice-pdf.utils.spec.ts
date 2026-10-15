import sharp from 'sharp';
import { buildInvoicePdfBuffer } from './invoice-pdf.utils';

describe('buildInvoicePdfBuffer', () => {
  it('creates a valid invoice PDF with itemized totals and terms', async () => {
    const pdf = await buildInvoicePdfBuffer({
      name: 'Consulting services',
      invoiceNo: 'INV-2026-008',
      customer: 'Acme Limited',
      customerAddress: 'Main Street, Mumbai',
      issueDate: '2026-10-13',
      dueDate: '2026-11-12',
      subtotal: 'INR 200.00',
      discount: 'INR 10.00',
      tax: 'INR 19.00',
      totalAmount: 'INR 209.00',
      companyName: 'Enterprise ERP',
      items: [
        {
          name: 'Design work',
          description: 'Interface design',
          unit: 'Day',
          quantity: 2,
          price: 100,
          total: 200,
        },
      ],
      terms: 'Payment due within 30 days.',
    });

    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(pdf.toString('latin1')).toContain('%%EOF');
    const pageCount = (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? [])
      .length;
    expect(pageCount).toBe(1);
  });

  it('paginates invoices with many line items', async () => {
    const items = Array.from({ length: 90 }, (_, index) => ({
      name: `Service ${index + 1}`,
      description: 'Detailed professional services for the billing period.',
      unit: 'Hour',
      quantity: 1,
      price: 100,
      total: 100,
    }));
    const pdf = await buildInvoicePdfBuffer({
      invoiceNo: 'INV-2026-009',
      customer: 'Acme Limited',
      issueDate: '2026-10-13',
      dueDate: '2026-11-12',
      subtotal: 'INR 9000.00',
      discount: 'INR 0.00',
      tax: 'INR 0.00',
      totalAmount: 'INR 9000.00',
      companyName: 'Enterprise ERP',
      items,
    });
    const pageCount = (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? [])
      .length;

    expect(pageCount).toBeGreaterThan(1);
  });

  it('renders an organization logo without adding an extra page', async () => {
    const logo = await sharp({
      create: { width: 12, height: 12, channels: 4, background: '#315B50' },
    })
      .png()
      .toBuffer();
    const pdf = await buildInvoicePdfBuffer({
      invoiceNo: 'INV-2026-010',
      customer: 'Acme Limited',
      issueDate: '2026-10-13',
      dueDate: '2026-11-12',
      subtotal: 'INR 200.00',
      discount: 'INR 0.00',
      tax: 'INR 0.00',
      totalAmount: 'INR 200.00',
      companyName: 'Acme Company',
      logo,
    });
    const pageCount = (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? [])
      .length;

    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(pageCount).toBe(1);
  });
});
