import { api, unwrap } from './client';

export type EmailTemplateOption = {
  name: string;
  requiredFields: string[];
};

export type EmailPreviewResponse = {
  template: string;
  html: string;
  text: string;
};

export async function emailTemplates(): Promise<EmailTemplateOption[]> {
  return unwrap<EmailTemplateOption[]>((await api.get('/email/templates')).data);
}

export async function previewEmail(
  template: string,
  context: Record<string, string>,
): Promise<EmailPreviewResponse> {
  return unwrap<EmailPreviewResponse>(
    (await api.post('/email/preview', { template, context })).data,
  );
}