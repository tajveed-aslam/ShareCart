import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage, supabase } from '../lib/supabase'
import type { ListSummary } from '../lib/types'
import { LIST_COLUMNS } from './mutations'

type Row = Omit<ListSummary, 'total' | 'remaining' | 'memberCount'> & {
  items: { checked: boolean }[]
  list_members: { count: number }[]
}

/**
 * The signed-in user's lists with item counts, kept fresh in real time: any change to an item, list or membership
 * the user can see (RLS decides) triggers a debounced refetch, which is simpler and safer than patching counts.
 */
export function useLists(userId: string | null) {
  const [loaded, setLoaded] = useState<{ userId: string; lists: ListSummary[] } | null>(null)
  const [failed, setFailed] = useState<{ userId: string; message: string } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('lists')
      .select(`${LIST_COLUMNS}, items(checked), list_members(count)`)
      .order('created_at', { ascending: false })
    if (error) {
      setFailed({ userId, message: errorMessage(error, "Couldn't load your lists.") })
      return
    }
    setFailed(null)
    setLoaded({
      userId,
      lists: (data as unknown as Row[]).map(({ items, list_members, ...list }) => ({
        ...list,
        total: items.length,
        remaining: items.filter((i) => !i.checked).length,
        memberCount: list_members[0]?.count ?? 1,
      })),
    })
  }, [userId])

  const scheduleLoad = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void load(), 300)
  }, [load])

  // Refetch whenever the screen comes back into view (e.g. after leaving a list).
  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`lists-overview:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, scheduleLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lists' }, scheduleLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'list_members', filter: `user_id=eq.${userId}` }, scheduleLoad)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'list_members' }, scheduleLoad)
      // Refetch once the database listener is attached (also after reconnects), so nothing in between is missed.
      .on('system', {}, (p: { extension?: string; status?: string }) => {
        if (p.extension === 'postgres_changes' && p.status === 'ok') scheduleLoad()
      })
      .subscribe()
    return () => {
      if (timer.current) clearTimeout(timer.current)
      void supabase.removeChannel(channel)
    }
  }, [userId, scheduleLoad])

  const lists = loaded && loaded.userId === userId ? loaded.lists : null
  const error = failed && failed.userId === userId ? failed.message : null
  return { lists, error, loading: !lists && !error, refresh: load }
}
