import { useState } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import type { Item } from '../lib/types'
import { radius, space, useTheme } from '../theme'
import { Button, Field, Muted } from './ui'

/** Bottom sheet to rename an item, change its quantity or delete it. Keyed by item id by the caller. */
export function ItemEditor({
  item,
  onClose,
  onSave,
  onDelete,
}: {
  item: Item
  onClose: () => void
  onSave: (fields: { name: string; quantity: string | null }) => void
  onDelete: () => void
}) {
  const t = useTheme()
  const [name, setName] = useState(item.name)
  const [quantity, setQuantity] = useState(item.quantity ?? '')

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap}>
        <View testID="item-editor" style={[styles.sheet, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={{ color: t.text, fontSize: 18, fontWeight: '800' }}>Edit item</Text>
          <Field label="Item" testID="editor-name" value={name} onChangeText={setName} maxLength={120} />
          <Field label="Quantity" testID="editor-quantity" value={quantity} onChangeText={setQuantity} placeholder="e.g. 2, 1 kg" maxLength={30} />
          {item.barcode && <Muted>Barcode {item.barcode}</Muted>}
          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <Button label="Delete" variant="danger" onPress={onDelete} testID="editor-delete" />
            </View>
            <View style={{ flex: 2 }}>
              <Button
                label="Save"
                disabled={!name.trim()}
                onPress={() => onSave({ name: name.trim(), quantity: quantity.trim() || null })}
                testID="editor-save"
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    padding: space.lg,
    paddingBottom: space.xl * 1.5,
    gap: space.md,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
})
