import { randomUUID } from 'expo-crypto'
import { supabase } from '../lib/supabase'
import type { InvitePreview, Item, List } from '../lib/types'

/**
 * Writes to Supabase. Who added/checked an item and the timestamps are set by database triggers from the caller's
 * session, so the client never sends them. Each function throws the PostgREST error; callers turn it into a message.
 */

const ITEM_COLUMNS = 'id, list_id, name, quantity, barcode, checked, added_by, checked_by, checked_at, created_at, updated_at'
export const LIST_COLUMNS = 'id, name, owner_id, invite_code, created_at, updated_at'

export async function createList(name: string): Promise<List> {
  const { data, error } = await supabase.from('lists').insert({ name: name.trim() }).select(LIST_COLUMNS).single()
  if (error) throw error
  return data
}

export async function createListWithItems(name: string, items: { name: string; quantity: string | null; barcode?: string }[]) {
  const list = await createList(name)
  const { error } = await supabase.from('items').insert(items.map((i) => ({ ...i, list_id: list.id })))
  if (error) throw error
  return list
}

export async function renameList(listId: string, name: string) {
  const { error } = await supabase.from('lists').update({ name: name.trim() }).eq('id', listId)
  if (error) throw error
}

export async function deleteList(listId: string) {
  const { error } = await supabase.from('lists').delete().eq('id', listId)
  if (error) throw error
}

export async function leaveList(listId: string, userId: string) {
  const { error } = await supabase.from('list_members').delete().eq('list_id', listId).eq('user_id', userId)
  if (error) throw error
}

export const removeMember = leaveList

/** A new item with a client-generated id, so the optimistic copy and the realtime echo share one id. */
export function draftItem(listId: string, userId: string, fields: { name: string; quantity: string | null; barcode: string | null }): Item {
  const now = new Date().toISOString()
  return {
    id: randomUUID(),
    list_id: listId,
    name: fields.name.trim(),
    quantity: fields.quantity?.trim() || null,
    barcode: fields.barcode,
    checked: false,
    added_by: userId,
    checked_by: null,
    checked_at: null,
    created_at: now,
    // The epoch, not `now`: the server's copy must always win in applyItemChange, even if this device's clock
    // runs ahead of the database's.
    updated_at: new Date(0).toISOString(),
  }
}

export async function insertItem(item: Item): Promise<Item> {
  const { id, list_id, name, quantity, barcode } = item
  const { data, error } = await supabase.from('items').insert({ id, list_id, name, quantity, barcode }).select(ITEM_COLUMNS).single()
  if (error) throw error
  return data
}

export async function setItemChecked(itemId: string, checked: boolean): Promise<Item> {
  const { data, error } = await supabase.from('items').update({ checked }).eq('id', itemId).select(ITEM_COLUMNS).single()
  if (error) throw error
  return data
}

export async function updateItem(itemId: string, fields: { name: string; quantity: string | null }): Promise<Item> {
  const { data, error } = await supabase
    .from('items')
    .update({ name: fields.name.trim(), quantity: fields.quantity?.trim() || null })
    .eq('id', itemId)
    .select(ITEM_COLUMNS)
    .single()
  if (error) throw error
  return data
}

export async function deleteItem(itemId: string) {
  const { error } = await supabase.from('items').delete().eq('id', itemId)
  if (error) throw error
}

export async function clearChecked(listId: string) {
  const { error } = await supabase.from('items').delete().eq('list_id', listId).eq('checked', true)
  if (error) throw error
}

export async function invitePreview(code: string): Promise<InvitePreview | null> {
  const { data, error } = await supabase.rpc('invite_preview', { p_code: code })
  if (error) throw error
  const row = (data as InvitePreview[] | null)?.[0]
  return row ? { ...row, member_count: Number(row.member_count) } : null
}

export async function joinList(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_list', { p_code: code })
  if (error) throw error
  return data as string
}

export async function regenerateInviteCode(listId: string): Promise<string> {
  const { data, error } = await supabase.rpc('regenerate_invite_code', { p_list_id: listId })
  if (error) throw error
  return data as string
}

export { ITEM_COLUMNS }
