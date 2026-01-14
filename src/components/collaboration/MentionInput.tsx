'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type User = {
  id: string
  name: string
  email: string
  role?: string
}

type MentionInputProps = {
  value: string
  onChange: (value: string) => void
  users: User[]
  placeholder?: string
  rows?: number
  className?: string
  disabled?: boolean
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
}

export function MentionInput({
  value,
  onChange,
  users,
  placeholder = 'Type a message...',
  rows = 2,
  className,
  disabled = false,
  onKeyDown,
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionStartIndex, setMentionStartIndex] = useState(-1)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(mentionQuery.toLowerCase())
  )

  useEffect(() => {
    setSelectedIndex(0)
  }, [mentionQuery])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    if (showSuggestions) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSuggestions])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    const cursorPos = e.target.selectionStart || 0

    onChange(newValue)

    // Check for @ mention trigger
    const textBeforeCursor = newValue.slice(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1)
      // Check if there's a space between @ and cursor (mentions shouldn't have spaces)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setMentionQuery(textAfterAt)
        setMentionStartIndex(lastAtIndex)
        setShowSuggestions(true)
        return
      }
    }

    setShowSuggestions(false)
    setMentionQuery('')
    setMentionStartIndex(-1)
  }

  const insertMention = useCallback(
    (user: User) => {
      if (mentionStartIndex === -1) return

      const beforeMention = value.slice(0, mentionStartIndex)
      const afterCursor = value.slice(mentionStartIndex + 1 + mentionQuery.length)
      const mention = `@[${user.name}](user:${user.id})`
      const newValue = beforeMention + mention + ' ' + afterCursor

      onChange(newValue)
      setShowSuggestions(false)
      setMentionQuery('')
      setMentionStartIndex(-1)

      // Focus back on textarea
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursorPos = beforeMention.length + mention.length + 1
          textareaRef.current.focus()
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
        }
      }, 0)
    },
    [mentionStartIndex, mentionQuery, value, onChange]
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions && filteredUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % filteredUsers.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + filteredUsers.length) % filteredUsers.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(filteredUsers[selectedIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowSuggestions(false)
        return
      }
    }

    onKeyDown?.(e)
  }

  return (
    <div className="relative" ref={containerRef}>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={className}
        disabled={disabled}
      />

      {showSuggestions && filteredUsers.length > 0 && (
        <div className="absolute z-50 bottom-full mb-1 left-0 w-full max-w-sm bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <div className="max-h-48 overflow-y-auto">
            {filteredUsers.map((user, index) => (
              <button
                key={user.id}
                type="button"
                onClick={() => insertMention(user)}
                className={cn(
                  'w-full px-3 py-2 text-left flex items-center gap-2 transition-colors',
                  index === selectedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                )}
              >
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
                {user.role && (
                  <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600">
                    {user.role}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Helper function to render content with mentions highlighted
export function renderMentions(content: string): React.ReactNode {
  const mentionRegex = /@\[([^\]]+)\]\(user:([^)]+)\)/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match

  while ((match = mentionRegex.exec(content)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index))
    }

    // Add the mention as a highlighted span
    const userName = match[1]
    parts.push(
      <span
        key={`mention-${match.index}`}
        className="bg-blue-100 text-blue-700 px-1 rounded font-medium"
      >
        @{userName}
      </span>
    )

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex))
  }

  return parts.length > 0 ? parts : content
}
