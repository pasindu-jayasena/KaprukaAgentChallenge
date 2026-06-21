import type { ChatLang } from '@/types'

export interface UserProfile {
  deviceId: string
  chatStyle: ChatLang
  preferredCity: string | null
  orderCount: number
  recentItems: string[]       // Last 5 product names ordered
  interests: string[]         // Extracted tags like "cakes", "flowers"
  recipientNames: string[]    // Names they've sent gifts to
  returningUser: boolean
}

// In-memory store — survives Vercel function warm periods (~5-30 min)
type ProfileStore = Map<string, UserProfile>

const profileStore: ProfileStore =
  (globalThis as unknown as { __anuUserProfiles?: ProfileStore }).__anuUserProfiles ??
  ((globalThis as unknown as { __anuUserProfiles: ProfileStore }).__anuUserProfiles =
    new Map())

function defaultProfile(deviceId: string): UserProfile {
  return {
    deviceId,
    chatStyle: 'en',
    preferredCity: null,
    orderCount: 0,
    recentItems: [],
    interests: [],
    recipientNames: [],
    returningUser: false,
  }
}

export function getProfile(deviceId: string): UserProfile {
  return profileStore.get(deviceId) ?? defaultProfile(deviceId)
}

export function updateProfile(
  deviceId: string,
  patch: Partial<Omit<UserProfile, 'deviceId'>>
): UserProfile {
  const existing = getProfile(deviceId)
  const updated: UserProfile = {
    ...existing,
    ...patch,
    deviceId, // always preserve
    // Merge arrays without duplicates, keep last 5/10
    recentItems: dedup([
      ...(patch.recentItems ?? []),
      ...existing.recentItems,
    ]).slice(0, 5),
    interests: dedup([
      ...(patch.interests ?? []),
      ...existing.interests,
    ]).slice(0, 10),
    recipientNames: dedup([
      ...(patch.recipientNames ?? []),
      ...existing.recipientNames,
    ]).slice(0, 8),
    orderCount: patch.orderCount != null
      ? patch.orderCount
      : existing.orderCount,
  }
  profileStore.set(deviceId, updated)
  return updated
}

function dedup(arr: string[]): string[] {
  return [...new Set(arr.map((s) => s.trim()).filter(Boolean))]
}

/** Extract interest tags from product names */
export function extractInterests(productNames: string[]): string[] {
  const KEYWORDS = [
    'cake', 'flower', 'chocolate', 'hamper', 'wine', 'perfume', 'toy',
    'electronics', 'clothing', 'fruit', 'grocery', 'gift', 'bouquet',
    'watch', 'jewelry', 'jewellery', 'bag', 'shoe', 'cosmetic',
  ]
  const tags: string[] = []
  for (const name of productNames) {
    const lower = name.toLowerCase()
    for (const kw of KEYWORDS) {
      if (lower.includes(kw) && !tags.includes(kw)) {
        tags.push(kw)
      }
    }
  }
  return tags
}

/** Build a natural-language block for the system prompt */
export function buildProfileBlock(profile: UserProfile): string {
  if (!profile.returningUser && profile.orderCount === 0) {
    return `═══ WHO YOU'RE TALKING TO ═══
New visitor — first time chatting. Be welcoming, explain how things work briefly on the first interaction.`
  }

  const lines: string[] = [
    `═══ WHO YOU'RE TALKING TO ═══`,
    `Returning customer (${profile.orderCount} previous order${profile.orderCount !== 1 ? 's' : ''}).`,
  ]

  if (profile.preferredCity) {
    lines.push(`Preferred delivery city: ${profile.preferredCity}`)
  }
  if (profile.recentItems.length > 0) {
    lines.push(`Recent orders: ${profile.recentItems.join(', ')}`)
  }
  if (profile.interests.length > 0) {
    lines.push(`Interests: ${profile.interests.join(', ')}`)
  }
  if (profile.recipientNames.length > 0) {
    lines.push(`People they gift: ${profile.recipientNames.join(', ')}`)
  }
  if (profile.chatStyle && profile.chatStyle !== 'en') {
    lines.push(`Chat style: ${profile.chatStyle}`)
  }

  lines.push('')
  lines.push(
    `Use this quietly to personalize suggestions — never read profile data back like a database dump.`
  )

  return lines.join('\n')
}
