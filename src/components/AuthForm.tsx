import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useAuth } from '../auth/AuthProvider'
import { space, useTheme } from '../theme'
import { Button, Card, Field, Muted, Notice } from './ui'

type Mode = 'guest' | 'sign-in' | 'sign-up'

/**
 * Guest first (one field, for trying the app or the portfolio demo), with email sign-in / sign-up a tap away.
 * Used on the sign-in screen and on the join screen when an invite link is opened while signed out.
 */
export function AuthForm({ intro }: { intro?: string }) {
  const t = useTheme()
  const { signIn, signUp, continueAsGuest } = useAuth()
  const [mode, setMode] = useState<Mode>('guest')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const needsName = mode !== 'sign-in'
  const valid =
    (!needsName || name.trim().length > 0) && (mode === 'guest' || (/^\S+@\S+\.\S+$/.test(email.trim()) && password.length >= 6))

  const submit = async () => {
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    setInfo(null)
    const result =
      mode === 'guest' ? await continueAsGuest(name) : mode === 'sign-in' ? await signIn(email, password) : await signUp(name, email, password)
    setBusy(false)
    if (!result.ok) setError(result.error)
    else if ('needsConfirmation' in result && result.needsConfirmation) {
      setInfo(`We sent a confirmation link to ${email.trim()}. Open it, then sign in here.`)
      setMode('sign-in')
    }
  }

  const tabs: { mode: Mode; label: string }[] = [
    { mode: 'guest', label: 'Guest' },
    { mode: 'sign-in', label: 'Sign in' },
    { mode: 'sign-up', label: 'Create account' },
  ]

  return (
    <Card testID="auth-form">
      {intro && <Muted>{intro}</Muted>}
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 6, marginBottom: space.xs }}>
        {tabs.map((tab) => {
          const selected = tab.mode === mode
          return (
            <Pressable
              key={tab.mode}
              testID={`auth-tab-${tab.mode}`}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => {
                setMode(tab.mode)
                setError(null)
              }}
              style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: selected ? t.primarySoft : 'transparent' }}
            >
              <Text style={{ color: selected ? t.text : t.muted, fontWeight: '700' }}>{tab.label}</Text>
            </Pressable>
          )
        })}
      </View>

      {needsName && (
        <Field
          label="Your name"
          testID="auth-name"
          value={name}
          onChangeText={setName}
          placeholder="Shown to people you share lists with"
          autoComplete="name"
          maxLength={40}
          returnKeyType={mode === 'guest' ? 'go' : 'next'}
          onSubmitEditing={mode === 'guest' ? submit : undefined}
        />
      )}
      {mode !== 'guest' && (
        <>
          <Field
            label="Email"
            testID="auth-email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
          <Field
            label="Password"
            testID="auth-password"
            value={password}
            onChangeText={setPassword}
            placeholder={mode === 'sign-up' ? 'At least 6 characters' : 'Your password'}
            secureTextEntry
            autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
            returnKeyType="go"
            onSubmitEditing={submit}
          />
        </>
      )}

      {error && <Notice tone="error" testID="auth-error">{error}</Notice>}
      {info && <Notice testID="auth-info">{info}</Notice>}

      <Button
        label={mode === 'guest' ? 'Continue as guest' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
        onPress={submit}
        disabled={!valid}
        loading={busy}
        testID="auth-submit"
      />
      {mode === 'guest' && (
        <Muted style={{ fontSize: 12 }}>
          A guest account lives on this device. You can share lists and join others&apos; just the same; create an
          account to use ShareCart on several devices.
        </Muted>
      )}
    </Card>
  )
}
