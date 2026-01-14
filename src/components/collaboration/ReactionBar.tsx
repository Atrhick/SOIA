'use client'

import { useState } from 'react'
import { EmojiPicker, getEmojiDisplay } from './EmojiPicker'
import { cn } from '@/lib/utils'

type Reaction = {
  id: string
  emoji: string
  userId: string
  userName?: string
}

type ReactionBarProps = {
  reactions: Reaction[]
  currentUserId: string
  onAddReaction: (emoji: string) => Promise<void>
  onRemoveReaction: (reactionId: string) => Promise<void>
  disabled?: boolean
}

type GroupedReaction = {
  emoji: string
  count: number
  users: string[]
  userHasReacted: boolean
  userReactionId?: string
}

export function ReactionBar({
  reactions,
  currentUserId,
  onAddReaction,
  onRemoveReaction,
  disabled = false,
}: ReactionBarProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Group reactions by emoji
  const groupedReactions = reactions.reduce<Record<string, GroupedReaction>>((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = {
        emoji: reaction.emoji,
        count: 0,
        users: [],
        userHasReacted: false,
      }
    }
    acc[reaction.emoji].count++
    if (reaction.userName) {
      acc[reaction.emoji].users.push(reaction.userName)
    }
    if (reaction.userId === currentUserId) {
      acc[reaction.emoji].userHasReacted = true
      acc[reaction.emoji].userReactionId = reaction.id
    }
    return acc
  }, {})

  const handleReactionClick = async (grouped: GroupedReaction) => {
    if (disabled || isSubmitting) return

    setIsSubmitting(true)
    try {
      if (grouped.userHasReacted && grouped.userReactionId) {
        await onRemoveReaction(grouped.userReactionId)
      } else {
        await onAddReaction(grouped.emoji)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleNewReaction = async (emoji: string) => {
    if (disabled || isSubmitting) return

    // Check if user already has this reaction
    const existing = groupedReactions[emoji]
    if (existing?.userHasReacted) {
      return // Already has this reaction
    }

    setIsSubmitting(true)
    try {
      await onAddReaction(emoji)
    } finally {
      setIsSubmitting(false)
    }
  }

  const reactionGroups = Object.values(groupedReactions)

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {reactionGroups.map((grouped) => (
        <button
          key={grouped.emoji}
          type="button"
          onClick={() => handleReactionClick(grouped)}
          disabled={disabled || isSubmitting}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 text-sm rounded-full border transition-colors',
            grouped.userHasReacted
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
          )}
          title={grouped.users.length > 0 ? grouped.users.join(', ') : undefined}
        >
          <span>{getEmojiDisplay(grouped.emoji)}</span>
          <span className="text-xs font-medium">{grouped.count}</span>
        </button>
      ))}

      <EmojiPicker onSelect={handleNewReaction} disabled={disabled || isSubmitting} size="sm" />
    </div>
  )
}
