/** "just now", "5m ago", "3h ago", "yesterday", "4 Oct". */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso)
  const seconds = Math.round((now.getTime() - then.getTime()) / 1000)
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  if (then.getTime() >= startOfToday - 86_400_000) return 'yesterday'
  return then.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

/** Up to two initials for an avatar: "Ayesha Khan" → "AK", "tajveed" → "T". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts.length === 1 ? parts[0][0] : parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Name to show for a user id: "You" for the current user, their display name if they're (still) a member,
 * otherwise "a former member" (their profile is no longer visible once they leave the list).
 */
export function personName(userId: string | null, names: Map<string, string>, me: string | null): string {
  if (!userId) return 'someone'
  if (userId === me) return 'You'
  return names.get(userId) ?? 'a former member'
}

/** A stable colour per user, so each person's avatar looks the same on every screen and device. */
export function avatarColor(userId: string): string {
  const palette = ['#2563eb', '#db2777', '#ea580c', '#7c3aed', '#0891b2', '#16a34a', '#ca8a04', '#dc2626']
  let hash = 0
  for (const ch of userId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return palette[hash % palette.length]
}
