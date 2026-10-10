import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { useAuth } from '@/auth/AuthProvider'
import { AuthForm } from '@/components/AuthForm'
import { Button, Card, Loading, Muted, Notice } from '@/components/ui'
import { invitePreview, joinList } from '@/data/mutations'
import { formatInviteCode, isPlausibleInviteCode, normalizeInviteCode } from '@/lib/invite'
import { errorMessage } from '@/lib/supabase'
import type { InvitePreview } from '@/lib/types'
import { space, useTheme } from '@/theme'

type Lookup = { code: string; userId: string } & ({ state: 'found'; preview: InvitePreview } | { state: 'invalid' } | { state: 'error'; message: string })

export default function JoinScreen() {
  const t = useTheme()
  const params = useLocalSearchParams<{ code: string }>()
  const code = normalizeInviteCode(params.code ?? '')
  const { session, user } = useAuth()
  const userId = user?.id ?? null
  const [lookup, setLookup] = useState<Lookup | null>(null)
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId || !isPlausibleInviteCode(code)) return
    let active = true
    invitePreview(code)
      .then((preview) => active && setLookup(preview ? { code, userId, state: 'found', preview } : { code, userId, state: 'invalid' }))
      .catch((e) => active && setLookup({ code, userId, state: 'error', message: errorMessage(e) }))
    return () => {
      active = false
    }
  }, [code, userId])

  const join = async (listId: string) => {
    setJoining(true)
    setJoinError(null)
    try {
      const joined = await joinList(code)
      router.replace({ pathname: '/list/[id]', params: { id: joined ?? listId } })
    } catch (e) {
      setJoinError(errorMessage(e))
      setJoining(false)
    }
  }

  const current = lookup && lookup.code === code && lookup.userId === userId ? lookup : null

  return (
    <ScrollView contentContainerStyle={styles.page} testID="screen-join">
      {!isPlausibleInviteCode(code) ? (
        <Card>
          <Notice tone="error" testID="join-invalid">&ldquo;{params.code}&rdquo; isn&apos;t a valid invite code. Codes are 8 letters and numbers, like ABCD-EFGH.</Notice>
          <Button label="Go to my lists" variant="ghost" onPress={() => router.replace('/')} />
        </Card>
      ) : !session ? (
        <AuthForm intro={`You've been invited to a ShareCart list (code ${formatInviteCode(code)}). Sign in or continue as a guest to join.`} />
      ) : !current ? (
        <Loading label="Checking the invite…" />
      ) : current.state === 'invalid' ? (
        <Card>
          <Notice tone="error" testID="join-not-found">This invite code doesn&apos;t match any list. It may have been reset by the list owner.</Notice>
          <Button label="Go to my lists" variant="ghost" onPress={() => router.replace('/')} />
        </Card>
      ) : current.state === 'error' ? (
        <Card>
          <Notice tone="error">{current.message}</Notice>
        </Card>
      ) : (
        <Card testID="join-preview">
          <Muted>{current.preview.owner_name} invited you to</Muted>
          <Text style={{ color: t.text, fontSize: 26, fontWeight: '800' }}>{current.preview.list_name}</Text>
          <Muted>
            {current.preview.member_count} {current.preview.member_count === 1 ? 'person' : 'people'} on this list
          </Muted>
          {joinError && <Notice tone="error">{joinError}</Notice>}
          {current.preview.already_member ? (
            <Button label="Open list" onPress={() => router.replace({ pathname: '/list/[id]', params: { id: current.preview.list_id } })} testID="join-open" />
          ) : (
            <Button label="Join list" loading={joining} onPress={() => void join(current.preview.list_id)} testID="join-confirm" />
          )}
        </Card>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.md, maxWidth: 520, width: '100%', alignSelf: 'center' },
})
