import { addItem, byTestId, createList, isChecked, itemId, relaunchApp, resetApp, signInAsGuest, tap, tapDialogButton, textOf, type, waitForTestId } from '../helpers.ts'

describe('Adding and checking off items', () => {
  before(async () => {
    await resetApp()
    await signInAsGuest('Shopper')
    await createList('E2E groceries')
  })

  it('starts empty', async () => {
    await waitForTestId('list-empty')
  })

  it('adds a typed item and splits out the quantity', async () => {
    await addItem('2 milk')
    await waitForTestId(itemId('milk'))
    expect(await textOf(`${itemId('milk')}-qty`)).toBe('2')
    expect(await textOf(`${itemId('milk')}-added-by`)).toMatch(/^Added by You · just now/)
    expect(await textOf('section-to-buy')).toMatch(/TO BUY · 1/)
  })

  it('warns before adding the same item twice', async () => {
    await addItem('Milk')
    await tapDialogButton('(?i)cancel')
    expect(await textOf('section-to-buy')).toMatch(/TO BUY · 1/)
  })

  it('checks an item off, moves it to the cart and shows who got it', async () => {
    await addItem('Bread')
    await waitForTestId(itemId('Bread'))
    await tap(`${itemId('milk')}-check`)
    await waitForTestId(`${itemId('milk')}-checked-by`)
    expect(await isChecked(`${itemId('milk')}-check`)).toBe(true)
    expect(await textOf(`${itemId('milk')}-checked-by`)).toMatch(/^Got by You/)
    expect(await textOf('section-in-cart')).toMatch(/IN THE CART · 1/)
    expect(await textOf('section-to-buy')).toMatch(/TO BUY · 1/)
  })

  it('unchecks an item back onto the list', async () => {
    await tap(`${itemId('milk')}-check`)
    expect(await isChecked(`${itemId('milk')}-check`)).toBe(false)
    expect(await byTestId(`${itemId('milk')}-checked-by`).isExisting()).toBe(false)
  })

  it('edits an item', async () => {
    await tap(`${itemId('Bread')}-edit`)
    await waitForTestId('item-editor')
    await type('editor-name', 'Brown bread')
    await type('editor-quantity', '1 loaf')
    await tap('editor-save')
    await waitForTestId(itemId('Brown bread'))
    expect(await textOf(`${itemId('Brown bread')}-qty`)).toBe('1 loaf')
  })

  it('keeps everything after a restart (it lives in Supabase, not on the phone)', async () => {
    await relaunchApp()
    await tap('list-row-E2E groceries')
    await waitForTestId(itemId('milk'))
    await waitForTestId(itemId('Brown bread'))
  })

  it('deletes an item and clears the cart', async () => {
    await tap(`${itemId('Brown bread')}-edit`)
    await tap('editor-delete')
    await byTestId(itemId('Brown bread')).waitForExist({ reverse: true })
    await tap(`${itemId('milk')}-check`)
    await tap('clear-checked')
    await tapDialogButton('(?i)clear')
    await byTestId(itemId('milk')).waitForExist({ reverse: true })
    await waitForTestId('list-empty')
  })
})
