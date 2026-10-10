import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, SectionList, StyleSheet, Text, View } from 'react-native'
import { useAuth } from '@/auth/AuthProvider'
import { ItemEditor } from '@/components/ItemEditor'
import { ItemRow } from '@/components/ItemRow'
import { Avatar, Button, Card, confirm, Field, Loading, Muted, Notice } from '@/components/ui'
import { useList } from '@/data/useList'
import { findDuplicate, parseItemInput, sortItems } from '@/lib/items'
import { personName } from '@/lib/format'
import type { Item } from '@/lib/types'
import { radius, space, useTheme } from '@/theme'

export default function ListScreen() {
  const t = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user, profile } = useAuth()
  const me = user ? { id: user.id, name: profile?.display_name ?? '' } : null
  const { status, loadError, list, members, items, connection, online, actionError, actions, reload } = useList(id, me)
  const [text, setText] = useState('')
  const [editing, setEditing] = useState<Item | null>(null)

  const names = useMemo(() => new Map(members.map((m) => [m.user_id, m.profile?.display_name ?? 'Member'])), [members])
  const { toBuy, inCart } = useMemo(() => sortItems(items), [items])
  const others = online.filter((uid) => uid !== user?.id)

  const add = () => {
    const fields = parseItemInput(text)
    if (!fields.name) return
    const doAdd = () => {
      setText('')
      void actions.add({ ...fields, barcode: null })
    }
    const dup = findDuplicate(items, fields.name, null)
    if (dup) {
      confirm(`${dup.name} is already on the list`, `Added by ${personName(dup.added_by, names, user?.id ?? null)}. Add it again?`, 'Add again', doAdd)
    } else doAdd()
  }

  const toggle = (item: Item) => {
    if (Platform.OS !== 'web') void Haptics.selectionAsync()
    void actions.toggle(item)
  }

  if (status === 'loading') return <Loading label="Opening list…" />
  if (status !== 'ready' || !list) {
    const message =
      status === 'removed'
        ? "You're no longer a member of this list."
        : status === 'deleted'
          ? 'This list was deleted by its owner.'
          : status === 'not-found'
            ? "This list doesn't exist, or you're not a member of it."
            : (loadError ?? "Couldn't load this list.")
    return (
      <View style={styles.page}>
        <Notice tone={status === 'error' ? 'error' : 'warn'} testID="list-unavailable">{message}</Notice>
        {status === 'error' && <Button label="Try again" onPress={() => void reload()} testID="list-retry" />}
        <Button label="Back to my lists" variant="ghost" onPress={() => router.replace('/')} testID="list-back" />
      </View>
    )
  }

  const sections = [
    { key: 'to-buy', title: `To buy · ${toBuy.length}`, data: toBuy },
    ...(inCart.length > 0 ? [{ key: 'in-cart', title: `In the cart · ${inCart.length}`, data: inCart }] : []),
  ]

  return (
    <>
      <Stack.Screen
        options={{
          title: list.name,
          headerRight: () => (
            <View style={styles.headerRight}>
              {others.slice(0, 3).map((uid) => (
                <Avatar key={uid} userId={uid} name={names.get(uid) ?? '?'} size={26} ring={t.primary} />
              ))}
              <Pressable onPress={() => router.push({ pathname: '/list/[id]/share', params: { id: list.id } })} testID="open-share" accessibilityRole="button" accessibilityLabel="Share list" hitSlop={8} style={styles.headerButton}>
                  <Ionicons name="person-add-outline" size={20} color={t.primary} />
                  <Text style={{ color: t.primary, fontWeight: '700' }}>{members.length}</Text>
                </Pressable>
            </View>
          ),
        }}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <SectionList
          testID="screen-list"
          sections={sections}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.page}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={
            <View style={{ gap: space.md }}>
              {connection === 'offline' && (
                <Notice tone="warn" testID="connection-offline">Reconnecting… your changes will sync when you&apos;re back online.</Notice>
              )}
              {others.length > 0 && (
                <Muted testID="presence-line">
                  {others.map((uid) => names.get(uid) ?? 'Someone').join(', ')} {others.length === 1 ? 'is' : 'are'} looking at this list now
                </Muted>
              )}
              <Card style={{ padding: space.md }}>
                <View style={styles.addBar}>
                  <View style={{ flex: 1 }}>
                    <Field
                      testID="add-item-input"
                      value={text}
                      onChangeText={setText}
                      placeholder="Add an item, e.g. 2 milk"
                      returnKeyType="done"
                      submitBehavior="submit"
                      onSubmitEditing={add}
                      maxLength={120}
                    />
                  </View>
                  <Pressable
                    onPress={() => router.push({ pathname: '/list/[id]/scan', params: { id: list.id } })}
                      testID="open-scanner"
                      accessibilityRole="button"
                      accessibilityLabel="Scan a barcode"
                      style={[styles.iconButton, { borderColor: t.border, backgroundColor: t.surface }]}
                    >
                      <Ionicons name="barcode-outline" size={24} color={t.text} />
                    </Pressable>
                  <Pressable
                    testID="add-item-submit"
                    accessibilityRole="button"
                    accessibilityLabel="Add item"
                    disabled={!text.trim()}
                    onPress={add}
                    style={[styles.iconButton, { backgroundColor: t.primary, borderColor: t.primary, opacity: text.trim() ? 1 : 0.5 }]}
                  >
                    <Ionicons name="add" size={26} color={t.primaryText} />
                  </Pressable>
                </View>
              </Card>
              {actionError && (
                <Pressable onPress={actions.dismissError}>
                  <Notice tone="error" testID="action-error">{actionError} (tap to dismiss)</Notice>
                </Pressable>
              )}
            </View>
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text testID={`section-${section.key}`} style={[styles.sectionTitle, { color: t.muted }]}>
                {section.title.toUpperCase()}
              </Text>
              {section.key === 'in-cart' && (
                <Pressable
                  testID="clear-checked"
                  accessibilityRole="button"
                  onPress={() => confirm('Clear the cart?', `Remove the ${inCart.length} checked items from the list?`, 'Clear', () => void actions.clearChecked())}
                >
                  <Text style={{ color: t.danger, fontWeight: '700' }}>Clear</Text>
                </Pressable>
              )}
            </View>
          )}
          renderSectionFooter={({ section }) =>
            section.key === 'to-buy' && section.data.length === 0 ? (
              <Muted testID="list-empty" style={{ paddingVertical: space.sm }}>
                {inCart.length > 0 ? 'Everything is in the cart.' : 'Nothing on the list yet. Type above or scan a barcode.'}
              </Muted>
            ) : null
          }
          renderItem={({ item }) => <ItemRow item={item} names={names} me={user?.id ?? null} onToggle={toggle} onEdit={setEditing} />}
          ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        />
      </KeyboardAvoidingView>

      {editing && (
        <ItemEditor
          key={editing.id}
          item={editing}
          onClose={() => setEditing(null)}
          onSave={(fields) => {
            void actions.edit(editing, fields)
            setEditing(null)
          }}
          onDelete={() => {
            void actions.remove(editing)
            setEditing(null)
          }}
        />
      )}
    </>
  )
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.md, maxWidth: 720, width: '100%', alignSelf: 'center', paddingBottom: space.xl * 3 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
  addBar: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  iconButton: { width: 48, height: 48, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.md, marginBottom: space.sm },
  sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
})
