/**
 * Integration tests against a real Supabase project: the database rules (RLS, triggers, RPCs) and realtime, as
 * three separate users would hit them. Alice owns a list, Bob joins it with the invite code, Eve is an outsider.
 *
 * Needs EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (from .env) and anonymous sign-ins enabled.
 * Run: npm run test:integration
 */
import { createClient, type RealtimePostgresChangesPayload, type SupabaseClient } from '@supabase/supabase-js'
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const skip = !url || !key ? 'set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.example)' : false

interface Item {
  id: string
  list_id: string
  name: string
  checked: boolean
  added_by: string | null
  checked_by: string | null
}

async function user(name: string): Promise<{ db: SupabaseClient; id: string }> {
  const db = createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await db.auth.signInAnonymously({ options: { data: { display_name: name } } })
  assert.ifError(error)
  return { db, id: data.user!.id }
}

/**
 * Subscribes to item INSERTs on a list as `db`'s user. `wait` resolves with the first row matching `predicate` (and
 * when it arrived), or null if none arrives within `ms`.
 *
 * Ready means the server's `system` message "Subscribed to PostgreSQL", not the SUBSCRIBED status: SUBSCRIBED only
 * says the socket joined the channel, and on a cold project the database listener can attach seconds later.
 */
async function watchInserts(db: SupabaseClient, listId: string, predicate: (row: Item) => boolean, ms: number) {
  let settle!: (hit: { row: Item; at: number } | null) => void
  const wait = new Promise<{ row: Item; at: number } | null>((resolve) => (settle = resolve))
  let ready!: () => void
  let failed!: (e: Error) => void
  const listening = new Promise<void>((resolve, reject) => ((ready = resolve), (failed = reject)))
  const channel = db
    .channel(`test-${listId}-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'items', filter: `list_id=eq.${listId}` }, (p: RealtimePostgresChangesPayload<Item>) => {
      if (predicate(p.new as Item)) settle({ row: p.new as Item, at: Date.now() })
    })
    .on('system', {}, (p: { extension?: string; status?: string; message?: string }) => {
      if (p.extension !== 'postgres_changes') return
      if (p.status === 'ok') ready()
      else failed(new Error(`realtime: ${p.message}`))
    })
  channel.subscribe((status, err) => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') failed(err ?? new Error(status))
  })
  await Promise.race([listening, new Promise((_, reject) => setTimeout(() => reject(new Error('realtime never became ready')), 20_000))])
  const timer = setTimeout(() => settle(null), ms)
  return {
    wait,
    stop: async () => {
      clearTimeout(timer)
      await db.removeChannel(channel)
    },
  }
}

describe('ShareCart database rules and realtime', { skip }, () => {
  let alice: Awaited<ReturnType<typeof user>>
  let bob: Awaited<ReturnType<typeof user>>
  let eve: Awaited<ReturnType<typeof user>>
  let listId: string
  let code: string
  let itemId: string

  before(async () => {
    ;[alice, bob, eve] = await Promise.all([user('Alice'), user('Bob'), user('Eve')])
  })

  after(async () => {
    if (listId) await alice.db.from('lists').delete().eq('id', listId)
    for (const u of [alice, bob, eve]) {
      await u?.db.removeAllChannels()
      await u?.db.auth.signOut()
    }
  })

  it('creates a profile from the sign-up name', async () => {
    const { data } = await alice.db.from('profiles').select('display_name').eq('id', alice.id).single()
    assert.equal(data?.display_name, 'Alice')
  })

  it('lets a user create a list and makes them its owner', async () => {
    const { data, error } = await alice.db.from('lists').insert({ name: 'Integration test list' }).select('id, owner_id, invite_code').single()
    assert.ifError(error)
    listId = data.id
    code = data.invite_code
    assert.equal(data.owner_id, alice.id)
    assert.match(code, /^[2-9A-HJKMNP-Z]{8}$/)
    const { data: members } = await alice.db.from('list_members').select('user_id, role').eq('list_id', listId)
    assert.deepEqual(members, [{ user_id: alice.id, role: 'owner' }])
  })

  it('stamps added_by from the session, ignoring a spoofed value', async () => {
    const { data, error } = await alice.db
      .from('items')
      .insert({ list_id: listId, name: 'Milk', added_by: bob.id, checked_by: bob.id })
      .select('id, added_by, checked_by')
      .single()
    assert.ifError(error)
    itemId = data.id
    assert.equal(data.added_by, alice.id)
    assert.equal(data.checked_by, null)
  })

  it('hides the list from outsiders and rejects their writes', async () => {
    const lists = await eve.db.from('lists').select('id').eq('id', listId)
    assert.deepEqual(lists.data, [])
    const items = await eve.db.from('items').select('id').eq('list_id', listId)
    assert.deepEqual(items.data, [])
    const insert = await eve.db.from('items').insert({ list_id: listId, name: 'Sneaky' })
    assert.equal(insert.error?.code, '42501')
    const update = await eve.db.from('items').update({ name: 'Hacked' }).eq('id', itemId).select('id')
    assert.deepEqual(update.data, [])
    const del = await eve.db.from('items').delete().eq('id', itemId).select('id')
    assert.deepEqual(del.data, [])
    const { data: still } = await alice.db.from('items').select('name').eq('id', itemId).single()
    assert.equal(still?.name, 'Milk')
  })

  it("doesn't let outsiders read members' profiles", async () => {
    const { data } = await eve.db.from('profiles').select('id').eq('id', alice.id)
    assert.deepEqual(data, [])
  })

  it('previews and joins a list with its invite code (case and dash insensitive)', async () => {
    const typed = `${code.slice(0, 4)}-${code.slice(4)}`.toLowerCase()
    const { data: preview, error } = await bob.db.rpc('invite_preview', { p_code: typed })
    assert.ifError(error)
    assert.equal(preview[0].list_name, 'Integration test list')
    assert.equal(preview[0].owner_name, 'Alice')
    assert.equal(preview[0].already_member, false)
    const joined = await bob.db.rpc('join_list', { p_code: typed })
    assert.ifError(joined.error)
    assert.equal(joined.data, listId)
    const again = await bob.db.rpc('join_list', { p_code: code }) // idempotent
    assert.ifError(again.error)
  })

  it('rejects an unknown invite code', async () => {
    const { error } = await eve.db.rpc('join_list', { p_code: 'ZZZZZZZZ' })
    assert.equal(error?.code, 'P0002')
  })

  it('stamps checked_by with whoever checked the item, ignoring a spoofed value', async () => {
    const { data, error } = await bob.db.from('items').update({ checked: true, checked_by: alice.id }).eq('id', itemId).select('checked, checked_by, checked_at').single()
    assert.ifError(error)
    assert.equal(data.checked, true)
    assert.equal(data.checked_by, bob.id)
    assert.ok(data.checked_at)
    const { data: unchecked } = await alice.db.from('items').update({ checked: false }).eq('id', itemId).select('checked_by, checked_at').single()
    assert.deepEqual(unchecked, { checked_by: null, checked_at: null })
  })

  it("doesn't let a member take over the list or change its code", async () => {
    await bob.db.from('lists').update({ owner_id: bob.id, invite_code: 'AAAAAAAA', name: 'Renamed by Bob' }).eq('id', listId)
    const { data } = await alice.db.from('lists').select('owner_id, invite_code, name').eq('id', listId).single()
    assert.equal(data?.owner_id, alice.id)
    assert.equal(data?.invite_code, code)
    assert.equal(data?.name, 'Renamed by Bob') // renaming is allowed
    const del = await bob.db.from('lists').delete().eq('id', listId).select('id')
    assert.deepEqual(del.data, [])
    const reset = await bob.db.rpc('regenerate_invite_code', { p_list_id: listId })
    assert.equal(reset.error?.code, '42501')
  })

  it('streams a member’s new item to the others in real time, and not to outsiders', async () => {
    const aliceSub = await watchInserts(alice.db, listId, (r) => r.name === 'Bread', 10_000)
    const eveSub = await watchInserts(eve.db, listId, (r) => r.name === 'Bread', 5_000)
    const started = Date.now()
    const { error } = await bob.db.from('items').insert({ list_id: listId, name: 'Bread' })
    assert.ifError(error)
    const [seenByAlice, seenByEve] = await Promise.all([aliceSub.wait, eveSub.wait])
    await Promise.all([aliceSub.stop(), eveSub.stop()])
    assert.ok(seenByAlice, 'Alice should receive the insert')
    assert.equal(seenByAlice.row.added_by, bob.id)
    assert.equal(seenByEve, null, 'Eve must not receive changes for a list she is not on')
    console.log(`    realtime: Bob's insert reached Alice in ${seenByAlice.at - started} ms`)
  })

  it('cuts access when a member leaves', async () => {
    const { error } = await bob.db.from('list_members').delete().eq('list_id', listId).eq('user_id', bob.id)
    assert.ifError(error)
    const { data } = await bob.db.from('items').select('id').eq('list_id', listId)
    assert.deepEqual(data, [])
  })

  it('stops old invite codes working once the owner resets the code', async () => {
    const { data: fresh, error } = await alice.db.rpc('regenerate_invite_code', { p_list_id: listId })
    assert.ifError(error)
    assert.notEqual(fresh, code)
    const { data: oldPreview } = await bob.db.rpc('invite_preview', { p_code: code })
    assert.deepEqual(oldPreview, [])
    const rejoin = await bob.db.rpc('join_list', { p_code: code })
    assert.equal(rejoin.error?.code, 'P0002')
  })
})
