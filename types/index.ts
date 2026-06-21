export type UiLang = 'en' | 'si' | 'ta'
export type ChatLang = 'en' | 'si' | 'ta' | 'singlish' | 'tanglish'

export interface Product {
  id: string
  name: string
  price: number
  image: string | null
  url: string | null
  reason?: string
  pick?: boolean
}

export interface ProductTrio {
  context?: string
  products: Product[]
}

export interface PlanBoard {
  occasion?: string
  message?: string
  delivery?: { city: string; date: string; fee?: number; confirmed?: boolean }
  recipient?: { name: string | null; phone: string | null; address: string | null }
  items: Array<{
    product_id: string
    name: string
    price: number
    image_url?: string | null
    url?: string | null
    quantity: number
    icing_text?: string | null
  }>
  gift_message?: string
  sender_name?: string
  sender_email?: string
  special_instructions?: string
  subtotal?: number
  delivery_fee?: number
  total?: number
  currency?: string
  needs_recipient?: boolean
}

export interface OrderResult {
  url: string | null
  ref: string | null
  expiresAt: string | null
}

export interface OrderTracking {
  ref: string
  status: string
  eta?: string
  steps?: Array<{ label: string; done: boolean }>
}

export interface CartItem {
  id: string
  name: string
  price: number
  image: string | null
  url: string | null
  quantity: number
  giftMessage?: string
  icingText?: string
}

export interface Recipient {
  name: string
  phone: string
  address: string
  city: string
  date: string
}

export interface SavedCheckoutProfile {
  recipient: Recipient
  senderName: string
  senderEmail: string
  giftMessage?: string
  specialInstructions?: string
}

export interface CheckoutDetailsInput {
  senderName: string
  senderEmail: string
  giftMessage?: string
  specialInstructions?: string
  recipient: Recipient
}

export interface CheckoutSuccessPayload {
  orderResult: OrderResult
  items: Array<{
    id?: string
    name: string
    price: number
    quantity: number
    image?: string | null
    url?: string | null
  }>
  cartRestore: CartItem[]
  recipient: { name: string; phone: string; city: string; address: string; date: string }
  subtotal: number
  total: number
  giftMessage?: string
  senderName?: string
  senderEmail?: string
  specialInstructions?: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  payload?: ChatPayload
  isStreaming?: boolean
}

export type ChatPayload =
  | { type: 'chat'; text: string; chips?: string[] }
  | { type: 'product_trio'; trio: ProductTrio; rawText?: string; chips?: string[] }
  | { type: 'plan_board'; plan: PlanBoard; rawText?: string; chips?: string[] }
  | { type: 'order_tracking'; tracking: OrderTracking; rawText?: string; chips?: string[] }
  | {
      type: 'checkout'
      orderResult: OrderResult
      text?: string
      items?: Array<{ name: string; price: number; quantity: number; image?: string | null }>
      recipient?: { name: string; phone: string; city: string; address: string; date: string }
      subtotal?: number
      deliveryFee?: number
      total?: number
      giftMessage?: string
      senderName?: string
      senderEmail?: string
      specialInstructions?: string
      cartRestore?: CartItem[]
      cancelled?: boolean
    }

export interface StatusEvent {
  type: 'status'
  icon: string
  key: string
  label: string
  params?: Record<string, string>
}

export interface SessionRecord {
  id: string
  title: string
  preview: string
  productCount: number
  thumbnailUrl: string | null
  updatedAt: string
  messages: ChatMessage[]
  journeyStep: number
  cartSnapshot?: CartItem[]
  recipient?: Recipient & { senderName?: string; giftMessage?: string }
}
