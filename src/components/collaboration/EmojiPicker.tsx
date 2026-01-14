'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { SmilePlus } from 'lucide-react'

const EMOJI_MAP: Record<string, string> = {
  '+1': '\u{1F44D}',
  '-1': '\u{1F44E}',
  'heart': '\u{2764}',
  'smile': '\u{1F642}',
  'laugh': '\u{1F602}',
  'thinking': '\u{1F914}',
  'clap': '\u{1F44F}',
  'fire': '\u{1F525}',
  'eyes': '\u{1F440}',
  'check': '\u{2705}',
  'x': '\u{274C}',
  'question': '\u{2753}',
  'celebration': '\u{1F389}',
}

export const EMOJI_KEYS = Object.keys(EMOJI_MAP)

export function getEmojiDisplay(emojiKey: string): string {
  return EMOJI_MAP[emojiKey] || emojiKey
}

type EmojiPickerProps = {
  onSelect: (emoji: string) => void
  disabled?: boolean
  size?: 'sm' | 'default'
}

export function EmojiPicker({ onSelect, disabled = false, size = 'default' }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSelect = (emoji: string) => {
    onSelect(emoji)
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={containerRef}>
      <Button
        type="button"
        variant="ghost"
        size={size === 'sm' ? 'sm' : 'default'}
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="h-8 w-8 p-0"
      >
        <SmilePlus className="h-4 w-4" />
      </Button>

      {isOpen && (
        <div className="absolute z-50 bottom-full mb-2 left-0 bg-white border border-gray-200 rounded-lg shadow-lg p-2">
          <div className="grid grid-cols-7 gap-1">
            {EMOJI_KEYS.map((emojiKey) => (
              <button
                key={emojiKey}
                type="button"
                onClick={() => handleSelect(emojiKey)}
                className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-100 rounded transition-colors"
                title={emojiKey}
              >
                {getEmojiDisplay(emojiKey)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
