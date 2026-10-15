import PDFDocument from 'pdfkit';
type PdfDocumentInstance = InstanceType<typeof PDFDocument>;

export type QuotePdfContext = {
  templateKey?: QuoteTemplateKey;
  logo?: Buffer;
  quoteNumber: string;
  quoteName?: string | null;
  quoteDate: string;
  validTill: string;
  customer: string;
  customerAddress?: string | null;
  companyName: string;
  companyAddress?: string | null;
  items: Array<{
    name: string;
    unit?: string | null;
    description?: string | null;
    quantity: number;
    price: number;
    total: number;
  }>;
  subtotal: string;
  discount: string;
  tax: string;
  adjustment: string;
  tds?: string;
  tcs?: string;
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

type TemplateStyle = {
  accent: string;
  tint: string;
  text: string;
  muted: string;
};

const templateStyles: Record<QuoteTemplateKey, TemplateStyle> = {
  minimal: {
    accent: '#334155',
    tint: '#F1F5F9',
    text: '#17212F',
    muted: '#64748B',
  },
  professional: {
    accent: '#245579',
    tint: '#EAF1F6',
    text: '#16354C',
    muted: '#607487',
  },
  modern: {
    accent: '#B64D35',
    tint: '#FBF0EC',
    text: '#49251F',
    muted: '#80645E',
  },
  classic: {
    accent: '#66513B',
    tint: '#F4F0E9',
    text: '#3F3428',
    muted: '#776A5A',
  },
};

const margin = { top: 44, right: 48, bottom: 52, left: 48 };
const pageWidth = 595.28;
const contentWidth = pageWidth - margin.left - margin.right;
const columns = { item: 219, quantity: 42, unit: 66, rate: 82, amount: 90 };

function drawHeader(
  doc: PdfDocumentInstance,
  context: QuotePdfContext,
  style: TemplateStyle,
) {
  const title = context.quoteName?.trim() || 'Quotation';
  const brandX = context.logo ? margin.left + 52 : margin.left;
  if (context.logo) {
    doc.image(context.logo, margin.left, 38, { fit: [38, 38] });
  }
  doc.fillColor(style.text).font('Helvetica-Bold').fontSize(10);
  doc.text(context.companyName, brandX, 41, { width: 280 });
  if (context.companyAddress) {
    doc
      .fillColor(style.muted)
      .font('Helvetica')
      .fontSize(7.5)
      .text(context.companyAddress, brandX, 56, { width: 280 });
  }
  doc
    .fillColor(style.accent)
    .font('Helvetica-Bold')
    .fontSize(8)
    .text('QUOTATION', 415, 41, {
      width: 111,
      align: 'right',
      characterSpacing: 0.8,
    });
  doc
    .fillColor(style.text)
    .font('Helvetica-Bold')
    .fontSize(22)
    .text(title, margin.left, 86, { width: 350 });
  doc
    .moveTo(margin.left, 137)
    .lineTo(pageWidth - margin.right, 137)
    .lineWidth(0.6)
    .strokeColor('#DDE3E9')
    .stroke();
  return 153;
}

function drawMetadata(
  doc: PdfDocumentInstance,
  context: QuotePdfContext,
  style: TemplateStyle,
  y: number,
) {
  const cellWidth = contentWidth / 3;
  const metadata = [
    ['QUOTE DATE', context.quoteDate],
    ['VALID UNTIL', context.validTill],
    ['QUOTE NUMBER', context.quoteNumber],
  ];
  metadata.forEach(([label, value], index) => {
    const x = margin.left + index * cellWidth;
    doc
      .fillColor(style.muted)
      .font('Helvetica-Bold')
      .fontSize(7)
      .text(label, x, y, { characterSpacing: 0.5 });
    doc
      .fillColor(style.text)
      .font('Helvetica')
      .fontSize(9)
      .text(value, x, y + 13);
  });
  doc
    .moveTo(margin.left, y + 34)
    .lineTo(pageWidth - margin.right, y + 34)
    .lineWidth(0.6)
    .strokeColor('#E2E7EC')
    .stroke();
  return y + 52;
}

function drawTableHeader(doc: PdfDocumentInstance, style: TemplateStyle) {
  const y = doc.y;
  doc
    .save()
    .roundedRect(margin.left, y, contentWidth, 24, 2)
    .fill(style.tint)
    .restore();
  doc.fillColor(style.muted).font('Helvetica-Bold').fontSize(7.5);
  doc.text('ITEM', margin.left + 8, y + 8, { width: columns.item - 12 });
  doc.text('QTY', margin.left + columns.item, y + 8, {
    width: columns.quantity,
    align: 'right',
  });
  doc.text('UNIT', margin.left + columns.item + columns.quantity, y + 8, {
    width: columns.unit,
    align: 'right',
  });
  doc.text(
    'RATE',
    margin.left + columns.item + columns.quantity + columns.unit,
    y + 8,
    { width: columns.rate, align: 'right' },
  );
  doc.text(
    'AMOUNT',
    margin.left + columns.item + columns.quantity + columns.unit + columns.rate,
    y + 8,
    { width: columns.amount - 8, align: 'right' },
  );
  doc.y = y + 32;
}

function drawItemRow(
  doc: PdfDocumentInstance,
  item: QuotePdfContext['items'][number],
  style: TemplateStyle,
) {
  const x = margin.left + 8;
  const itemWidth = columns.item - 20;
  const nameHeight = doc
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .heightOfString(item.name, { width: itemWidth });
  const descriptionHeight = item.description
    ? doc
        .font('Helvetica')
        .fontSize(7.5)
        .heightOfString(item.description, { width: itemWidth }) + 3
    : 0;
  const rowHeight = Math.max(24, nameHeight + descriptionHeight + 12);
  const bottomLimit = doc.page.height - margin.bottom - 22;

  if (doc.y + rowHeight > bottomLimit) {
    doc.addPage();
    drawTableHeader(doc, style);
  }

  const y = doc.y + 6;
  doc
    .fillColor(style.text)
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .text(item.name, x, y, { width: itemWidth });
  if (item.description) {
    const renderedNameHeight = doc
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .heightOfString(item.name, { width: itemWidth });
    doc
      .fillColor(style.muted)
      .font('Helvetica')
      .fontSize(7.5)
      .text(item.description, x, y + renderedNameHeight + 2, {
        width: itemWidth,
      });
  }
  doc.fillColor(style.text).font('Helvetica').fontSize(8.5);
  doc.text(String(item.quantity), margin.left + columns.item, y, {
    width: columns.quantity,
    align: 'right',
  });
  doc.text(
    item.unit || 'Unit',
    margin.left + columns.item + columns.quantity,
    y,
    { width: columns.unit, align: 'right' },
  );
  doc.text(
    item.price.toFixed(2),
    margin.left + columns.item + columns.quantity + columns.unit,
    y,
    { width: columns.rate, align: 'right' },
  );
  doc
    .font('Helvetica-Bold')
    .text(
      item.total.toFixed(2),
      margin.left +
        columns.item +
        columns.quantity +
        columns.unit +
        columns.rate,
      y,
      { width: columns.amount - 8, align: 'right' },
    );
  doc
    .moveTo(margin.left, y + rowHeight - 1)
    .lineTo(pageWidth - margin.right, y + rowHeight - 1)
    .lineWidth(0.4)
    .strokeColor('#E5E9EE')
    .stroke();
  doc.y = y + rowHeight;
}

function drawSummary(
  doc: PdfDocumentInstance,
  context: QuotePdfContext,
  style: TemplateStyle,
) {
  const width = 235;
  const rows: Array<[string, string]> = [
    ['Subtotal', context.subtotal],
    ['Discount', context.discount],
    ['Tax', context.tax],
    ...(context.tds ? [['TDS', `-${context.tds}`] as [string, string]] : []),
    ...(context.tcs ? [['TCS', context.tcs] as [string, string]] : []),
    ['Adjustment', context.adjustment],
  ];
  const summaryHeight = rows.length * 17 + 55;
  if (doc.y + summaryHeight > doc.page.height - margin.bottom) doc.addPage();
  const x = pageWidth - margin.right - width;
  let y = doc.y + 14;
  for (const [label, value] of rows) {
    doc
      .fillColor(style.muted)
      .font('Helvetica')
      .fontSize(8.5)
      .text(label, x, y, { width: 130 });
    doc
      .fillColor(style.text)
      .text(value, x + 130, y, { width: width - 130, align: 'right' });
    y += 17;
  }
  doc
    .moveTo(x, y + 2)
    .lineTo(x + width, y + 2)
    .lineWidth(1)
    .strokeColor(style.accent)
    .stroke();
  y += 11;
  doc
    .fillColor(style.text)
    .font('Helvetica-Bold')
    .fontSize(10)
    .text('TOTAL', x, y, { width: 100 });
  doc
    .fillColor(style.accent)
    .fontSize(14)
    .text(context.total, x + 100, y - 2, {
      width: width - 100,
      align: 'right',
    });
  doc.y = y + 28;
}

export async function buildQuotePdfBuffer(
  context: QuotePdfContext,
): Promise<Buffer> {
  const templateKey = QUOTE_TEMPLATE_KEYS.includes(
    context.templateKey ?? 'minimal',
  )
    ? (context.templateKey ?? 'minimal')
    : 'minimal';
  const style = templateStyles[templateKey];
  const doc = new PDFDocument({
    size: 'A4',
    margins: margin,
    bufferPages: true,
    autoFirstPage: false,
    compress: true,
  });
  const chunks: Buffer[] = [];

  return new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    doc.addPage();
    let y = drawHeader(doc, context, style);
    y = drawMetadata(doc, context, style, y);

    doc
      .fillColor(style.muted)
      .font('Helvetica-Bold')
      .fontSize(7)
      .text('PREPARED FOR', margin.left, y, { characterSpacing: 0.5 });
    doc
      .fillColor(style.text)
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(context.customer, margin.left, y + 13, { width: contentWidth });
    let customerBottom = y + 28;
    if (context.customerAddress) {
      doc
        .fillColor(style.muted)
        .font('Helvetica')
        .fontSize(8)
        .text(context.customerAddress, margin.left, customerBottom, {
          width: contentWidth / 2,
        });
      customerBottom = doc.y + 8;
    }
    doc.y = customerBottom + 12;

    drawTableHeader(doc, style);
    for (const item of context.items) drawItemRow(doc, item, style);
    drawSummary(doc, context, style);

    if (context.terms?.trim()) {
      const termsHeight =
        doc.heightOfString(context.terms.trim(), { width: contentWidth }) + 30;
      if (doc.y + termsHeight > doc.page.height - margin.bottom) doc.addPage();
      doc
        .moveTo(margin.left, doc.y)
        .lineTo(pageWidth - margin.right, doc.y)
        .lineWidth(0.6)
        .strokeColor('#E2E7EC')
        .stroke();
      doc.y += 13;
      doc
        .fillColor(style.text)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('TERMS & CONDITIONS', margin.left, doc.y);
      doc.y += 14;
      doc
        .fillColor(style.muted)
        .font('Helvetica')
        .fontSize(8)
        .text(context.terms.trim(), margin.left, doc.y, {
          width: contentWidth,
          lineGap: 2,
        });
    }

    const pageRange = doc.bufferedPageRange();
    for (
      let pageIndex = pageRange.start;
      pageIndex < pageRange.start + pageRange.count;
      pageIndex += 1
    ) {
      doc.switchToPage(pageIndex);
      const footerY = doc.page.height - margin.bottom - 12;
      doc
        .moveTo(margin.left, footerY - 8)
        .lineTo(pageWidth - margin.right, footerY - 8)
        .lineWidth(0.5)
        .strokeColor('#E2E7EC')
        .stroke();
      doc
        .fillColor(style.muted)
        .font('Helvetica')
        .fontSize(7)
        .text(
          `${context.companyName} · ${context.quoteNumber}`,
          margin.left,
          footerY,
          { width: contentWidth / 2 },
        );
      doc.text(
        `Page ${pageIndex + 1} of ${pageRange.count}`,
        margin.left + contentWidth / 2,
        footerY,
        { width: contentWidth / 2, align: 'right' },
      );
    }
    doc.end();
  });
}
