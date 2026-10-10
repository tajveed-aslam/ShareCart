import { applyItemChange, findDuplicate, parseItemInput, sortItems, toggledLocally } from '../items'
import type { Item } from '../types'

const LIST = 'list-1'
function item(id: string, over: Partial<Item> = {}): Item {
  return {
    id,
    list_id: LIST,
    name: `Item ${id}`,
    quantity: null,
    barcode: null,
    checked: false,
    added_by: 'u1',
    checked_by: null,
    checked_at: null,
    created_at: '2026-10-10T10:00:00.000Z',
    updated_at: '2026-10-10T10:00:00.000Z',
    ...over,
  }
}

describe('applyItemChange', () => {
  it('adds an item inserted by someone else', () => {
    const next = applyItemChange([item('a')], { eventType: 'INSERT', new: item('b') }, LIST)
    expect(next.map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('treats the echo of our own optimistic insert as a replacement, not a duplicate', () => {
    const optimistic = item('a', { added_by: 'me' })
    const fromServer = item('a', { added_by: 'me', updated_at: '2026-10-10T10:00:01.000Z' })
    const next = applyItemChange([optimistic], { eventType: 'INSERT', new: fromServer }, LIST)
    expect(next).toEqual([fromServer])
  })

  it('applies a newer update and ignores an older one that arrives late', () => {
    const current = item('a', { checked: true, checked_by: 'u2', updated_at: '2026-10-10T10:05:00.000Z' })
    const stale = item('a', { checked: false, updated_at: '2026-10-10T10:01:00.000Z' })
    expect(applyItemChange([current], { eventType: 'UPDATE', new: stale }, LIST)).toEqual([current])
    const newer = item('a', { checked: false, updated_at: '2026-10-10T10:06:00.000Z' })
    expect(applyItemChange([current], { eventType: 'UPDATE', new: newer }, LIST)).toEqual([newer])
  })

  it('removes deleted items by id (RLS delete payloads carry only the key)', () => {
    const items = [item('a'), item('b')]
    expect(applyItemChange(items, { eventType: 'DELETE', old: { id: 'a' } }, LIST).map((i) => i.id)).toEqual(['b'])
  })

  it('ignores changes for other lists and deletes of unknown ids', () => {
    const items = [item('a')]
    expect(applyItemChange(items, { eventType: 'INSERT', new: item('x', { list_id: 'other' }) }, LIST)).toBe(items)
    expect(applyItemChange(items, { eventType: 'DELETE', old: { id: 'zzz' } }, LIST)).toBe(items)
    expect(applyItemChange(items, { eventType: 'DELETE', old: {} }, LIST)).toBe(items)
  })
})

describe('sortItems', () => {
  it('lists items to buy in the order added, then the cart with the latest checked first', () => {
    const items = [
      item('late', { created_at: '2026-10-10T12:00:00.000Z' }),
      item('early', { created_at: '2026-10-10T08:00:00.000Z' }),
      item('cart-old', { checked: true, checked_at: '2026-10-10T09:00:00.000Z' }),
      item('cart-new', { checked: true, checked_at: '2026-10-10T11:00:00.000Z' }),
    ]
    const { toBuy, inCart } = sortItems(items)
    expect(toBuy.map((i) => i.id)).toEqual(['early', 'late'])
    expect(inCart.map((i) => i.id)).toEqual(['cart-new', 'cart-old'])
  })
})

describe('findDuplicate', () => {
  const items = [item('milk', { name: 'Milk' }), item('nutella', { name: 'Nutella', barcode: '3017624010701' }), item('bread', { name: 'Bread', checked: true })]

  it('matches by barcode or by name, ignoring case and spacing', () => {
    expect(findDuplicate(items, 'Chocolate spread', '3017624010701')?.id).toBe('nutella')
    expect(findDuplicate(items, '  milk ', null)?.id).toBe('milk')
  })

  it("doesn't flag items already in the cart, or new things", () => {
    expect(findDuplicate(items, 'bread', null)).toBeNull()
    expect(findDuplicate(items, 'Eggs', null)).toBeNull()
  })
})

describe('parseItemInput', () => {
  it.each([
    ['Milk', 'Milk', null],
    ['2 milk', 'milk', '2'],
    ['3kg rice', 'rice', '3kg'],
    ['500 g flour', 'flour', '500 g'],
    ['2x eggs', 'eggs', '2'],
    ['eggs x 12', 'eggs', '12'],
    ['eggs 6x', 'eggs', '6'],
    ['  oat   milk  ', 'oat milk', null],
  ])('%s', (input, name, quantity) => {
    expect(parseItemInput(input)).toEqual({ name, quantity })
  })
})

describe('toggledLocally', () => {
  it('stamps the local user when checking, and clears it when unchecking', () => {
    const now = new Date('2026-10-10T10:00:00.000Z')
    const checked = toggledLocally(item('a'), 'me', now)
    expect(checked).toMatchObject({ checked: true, checked_by: 'me', checked_at: now.toISOString() })
    expect(toggledLocally(checked, 'me')).toMatchObject({ checked: false, checked_by: null, checked_at: null })
  })
})
