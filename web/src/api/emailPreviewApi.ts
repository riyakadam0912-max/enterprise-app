import { axiosClient } from './axiosClient';

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
  const response = await axiosClient.get<EmailTemplateOption[]>('/email/templates');
  return response.data;
}

export async function previewEmailTemplate(
  template: string,
  context: Record<string, string>,
): Promise<EmailPreviewResponse> {
  const response = await axiosClient.post<EmailPreviewResponse>('/email/preview', {
    template,
    context,
  });
  return response.data;
}