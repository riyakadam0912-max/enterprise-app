import { Pressable, Text, View } from 'react-native';
import { tokens } from '@/src/theme/tokens';

const variants = {
  primary: { backgroundColor: tokens.colors.primary, color: '#fff' },
  secondary: { backgroundColor: tokens.colors.surface, color: tokens.colors.text, borderWidth: 1, borderColor: tokens.colors.border },
  success: { backgroundColor: tokens.colors.success, color: '#fff' },
  danger: { backgroundColor: tokens.colors.danger, color: '#fff' },
  tertiary: { backgroundColor: 'transparent', color: tokens.colors.info },
} as const;

export function AppButton({ label, onPress, variant = 'primary', disabled = false, loading = false, style }: { label: string; onPress: () => void; variant?: keyof typeof variants; disabled?: boolean; loading?: boolean; style?: object }) {
  const tone = variants[variant];
  return <Pressable accessibilityRole="button" disabled={disabled || loading} onPress={onPress} style={[{ minHeight: 46, paddingHorizontal: 16, paddingVertical: 13, borderRadius: tokens.radius.control, alignItems: 'center', justifyContent: 'center', opacity: disabled || loading ? 0.55 : 1, ...tone }, style]}><Text style={{ color: tone.color, ...tokens.type.button }}>{loading ? 'Working...' : label}</Text></Pressable>;
}

export function ButtonRow({ children }: { children: React.ReactNode }) { return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.compact }}>{children}</View>; }
