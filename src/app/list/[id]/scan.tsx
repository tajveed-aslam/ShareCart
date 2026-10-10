import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import { router, useLocalSearchParams } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { Image, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useAuth } from '@/auth/AuthProvider'
import { Button, Card, Field, Loading, Muted, Notice } from '@/components/ui'
import { draftItem, insertItem } from '@/data/mutations'
import { cleanBarcode, lookupProduct, PRODUCT_BARCODE_TYPES, productTitle, type Product } from '@/lib/barcode'
import { errorMessage, supabase } from '@/lib/supabase'
import { radius, space, useTheme } from '@/theme'

type Found =
  | { state: 'looking'; barcode: string }
  | { state: 'ready'; barcode: string; product: Product | null; lookupFailed: boolean; duplicateOf: string | null }

export default function ScanScreen() {
  const t = useTheme()
  const { id: listId } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()
  const [permission, requestPermission] = useCameraPermissions()
  const [found, setFound] = useState<Found | null>(null)
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [manual, setManual] = useState('')
  const [manualError, setManualError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState<string[]>([])
  // The camera fires many events per second; only the first good read until the user decides counts.
  const handling = useRef(false)

  const handleCode = useCallback(
    async (raw: string) => {
      const barcode = cleanBarcode(raw)
      if (!barcode || handling.current) return false
      handling.current = true
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setError(null)
      setFound({ state: 'looking', barcode })
      const [lookup, dup] = await Promise.all([
        lookupProduct(barcode),
        supabase.from('items').select('name').eq('list_id', listId).eq('barcode', barcode).eq('checked', false).limit(1),
      ])
      const product = lookup.kind === 'found' ? lookup.product : null
      setName(product ? productTitle(product) : '')
      setQuantity(product?.size ?? '')
      setFound({ state: 'ready', barcode, product, lookupFailed: lookup.kind === 'error', duplicateOf: dup.data?.[0]?.name ?? null })
      return true
    },
    [listId],
  )

  const onScanned = (result: BarcodeScanningResult) => void handleCode(result.data)

  const submitManual = async () => {
    if (!cleanBarcode(manual)) {
      setManualError("That doesn't look like a valid product barcode. Check the digits.")
      return
    }
    setManualError(null)
    setManual('')
    await handleCode(manual)
  }

  const scanAgain = () => {
    setFound(null)
    setName('')
    setQuantity('')
    setError(null)
    handling.current = false
  }

  const add = async () => {
    if (!user || found?.state !== 'ready' || !name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await insertItem(draftItem(listId, user.id, { name, quantity: quantity || null, barcode: found.barcode }))
      setAdded((a) => [...a, name.trim()])
      scanAgain()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const cameraBlock = (() => {
    if (!permission) return <Loading />
    if (!permission.granted) {
      return (
        <Card testID="camera-permission">
          <Muted>ShareCart needs the camera to read barcodes. The picture never leaves your phone; only the number is used.</Muted>
          {permission.canAskAgain ? (
            <Button label="Allow camera" onPress={() => void requestPermission()} testID="camera-allow" />
          ) : (
            <Button label="Open settings" variant="ghost" onPress={() => void Linking.openSettings()} testID="camera-settings" />
          )}
        </Card>
      )
    }
    return (
      <View style={[styles.cameraWrap, { borderColor: t.border }]}>
        <CameraView
          testID="camera"
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: [...PRODUCT_BARCODE_TYPES] }}
          onBarcodeScanned={found ? undefined : onScanned}
        />
        <View pointerEvents="none" style={styles.reticleWrap}>
          <View style={[styles.reticle, { borderColor: found ? t.primary : '#ffffff' }]} />
          <Text style={styles.hint}>{found ? 'Got it' : 'Point at a barcode'}</Text>
        </View>
      </View>
    )
  })()

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" testID="screen-scan">
        {cameraBlock}

        {found?.state === 'looking' && <Loading label={`Looking up ${found.barcode}…`} />}

        {found?.state === 'ready' && (
          <Card testID="scan-result">
            <View style={styles.productLine}>
              {found.product?.imageUrl && <Image source={{ uri: found.product.imageUrl }} style={styles.thumb} accessibilityIgnoresInvertColors />}
              <View style={{ flex: 1 }}>
                <Text testID="scan-barcode" style={{ color: t.muted, fontSize: 12 }}>
                  Barcode {found.barcode}
                </Text>
                <Text style={{ color: t.text, fontWeight: '700', fontSize: 16 }}>
                  {found.product ? 'Found on Open Food Facts' : found.lookupFailed ? "Couldn't look this up right now" : 'Not in the product database'}
                </Text>
              </View>
            </View>
            {found.duplicateOf && <Notice tone="warn" testID="scan-duplicate">{found.duplicateOf} with this barcode is already on the list.</Notice>}
            <Field label="Item" testID="scan-name" value={name} onChangeText={setName} placeholder="What is it?" maxLength={120} />
            <Field label="Quantity" testID="scan-quantity" value={quantity} onChangeText={setQuantity} placeholder="Optional" maxLength={30} />
            {error && <Notice tone="error">{error}</Notice>}
            <View style={styles.actions}>
              <View style={{ flex: 1 }}>
                <Button label="Rescan" variant="ghost" onPress={scanAgain} testID="scan-again" />
              </View>
              <View style={{ flex: 2 }}>
                <Button label={found.duplicateOf ? 'Add anyway' : 'Add to list'} disabled={!name.trim()} loading={saving} onPress={add} testID="scan-add" />
              </View>
            </View>
          </Card>
        )}

        {added.length > 0 && (
          <Notice testID="scan-added">
            Added {added.join(', ')}. Scan another, or tap Done.
          </Notice>
        )}

        <Card>
          <Muted>No camera, or a smudged label? Type the number under the barcode.</Muted>
          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <Field
                testID="manual-barcode"
                value={manual}
                onChangeText={setManual}
                placeholder="e.g. 3017624010701"
                keyboardType="number-pad"
                maxLength={20}
                onSubmitEditing={submitManual}
              />
            </View>
            <Button label="Look up" variant="ghost" disabled={!manual.trim() || !!found} onPress={() => void submitManual()} testID="manual-lookup" />
          </View>
          {manualError && <Notice tone="error" testID="manual-error">{manualError}</Notice>}
        </Card>

        <Button label="Done" variant="ghost" onPress={() => router.back()} testID="scan-done" />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.md, maxWidth: 720, width: '100%', alignSelf: 'center', paddingBottom: space.xl * 2 },
  cameraWrap: { height: 300, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, backgroundColor: '#000' },
  reticleWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  reticle: { width: '78%', height: 120, borderWidth: 3, borderRadius: radius.md },
  hint: { color: '#fff', fontWeight: '700', textShadowColor: '#000', textShadowRadius: 4 },
  productLine: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: '#fff' },
  actions: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
})
