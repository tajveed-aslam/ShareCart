import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { applyItemChange, toggledLocally, type ItemChange } from '../lib/items'
import { errorMessage, supabase } from '../lib/supabase'
import type { Item, List, Member } from '../lib/types'
import * as api from './mutations'

export type Connection = 'connecting' | 'live' | 'offline'

interface Snapshot {
  listId: string
  list: List
  members: Member[]
  items: Item[]
}

type Status = 'loading' | 'ready' | 'not-found' | 'removed' | 'deleted' | 'error'

type SnapshotResult = { kind: 'ok'; snapshot: Snapshot } | { kind: 'not-found' } | { kind: 'error'; message: string }

async function fetchSnapshot(listId: string): Promise<SnapshotResult> {
  const [list, members, items] = await Promise.all([
    supabase.from('lists').select(api.LIST_COLUMNS).eq('id', listId).maybeSingle(),
    supabase.from('list_members').select('list_id, user_id, role, joined_at, profile:profiles(id, display_name)').eq('list_id', listId),
    supabase.from('items').select(api.ITEM_COLUMNS).eq('list_id', listId),
  ])
  const error = list.error ?? members.error ?? items.error
  if (error) return { kind: 'error', message: errorMessage(error, "Couldn't load this list.") }
  if (!list.data) return { kind: 'not-found' }
  return {
    kind: 'ok',
    snapshot: { listId, list: list.data, members: (members.data ?? []) as unknown as Member[], items: (items.data ?? []) as Item[] },
  }
}

/**
 * One list, its members and items, synced in real time over a single Supabase channel:
 * - postgres_changes for items, the list row and memberships (RLS means only members receive them);
 * - presence, so members can see who else has the list open right now.
 * Edits are applied optimistically and reconciled by applyItemChange when the server's row (or its echo) arrives.
 * After any reconnect the list is refetched, so nothing missed while offline is lost.
 *
 * `live: false` loads once without a channel. Screens stacked on top of the list (share) use it: a second channel
 * on the same topic would be torn down with them and take the list screen's subscription along.
 */
