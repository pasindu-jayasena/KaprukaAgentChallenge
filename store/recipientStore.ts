import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Recipient } from '@/types'

interface RecipientStore {
  saved: Recipient | null
  setSaved: (r: Recipient) => void
  clearSaved: () => void
}

export const useRecipientStore = create<RecipientStore>()(
  persist(
    (set) => ({
      saved: null,
      setSaved: (r) => set({ saved: r }),
      clearSaved: () => set({ saved: null }),
    }),
    { name: 'kapruka-anu-recipient' }
  )
)
