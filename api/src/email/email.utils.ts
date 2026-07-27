import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import Handlebars from 'handlebars';
import { EMAIL_BRAND, EMAIL_TEMPLATE_REQUIREMENTS } from './email.constants';
import {
  EmailRenderResult,
  EmailSendOptions,
  EmailTemplateContext,
} from './email.interfaces';
import { registerEmailHelpers } from './email.helpers';

const handlebarsCache = new Map<string, ReturnType<typeof Handlebars.create>>();
const compiledTemplateCache = new Map<string, Handlebars.TemplateDelegate>();
const compiledLayoutCache = new Map<string, Handlebars.TemplateDelegate>();

export function getTemplateRoot(): string {
  const candidates = [
    resolve(process.cwd(), 'src/email/templates'),
    resolve(process.cwd(), 'dist/email/templates'),
    resolve(__dirname, 'templates'),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

export function buildTemplateContext(
  context: EmailTemplateContext = {},
): EmailTemplateContext {
  return {
    brand: EMAIL_BRAND,
    locale: 'en',
    organization: EMAIL_BRAND.companyName,
    ...context,
    ctaText: context.ctaText ?? 'Open dashboard',
    ctaUrl: context.ctaUrl ?? '',
    title: context.title ?? 'Important update',
    message: context.message ?? 'Please review this message.',
  };
}

export function validateTemplateContext(
  templateName: string,
  context: EmailTemplateContext,
): string[] {
  const required = EMAIL_TEMPLATE_REQUIREMENTS[templateName] ?? [];
  return required.filter((variable) => {
    const value = context[variable];
    return value === undefined || value === null || value === '';
  });
}

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function createTextVersion(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function renderEmailTemplate(
  templateName: string,
  context: EmailTemplateContext,
): EmailRenderResult {
  const templateRoot = getTemplateRoot();
  const bodyPath = join(templateRoot, `${templateName}.hbs`);
  const fallbackPath = join(templateRoot, 'generic.hbs');
  const layoutPath = join(templateRoot, 'layouts', 'master.hbs');

  const resolvedBodyPath = existsSync(bodyPath) ? bodyPath : fallbackPath;

  if (!existsSync(resolvedBodyPath)) {
    throw new Error(`Template ${templateName} was not found`);
  }
  if (!existsSync(layoutPath)) {
    throw new Error('Master layout was not found');
  }

  const handlebars = getOrCreateHandlebars(templateRoot);
  const bodyTemplate = getOrCreateTemplate(
    resolvedBodyPath,
    handlebars,
    compiledTemplateCache,
  );
  const layoutTemplate = getOrCreateTemplate(
    layoutPath,
    handlebars,
    compiledLayoutCache,
  );
  const resolvedContext = buildTemplateContext(context);

  const bodyHtml = bodyTemplate(resolvedContext);
  const html = layoutTemplate({ ...resolvedContext, body: bodyHtml });
  return { html, text: createTextVersion(html) };
}

function getOrCreateHandlebars(
  templateRoot: string,
): ReturnType<typeof Handlebars.create> {
  const cached = handlebarsCache.get(templateRoot);
  if (cached) {
    return cached;
  }

  const handlebars = Handlebars.create();
  registerEmailHelpers(handlebars);

  const partialDir = join(templateRoot, 'partials');
  for (const file of [
    'header.hbs',
    'footer.hbs',
    'button.hbs',
    'card.hbs',
    'divider.hbs',
    'badge.hbs',
    'alert.hbs',
    'signature.hbs',
  ]) {
    const partialPath = join(partialDir, file);
    if (existsSync(partialPath)) {
      const name = file.replace(/\.hbs$/, '');
      handlebars.registerPartial(name, readFileSync(partialPath, 'utf8'));
    }
  }

  handlebarsCache.set(templateRoot, handlebars);
  return handlebars;
}

function getOrCreateTemplate(
  templatePath: string,
  handlebars: ReturnType<typeof Handlebars.create>,
  cache: Map<string, Handlebars.TemplateDelegate>,
): Handlebars.TemplateDelegate {
  const cached = cache.get(templatePath);
  if (cached) {
    return cached;
  }

  const compiled = handlebars.compile(readFileSync(templatePath, 'utf8'));
  cache.set(templatePath, compiled);
  return compiled;
}

export function buildEmailOptions(options: EmailSendOptions): EmailSendOptions {
  return {
    ...options,
    category: options.category ?? 'system',
    headers: {
      'X-Template': options.template,
      ...options.headers,
    },
  };
}
