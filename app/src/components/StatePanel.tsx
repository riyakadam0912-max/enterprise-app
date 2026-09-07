import { Pressable, Text, View } from 'react-native';
import { tokens } from '@/src/theme/tokens';

export function StatePanel({ kind, message, onRetry }: { kind: 'loading' | 'empty' | 'error' | 'denied'; message: string; onRetry?: () => void }) {
  const error = kind === 'error' || kind === 'denied';
  return <View style={{ backgroundColor: error ? tokens.colors.dangerSoft : tokens.colors.surface, borderRadius: tokens.radius.card, padding: tokens.spacing.card, marginTop: tokens.spacing.section }}><Text style={{ color: error ? tokens.colors.danger : tokens.colors.muted, textAlign: 'center', ...tokens.type.body }}>{message}</Text>{onRetry ? <Pressable accessibilityRole="button" onPress={onRetry} style={{ alignSelf: 'center', marginTop: tokens.spacing.control }}><Text style={{ color: tokens.colors.info, ...tokens.type.button }}>Try again</Text></Pressable> : null}</View>;
}
