import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ScrollView, Text, useColorScheme, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider, useAuth } from '@/auth/AuthProvider'
import { Card, Loading, Muted } from '@/components/ui'
import { supabaseConfigured } from '@/lib/supabase'
import { space, useTheme } from '@/theme'

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootStack />
      </AuthProvider>
    </SafeAreaProvider>
  )
}

function RootStack() {
  const t = useTheme()
  const dark = useColorScheme() === 'dark'
  const { ready, session } = useAuth()
  const base = dark ? DarkTheme : DefaultTheme
  const navTheme = { ...base, colors: { ...base.colors, primary: t.primary, background: t.bg, card: t.surface, text: t.text, border: t.border } }

  if (!supabaseConfigured) return <SetupNeeded />
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, justifyContent: 'center' }}>
        <Loading />
      </View>
    )
  }

  const signedIn = !!session
  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerTitleStyle: { fontWeight: '700' }, contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" options={{ headerShown: false, title: 'Sign in' }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="index" options={{ title: 'ShareCart' }} />
          <Stack.Screen name="list/[id]/index" options={{ title: '' }} />
          <Stack.Screen name="list/[id]/scan" options={{ presentation: 'modal', title: 'Scan a barcode' }} />
          <Stack.Screen name="list/[id]/share" options={{ presentation: 'modal', title: 'Share list' }} />
          <Stack.Screen name="account" options={{ title: 'Account' }} />
        </Stack.Protected>
        {/* Open to everyone: an invite link opened while signed out shows the sign-in form first. */}
        <Stack.Screen name="join/[code]" options={{ title: 'Join a list' }} />
      </Stack>
    </ThemeProvider>
  )
}

function SetupNeeded() {
  const t = useTheme()
  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: space.xl, gap: space.md, maxWidth: 560, alignSelf: 'center' }}>
      <Text style={{ color: t.text, fontSize: 24, fontWeight: '800' }}>ShareCart needs a Supabase project</Text>
      <Card>
        <Muted>
          Copy .env.example to .env and fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY from your
          Supabase project&apos;s API settings, then restart with `npx expo start -c`. See the README for the full setup.
        </Muted>
      </Card>
    </ScrollView>
  )
}
