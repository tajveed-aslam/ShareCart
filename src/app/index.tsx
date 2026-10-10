import { Ionicons } from '@expo/vector-icons'
import { router, Stack } from 'expo-router'
import { useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useAuth } from '@/auth/AuthProvider'
import { Avatar, Button, Card, Field, Loading, Muted, Notice } from '@/components/ui'
import { createList } from '@/data/mutations'
import { useLists } from '@/data/useLists'
import { isPlausibleInviteCode, normalizeInviteCode } from '@/lib/invite'
import { errorMessage } from '@/lib/supabase'
import type { ListSummary } from '@/lib/types'
import { radius, space, useTheme } from '@/theme'

export default function ListsScreen() {
  const t = useTheme()
  const { user, profile } = useAuth()
  const { lists, error, loading, refresh } = useLists(user?.id ?? null)
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () =>
            user && (
              <Pressable testID="open-account" accessibilityRole="button" accessibilityLabel="Account" hitSlop={8} onPress={() => router.push('/account')}>
                <Avatar userId={user.id} name={profile?.display_name ?? '?'} size={32} />
              </Pressable>
            ),
        }}
      />
      <FlatList
        testID="screen-lists"
        data={lists ?? []}
        keyExtractor={(l) => l.id}
        contentContainerStyle={styles.page}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
        ListHeaderComponent={
          <View style={{ gap: space.lg }}>
            <NewListCard />
            <JoinCard />
            {error && <Notice tone="error" testID="lists-error">{error}</Notice>}
            {lists && lists.length > 0 && <Text style={[styles.section, { color: t.muted }]}>YOUR LISTS</Text>}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <Loading label="Loading your lists…" />
          ) : lists ? (
            <Card testID="lists-empty">
              <Muted>No lists yet. Create one above, or join a family member&apos;s list with their invite code.</Muted>
            </Card>
          ) : null
        }
        renderItem={({ item }) => <ListRow list={item} />}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
      />
    </>
  )
}

function ListRow({ list }: { list: ListSummary }) {
  const t = useTheme()
  const done = list.total > 0 && list.remaining === 0
  return (
    <Pressable
        onPress={() => router.push({ pathname: '/list/[id]', params: { id: list.id } })}
        testID={`list-row-${list.name}`}
        accessibilityRole="button"
        accessibilityLabel={`${list.name}, ${list.remaining} of ${list.total} left`}
        style={({ pressed }) => [styles.row, { backgroundColor: t.surface, borderColor: t.border }, pressed && { opacity: 0.85 }]}
      >
        <View style={[styles.rowIcon, { backgroundColor: done ? t.primarySoft : t.surface2 }]}>
          <Ionicons name={done ? 'checkmark-done' : 'cart-outline'} size={22} color={done ? t.primary : t.text} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: t.text, fontSize: 17, fontWeight: '700' }} numberOfLines={1}>
            {list.name}
          </Text>
          <Text style={{ color: t.muted }}>
            {list.total === 0 ? 'Empty' : done ? 'All done' : `${list.remaining} of ${list.total} to buy`}
            {' · '}
            {list.memberCount === 1 ? 'Just you' : `${list.memberCount} people`}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={t.muted} />
    </Pressable>
  )
}

function NewListCard() {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const list = await createList(name)
      setName('')
      router.push({ pathname: '/list/[id]', params: { id: list.id } })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <View style={styles.inline}>
        <View style={{ flex: 1 }}>
          <Field testID="new-list-name" value={name} onChangeText={setName} placeholder="New list, e.g. Weekly shop" maxLength={60} returnKeyType="done" onSubmitEditing={create} />
        </View>
        <Button label="Create" onPress={create} disabled={!name.trim()} loading={busy} testID="new-list-create" />
      </View>
      {error && <Notice tone="error">{error}</Notice>}
    </Card>
  )
}

function JoinCard() {
  const [code, setCode] = useState('')
  const normalized = normalizeInviteCode(code)
  const plausible = isPlausibleInviteCode(normalized)
  return (
    <Card>
      <Muted>Got an invite code from family?</Muted>
      <View style={styles.inline}>
        <View style={{ flex: 1 }}>
          <Field
            testID="join-code"
            value={code}
            onChangeText={setCode}
            placeholder="ABCD-EFGH"
            autoCapitalize="characters"
            autoCorrect={false}
            onSubmitEditing={() => plausible && router.push({ pathname: '/join/[code]', params: { code: normalized } })}
          />
        </View>
        <Button
          label="Join"
          variant="ghost"
          disabled={!plausible}
          onPress={() => router.push({ pathname: '/join/[code]', params: { code: normalized } })}
          testID="join-submit"
        />
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.sm, maxWidth: 720, width: '100%', alignSelf: 'center', paddingBottom: space.xl * 2 },
  section: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, marginBottom: -space.sm },
  inline: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: 1 },
  rowIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
})
