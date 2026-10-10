import { useColorScheme } from 'react-native'

const light = {
  bg: '#f4f7f5',
  surface: '#ffffff',
  surface2: '#eaf0ec',
  border: '#d8e2dc',
  text: '#0f1f17',
  muted: '#5b6e64',
  primary: '#16a34a',
  primaryText: '#ffffff',
  primarySoft: '#dcfce7',
  accent: '#f59e0b',
  accentSoft: '#fef3c7',
  danger: '#dc2626',
  dangerSoft: '#fee2e2',
  checked: '#94a3a0',
}

export type Theme = typeof light

const dark: Theme = {
  bg: '#0a120e',
  surface: '#111c16',
  surface2: '#18271f',
  border: '#24372d',
  text: '#e7f2ec',
  muted: '#8fa79a',
  primary: '#4ade80',
  primaryText: '#052e16',
  primarySoft: '#123321',
  accent: '#fbbf24',
  accentSoft: '#3a2c0b',
  danger: '#f87171',
  dangerSoft: '#3b1515',
  checked: '#5f7268',
}

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light
}

export const radius = { sm: 8, md: 12, lg: 18 }
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 }
