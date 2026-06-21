import { z } from 'zod'

export const chatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().max(50000), // Max 50k chars per message to allow structured data
    })
  ).max(50),
  uiLang: z.enum(['en', 'si', 'ta']).default('en'),
  chatLang: z
    .enum(['en', 'si', 'ta', 'singlish', 'tanglish'])
    .default('en'),
  cartItems: z
    .array(
      z.object({
        id: z.string().max(500).catch('unknown'),
        name: z.string().max(500).catch('Unknown Item'),
        price: z.coerce.number().catch(0),
        quantity: z.coerce.number().catch(1),
        giftMessage: z.string().max(1000).nullish(),
        icingText: z.string().max(500).nullish(),
      })
    )
    .max(50)
    .optional(),
})

export const recipientSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(9).max(12),
  address: z.string().min(5),
  city: z.string().min(2),
  date: z.string(),
})
