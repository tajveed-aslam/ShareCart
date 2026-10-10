import { Ionicons } from '@expo/vector-icons'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AuthForm } from '@/components/AuthForm'
import { Muted } from '@/components/ui'
import { space, useTheme } from '@/theme'

export default function SignInScreen() {
  const t = useTheme()
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" testID="screen-sign-in">
          <View style={styles.hero}>
            <View style={[styles.logo, { backgroundColor: t.primary }]}>
              <Ionicons name="cart" size={34} color={t.primaryText} />
            </View>
            <Text style={[styles.brand, { color: t.text }]}>ShareCart</Text>
            <Muted style={{ textAlign: 'center', fontSize: 16 }}>
              One grocery list for the whole family. Add items by typing or scanning, and watch them get ticked off live.
            </Muted>
          </View>
          <AuthForm />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.xl, maxWidth: 480, width: '100%', alignSelf: 'center', paddingTop: space.xl * 2 },
  hero: { alignItems: 'center', gap: space.sm },
  logo: { width: 68, height: 68, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  brand: { fontSize: 32, fontWeight: '800', letterSpacing: -0.8 },
})
