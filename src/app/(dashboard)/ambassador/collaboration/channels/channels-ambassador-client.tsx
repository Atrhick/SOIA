'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  MessageSquare,
  Hash,
  Users,
  Lock,
  Loader2,
  Send,
  ArrowLeft,
  Pin,
} from 'lucide-react'
import {
  getChannel,
  createPost,
  createReply,
  joinChannel,
  addReaction,
  removeReaction,
  getMentionableUsers,
} from '@/lib/actions/collaboration'
import { MentionInput, renderMentions } from '@/components/collaboration/MentionInput'
import { ReactionBar } from '@/components/collaboration/ReactionBar'

type Channel = {
  id: string
  name: string
  description: string | null
  isPrivate: boolean
  createdById: string
  allowedRoles: string[]
  createdAt: string
  updatedAt: string
  postCount: number
  memberCount: number
}

type Reaction = {
  id: string
  emoji: string
  userId: string
  userName?: string
}

type Reply = {
  id: string
  postId: string
  authorId: string
  authorName: string
  content: string
  createdAt: string
  isEdited?: boolean
  reactions?: Reaction[]
}

type Post = {
  id: string
  channelId: string
  authorId: string
  authorName: string
  content: string
  isPinned: boolean
  isEdited?: boolean
  createdAt: string
  updatedAt: string
  replies: Reply[]
  reactions?: Reaction[]
}

type MentionableUser = {
  id: string
  name: string
  email: string
  role?: string
}

type ChannelDetail = Omit<Channel, 'postCount' | 'memberCount'> & {
  posts: Post[]
  members: { id: string; userId: string; joinedAt: string }[]
}

