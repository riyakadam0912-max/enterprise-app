import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/src/providers/AuthProvider';
export default function AuthLayout() { const { session } = useAuth(); if (session) return <Redirect href="/(app)/(tabs)/dashboard" />; return <Stack screenOptions={{ headerShown: false }} />; }
