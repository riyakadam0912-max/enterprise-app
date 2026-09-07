import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/src/providers/AuthProvider';
export default function AppLayout() { const { session } = useAuth(); if (!session) return <Redirect href="/(auth)/login" />; return <Stack screenOptions={{ headerShown: false }} />; }