export function ChannelsAmbassadorClient({
  channels: initialChannels,
  userId,
}: {
  channels: Channel[]
  userId: string
}) {
  const [channels] = useState(initialChannels)
  const [selectedChannel, setSelectedChannel] = useState<ChannelDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [newPostContent, setNewPostContent] = useState('')
  const [replyContent, setReplyContent] = useState<Record<string, string>>({})
  const [showReplyFor, setShowReplyFor] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mentionableUsers, setMentionableUsers] = useState<MentionableUser[]>([])

  const handleSelectChannel = async (channel: Channel) => {
    setIsLoading(true)
    try {
      const [channelResult, usersResult] = await Promise.all([
        getChannel(channel.id),
        getMentionableUsers(channel.id),
      ])
      if (channelResult.channel) {
        setSelectedChannel(channelResult.channel as ChannelDetail)
      }
      if (usersResult.users) {
        setMentionableUsers(usersResult.users as MentionableUser[])
      }
    } catch (error) {
      console.error('Error loading channel:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBackToChannels = () => {
    setSelectedChannel(null)
    setNewPostContent('')
    setReplyContent({})
    setShowReplyFor(null)
    setMentionableUsers([])
  }

  const handleCreatePost = async () => {
    if (!selectedChannel || !newPostContent.trim()) return

    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.set('channelId', selectedChannel.id)
      formData.set('content', newPostContent)

      const result = await createPost(formData)
      if (result.success) {
        const refreshed = await getChannel(selectedChannel.id)
        if (refreshed.channel) {
          setSelectedChannel(refreshed.channel as ChannelDetail)
        }
        setNewPostContent('')
      }
    } catch (error) {
      console.error('Error creating post:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateReply = async (postId: string) => {
    const content = replyContent[postId]
    if (!content?.trim()) return

    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.set('postId', postId)
      formData.set('content', content)

      const result = await createReply(formData)
      if (result.success && selectedChannel) {
        const refreshed = await getChannel(selectedChannel.id)
        if (refreshed.channel) {
          setSelectedChannel(refreshed.channel as ChannelDetail)
        }
        setReplyContent({ ...replyContent, [postId]: '' })
        setShowReplyFor(null)
      }
    } catch (error) {
      console.error('Error creating reply:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleJoinChannel = async (channelId: string) => {
    setIsSubmitting(true)
    try {
      await joinChannel(channelId)
      if (selectedChannel?.id === channelId) {
        const refreshed = await getChannel(channelId)
        if (refreshed.channel) {
          setSelectedChannel(refreshed.channel as ChannelDetail)
        }
      }
    } catch (error) {
      console.error('Error joining channel:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddReaction = async (postId: string, emoji: string) => {
    try {
      await addReaction(postId, null, emoji)
      if (selectedChannel) {
        const refreshed = await getChannel(selectedChannel.id)
        if (refreshed.channel) {
          setSelectedChannel(refreshed.channel as ChannelDetail)
        }
      }
    } catch (error) {
      console.error('Error adding reaction:', error)
    }
  }

  const handleRemoveReaction = async (reactionId: string) => {
    try {
      await removeReaction(reactionId)
      if (selectedChannel) {
        const refreshed = await getChannel(selectedChannel.id)
        if (refreshed.channel) {
          setSelectedChannel(refreshed.channel as ChannelDetail)
        }
      }
    } catch (error) {
      console.error('Error removing reaction:', error)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Channel detail view
  if (selectedChannel) {
    const isMember = selectedChannel.members.some(m => m.userId === userId)

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBackToChannels}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Channels
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  {selectedChannel.isPrivate ? (
                    <Lock className="h-5 w-5 text-amber-600" />
                  ) : (
                    <Hash className="h-5 w-5 text-amber-600" />
                  )}
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {selectedChannel.name}
                    {selectedChannel.isPrivate && (
                      <Badge variant="secondary" className="text-xs">Private</Badge>
                    )}
                  </CardTitle>
                  {selectedChannel.description && (
                    <CardDescription>{selectedChannel.description}</CardDescription>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  <Users className="h-3 w-3 mr-1" />
                  {selectedChannel.members.length} members
                </Badge>
                {!isMember && (
                  <Button size="sm" onClick={() => handleJoinChannel(selectedChannel.id)}>
                    Join Channel
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* New Post Input with Mentions */}
            <div className="space-y-2">
              <MentionInput
                value={newPostContent}
                onChange={setNewPostContent}
                users={mentionableUsers}
                placeholder="Write a message... Use @ to mention someone"
                rows={2}
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    e.preventDefault()
                    handleCreatePost()
                  }
                }}
              />
              <div className="flex justify-between items-center">
                <p className="text-xs text-gray-500">Press Ctrl+Enter to send</p>
                <Button
                  onClick={handleCreatePost}
                  disabled={!newPostContent.trim() || isSubmitting}
                  className="bg-amber-500 hover:bg-amber-600"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Post
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Posts */}
            <div className="space-y-4 mt-6">
              {selectedChannel.posts.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                selectedChannel.posts.map((post) => (
                  <div
                    key={post.id}
                    className={`p-4 rounded-lg ${post.isPinned ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-sm font-medium text-amber-600 flex-shrink-0">
                          {(post.authorName || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">
                              {post.authorName || 'Unknown'}
                            </span>
                            <span className="text-xs text-gray-500">{formatDate(post.createdAt)}</span>
                            {post.isEdited && <span className="text-xs text-gray-400">(edited)</span>}
                          </div>
                          {post.isPinned && (
                            <div className="flex items-center gap-1 text-yellow-600 text-xs mt-1">
                              <Pin className="h-3 w-3" />
                              Pinned
                            </div>
                          )}
                          <p className="text-sm whitespace-pre-wrap mt-1">{renderMentions(post.content)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Reactions */}
                    <div className="mt-3 ml-11">
                      <ReactionBar
                        reactions={post.reactions || []}
                        currentUserId={userId}
                        onAddReaction={(emoji) => handleAddReaction(post.id, emoji)}
                        onRemoveReaction={handleRemoveReaction}
                      />
                    </div>

                    {/* Replies */}
                    {post.replies.length > 0 && (
                      <div className="ml-11 mt-3 space-y-2 border-l-2 border-gray-200 pl-4">
                        {post.replies.map((reply) => (
                          <div key={reply.id} className="bg-white p-3 rounded">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
                                {(reply.authorName || 'U').charAt(0).toUpperCase()}
                              </div>
                              <span className="text-xs font-medium text-gray-700">
                                {reply.authorName || 'Unknown'}
                              </span>
                              <span className="text-xs text-gray-500">{formatDate(reply.createdAt)}</span>
                              {reply.isEdited && <span className="text-xs text-gray-400">(edited)</span>}
                            </div>
                            <p className="text-sm ml-8">{renderMentions(reply.content)}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reply Input */}
                    {showReplyFor === post.id ? (
                      <div className="mt-3 ml-11 flex gap-2">
                        <MentionInput
                          value={replyContent[post.id] || ''}
                          onChange={(value) => setReplyContent({ ...replyContent, [post.id]: value })}
                          users={mentionableUsers}
                          placeholder="Write a reply..."
                          rows={1}
                          className="flex-1"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              handleCreateReply(post.id)
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          onClick={() => handleCreateReply(post.id)}
                          disabled={!replyContent[post.id]?.trim() || isSubmitting}
                          className="bg-amber-500 hover:bg-amber-600"
                        >
                          Reply
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowReplyFor(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 ml-11"
                        onClick={() => setShowReplyFor(post.id)}
                      >
                        <MessageSquare className="h-3 w-3 mr-1" />
                        Reply ({post.replies.length})
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Channel list view
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Channels</h1>
        <p className="text-gray-600">
          Team discussions and group conversations
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-amber-600" />
            All Channels
          </CardTitle>
          <CardDescription>
            Join team discussions and stay connected
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : channels.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No channels available</p>
            </div>
          ) : (
            <div className="space-y-2">
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => handleSelectChannel(channel)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-amber-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      {channel.isPrivate ? (
                        <Lock className="h-4 w-4 text-amber-600" />
                      ) : (
                        <Hash className="h-4 w-4 text-amber-600" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{channel.name}</span>
                        {channel.isPrivate && (
                          <Badge variant="secondary" className="text-xs">Private</Badge>
                        )}
                      </div>
                      {channel.description && (
                        <p className="text-sm text-gray-500 line-clamp-1">{channel.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {channel.memberCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-4 w-4" />
                      {channel.postCount}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
