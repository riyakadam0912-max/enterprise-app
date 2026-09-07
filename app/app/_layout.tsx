import 'react-native-reanimated';
import { Stack } from 'expo-router';
import { QueryProvider } from '@/src/providers/QueryProvider';
import { AuthProvider } from '@/src/providers/AuthProvider';
import { ContextProviders } from '@/src/providers/ContextProviders';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export default function RootLayout() {
  return <QueryProvider><AuthProvider><ContextProviders><Stack screenOptions={{ headerShown: false }}><Stack.Screen name="(auth)" /><Stack.Screen name="(app)" /><Stack.Screen name="select-organization" /><Stack.Screen name="super-admin" /></Stack></ContextProviders></AuthProvider></QueryProvider>;
}
