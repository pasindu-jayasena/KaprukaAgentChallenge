import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_SENDER_EMAIL } from '@/lib/checkout-profile'
import { normalizeRecipientName, recipientNamesMatch } from '@/lib/recipient-match'
import type { SavedCheckoutProfile } from '@/types'

const MAX_PROFILES = 10

interface RecipientStore {
  profiles: SavedCheckoutProfile[]
  saveProfile: (profile: SavedCheckoutProfile) => void
  findByRecipientName: (name: string) => SavedCheckoutProfile | undefined
  getLatestProfile: () => SavedCheckoutProfile | undefined
  clearProfiles: () => void
}

function normalizeProfile(raw: unknown): SavedCheckoutProfile | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>

  if (typeof o.name === 'string' && typeof o.phone === 'string') {
    return {
      recipient: {
        name: String(o.name),
        phone: String(o.phone),
        address: String(o.address ?? ''),
        city: String(o.city ?? ''),
        date: String(o.date ?? new Date().toISOString().slice(0, 10)),
      },
      senderName: String(o.senderName ?? ''),
      senderEmail: String(o.senderEmail ?? DEFAULT_SENDER_EMAIL),
      giftMessage: o.giftMessage ? String(o.giftMessage) : undefined,
      specialInstructions: o.specialInstructions ? String(o.specialInstructions) : undefined,
    }
  }

  const recipient = o.recipient as Record<string, unknown> | undefined
  if (!recipient || typeof recipient.name !== 'string') return null

  return {
    recipient: {
      name: String(recipient.name),
      phone: String(recipient.phone ?? ''),
      address: String(recipient.address ?? ''),
      city: String(recipient.city ?? ''),
      date: String(recipient.date ?? new Date().toISOString().slice(0, 10)),
    },
    senderName: String(o.senderName ?? ''),
    senderEmail: String(o.senderEmail ?? DEFAULT_SENDER_EMAIL),
    giftMessage: o.giftMessage ? String(o.giftMessage) : undefined,
    specialInstructions: o.specialInstructions ? String(o.specialInstructions) : undefined,
  }
}

function upsertProfile(
  profiles: SavedCheckoutProfile[],
  profile: SavedCheckoutProfile
): SavedCheckoutProfile[] {
  const key = normalizeRecipientName(profile.recipient.name)
  const filtered = profiles.filter(
    (p) => normalizeRecipientName(p.recipient.name) !== key
  )
  return [profile, ...filtered].slice(0, MAX_PROFILES)
}

function migratePersisted(raw: unknown): SavedCheckoutProfile[] {
  if (!raw || typeof raw !== 'object') return []
  const o = raw as Record<string, unknown>

  if (Array.isArray(o.profiles)) {
    return o.profiles
      .map(normalizeProfile)
      .filter((p): p is SavedCheckoutProfile => p !== null)
  }

  const legacy = normalizeProfile(o.saved)
  return legacy ? [legacy] : []
}

export const useRecipientStore = create<RecipientStore>()(
  persist(
    (set, get) => ({
      profiles: [],

      saveProfile: (profile) =>
        set((state) => ({
          profiles: upsertProfile(state.profiles, profile),
        })),

      findByRecipientName: (name) => {
        const trimmed = name.trim()
        if (!trimmed) return undefined
        return get().profiles.find((p) => recipientNamesMatch(p.recipient.name, trimmed))
      },

      getLatestProfile: () => get().profiles[0],

      clearProfiles: () => set({ profiles: [] }),
    }),
    {
      name: 'kapruka-anu-recipient',
      merge: (persisted, current) => ({
        ...current,
        profiles: migratePersisted(persisted),
      }),
    }
  )
)
