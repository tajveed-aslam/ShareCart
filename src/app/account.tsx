import { useState } from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { useAuth } from '@/auth/AuthProvider'
import { Avatar, Button, Card, confirm, Field, Muted, Notice } from '@/components/ui'
import { space, useTheme } from '@/theme'

export default function AccountScreen() {
  const t = useTheme()
  const { user, profile, isGuest, updateName, signOut } = useAuth()
  const [name, setName] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null)
  const value = name ?? profile?.display_name ?? ''

  const save = async () => {
    setSaving(true)
    const result = await updateName(value)
    setSaving(false)
    setMessage(result.ok ? { tone: 'info', text: 'Name updated. Everyone on your lists will see it.' } : { tone: 'error', text: result.error })
    if (result.ok) setName(null)
  }

  if (!user) return null
  return (
    <ScrollView contentContainerStyle={styles.page} testID="screen-account">
      <Card style={{ alignItems: 'center' }}>
        <Avatar userId={user.id} name={profile?.display_name ?? '?'} size={64} />
        <Text testID="account-name" style={{ color: t.text, fontSize: 20, fontWeight: '800' }}>
          {profile?.display_name}
        </Text>
        <Muted testID="account-kind">{isGuest ? 'Guest account on this device' : user.email}</Muted>
      </Card>

      <Card>
        <Field label="Display name" testID="account-name-input" value={value} onChangeText={setName} maxLength={40} />
        <Button label="Save" onPress={() => void save()} loading={saving} disabled={!value.trim() || value.trim() === profile?.display_name} testID="account-save" />
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
      </Card>

      {isGuest && (
        <Notice tone="warn" testID="guest-warning">
          Guest accounts can&apos;t be recovered: signing out, or clearing this browser&apos;s data, loses access to your lists
          unless someone invites you back.
        </Notice>
      )}
      <Button
        label="Sign out"
        variant="danger"
        testID="sign-out"
        onPress={() =>
          isGuest ? confirm('Sign out of the guest account?', "You won't be able to sign back in to it.", 'Sign out', () => void signOut()) : void signOut()
        }
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.md, maxWidth: 520, width: '100%', alignSelf: 'center' },
})
