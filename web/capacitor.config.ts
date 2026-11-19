import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.enterprise.erp',
  appName: 'Enterprise ERP',
  webDir: 'public',
  server: {
    url: 'https://enterprise-app-web-orcin.vercel.app',
    cleartext: false,
  },
};

export default config;
