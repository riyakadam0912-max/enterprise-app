'use client';

import { Card } from '@/components/ui/card';
import { Heading } from '@/components/typography/Heading';
import { Caption } from '@/components/typography/Caption';
import { Text } from '@/components/typography/Text';

const settingsSections = [
  { label: 'General', description: 'System-wide general settings' },
  { label: 'Authentication', description: 'Authentication and security settings' },
  { label: 'Email', description: 'Email configuration and templates' },
  { label: 'Security', description: 'Security policies and settings' },
  { label: 'Maintenance', description: 'System maintenance options' },
  { label: 'Branding', description: 'Customize system branding' },
];

export default function SuperAdminSettings() {
  return (
    <div className="space-y-6">
      <div>
        <Heading level={1}>
          System Settings
        </Heading>
        <Caption className="text-slate-500 mt-1">
          Configure global system settings
        </Caption>
      </div>

      <div className="grid gap-4">
        {settingsSections.map((section) => (
          <Card key={section.label} className="p-6 cursor-pointer hover:shadow-md transition-shadow">
            <Text className="font-semibold text-slate-900">
              {section.label}
            </Text>
            <Caption className="text-slate-500 mt-1">{section.description}</Caption>
          </Card>
        ))}
      </div>
    </div>
  );
}
