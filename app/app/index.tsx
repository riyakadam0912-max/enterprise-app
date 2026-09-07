import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/src/providers/AuthProvider';
export default function Index() {
  const { session, loading } = useAuth();
  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#f97316" /></View>;
  if (!session) return <Redirect href="/(auth)/login" />;
  if (session.isSuperAdmin) return <Redirect href="/(app)/(tabs)/global" />;
  if (session.isPlatformAdmin && session.organizationId == null) return <Redirect href="/select-organization" />;
  return <Redirect href="/(app)/(tabs)/dashboard" />;
}
