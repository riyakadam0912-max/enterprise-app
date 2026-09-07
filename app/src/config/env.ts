import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL ?? extra.apiUrl;
const apiUrl = configuredApiUrl ?? (__DEV__ ? 'http://10.0.2.2:3000/api/v1' : '');

if (!apiUrl) {
  throw new Error('EXPO_PUBLIC_API_URL is required in production. Set it to the API /api/v1 endpoint.');
}

if (__DEV__ && /production|vercel\.app/i.test(apiUrl)) {
  console.warn('[app] Development build is configured for a production API.');
}

export const env = {
  apiUrl: apiUrl.replace(/\/$/, ''),
  notificationApiUrl: process.env.EXPO_PUBLIC_NOTIFICATION_API_URL ?? extra.notificationApiUrl ?? apiUrl,
};
