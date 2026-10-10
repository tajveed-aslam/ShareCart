import { Platform } from 'react-native'

/**
 * Where invite links point. On web it's wherever the app is being served; native builds use the deployed web app
 * (EXPO_PUBLIC_APP_URL), whose /join/<code> page works for anyone, with or without the app installed.
 */
export function appOrigin(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin
  return process.env.EXPO_PUBLIC_APP_URL ?? 'https://sharecart.vercel.app'
}
