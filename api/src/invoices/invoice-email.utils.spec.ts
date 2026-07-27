import { renderInvoiceLetter } from './invoice-email.utils';

describe('renderInvoiceLetter', () => {
  it('replaces invoice placeholders with the invoice context values', () => {
    const template = [
      'Dear {{CustomerName}},',
      '',
      'Please find attached Invoice {{InvoiceNumber}} for the services/products provided.',
      'The invoice amount is {{TotalAmount}}.',
      'Kindly make payment before {{DueDate}}.',
      '',
      'Thank you for your business.',
      '',
      'Kind Regards,',
      '',
      '{{CompanyName}}',
    ].join('\n');

    const rendered = renderInvoiceLetter(template, {
      CustomerName: 'Acme Corp',
      InvoiceNumber: 'INV-001',
      TotalAmount: '₹5000',
      DueDate: '2026-07-15',
      CompanyName: 'Northstar Labs',
    });

    expect(rendered).toContain('Dear Acme Corp,');
    expect(rendered).toContain('Invoice INV-001');
    expect(rendered).toContain('₹5000');
    expect(rendered).toContain('2026-07-15');
    expect(rendered).toContain('Northstar Labs');
  });
});
