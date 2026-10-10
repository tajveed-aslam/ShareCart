import { createList, itemId, resetApp, signInAsGuest, tap, tapDialogButton, textOf, type, waitForTestId } from '../helpers.ts'

/**
 * The camera itself can't be pointed at a product from a test, so the scan flow is driven through the manual barcode
 * field, which goes through the same validation, Open Food Facts lookup and add path as a camera read.
 */
describe('Barcode scanning', () => {
  before(async () => {
    await resetApp() // camera not granted: the permission prompt is part of the flow
    await signInAsGuest('Scanner')
    await createList('Scanned shop')
  })

  it('asks for camera permission and shows the camera once allowed', async () => {
    await tap('open-scanner')
    await waitForTestId('camera-permission')
    await tap('camera-allow')
    await tapDialogButton('(?i)(while using the app|only this time|allow)')
    await waitForTestId('camera', 15_000)
  })

  it('rejects a misread barcode (bad check digit)', async () => {
    await type('manual-barcode', '3017624010702')
    await tap('manual-lookup')
    await waitForTestId('manual-error')
  })

  it('looks a product up on Open Food Facts and adds it with its barcode', async () => {
    await type('manual-barcode', '3017624010701')
    await tap('manual-lookup')
    await waitForTestId('scan-result', 20_000)
    expect(await textOf('scan-barcode')).toMatch(/3017624010701/)
    expect(await textOf('scan-name')).toMatch(/Nutella/i)
    await tap('scan-add')
    await waitForTestId('scan-added')
  })

  it('flags a barcode that is already on the list', async () => {
    await type('manual-barcode', '3017624010701')
    await tap('manual-lookup')
    await waitForTestId('scan-duplicate', 20_000)
    await tap('scan-again')
  })

  it('lets an unknown product be named by hand', async () => {
    await type('manual-barcode', '4006381333931') // valid EAN-13, may or may not be in the database
    await tap('manual-lookup')
    await waitForTestId('scan-result', 20_000)
    await type('scan-name', 'Highlighter pen')
    await tap('scan-add')
    await waitForTestId('scan-added')
  })

  it('shows scanned items on the list', async () => {
    await tap('scan-done')
    await waitForTestId(itemId('Highlighter pen'), 20_000)
    const nutella = await $('android=new UiSelector().resourceIdMatches("item-.*nutella.*")')
    await nutella.waitForDisplayed()
  })
})
