import { buildQuotePdfBuffer } from './quote-pdf.utils';

describe('buildQuotePdfBuffer', () => {
  it('creates a PDF containing quote identity, items, totals, and terms', () => {
    const pdf = buildQuotePdfBuffer({
      quoteNumber: 'Q-42',
      quoteName: 'Website proposal',
      quoteDate: '2026-10-12',
      validTill: '2026-11-12',
      customer: 'Acme (India)',
      customerAddress: 'Main Street, Mumbai',
      companyName: 'Enterprise ERP',
      items: [{ name: 'Design (UI)', quantity: 2, price: 100, total: 200 }],
      subtotal: 'INR 200.00',
      discount: 'INR 10.00',
      tax: 'INR 19.00',
      adjustment: 'INR 0.00',
      total: 'INR 209.00',
      terms: 'Net 30 (calendar days)',
    });

    const content = pdf.toString('utf8');
    expect(content.startsWith('%PDF-1.4')).toBe(true);
    expect(content).toContain('Quote number: Q-42');
    expect(content).toContain('Customer: Acme \\(India\\)');
    expect(content).toContain('Design \\(UI\\) | 2 x 100 | 200');
    expect(content).toContain('Total: INR 209.00');
    expect(content).toContain('Net 30 \\(calendar days\\)');
    expect(content.endsWith('%%EOF\n')).toBe(true);

    const startXref = Number(content.match(/startxref\n(\d+)/)?.[1]);
    const xrefLines = content.slice(startXref).split('\n');
    const objectCount = Number(xrefLines[1].split(' ')[1]);
    expect(xrefLines[0]).toBe('xref');
    for (let objectNumber = 1; objectNumber < objectCount; objectNumber += 1) {
      const offset = Number(xrefLines[objectNumber + 2].slice(0, 10));
      expect(content.slice(offset).startsWith(`${objectNumber} 0 obj`)).toBe(
        true,
      );
    }
  });
});
