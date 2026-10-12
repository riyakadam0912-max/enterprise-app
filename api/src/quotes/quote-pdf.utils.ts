export type QuotePdfContext = {
  templateKey?: QuoteTemplateKey;
  quoteNumber: string;
  quoteName?: string | null;
  quoteDate: string;
  validTill: string;
  customer: string;
  customerAddress?: string | null;
  companyName: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  subtotal: string;
  discount: string;
  tax: string;
  adjustment: string;
  total: string;
  terms?: string | null;
};

export const QUOTE_TEMPLATE_KEYS = [
  'minimal',
  'professional',
  'modern',
  'classic',
] as const;
export type QuoteTemplateKey = (typeof QUOTE_TEMPLATE_KEYS)[number];

const templateStyles: Record<
  QuoteTemplateKey,
  { headingSize: number; bodySize: number; accent: string }
> = {
  minimal: { headingSize: 12, bodySize: 9, accent: '0 0 0 rg' },
  professional: { headingSize: 14, bodySize: 9, accent: '0.05 0.2 0.45 rg' },
  modern: { headingSize: 13, bodySize: 9, accent: '0.9 0.25 0.05 rg' },
  classic: { headingSize: 12, bodySize: 10, accent: '0.25 0.15 0.08 rg' },
};

function escapePdfText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

export function buildQuotePdfBuffer(context: QuotePdfContext) {
  const templateKey = QUOTE_TEMPLATE_KEYS.includes(
    context.templateKey ?? 'minimal',
  )
    ? (context.templateKey ?? 'minimal')
    : 'minimal';
  const style = templateStyles[templateKey];
  const lines = [
    context.companyName,
    context.quoteName?.trim() || `Quote ${context.quoteNumber}`,
    `Quote number: ${context.quoteNumber}`,
    `Quote date: ${context.quoteDate}`,
    `Valid until: ${context.validTill}`,
    `Customer: ${context.customer}`,
    context.customerAddress ? `Address: ${context.customerAddress}` : '',
    '',
    'Items',
    ...context.items.map(
      (item) =>
        `${item.name} | ${item.quantity} x ${item.price} | ${item.total}`,
    ),
    '',
    `Subtotal: ${context.subtotal}`,
    `Discount: ${context.discount}`,
    `Tax: ${context.tax}`,
    `Adjustment: ${context.adjustment}`,
    `Total: ${context.total}`,
    '',
    'Terms & Conditions',
    context.terms?.trim() || 'No additional terms and conditions provided.',
  ];

  const contentLines = [style.accent];
  let y = 790;
  for (const line of lines) {
    contentLines.push(
      'BT',
      line === 'Items' || line === 'Terms & Conditions'
        ? `/F1 ${style.headingSize} Tf`
        : `/F1 ${style.bodySize} Tf`,
    );
    contentLines.push(`50 ${y} Td`, `(${escapePdfText(line)}) Tj`, 'ET');
    y -= line === 'Items' || line === 'Terms & Conditions' ? 20 : 14;
    if (y < 60) break;
  }

  const content = contentLines.join('\n');
  const objects = [
    '%PDF-1.4',
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${Buffer.byteLength(content, 'utf8')} >> stream\n${content}\nendstream endobj`,
  ];
  let body = '';
  const offsets: number[] = [];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body, 'utf8'));
    body += `${object}\n`;
  }
  const xrefOffset = Buffer.byteLength(body, 'utf8');
  const xref = ['xref', `0 ${objects.length + 1}`, '0000000000 65535 f '];
  for (const offset of offsets)
    xref.push(`${String(offset).padStart(10, '0')} 00000 n `);
  const footer = [
    'trailer',
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    'startxref',
    String(xrefOffset),
    '%%EOF',
  ];
  return Buffer.from(`${body}${xref.join('\n')}\n${footer.join('\n')}\n`);
}
