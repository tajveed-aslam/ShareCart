import { avatarColor, initials, personName, timeAgo } from '../format'
import { formatInviteCode, inviteLink, isPlausibleInviteCode, normalizeInviteCode } from '../invite'

describe('invite codes', () => {
  it('normalizes what people type or paste', () => {
    expect(normalizeInviteCode('abcd-efgh')).toBe('ABCDEFGH')
    expect(normalizeInviteCode(' 7k9m 2pq4 ')).toBe('7K9M2PQ4')
    expect(normalizeInviteCode('https://sharecart-omega.vercel.app/join/7K9M2PQ4')).toBe('7K9M2PQ4')
    expect(normalizeInviteCode('sharecart://join/7k9m-2pq4')).toBe('7K9M2PQ4')
  })

  it('checks length and the look-alike-free alphabet', () => {
    expect(isPlausibleInviteCode('7K9M2PQ4')).toBe(true)
    expect(isPlausibleInviteCode('7K9M2PQ')).toBe(false)
    expect(isPlausibleInviteCode('7K9M2PQO')).toBe(false) // O isn't used
    expect(isPlausibleInviteCode('1K9M2PQ4')).toBe(false) // nor 1
  })

  it('formats codes and builds links', () => {
    expect(formatInviteCode('7k9m2pq4')).toBe('7K9M-2PQ4')
    expect(formatInviteCode('short')).toBe('SHORT')
    expect(inviteLink('7K9M-2PQ4', 'https://sharecart-omega.vercel.app/')).toBe('https://sharecart-omega.vercel.app/join/7K9M2PQ4')
  })
})

describe('timeAgo', () => {
  const now = new Date('2026-10-10T12:00:00')
  it.each([
    ['2026-10-10T11:59:40', 'just now'],
    ['2026-10-10T11:55:00', '5m ago'],
    ['2026-10-10T09:00:00', '3h ago'],
    ['2026-10-09T08:00:00', 'yesterday'],
  ])('%s → %s', (iso, label) => {
    expect(timeAgo(new Date(iso).toISOString(), now)).toBe(label)
  })

  it('shows a date for older times', () => {
    expect(timeAgo(new Date('2026-10-04T12:00:00').toISOString(), now)).toMatch(/4/)
  })
})

describe('people', () => {
  const names = new Map([['u2', 'Ayesha Khan']])

  it('names the current user, members and former members', () => {
    expect(personName('me', names, 'me')).toBe('You')
    expect(personName('u2', names, 'me')).toBe('Ayesha Khan')
    expect(personName('gone', names, 'me')).toBe('a former member')
    expect(personName(null, names, 'me')).toBe('someone')
  })

  it('builds initials and stable colours', () => {
    expect(initials('Ayesha Khan')).toBe('AK')
    expect(initials('tajveed')).toBe('T')
    expect(initials('  ')).toBe('?')
    expect(avatarColor('u2')).toBe(avatarColor('u2'))
    expect(avatarColor('u2')).toMatch(/^#[0-9a-f]{6}$/)
  })
})
