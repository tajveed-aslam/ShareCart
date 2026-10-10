import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { AppState, Platform } from 'react-native'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY

/** False when the app was built without Supabase settings; the UI then explains how to add them. */
export const supabaseConfigured = Boolean(url && key)

export const supabase = createClient(url ?? 'http://localhost:54321', key ?? 'missing-key', {
  auth: {
    // On native the session lives in AsyncStorage; on web supabase-js uses localStorage by default.
    ...(Platform.OS !== 'web' && { storage: AsyncStorage }),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// Native apps don't get the browser's visibility events, so token refresh is tied to the app being in the
// foreground: refreshing while backgrounded wastes battery and can be killed mid-request.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh()
    else void supabase.auth.stopAutoRefresh()
  })
}

/** A user-facing message for a Supabase/PostgREST error. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!error) return fallback
  const e = error as { message?: string; code?: string }
  if (e.code === 'P0002' || e.code === '28000' || e.code === '42501') return e.message ?? fallback
  if (e.code === '23514') return 'That value is too long or not allowed.'
  if (e.message && /fetch|network/i.test(e.message)) return "Can't reach ShareCart. Check your connection."
  if (e.message && /invalid login credentials/i.test(e.message)) return 'Wrong email or password.'
  if (e.message && /already registered/i.test(e.message)) return 'An account with that email already exists. Sign in instead.'
  return e.message ?? fallback
}
