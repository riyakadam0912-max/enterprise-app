import { apiClient } from './apiClient';

export type EmailTemplateOption = {
  name: string;
  requiredFields: string[];
};

export type EmailPreviewResponse = {
  template: string;
  html: string;
  text: string;
};

export async function listEmailTemplates(): Promise<EmailTemplateOption[]> {
  return apiClient<EmailTemplateOption[]>('/email/templates');
}

export async function previewEmailTemplate(
  template: string,
  context: Record<string, string>,
): Promise<EmailPreviewResponse> {
  return apiClient<EmailPreviewResponse>('/email/preview', {
    method: 'POST',
    body: JSON.stringify({ template, context }),
  });
}
