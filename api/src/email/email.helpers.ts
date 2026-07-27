import Handlebars from 'handlebars';

export function registerEmailHelpers(handlebars: typeof Handlebars): void {
  handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);
  handlebars.registerHelper('formatDate', (value: unknown) => {
    if (!value) {
      return '';
    }

    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toLocaleDateString('en');
  });

  handlebars.registerHelper('formatCurrency', (value: unknown) => {
    if (value === undefined || value === null || value === '') {
      return '';
    }

    const amount = typeof value === 'number' ? value : Number(value);
    return Number.isNaN(amount)
      ? String(value)
      : new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(amount);
  });

  handlebars.registerHelper(
    'defaultValue',
    (value: unknown, fallback: string) => value ?? fallback,
  );
  handlebars.registerHelper('uppercase', (value: unknown) =>
    String(value ?? '').toUpperCase(),
  );
}
