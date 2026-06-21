import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem } from '@/types'

interface CartStore {
  items: CartItem[]
  selectedIds: string[]
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, qty: number) => void
  setGiftMessage: (id: string, message: string) => void
  setIcingText: (id: string, text: string) => void
  clearCart: () => void
  toggleSelection: (id: string) => void
  selectAll: () => void
  clearSelection: () => void
  selectedItems: () => CartItem[]
  selectedTotal: () => number
  totalItems: () => number
  totalPrice: () => number
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      selectedIds: [],

      addItem: (product) =>
        set((state) => {
          const existing = state.items.find((i) => i.id === product.id)
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.id === product.id
                  ? { ...i, quantity: i.quantity + (product.quantity ?? 1) }
                  : i
              ),
            }
          }
          return {
            items: [
              ...state.items,
              { ...product, quantity: product.quantity ?? 1 },
            ],
            // Auto-select new item
            selectedIds: [...state.selectedIds, product.id],
          }
        }),

      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
          selectedIds: state.selectedIds.filter((sid) => sid !== id),
        })),

      updateQuantity: (id, qty) =>
        set((state) => ({
          items:
            qty <= 0
              ? state.items.filter((i) => i.id !== id)
              : state.items.map((i) =>
                  i.id === id ? { ...i, quantity: qty } : i
                ),
          selectedIds:
            qty <= 0
              ? state.selectedIds.filter((sid) => sid !== id)
              : state.selectedIds,
        })),

      setGiftMessage: (id, message) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.id === id ? { ...i, giftMessage: message } : i
          ),
        })),

      setIcingText: (id, text) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.id === id ? { ...i, icingText: text } : i
          ),
        })),

      clearCart: () => set({ items: [], selectedIds: [] }),

      toggleSelection: (id) =>
        set((state) => ({
          selectedIds: state.selectedIds.includes(id)
            ? state.selectedIds.filter((sid) => sid !== id)
            : [...state.selectedIds, id],
        })),

      selectAll: () =>
        set((state) => ({
          selectedIds: state.items.map((i) => i.id),
        })),

      clearSelection: () => set({ selectedIds: [] }),

      selectedItems: () => {
        const { items, selectedIds } = get()
        return items.filter((i) => selectedIds.includes(i.id))
      },

      selectedTotal: () => {
        const { items, selectedIds } = get()
        return items
          .filter((i) => selectedIds.includes(i.id))
          .reduce((s, i) => s + i.price * i.quantity, 0)
      },

      totalItems: () => get().items.reduce((s, i) => s + i.quantity, 0),

      totalPrice: () =>
        get().items.reduce((s, i) => s + i.price * i.quantity, 0),
    }),
    { name: 'kapruka-anu-cart' }
  )
)
