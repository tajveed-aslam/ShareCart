/**
 * Invite codes are 8 characters from a 31-letter alphabet with no look-alikes (no 0/O, 1/I/L), generated in the
 * database. Users may type them in lower case, with spaces or a dash, or paste a whole invite link.
 */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
export const INVITE_LENGTH = 8

/** Uppercases and strips anything that isn't a letter or digit; pulls the code out of a pasted invite link. */
export function normalizeInviteCode(input: string): string {
  const fromLink = input.match(/join\/([0-9A-Za-z-]+)/)
  const raw = fromLink ? fromLink[1] : input
  return raw.toUpperCase().replace(/[^0-9A-Z]/g, '')
}

/** Whether a (normalized) code could be a real invite: right length and alphabet. */
export function isPlausibleInviteCode(code: string): boolean {
  return code.length === INVITE_LENGTH && [...code].every((c) => ALPHABET.includes(c))
}

/** "ABCDEFGH" → "ABCD-EFGH", easier to read out. */
export function formatInviteCode(code: string): string {
  const c = normalizeInviteCode(code)
  return c.length === INVITE_LENGTH ? `${c.slice(0, 4)}-${c.slice(4)}` : c
}

/** The web link that opens the join screen (also handled by the app via the sharecart:// scheme). */
export function inviteLink(code: string, origin: string): string {
  return `${origin.replace(/\/+$/, '')}/join/${normalizeInviteCode(code)}`
}
