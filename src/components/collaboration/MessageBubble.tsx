'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Pin,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Trash2,
  Paperclip,
  FileText,
  Loader2,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ReactionBar } from './ReactionBar'
import { MeetingLinkCard } from './MeetingLinkCard'
import { renderMentions } from './MentionInput'
import { cn } from '@/lib/utils'

type Reaction = {
  id: string
  emoji: string
  userId: string
  userName?: string
}

type Attachment = {
  id: string
  documentId: string
  documentTitle: string
  documentType: string
  documentUrl: string
}

type MeetingLink = {
  id: string
  provider: 'ZOOM' | 'GOOGLE_MEET' | 'MICROSOFT_TEAMS' | 'CUSTOM'
  url: string
  title?: string | null
  scheduledAt?: string | null
  duration?: number | null
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

type MessageBubbleProps = {
  id: string
  content: string
  authorId: string
  authorName: string
  createdAt: string
  isPinned?: boolean
  isEdited?: boolean
  currentUserId: string
  reactions?: Reaction[]
  attachments?: Attachment[]
  meetingLinks?: MeetingLink[]
  replies?: Reply[]
  // Action callbacks
  onAddReaction?: (postId: string, emoji: string) => Promise<void>
  onRemoveReaction?: (reactionId: string) => Promise<void>
  onEdit?: (postId: string, content: string) => Promise<void>
  onDelete?: (postId: string) => Promise<void>
  onPin?: (postId: string) => Promise<void>
  onReply?: (postId: string, content: string) => Promise<void>
  onRemoveAttachment?: (attachmentId: string) => Promise<void>
  onRemoveMeetingLink?: (linkId: string) => Promise<void>
}

export function MessageBubble({
  id,
  content,
  authorId,
  authorName,
  createdAt,
  isPinned = false,
  isEdited = false,
  currentUserId,
  reactions = [],
  attachments = [],
  meetingLinks = [],
  replies = [],
  onAddReaction,
  onRemoveReaction,
  onEdit,
  onDelete,
  onPin,
  onReply,
  onRemoveAttachment,
  onRemoveMeetingLink,
}: MessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(content)
  const [showReplyInput, setShowReplyInput] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isAuthor = authorId === currentUserId

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleSaveEdit = async () => {
    if (!editContent.trim() || !onEdit) return

    setIsSubmitting(true)
    try {
      await onEdit(id, editContent)
      setIsEditing(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitReply = async () => {
    if (!replyContent.trim() || !onReply) return

    setIsSubmitting(true)
    try {
      await onReply(id, replyContent)
      setReplyContent('')
      setShowReplyInput(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddReaction = async (emoji: string) => {
    if (!onAddReaction) return
    await onAddReaction(id, emoji)
  }

  const handleRemoveReaction = async (reactionId: string) => {
    if (!onRemoveReaction) return
    await onRemoveReaction(reactionId)
  }

  return (
    <div
      className={cn(
        'p-4 rounded-lg',
        isPinned ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium text-blue-600">
            {authorName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">{authorName}</span>
              {isPinned && (
                <Badge variant="secondary" className="text-xs">
                  <Pin className="h-3 w-3 mr-1" />
                  Pinned
                </Badge>
              )}
            </div>
            <p className="text-xs text-gray-500">
              {formatDate(createdAt)}
              {isEdited && <span className="ml-1">(edited)</span>}
            </p>
          </div>
        </div>

        {/* Actions menu */}
        {(isAuthor || onPin) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isAuthor && onEdit && (
                <DropdownMenuItem onClick={() => setIsEditing(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
              )}
              {onPin && (
                <DropdownMenuItem onClick={() => onPin(id)}>
                  <Pin className="h-4 w-4 mr-2" />
                  {isPinned ? 'Unpin' : 'Pin'}
                </DropdownMenuItem>
              )}
              {isAuthor && onDelete && (
                <DropdownMenuItem
                  onClick={() => onDelete(id)}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Content */}
      <div className="mt-3">
        {isEditing ? (
          <div className="space-y-2">
            <Input
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={!editContent.trim() || isSubmitting}
              >
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsEditing(false)
                  setEditContent(content)
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap">{renderMentions(content)}</p>
        )}
      </div>

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="mt-3 space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200"
            >
              <Paperclip className="h-4 w-4 text-gray-400" />
              <a
                href={attachment.documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-sm text-blue-600 hover:underline truncate"
              >
                {attachment.documentTitle}
              </a>
              {onRemoveAttachment && isAuthor && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => onRemoveAttachment(attachment.id)}
                >
                  <Trash2 className="h-3 w-3 text-gray-400 hover:text-red-600" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Meeting Links */}
      {meetingLinks.length > 0 && (
        <div className="mt-3 space-y-2">
          {meetingLinks.map((link) => (
            <MeetingLinkCard
              key={link.id}
              {...link}
              onRemove={
                onRemoveMeetingLink && isAuthor
                  ? onRemoveMeetingLink
                  : undefined
              }
              compact
            />
          ))}
        </div>
      )}

      {/* Reactions */}
      {(reactions.length > 0 || onAddReaction) && (
        <div className="mt-3">
          <ReactionBar
            reactions={reactions}
            currentUserId={currentUserId}
            onAddReaction={handleAddReaction}
            onRemoveReaction={handleRemoveReaction}
            disabled={!onAddReaction}
          />
        </div>
      )}

      {/* Replies */}
      {replies.length > 0 && (
        <div className="mt-3 ml-4 space-y-2 border-l-2 border-gray-200 pl-4">
          {replies.map((reply) => (
            <div key={reply.id} className="bg-white p-2 rounded">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-gray-700">{reply.authorName}</span>
                <span className="text-xs text-gray-500">{formatDate(reply.createdAt)}</span>
                {reply.isEdited && <span className="text-xs text-gray-400">(edited)</span>}
              </div>
              <p className="text-sm">{renderMentions(reply.content)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Reply input */}
      {onReply && (
        <div className="mt-3">
          {showReplyInput ? (
            <div className="flex gap-2">
              <Input
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Write a reply..."
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmitReply()
                  }
                }}
              />
              <Button
                size="sm"
                onClick={handleSubmitReply}
                disabled={!replyContent.trim() || isSubmitting}
              >
                Reply
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowReplyInput(false)
                  setReplyContent('')
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowReplyInput(true)}
            >
              <MessageSquare className="h-3 w-3 mr-1" />
              Reply ({replies.length})
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
