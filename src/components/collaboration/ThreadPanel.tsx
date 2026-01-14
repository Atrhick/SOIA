'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, Send, Loader2, MessageSquare } from 'lucide-react'
import { ReactionBar } from './ReactionBar'
import { renderMentions, MentionInput } from './MentionInput'
import { cn } from '@/lib/utils'

type Reaction = {
  id: string
  emoji: string
  userId: string
  userName?: string
}

type Reply = {
  id: string
  content: string
  authorId: string
  authorName: string
  createdAt: string
  isEdited?: boolean
  reactions?: Reaction[]
}

type ParentPost = {
  id: string
  content: string
  authorId: string
  authorName: string
  createdAt: string
  isPinned?: boolean
}

type User = {
  id: string
  name: string
  email: string
  role?: string
}

type ThreadPanelProps = {
  isOpen: boolean
  onClose: () => void
  parentPost: ParentPost | null
  replies: Reply[]
  currentUserId: string
  mentionableUsers?: User[]
  onReply: (content: string) => Promise<void>
  onAddReaction?: (replyId: string, emoji: string) => Promise<void>
  onRemoveReaction?: (reactionId: string) => Promise<void>
}

export function ThreadPanel({
  isOpen,
  onClose,
  parentPost,
  replies,
  currentUserId,
  mentionableUsers = [],
  onReply,
  onAddReaction,
  onRemoveReaction,
}: ThreadPanelProps) {
  const [replyContent, setReplyContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [isOpen, replies.length])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleSubmitReply = async () => {
    if (!replyContent.trim()) return

    setIsSubmitting(true)
    try {
      await onReply(replyContent)
      setReplyContent('')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmitReply()
    }
  }

  if (!isOpen || !parentPost) return null

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-gray-200 shadow-xl z-40 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Thread</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Parent post */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium text-blue-600">
            {parentPost.authorName.charAt(0).toUpperCase()}
          </div>
          <div>
            <span className="text-sm font-medium text-gray-900">{parentPost.authorName}</span>
            <p className="text-xs text-gray-500">{formatDate(parentPost.createdAt)}</p>
          </div>
        </div>
        <p className="text-sm whitespace-pre-wrap">{renderMentions(parentPost.content)}</p>
      </div>

      {/* Replies */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {replies.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No replies yet</p>
            <p className="text-xs text-gray-400">Be the first to reply!</p>
          </div>
        ) : (
          replies.map((reply) => (
            <div key={reply.id} className="space-y-2">
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 flex-shrink-0">
                  {reply.authorName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{reply.authorName}</span>
                    <span className="text-xs text-gray-500">{formatDate(reply.createdAt)}</span>
                    {reply.isEdited && (
                      <span className="text-xs text-gray-400">(edited)</span>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap mt-0.5">
                    {renderMentions(reply.content)}
                  </p>

                  {/* Reply reactions */}
                  {(reply.reactions && reply.reactions.length > 0) || onAddReaction ? (
                    <div className="mt-2">
                      <ReactionBar
                        reactions={reply.reactions || []}
                        currentUserId={currentUserId}
                        onAddReaction={async (emoji) => {
                          if (onAddReaction) {
                            await onAddReaction(reply.id, emoji)
                          }
                        }}
                        onRemoveReaction={async (reactionId) => {
                          if (onRemoveReaction) {
                            await onRemoveReaction(reactionId)
                          }
                        }}
                        disabled={!onAddReaction}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          {mentionableUsers.length > 0 ? (
            <MentionInput
              value={replyContent}
              onChange={setReplyContent}
              users={mentionableUsers}
              placeholder="Reply..."
              rows={2}
              className="flex-1"
              onKeyDown={handleKeyDown}
            />
          ) : (
            <Input
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Reply..."
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmitReply()
                }
              }}
            />
          )}
          <Button
            onClick={handleSubmitReply}
            disabled={!replyContent.trim() || isSubmitting}
            className="h-auto"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
