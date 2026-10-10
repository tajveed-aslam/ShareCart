/** Row shapes of the Supabase tables (see supabase/migrations). Timestamps are ISO strings, as PostgREST returns them. */

export interface Profile {
  id: string
  display_name: string
}

export interface List {
  id: string
  name: string
  owner_id: string
  invite_code: string
  created_at: string
  updated_at: string
}

export type MemberRole = 'owner' | 'member'

export interface Member {
  list_id: string
  user_id: string
  role: MemberRole
  joined_at: string
  /** Joined from profiles; null when the profile can't be read. */
  profile: Profile | null
}

export interface Item {
  id: string
  list_id: string
  name: string
  quantity: string | null
  barcode: string | null
  checked: boolean
  added_by: string | null
  checked_by: string | null
  checked_at: string | null
  created_at: string
  updated_at: string
}

/** A list on the home screen, with its item counts. */
export interface ListSummary extends List {
  total: number
  remaining: number
  memberCount: number
}

export interface InvitePreview {
  list_id: string
  list_name: string
  owner_name: string
  member_count: number
  already_member: boolean
}
