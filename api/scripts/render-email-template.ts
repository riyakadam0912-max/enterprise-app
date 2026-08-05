import * as fs from 'node:fs';
import * as path from 'node:path';
import Handlebars from 'handlebars';
import { registerEmailHelpers } from '../src/email/email.helpers';

const templateRoot = path.resolve('src/email/templates');
const handlebars = Handlebars.create();
registerEmailHelpers(handlebars);

for (const partial of ['header', 'footer', 'button', 'card', 'divider', 'badge', 'alert', 'signature']) {
  const file = path.join(templateRoot, 'partials', `${partial}.hbs`);
  if (fs.existsSync(file)) {
    handlebars.registerPartial(partial, fs.readFileSync(file, 'utf8'));
  }
}

const bodyTemplate = handlebars.compile(fs.readFileSync(path.join(templateRoot, 'welcome.hbs'), 'utf8'));
const layoutTemplate = handlebars.compile(fs.readFileSync(path.join(templateRoot, 'layouts', 'master.hbs'), 'utf8'));
const baseContext = {
  firstName: 'Asha',
  organization: 'Enterprise ERP',
  ctaUrl: 'http://localhost:3001/dashboard',
  ctaText: 'Open dashboard',
  brand: {
    companyName: 'Enterprise ERP',
    supportEmail: 'support@example.com',
    supportWebsite: 'https://example.com',
    address: '1 Example Street',
  },
  title: 'Welcome to your workspace',
};
const body = bodyTemplate(baseContext);
const html = layoutTemplate({ ...baseContext, body });
console.log(JSON.stringify({
  hasFirstName: html.includes('Asha'),
  hasOrganization: html.includes('Enterprise ERP'),
  hasPlaceholder: html.includes('{{'),
  hasCtaText: html.includes('Open dashboard'),
  htmlSnippet: html.slice(0, 500),
}, null, 2));
