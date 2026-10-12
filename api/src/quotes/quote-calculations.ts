export type QuoteRateMode = 'AMOUNT' | 'PERCENTAGE';

export interface QuoteCalculationItem {
  quantity: number;
  price: number;
  discountAmount?: number;
  taxRate?: number;
}

export interface QuoteCalculationOptions {
  discountAmount?: number;
  discountRate?: number;
  discountType?: QuoteRateMode;
  adjustmentAmount?: number;
  adjustmentRate?: number;
  adjustmentType?: QuoteRateMode;
  tdsEnabled?: boolean;
  tdsRate?: number;
  tcsEnabled?: boolean;
  tcsRate?: number;
  explicitTaxAmount?: number;
}

export interface QuoteTotals {
  subtotal: number;
  lineDiscountAmount: number;
  discountAmount: number;
  taxAmount: number;
  tdsAmount: number;
  tcsAmount: number;
  adjustmentAmount: number;
  total: number;
}

function percentage(base: number, rate = 0) {
  return (Math.max(0, base) * Math.max(0, rate)) / 100;
}

function resolveRate(
  base: number,
  amount = 0,
  rate = 0,
  type: QuoteRateMode = 'AMOUNT',
) {
  return type === 'PERCENTAGE' ? percentage(base, rate) : Math.max(0, amount);
}

export function calculateQuoteTotals(
  items: QuoteCalculationItem[],
  options: QuoteCalculationOptions = {},
): QuoteTotals {
  const grossSubtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.price,
    0,
  );
  const lineDiscountAmount = items.reduce(
    (sum, item) =>
      sum +
      Math.min(
        Math.max(0, item.quantity * item.price),
        item.discountAmount ?? 0,
      ),
    0,
  );
  const subtotal = Math.max(0, grossSubtotal - lineDiscountAmount);
  const discountAmount = Math.min(
    subtotal,
    resolveRate(
      subtotal,
      options.discountAmount,
      options.discountRate,
      options.discountType,
    ),
  );
  const taxableSubtotal = Math.max(0, subtotal - discountAmount);
  const taxAmount =
    options.explicitTaxAmount ??
    items.reduce((sum, item) => {
      const lineBase = Math.max(
        0,
        item.quantity * item.price - (item.discountAmount ?? 0),
      );
      return sum + percentage(lineBase, item.taxRate);
    }, 0);
  const tdsAmount = options.tdsEnabled
    ? percentage(taxableSubtotal, options.tdsRate)
    : 0;
  const tcsAmount = options.tcsEnabled
    ? percentage(taxableSubtotal, options.tcsRate)
    : 0;
  const adjustmentAmount = resolveRate(
    taxableSubtotal,
    options.adjustmentAmount,
    options.adjustmentRate,
    options.adjustmentType,
  );

  return {
    subtotal,
    lineDiscountAmount,
    discountAmount,
    taxAmount,
    tdsAmount,
    tcsAmount,
    adjustmentAmount,
    total:
      taxableSubtotal + taxAmount + tcsAmount - tdsAmount + adjustmentAmount,
  };
}
