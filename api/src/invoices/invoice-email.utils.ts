export type InvoiceLetterContext = {
  CustomerName: string;
  InvoiceNumber: string;
  TotalAmount: string;
  DueDate: string;
  CompanyName: string;
};

export function renderInvoiceLetter(
  template: string,
  context: InvoiceLetterContext,
) {
  return template.replace(
    /\{\{(CustomerName|InvoiceNumber|TotalAmount|DueDate|CompanyName)\}\}/g,
    (_match, key) => {
      switch (key) {
        case 'CustomerName':
          return context.CustomerName;
        case 'InvoiceNumber':
          return context.InvoiceNumber;
        case 'TotalAmount':
          return context.TotalAmount;
        case 'DueDate':
          return context.DueDate;
        case 'CompanyName':
          return context.CompanyName;
        default:
          return '';
      }
    },
  );
}
