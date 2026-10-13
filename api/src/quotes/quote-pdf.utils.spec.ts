import { buildQuotePdfBuffer } from './quote-pdf.utils';

describe('buildQuotePdfBuffer', () => {
  const context = {
    quoteNumber: 'Q-42',
    quoteName: 'Website proposal',
    quoteDate: '2026-10-12',
    validTill: '2026-11-12',
    customer: 'Acme (India)',
    customerAddress: 'Main Street, Mumbai',
    companyName: 'Enterprise ERP',
    items: [
      {
        name: 'Design (UI)',
        description: 'Interface design',
        unit: 'Day',
        quantity: 2,
        price: 100,
        total: 200,
      },
    ],
    subtotal: 'INR 200.00',
    discount: 'INR 10.00',
    tax: 'INR 19.00',
    adjustment: 'INR 0.00',
    total: 'INR 209.00',
    terms: 'Net 30 (calendar days)',
  };

  it('creates a valid PDF buffer for a quote', async () => {
    const pdf = await buildQuotePdfBuffer(context);
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(pdf.toString('latin1')).toContain('%%EOF');
  });

  it('uses different visual layouts for the selected templates', async () => {
    const minimal = await buildQuotePdfBuffer({
      ...context,
      templateKey: 'minimal',
    });
    const professional = await buildQuotePdfBuffer({
      ...context,
      templateKey: 'professional',
    });
    expect(professional.equals(minimal)).toBe(false);
  });

  it('paginates large quotes instead of dropping trailing line items', async () => {
    const items = Array.from({ length: 90 }, (_, index) => ({
      name: `Service ${index + 1}`,
      description:
        'A detailed line item description that takes more than one line in the document.',
      unit: 'Day',
      quantity: 1,
      price: 100,
      total: 100,
    }));
    const pdf = await buildQuotePdfBuffer({ ...context, items });
    const encodedPdf = pdf.toString('latin1');
    const pageCount = (encodedPdf.match(/\/Type\s*\/Page\b/g) ?? []).length;
    expect(pageCount).toBeGreaterThan(1);
  });
});
