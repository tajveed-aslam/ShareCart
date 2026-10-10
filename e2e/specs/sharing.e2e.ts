import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { addItem, byTestId, createList, isChecked, itemId, resetApp, signInAsGuest, tap, textOf, waitForTestId } from '../helpers.ts'

/**
 * Real-time sharing between two people: the phone (Appium) is one family member, and a second member ("Sam") is
 * driven from the test runner through supabase-js, exactly as another phone would talk to Supabase. Every change
 * Sam makes must appear on the phone without a refresh, and vice versa.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY

describe('Sharing a list in real time', function () {
  let sam: SupabaseClient
  let listId: string

  before(async function () {
    if (!url || !key) this.skip() // needs ../.env with the Supabase settings
    sam = createClient(url!, key!, { auth: { persistSession: false } })
    const { error } = await sam.auth.signInAnonymously({ options: { data: { display_name: 'Sam' } } })
    if (error) throw error
    await resetApp()
    await signInAsGuest('Phone user')
    await createList('Family shop')
  })

  after(async () => {
    await sam?.auth.signOut()
  })

  it('shows an invite code Sam can join with', async () => {
    await tap('open-share')
    const code = (await textOf('invite-code')).replace('-', '')
    expect(code).toMatch(/^[2-9A-Z]{8}$/)
    const { data, error } = await sam.rpc('join_list', { p_code: code })
    if (error) throw error
    listId = data as string
    // Membership changes stream to the phone too.
    await waitForTestId('member-Sam', 15_000)
    await driver.back()
  })

  it("shows Sam's new item on the phone without a refresh", async () => {
    const { error } = await sam.from('items').insert({ list_id: listId, name: 'Apples', quantity: '6' })
    if (error) throw error
    await waitForTestId(itemId('Apples'), 15_000)
    expect(await textOf(`${itemId('Apples')}-added-by`)).toMatch(/^Added by Sam/)
  })

  it('sends what the phone checks off to Sam, stamped with the phone user', async () => {
    await tap(`${itemId('Apples')}-check`)
    await browser.waitUntil(
      async () => {
        const { data } = await sam.from('items').select('checked, checked_by').eq('list_id', listId).eq('name', 'Apples').single()
        return data?.checked === true && data.checked_by !== null
      },
      { timeout: 15_000, timeoutMsg: "Sam never saw the phone's check-off" },
    )
  })

  it("shows Sam unchecking and checking items live, with Sam's name", async () => {
    await addItem('Yoghurt')
    await waitForTestId(itemId('Yoghurt'))
    const { error } = await sam.from('items').update({ checked: true }).eq('list_id', listId).eq('name', 'Yoghurt')
    if (error) throw error
    await waitForTestId(`${itemId('Yoghurt')}-checked-by`, 15_000)
    expect(await textOf(`${itemId('Yoghurt')}-checked-by`)).toMatch(/^Got by Sam/)
    expect(await isChecked(`${itemId('Yoghurt')}-check`)).toBe(true)
  })

  it("removes Sam's deleted item from the phone", async () => {
    const { error } = await sam.from('items').delete().eq('list_id', listId).eq('name', 'Yoghurt')
    if (error) throw error
    await byTestId(itemId('Yoghurt')).waitForExist({ reverse: true, timeout: 15_000 })
  })

  it("shows the list's new name when Sam renames it", async () => {
    const { error } = await sam.from('lists').update({ name: 'Family shop (Sat)' }).eq('id', listId)
    if (error) throw error
    await $('android=new UiSelector().text("Family shop (Sat)")').waitForDisplayed({ timeout: 15_000 })
  })
})
