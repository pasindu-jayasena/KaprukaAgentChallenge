'use client'

import { CheckCheck } from 'lucide-react'

export function SentReceipt() {
  return (
    <span className="sent-receipt ml-1.5 inline-flex shrink-0 items-center" aria-label="Sent">
      <CheckCheck className="h-3.5 w-3.5" strokeWidth={2.2} />
    </span>
  )
}
