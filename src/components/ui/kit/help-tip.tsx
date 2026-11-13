'use client'

import * as Popover from '@radix-ui/react-popover'
import { HelpCircle } from 'lucide-react'

/**
 * A "?" that explains a word or rule in plain language. 44px tap area, keyboard and screen-reader
 * friendly. Use it instead of jargon-only labels:  <HelpTip label="What counts as a day?">...</HelpTip>
 */
export function HelpTip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Popover.Root>
      <Popover.Trigger aria-label={label} className="inline-flex h-11 w-11 -my-2.5 items-center justify-center rounded-full align-middle text-gray-500 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600">
        <HelpCircle className="h-5 w-5" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={6} collisionPadding={16} className="z-[90] max-w-xs rounded-xl border border-gray-200 bg-white p-4 text-base leading-snug text-gray-800 shadow-xl focus:outline-none">
          <p className="mb-1 font-semibold text-gray-900">{label}</p>
          <div className="space-y-2">{children}</div>
          <Popover.Arrow className="fill-white" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