export function useList(listId: string, me: { id: string; name: string } | null, { live = true } = {}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [terminal, setTerminal] = useState<{ listId: string; status: Status; message?: string } | null>(null)
  const [connection, setConnection] = useState<Connection>('connecting')
  const [online, setOnline] = useState<string[]>([])
  const [actionError, setActionError] = useState<string | null>(null)
  const meId = me?.id ?? null
  const meName = me?.name ?? ''
  const loadSeq = useRef(0)

  const apply = useCallback(
    (seq: number, result: SnapshotResult) => {
      if (seq !== loadSeq.current) return // a newer load started; let it win
      if (result.kind === 'ok') {
        setTerminal(null)
        setSnapshot(result.snapshot)
      } else setTerminal({ listId, status: result.kind, message: result.kind === 'error' ? result.message : undefined })
    },
    [listId],
  )

  const load = useCallback(async () => {
    const seq = ++loadSeq.current
    apply(seq, await fetchSnapshot(listId))
  }, [listId, apply])

  const patchItems = useCallback(
    (fn: (items: Item[]) => Item[]) => setSnapshot((s) => (s && s.listId === listId ? { ...s, items: fn(s.items) } : s)),
    [listId],
  )

  useEffect(() => {
    if (!meId) return
    const seq = ++loadSeq.current
    void (async () => apply(seq, await fetchSnapshot(listId)))()
    if (!live) return

    const onItem = (payload: RealtimePostgresChangesPayload<Item>) => patchItems((items) => applyItemChange(items, payload as unknown as ItemChange, listId))

    const channel = supabase
      .channel(`list:${listId}`, { config: { presence: { key: meId } } })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'items', filter: `list_id=eq.${listId}` }, onItem)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'items', filter: `list_id=eq.${listId}` }, onItem)
      // Under RLS a DELETE payload carries only the primary key, so it can't be filtered by list_id server-side.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'items' }, onItem)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lists', filter: `id=eq.${listId}` }, (p) =>
        setSnapshot((s) => (s && s.listId === listId ? { ...s, list: { ...s.list, ...(p.new as List) } } : s)),
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'lists' }, (p) => {
        if ((p.old as Partial<List>).id === listId) setTerminal({ listId, status: 'deleted' })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'list_members', filter: `list_id=eq.${listId}` }, () => void load())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'list_members' }, (p) => {
        const old = p.old as Partial<Member>
        if (old.list_id !== listId) return
        if (old.user_id === meId) setTerminal({ listId, status: 'removed' })
        else void load()
      })
      .on('presence', { event: 'sync' }, () => setOnline(Object.keys(channel.presenceState())))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnection('live')
          void channel.track({ name: meName, at: new Date().toISOString() })
          void load() // catch anything that changed while (re)connecting
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConnection('offline')
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [listId, meId, meName, live, load, apply, patchItems])

  const run = useCallback(async <T,>(action: () => Promise<T>, rollback?: () => void): Promise<T | undefined> => {
    setActionError(null)
    try {
      return await action()
    } catch (e) {
      rollback?.()
      setActionError(errorMessage(e))
      return undefined
    }
  }, [])

  const upsertLocal = useCallback(
    (row: Item) => patchItems((items) => applyItemChange(items, { eventType: 'UPDATE', new: row }, listId)),
    [listId, patchItems],
  )

  const actions = useMemo(
    () => ({
      add: async (fields: { name: string; quantity: string | null; barcode: string | null }) => {
        if (!meId) return
        const draft = api.draftItem(listId, meId, fields)
        patchItems((items) => [...items, draft])
        const saved = await run(
          () => api.insertItem(draft),
          () => patchItems((items) => items.filter((i) => i.id !== draft.id)),
        )
        if (saved) upsertLocal(saved)
      },
      toggle: async (item: Item) => {
        if (!meId) return
        const optimistic = toggledLocally(item, meId)
        patchItems((items) => items.map((i) => (i.id === item.id ? optimistic : i)))
        const saved = await run(
          () => api.setItemChecked(item.id, optimistic.checked),
          () => patchItems((items) => items.map((i) => (i.id === item.id ? item : i))),
        )
        if (saved) upsertLocal(saved)
      },
      edit: async (item: Item, fields: { name: string; quantity: string | null }) => {
        patchItems((items) => items.map((i) => (i.id === item.id ? { ...i, ...fields } : i)))
        const saved = await run(
          () => api.updateItem(item.id, fields),
          () => patchItems((items) => items.map((i) => (i.id === item.id ? item : i))),
        )
        if (saved) upsertLocal(saved)
      },
      remove: async (item: Item) => {
        patchItems((items) => items.filter((i) => i.id !== item.id))
        await run(
          () => api.deleteItem(item.id),
          () => patchItems((items) => [...items, item]),
        )
      },
      clearChecked: async () => {
        let removed: Item[] = []
        patchItems((items) => {
          removed = items.filter((i) => i.checked)
          return items.filter((i) => !i.checked)
        })
        await run(
          () => api.clearChecked(listId),
          () => patchItems((items) => [...items, ...removed]),
        )
      },
      rename: (name: string) => run(() => api.renameList(listId, name)).then(() => load()),
      removeMember: (userId: string) => run(() => api.removeMember(listId, userId)).then(() => load()),
      dismissError: () => setActionError(null),
    }),
    [listId, meId, patchItems, run, upsertLocal, load],
  )

  const current = snapshot && snapshot.listId === listId ? snapshot : null
  const status: Status = terminal && terminal.listId === listId ? terminal.status : current ? 'ready' : 'loading'
  return {
    status,
    loadError: terminal?.listId === listId ? (terminal.message ?? null) : null,
    list: current?.list ?? null,
    members: current?.members ?? [],
    items: current?.items ?? [],
    connection,
    online,
    actionError,
    actions,
    reload: load,
  }
}
