import type { Session, User } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createListWithItems } from '../data/mutations'
import { errorMessage, supabase, supabaseConfigured } from '../lib/supabase'
import type { Profile } from '../lib/types'

export type SignUpResult = { ok: true; needsConfirmation: boolean } | { ok: false; error: string }
type Result = { ok: true } | { ok: false; error: string }

interface AuthValue {
  /** False until the stored session has been read, so screens don't flash the sign-in page. */
  ready: boolean
  session: Session | null
  user: User | null
  profile: Profile | null
  isGuest: boolean
  signIn: (email: string, password: string) => Promise<Result>
  signUp: (name: string, email: string, password: string) => Promise<SignUpResult>
  continueAsGuest: (name: string) => Promise<Result>
  updateName: (name: string) => Promise<Result>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

/** Items for the list a new guest starts with, so the demo isn't empty. */
const SAMPLE_ITEMS = [
  { name: 'Milk', quantity: '2' },
  { name: 'Eggs', quantity: '12' },
  { name: 'Bananas', quantity: null },
  { name: 'Basmati rice', quantity: '1 kg' },
  { name: 'Ferrero Nutella', quantity: '400 g', barcode: '3017624010701' },
]

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!supabaseConfigured)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const user = session?.user ?? null

  useEffect(() => {
    if (!supabaseConfigured) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    // Keep this callback synchronous: awaiting Supabase calls inside it can deadlock the auth client.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = user?.id ?? null
  useEffect(() => {
    if (!userId) return
    let active = true
    supabase
      .from('profiles')
      .select('id, display_name')
      .eq('id', userId)
      .single()
      .then(({ data }) => active && setProfile(data))
    return () => {
      active = false
    }
  }, [userId])

  const signIn = useCallback(async (email: string, password: string): Promise<Result> => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    return error ? { ok: false, error: errorMessage(error) } : { ok: true }
  }, [])

  const signUp = useCallback(async (name: string, email: string, password: string): Promise<SignUpResult> => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: name.trim() } },
    })
    if (error) return { ok: false, error: errorMessage(error) }
    // With "Confirm email" on in Supabase, there's no session until the link in the email is clicked.
    return { ok: true, needsConfirmation: !data.session }
  }, [])

  const continueAsGuest = useCallback(async (name: string): Promise<Result> => {
    const { data, error } = await supabase.auth.signInAnonymously({ options: { data: { display_name: name.trim() } } })
    if (error) {
      if (/anonymous sign-ins are disabled/i.test(error.message)) return { ok: false, error: 'Guest mode is turned off for this app.' }
      return { ok: false, error: errorMessage(error) }
    }
    if (data.user) {
      try {
        await createListWithItems('Weekly shop', SAMPLE_ITEMS)
      } catch {
        // The sample list is a nicety; signing in still worked.
      }
    }
    return { ok: true }
  }, [])

  const updateName = useCallback(
    async (name: string): Promise<Result> => {
      if (!userId) return { ok: false, error: 'Not signed in.' }
      const display_name = name.trim()
      const { data, error } = await supabase.from('profiles').update({ display_name }).eq('id', userId).select('id, display_name').single()
      if (error) return { ok: false, error: errorMessage(error) }
      setProfile(data)
      return { ok: true }
    },
    [userId],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      ready,
      session,
      user,
      profile: profile && profile.id === userId ? profile : null,
      isGuest: !!user?.is_anonymous,
      signIn,
      signUp,
      continueAsGuest,
      updateName,
      signOut,
    }),
    [ready, session, user, profile, userId, signIn, signUp, continueAsGuest, updateName, signOut],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
