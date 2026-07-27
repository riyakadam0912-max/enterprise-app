import { Injectable } from '@nestjs/common';

type TemplateVariables = Record<
  string,
  string | number | boolean | null | undefined
>;

const DEFAULT_TEMPLATES: Record<string, { subject: string; body: string }> = {
  approval_request: {
    subject: 'Approval required: {{title}}',
    body: '<p>{{message}}</p><p><a href="{{actionUrl}}">Review request</a></p>',
  },
  approval_completed: {
    subject: 'Approval completed: {{title}}',
    body: '<p>{{message}}</p>',
  },
  password_reset: {
    subject: 'Reset your password',
    body: '<p>Use this link to reset your password: <a href="{{actionUrl}}">Reset password</a></p>',
  },
  welcome_email: {
    subject: 'Welcome to {{brand}}',
    body: '<p>Welcome {{name}}.</p>',
  },
  mention_notification: {
    subject: 'You were mentioned by {{actor}}',
    body: '<p>{{message}}</p>',
  },
  task_assignment: {
    subject: 'Task assigned: {{title}}',
    body: '<p>{{message}}</p><p><a href="{{actionUrl}}">Open task</a></p>',
  },
  invoice_overdue: {
    subject: 'Invoice overdue: {{title}}',
    body: '<p>{{message}}</p>',
  },
};

function renderTemplate(
  template: string,
  variables: TemplateVariables,
): string {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) =>
    String(variables[key] ?? ''),
  );
}

@Injectable()
export class NotificationTemplateService {
  resolveTemplate(key: string): { subject: string; body: string } | null {
    return DEFAULT_TEMPLATES[key] ?? null;
  }

  render(
    key: string,
    variables: TemplateVariables,
  ): { subject: string; body: string } {
    const template =
      this.resolveTemplate(key) ?? DEFAULT_TEMPLATES.approval_request;
    return {
      subject: renderTemplate(template.subject, variables),
      body: renderTemplate(template.body, variables),
    };
  }
}
