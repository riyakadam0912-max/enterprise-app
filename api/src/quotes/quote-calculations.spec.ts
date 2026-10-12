import { calculateQuoteTotals } from './quote-calculations';

describe('calculateQuoteTotals', () => {
  const items = [{ quantity: 2, price: 100, discountAmount: 10, taxRate: 10 }];

  it('supports editable percentage discount and adjustment', () => {
    expect(
      calculateQuoteTotals(items, {
        discountType: 'PERCENTAGE',
        discountRate: 10,
        adjustmentType: 'PERCENTAGE',
        adjustmentRate: 5,
      }),
    ).toMatchObject({
      subtotal: 190,
      discountAmount: 19,
      taxAmount: 19,
      adjustmentAmount: 8.55,
      total: 198.55,
    });
  });

  it('applies TCS and TDS independently to the taxable subtotal', () => {
    expect(
      calculateQuoteTotals(items, {
        tdsEnabled: true,
        tdsRate: 2,
        tcsEnabled: true,
        tcsRate: 1,
      }),
    ).toMatchObject({
      subtotal: 190,
      taxAmount: 19,
      tdsAmount: 3.8,
      tcsAmount: 1.9,
      total: 207.1,
    });
  });

  it('caps fixed discounts at the available subtotal', () => {
    expect(
      calculateQuoteTotals([{ quantity: 1, price: 50 }], {
        discountAmount: 100,
      }),
    ).toMatchObject({
      subtotal: 50,
      discountAmount: 50,
      total: 0,
    });
  });
});
