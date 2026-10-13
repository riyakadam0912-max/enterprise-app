import PDFDocument from 'pdfkit';

export type InvoicePdfContext = {
  name?: string | null;
  invoiceNo: string;
  customer: string;
  customerAddress?: string | null;
  issueDate: string;
  dueDate: string;
  subtotal: string;
  discount: string;
  tax: string;
  adjustment?: string;
  tds?: string;
  tcs?: string;
  totalAmount: string;
  companyName: string;
  items?: Array<{
    name: string;
    description?: string | null;
    unit?: string | null;
    quantity: number;
    price: number;
    total: number;
  }>;
  notes?: string | null;
  paymentInstructions?: string | null;
  terms?: string | null;
};

const pageWidth = 595.28;
const margin = 48;
const contentWidth = pageWidth - margin * 2;

export async function buildInvoicePdfBuffer(
  context: InvoicePdfContext,
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 44, right: margin, bottom: 52, left: margin },
    bufferPages: true,
  });
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    doc
      .fillColor('#245579')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(context.companyName, margin, 42);
    doc
      .fillColor('#64748B')
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('INVOICE', 415, 42, {
        width: 132,
        align: 'right',
        characterSpacing: 1,
      });
    doc
      .fillColor('#17212F')
      .font('Helvetica-Bold')
      .fontSize(23)
      .text(
        context.name?.trim() || `Invoice ${context.invoiceNo}`,
        margin,
        70,
        { width: 355 },
      );
    doc
      .fillColor('#64748B')
      .font('Helvetica')
      .fontSize(9)
      .text(context.invoiceNo, margin, 105);
    doc
      .fillColor('#64748B')
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('AMOUNT DUE', 420, 76, { width: 127, align: 'right' });
    doc
      .fillColor('#17212F')
      .font('Helvetica-Bold')
      .fontSize(14)
      .text(context.totalAmount, 400, 92, { width: 147, align: 'right' });
    doc
      .moveTo(margin, 128)
      .lineTo(pageWidth - margin, 128)
      .lineWidth(0.7)
      .strokeColor('#DDE3E9')
      .stroke();

    let y = 150;
    const drawLabel = (
      label: string,
      value: string,
      x: number,
      width: number,
    ) => {
      doc
        .fillColor('#64748B')
        .font('Helvetica-Bold')
        .fontSize(7)
        .text(label, x, y, { characterSpacing: 0.5 });
      doc
        .fillColor('#17212F')
        .font('Helvetica')
        .fontSize(9)
        .text(value, x, y + 13, { width });
    };
    drawLabel('BILL TO', context.customer, margin, contentWidth / 2);
    drawLabel(
      'ISSUED',
      context.issueDate,
      margin + contentWidth / 2,
      contentWidth / 4,
    );
    drawLabel(
      'DUE DATE',
      context.dueDate,
      margin + (contentWidth * 3) / 4,
      contentWidth / 4,
    );
    y += 39;
    if (context.customerAddress) {
      doc
        .fillColor('#64748B')
        .font('Helvetica')
        .fontSize(8)
        .text(context.customerAddress, margin, y, { width: contentWidth / 2 });
      y = doc.y + 14;
    }

    const drawTableHeader = () => {
      doc.roundedRect(margin, y, contentWidth, 24, 2).fill('#EAF1F6');
      doc.fillColor('#607487').font('Helvetica-Bold').fontSize(7.5);
      doc.text('DESCRIPTION', margin + 8, y + 8, { width: 255 });
      doc.text('QTY', 360, y + 8, { width: 42, align: 'right' });
      doc.text('RATE', 406, y + 8, { width: 62, align: 'right' });
      doc.text('AMOUNT', 472, y + 8, { width: 75, align: 'right' });
      y += 32;
    };
    drawTableHeader();
    for (const item of context.items ?? []) {
      const description = item.description
        ? `${item.name}\n${item.description}`
        : item.name;
      const height = Math.max(
        25,
        doc.heightOfString(description, { width: 240 }) + 12,
      );
      if (y + height > doc.page.height - 90) {
        doc.addPage();
        y = 48;
        drawTableHeader();
      }
      doc
        .fillColor('#17212F')
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .text(item.name, margin + 8, y + 5, { width: 240 });
      if (item.description)
        doc
          .fillColor('#64748B')
          .font('Helvetica')
          .fontSize(7.5)
          .text(item.description, margin + 8, doc.y + 1, { width: 240 });
      doc
        .fillColor('#17212F')
        .font('Helvetica')
        .fontSize(8.5)
        .text(`${item.quantity} ${item.unit ?? 'Unit'}`, 352, y + 5, {
          width: 50,
          align: 'right',
        });
      doc.text(item.price.toFixed(2), 406, y + 5, {
        width: 62,
        align: 'right',
      });
      doc
        .font('Helvetica-Bold')
        .text(item.total.toFixed(2), 472, y + 5, { width: 75, align: 'right' });
      y += height;
      doc
        .moveTo(margin, y)
        .lineTo(pageWidth - margin, y)
        .lineWidth(0.4)
        .strokeColor('#E5E9EE')
        .stroke();
      y += 3;
    }

    const summaryRows: Array<[string, string]> = [
      ['Subtotal', context.subtotal],
      ['Discount', context.discount],
      ['Tax', context.tax],
      ...(context.tds ? [['TDS', `-${context.tds}`] as [string, string]] : []),
      ...(context.tcs ? [['TCS', context.tcs] as [string, string]] : []),
      ...(context.adjustment
        ? [['Adjustment', context.adjustment] as [string, string]]
        : []),
    ];
    if (y + summaryRows.length * 17 + 48 > doc.page.height - 55) {
      doc.addPage();
      y = 55;
    } else y += 12;
    const summaryX = pageWidth - margin - 230;
    for (const [label, value] of summaryRows) {
      doc
        .fillColor('#64748B')
        .font('Helvetica')
        .fontSize(8.5)
        .text(label, summaryX, y, { width: 125 });
      doc
        .fillColor('#17212F')
        .text(value, summaryX + 125, y, { width: 105, align: 'right' });
      y += 17;
    }
    doc
      .moveTo(summaryX, y + 2)
      .lineTo(pageWidth - margin, y + 2)
      .lineWidth(1)
      .strokeColor('#245579')
      .stroke();
    y += 13;
    doc
      .fillColor('#17212F')
      .font('Helvetica-Bold')
      .fontSize(10)
      .text('TOTAL DUE', summaryX, y, { width: 125 });
    doc
      .fillColor('#245579')
      .fontSize(13)
      .text(context.totalAmount, summaryX + 125, y - 2, {
        width: 105,
        align: 'right',
      });
    y += 32;

    for (const [label, value] of [
      ['TERMS & CONDITIONS', context.terms],
      ['PAYMENT INSTRUCTIONS', context.paymentInstructions],
      ['NOTES', context.notes],
    ] as const) {
      if (!value?.trim()) continue;
      doc.font('Helvetica').fontSize(8);
      const sectionHeight =
        doc.heightOfString(value.trim(), { width: contentWidth }) + 36;
      if (y + sectionHeight > doc.page.height - 58) {
        doc.addPage();
        y = 50;
      }
      doc
        .fillColor('#17212F')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(label, margin, y);
      y += 13;
      doc
        .fillColor('#64748B')
        .font('Helvetica')
        .fontSize(8)
        .text(value.trim(), margin, y, { width: contentWidth, lineGap: 2 });
      y = doc.y + 14;
    }

    const pages = doc.bufferedPageRange();
    for (
      let pageIndex = pages.start;
      pageIndex < pages.start + pages.count;
      pageIndex += 1
    ) {
      doc.switchToPage(pageIndex);
      const footerY = doc.page.height - 34;
      doc
        .moveTo(margin, footerY - 8)
        .lineTo(pageWidth - margin, footerY - 8)
        .lineWidth(0.5)
        .strokeColor('#E2E7EC')
        .stroke();
      doc
        .fillColor('#64748B')
        .font('Helvetica')
        .fontSize(7)
        .text(
          `${context.companyName} · ${context.invoiceNo}`,
          margin,
          footerY,
          { width: contentWidth / 2 },
        );
      doc.text(
        `Page ${pageIndex + 1} of ${pages.count}`,
        margin + contentWidth / 2,
        footerY,
        { width: contentWidth / 2, align: 'right' },
      );
    }
    doc.end();
  });
}
