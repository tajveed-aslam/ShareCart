import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native'
import { avatarColor, initials } from '../lib/format'
import { radius, space, useTheme } from '../theme'

export function Card({ children, style, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  const t = useTheme()
  return (
    <View testID={testID} style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }, style]}>
      {children}
    </View>
  )
}

export function Title({ children }: { children: ReactNode }) {
  const t = useTheme()
  return (
    <Text accessibilityRole="header" style={[styles.title, { color: t.text }]}>
      {children}
    </Text>
  )
}

export function Muted({ children, style, testID }: { children: ReactNode; style?: object; testID?: string }) {
  const t = useTheme()
  return (
    <Text testID={testID} style={[{ color: t.muted, fontSize: 14, lineHeight: 20 }, style]}>
      {children}
    </Text>
  )
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  testID,
  compact,
}: {
  label: string
  onPress: () => void
  variant?: 'primary' | 'ghost' | 'danger'
  disabled?: boolean
  loading?: boolean
  testID?: string
  compact?: boolean
}) {
  const t = useTheme()
  const bg = variant === 'primary' ? t.primary : variant === 'danger' ? t.dangerSoft : t.surface
  const fg = variant === 'primary' ? t.primaryText : variant === 'danger' ? t.danger : t.text
  const off = disabled || loading
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: bg },
        variant === 'ghost' && { borderWidth: 1, borderColor: t.border },
        (pressed || off) && { opacity: off ? 0.55 : 0.8 },
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontWeight: '700', fontSize: 15 }}>{label}</Text>}
    </Pressable>
  )
}

export function Field({ label, testID, ...input }: TextInputProps & { label?: string; testID: string }) {
  const t = useTheme()
  return (
    <View style={{ gap: 6 }}>
      {label && <Text style={{ color: t.text, fontWeight: '600', fontSize: 14 }}>{label}</Text>}
      <TextInput
        testID={testID}
        accessibilityLabel={label ?? input.placeholder}
        placeholderTextColor={t.muted}
        {...input}
        style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.surface }, input.style]}
      />
    </View>
  )
}

export function Notice({ children, tone = 'info', testID }: { children: ReactNode; tone?: 'info' | 'warn' | 'error'; testID?: string }) {
  const t = useTheme()
  const bg = tone === 'error' ? t.dangerSoft : tone === 'warn' ? t.accentSoft : t.primarySoft
  const fg = tone === 'error' ? t.danger : tone === 'warn' ? t.text : t.text
  return (
    <View testID={testID} accessibilityRole={tone === 'error' ? 'alert' : undefined} style={[styles.notice, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 14, lineHeight: 20 }}>{children}</Text>
    </View>
  )
}

export function Loading({ label }: { label?: string }) {
  const t = useTheme()
  return (
    <View style={styles.loading} testID="loading">
      <ActivityIndicator color={t.primary} />
      {label && <Text style={{ color: t.muted }}>{label}</Text>}
    </View>
  )
}

export function Avatar({ userId, name, size = 28, ring }: { userId: string; name: string; size?: number; ring?: string }) {
  return (
    <View
      accessibilityLabel={name}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: avatarColor(userId),
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: ring ? 2 : 0,
        borderColor: ring,
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.4 }}>{initials(name)}</Text>
    </View>
  )
}

/** Confirmation dialog that also works on web (react-native-web's Alert can't show buttons). */
export function confirm(title: string, message: string, confirmLabel: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm()
    return
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ])
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: space.lg, gap: space.sm },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  button: { minHeight: 48, paddingHorizontal: 18, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  buttonCompact: { minHeight: 40, paddingHorizontal: 14 },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  notice: { borderRadius: radius.md, padding: space.md },
  loading: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl },
})
