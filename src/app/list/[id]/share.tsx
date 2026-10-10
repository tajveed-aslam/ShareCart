import * as Clipboard from 'expo-clipboard'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native'
import { useAuth } from '@/auth/AuthProvider'
import { Avatar, Button, Card, confirm, Field, Loading, Muted, Notice } from '@/components/ui'
import { deleteList, leaveList, regenerateInviteCode } from '@/data/mutations'
import { useList } from '@/data/useList'
import { appOrigin } from '@/lib/config'
import { formatInviteCode, inviteLink } from '@/lib/invite'
import { errorMessage } from '@/lib/supabase'
import { radius, space, useTheme } from '@/theme'

export default function ShareScreen() {
  const t = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user, profile } = useAuth()
  const me = user ? { id: user.id, name: profile?.display_name ?? '' } : null
  const { status, list, members, actions, reload } = useList(id, me, { presence: false })
  const [copied, setCopied] = useState(false)
  const [rename, setRename] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (status === 'loading') return <Loading />
  if (status !== 'ready' || !list || !user) {
    return (
      <View style={styles.page}>
        <Notice tone="warn">This list isn&apos;t available any more.</Notice>
        <Button label="Back to my lists" variant="ghost" onPress={() => router.dismissTo('/')} />
      </View>
    )
  }

  const isOwner = list.owner_id === user.id
  const link = inviteLink(list.invite_code, appOrigin())
  const message = `Join my ShareCart list "${list.name}": ${link}\nOr enter the code ${formatInviteCode(list.invite_code)} in the app.`

  const copy = async () => {
    await Clipboard.setStringAsync(Platform.OS === 'web' ? link : message)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const share = async () => {
    try {
      await Share.share({ message, url: link, title: `Join "${list.name}" on ShareCart` })
    } catch {
      await copy() // web browsers without the Share API
    }
  }

  const guard = async (action: () => Promise<unknown>) => {
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page} testID="screen-share">
      <Card>
        <Muted>Anyone with this code can join and edit &ldquo;{list.name}&rdquo;.</Muted>
        <Text testID="invite-code" selectable style={[styles.code, { color: t.text, backgroundColor: t.surface2 }]}>
          {formatInviteCode(list.invite_code)}
        </Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Button label="Share invite" onPress={() => void share()} testID="share-invite" />
          </View>
          <View style={{ flex: 1 }}>
            <Button label={copied ? 'Copied ✓' : Platform.OS === 'web' ? 'Copy link' : 'Copy'} variant="ghost" onPress={() => void copy()} testID="copy-invite" />
          </View>
        </View>
        {isOwner && (
          <Pressable
            testID="reset-code"
            accessibilityRole="button"
            onPress={() =>
              confirm('Reset the invite code?', 'The current code and links stop working. People already on the list stay.', 'Reset', () =>
                void guard(async () => {
                  await regenerateInviteCode(list.id)
                  await reload()
                }),
              )
            }
          >
            <Text style={{ color: t.muted, textDecorationLine: 'underline' }}>Reset code</Text>
          </Pressable>
        )}
      </Card>

      <Card testID="members">
        <Text style={{ color: t.text, fontWeight: '800', fontSize: 16 }}>People · {members.length}</Text>
        {members.map((m) => {
          const name = m.user_id === user.id ? `${m.profile?.display_name ?? 'You'} (you)` : (m.profile?.display_name ?? 'Member')
          return (
            <View key={m.user_id} style={styles.member} testID={`member-${m.profile?.display_name ?? m.user_id}`}>
              <Avatar userId={m.user_id} name={m.profile?.display_name ?? '?'} size={34} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontWeight: '600' }}>{name}</Text>
                <Text style={{ color: t.muted, fontSize: 12 }}>
                  {m.role === 'owner' ? 'Owner' : 'Member'}
                </Text>
              </View>
              {isOwner && m.user_id !== user.id && (
                <Pressable
                  testID={`remove-member-${m.profile?.display_name ?? m.user_id}`}
                  accessibilityRole="button"
                  onPress={() => confirm(`Remove ${m.profile?.display_name ?? 'this member'}?`, 'They lose access to the list.', 'Remove', () => void actions.removeMember(m.user_id))}
                >
                  <Text style={{ color: t.danger, fontWeight: '700' }}>Remove</Text>
                </Pressable>
              )}
            </View>
          )
        })}
      </Card>

      <Card>
        {rename === null ? (
          <Button label="Rename list" variant="ghost" onPress={() => setRename(list.name)} testID="rename-open" />
        ) : (
          <>
            <Field label="List name" testID="rename-input" value={rename} onChangeText={setRename} maxLength={60} />
            <Button
              label="Save name"
              disabled={!rename.trim()}
              onPress={() =>
                void actions.rename(rename).then(() => setRename(null))
              }
              testID="rename-save"
            />
          </>
        )}
        {isOwner ? (
          <Button
            label="Delete list"
            variant="danger"
            testID="delete-list"
            onPress={() =>
              confirm('Delete this list?', `"${list.name}" and all its items are removed for everyone.`, 'Delete', () =>
                void guard(async () => {
                  await deleteList(list.id)
                  router.dismissTo('/')
                }),
              )
            }
          />
        ) : (
          <Button
            label="Leave list"
            variant="danger"
            testID="leave-list"
            onPress={() =>
              confirm('Leave this list?', 'You can rejoin later with an invite code.', 'Leave', () =>
                void guard(async () => {
                  await leaveList(list.id, user.id)
                  router.dismissTo('/')
                }),
              )
            }
          />
        )}
        {error && <Notice tone="error">{error}</Notice>}
      </Card>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.md, maxWidth: 720, width: '100%', alignSelf: 'center', paddingBottom: space.xl * 2 },
  code: { fontSize: 34, fontWeight: '800', letterSpacing: 4, textAlign: 'center', paddingVertical: space.lg, borderRadius: radius.md, overflow: 'hidden', fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', gap: space.sm },
  member: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 6 },
})
