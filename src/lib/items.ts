import type { Item } from './types'

/** A Supabase realtime postgres_changes payload, reduced to what the reducer needs. */
export type ItemChange =
  | { eventType: 'INSERT'; new: Item }
  | { eventType: 'UPDATE'; new: Item }
  | { eventType: 'DELETE'; old: Partial<Item> & { id?: string } }

/**
 * Applies one realtime change to the local items of a list. Idempotent and order-tolerant:
 * - an INSERT for an item we already have (our own optimistic add, echoed back) just takes the server's row;
 * - an UPDATE older than what we hold (e.g. it arrives after a newer one, or after our fetch) is ignored;
 * - DELETE events carry only the primary key under RLS, so they're matched by id.
 */
export function applyItemChange(items: Item[], change: ItemChange, listId: string): Item[] {
  if (change.eventType === 'DELETE') {
    const id = change.old.id
    return id && items.some((i) => i.id === id) ? items.filter((i) => i.id !== id) : items
  }
  const row = change.new
  if (row.list_id !== listId) return items
  const index = items.findIndex((i) => i.id === row.id)
  if (index === -1) return [...items, row]
  if (Date.parse(row.updated_at) < Date.parse(items[index].updated_at)) return items
  const next = items.slice()
  next[index] = row
  return next
}

/** To buy first, in the order they were added; then what's in the cart, most recently checked first. */
export function sortItems(items: Item[]): { toBuy: Item[]; inCart: Item[] } {
  const toBuy = items.filter((i) => !i.checked).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
  const inCart = items
    .filter((i) => i.checked)
    .sort((a, b) => (b.checked_at ?? b.updated_at).localeCompare(a.checked_at ?? a.updated_at) || a.id.localeCompare(b.id))
  return { toBuy, inCart }
}

const normalizeName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ')

/** An item still to buy with the same barcode or name, so adding it twice can be flagged instead. */
export function findDuplicate(items: Item[], name: string, barcode: string | null): Item | null {
  const n = normalizeName(name)
  return items.find((i) => !i.checked && ((barcode && i.barcode === barcode) || normalizeName(i.name) === n)) ?? null
}

/** "bread" → "Bread". Names whose first word already has capitals ("iPhone charger", "eBay voucher") stay as typed. */
const capitalize = (name: string) => (/^[a-z]+$/.test(name.split(' ')[0]) ? name.charAt(0).toUpperCase() + name.slice(1) : name)

/** Splits "2 milk", "milk x2" or "3kg rice" into a name and quantity; plain text is just a name. */
export function parseItemInput(input: string): { name: string; quantity: string | null } {
  const text = input.trim().replace(/\s+/g, ' ')
  const leading = text.match(/^(\d+(?:[.,]\d+)?\s?(?:x|kg|g|l|ml|pcs|pack|packs|dozen)?)\s+(.+)$/i)
  if (leading) return { name: capitalize(leading[2]), quantity: leading[1].replace(/\s?x$/i, '') }
  const trailing = text.match(/^(.+?)\s+(?:x\s?(\d+)|(\d+)\s?x)$/i)
  if (trailing) return { name: capitalize(trailing[1]), quantity: trailing[2] ?? trailing[3] }
  return { name: capitalize(text), quantity: null }
}

/**
 * Optimistically flips an item; the server stamps checked_by/checked_at, the local copy just guesses. updated_at is
 * left alone so the server's row, whatever its clock says, replaces this guess.
 */
export function toggledLocally(item: Item, userId: string, now = new Date()): Item {
  const checked = !item.checked
  return {
    ...item,
    checked,
    checked_by: checked ? userId : null,
    checked_at: checked ? now.toISOString() : null,
  }
}
