import { Ionicons } from '@expo/vector-icons'
import { memo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { personName, timeAgo } from '../lib/format'
import type { Item } from '../lib/types'
import { radius, space, useTheme } from '../theme'

/** testIDs use the item name so E2E tests can find "Milk" without knowing its database id. */
export const itemTestId = (name: string) => `item-${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

function ItemRowImpl({
  item,
  names,
  me,
  onToggle,
  onEdit,
}: {
  item: Item
  names: Map<string, string>
  me: string | null
  onToggle: (item: Item) => void
  onEdit: (item: Item) => void
}) {
  const t = useTheme()
  const id = itemTestId(item.name)
  const added = `Added by ${personName(item.added_by, names, me)} · ${timeAgo(item.created_at)}`
  const checked = item.checked && item.checked_at ? `Got by ${personName(item.checked_by, names, me)} · ${timeAgo(item.checked_at)}` : null

  return (
    <View testID={id} style={[styles.row, { backgroundColor: t.surface, borderColor: t.border }]}>
      <Pressable
        testID={`${id}-check`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.checked }}
        accessibilityLabel={`${item.name}${item.quantity ? `, ${item.quantity}` : ''}`}
        onPress={() => onToggle(item)}
        hitSlop={6}
        style={[styles.box, { borderColor: item.checked ? t.primary : t.border, backgroundColor: item.checked ? t.primary : 'transparent' }]}
      >
        {item.checked && <Ionicons name="checkmark" size={18} color={t.primaryText} />}
      </Pressable>

      <Pressable
        testID={`${id}-edit`}
        accessibilityRole="button"
        accessibilityHint="Edit or delete this item"
        onPress={() => onEdit(item)}
        style={{ flex: 1, gap: 2 }}
      >
        <View style={styles.titleLine}>
          <Text
            style={[styles.name, { color: item.checked ? t.checked : t.text }, item.checked && styles.struck]}
            numberOfLines={2}
          >
            {item.name}
          </Text>
          {item.quantity && (
            <View style={[styles.qty, { backgroundColor: t.surface2 }]}>
              <Text testID={`${id}-qty`} style={{ color: t.muted, fontWeight: '700', fontSize: 12 }}>
                {item.quantity}
              </Text>
            </View>
          )}
          {item.barcode && <Ionicons name="barcode-outline" size={15} color={t.muted} accessibilityLabel="Scanned" />}
        </View>
        <Text testID={`${id}-added-by`} style={[styles.meta, { color: t.muted }]} numberOfLines={1}>
          {added}
        </Text>
        {checked && (
          <Text testID={`${id}-checked-by`} style={[styles.meta, { color: t.primary }]} numberOfLines={1}>
            {checked}
          </Text>
        )}
      </Pressable>
    </View>
  )
}

export const ItemRow = memo(ItemRowImpl)

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1 },
  box: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  struck: { textDecorationLine: 'line-through' },
  qty: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  meta: { fontSize: 12 },
})
