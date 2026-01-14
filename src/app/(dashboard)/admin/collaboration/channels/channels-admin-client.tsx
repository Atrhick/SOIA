'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import {
  MessageSquare,
  Hash,
  Users,
  Lock,
  Loader2,
  Send,
  ArrowLeft,
  Pin,
  Plus,
  Settings,
} from 'lucide-react'
import {
  getChannel,
  createChannel,
  createPost,
  createReply,
  joinChannel,
  togglePinPost,
} from '@/lib/actions/collaboration'

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

type Post = {
  id: string
  channelId: string
  authorId: string
  content: string
  isPinned: boolean
  createdAt: string
  updatedAt: string
  replies: Reply[]
}

type Reply = {
  id: string
  postId: string
  authorId: string
  content: string
  createdAt: string
}

type ChannelDetail = Omit<Channel, 'postCount' | 'memberCount'> & {
  posts: Post[]
  members: { id: string; userId: string; joinedAt: string }[]
}

export function ChannelsAdminClient({
  channels: initialChannels,
  userId,
}: {
  channels: Channel[]
  userId: string
}) {
  const [channels, setChannels] = useState(initialChannels)
  const [selectedChannel, setSelectedChannel] = useState<ChannelDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [newPostContent, setNewPostContent] = useState('')
  const [replyContent, setReplyContent] = useState<Record<string, string>>({})
  const [showReplyFor, setShowReplyFor] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Create channel dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelDescription, setNewChannelDescription] = useState('')
  const [newChannelPrivate, setNewChannelPrivate] = useState(false)
  const [newChannelRoles, setNewChannelRoles] = useState<string[]>(['ADMIN', 'COACH', 'AMBASSADOR'])

  const handleSelectChannel = async (channel: Channel) => {
    setIsLoading(true)
    try {
      const result = await getChannel(channel.id)
      if (result.channel) {
        setSelectedChannel(result.channel as ChannelDetail)
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
  }

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return

    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.set('name', newChannelName)
      formData.set('description', newChannelDescription)
      formData.set('isPrivate', newChannelPrivate.toString())
      formData.set('allowedRoles', JSON.stringify(newChannelRoles))

      const result = await createChannel(formData)
      if (result.success && result.channel) {
        // Add default counts for newly created channel
        const newChannel: Channel = {
          id: result.channel.id,
          name: result.channel.name || newChannelName,
          description: result.channel.description,
          isPrivate: result.channel.isPrivate,
          createdById: result.channel.createdById,
          allowedRoles: result.channel.allowedRoles,
          createdAt: result.channel.createdAt.toISOString(),
          updatedAt: result.channel.updatedAt.toISOString(),
          postCount: 0,
          memberCount: 0,
        }
        setChannels([...channels, newChannel])
        setShowCreateDialog(false)
        setNewChannelName('')
        setNewChannelDescription('')
        setNewChannelPrivate(false)
        setNewChannelRoles(['ADMIN', 'COACH', 'AMBASSADOR'])
      }
    } catch (error) {
      console.error('Error creating channel:', error)
    } finally {
      setIsSubmitting(false)
    }
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

  const handleTogglePin = async (postId: string) => {
    try {
      await togglePinPost(postId)
      if (selectedChannel) {
        const refreshed = await getChannel(selectedChannel.id)
        if (refreshed.channel) {
          setSelectedChannel(refreshed.channel as ChannelDetail)
        }
      }
    } catch (error) {
      console.error('Error toggling pin:', error)
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

  const toggleRole = (role: string) => {
    if (newChannelRoles.includes(role)) {
      setNewChannelRoles(newChannelRoles.filter(r => r !== role))
    } else {
      setNewChannelRoles([...newChannelRoles, role])
    }
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
                <div className="p-2 bg-blue-100 rounded-lg">
                  {selectedChannel.isPrivate ? (
                    <Lock className="h-5 w-5 text-blue-600" />
                  ) : (
                    <Hash className="h-5 w-5 text-blue-600" />
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
                  <Button size="sm" onClick={() => joinChannel(selectedChannel.id)}>
                    Join Channel
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* New Post Input */}
            <div className="flex gap-2">
              <Textarea
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="Write a message..."
                rows={2}
                className="flex-1"
              />
              <Button
                onClick={handleCreatePost}
                disabled={!newPostContent.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
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
                      <div className="flex-1">
                        {post.isPinned && (
                          <div className="flex items-center gap-1 text-yellow-600 text-xs mb-2">
                            <Pin className="h-3 w-3" />
                            Pinned
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{post.content}</p>
                        <p className="text-xs text-gray-500 mt-2">{formatDate(post.createdAt)}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTogglePin(post.id)}
                        title={post.isPinned ? 'Unpin' : 'Pin'}
                      >
                        <Pin className={`h-4 w-4 ${post.isPinned ? 'text-yellow-600' : 'text-gray-400'}`} />
                      </Button>
                    </div>

                    {/* Replies */}
                    {post.replies.length > 0 && (
                      <div className="ml-4 mt-3 space-y-2 border-l-2 border-gray-200 pl-4">
                        {post.replies.map((reply) => (
                          <div key={reply.id} className="bg-white p-2 rounded">
                            <p className="text-sm">{reply.content}</p>
                            <p className="text-xs text-gray-500 mt-1">{formatDate(reply.createdAt)}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reply Input */}
                    {showReplyFor === post.id ? (
                      <div className="mt-3 flex gap-2">
                        <Input
                          value={replyContent[post.id] || ''}
                          onChange={(e) => setReplyContent({ ...replyContent, [post.id]: e.target.value })}
                          placeholder="Write a reply..."
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleCreateReply(post.id)}
                          disabled={!replyContent[post.id]?.trim() || isSubmitting}
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
                        className="mt-2"
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Channels</h1>
          <p className="text-gray-600">
            Manage team discussion channels
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Channel
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5" />
            All Channels
          </CardTitle>
          <CardDescription>
            Team discussion spaces
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
              <p className="text-gray-500 text-sm">No channels yet</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create First Channel
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => handleSelectChannel(channel)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      {channel.isPrivate ? (
                        <Lock className="h-4 w-4 text-blue-600" />
                      ) : (
                        <Hash className="h-4 w-4 text-blue-600" />
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

      {/* Create Channel Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Channel</DialogTitle>
            <DialogDescription>
              Create a new discussion channel for your team
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Channel Name</label>
              <Input
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="e.g., general, announcements"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description (Optional)</label>
              <Textarea
                value={newChannelDescription}
                onChange={(e) => setNewChannelDescription(e.target.value)}
                placeholder="What's this channel about?"
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="private"
                checked={newChannelPrivate}
                onCheckedChange={(checked) => setNewChannelPrivate(checked as boolean)}
              />
              <label htmlFor="private" className="text-sm">
                Make this channel private
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Allowed Roles</label>
              <div className="flex gap-4">
                {['ADMIN', 'COACH', 'AMBASSADOR'].map((role) => (
                  <div key={role} className="flex items-center gap-2">
                    <Checkbox
                      id={role}
                      checked={newChannelRoles.includes(role)}
                      onCheckedChange={() => toggleRole(role)}
                    />
                    <label htmlFor={role} className="text-sm">
                      {role.charAt(0) + role.slice(1).toLowerCase()}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateChannel}
              disabled={!newChannelName.trim() || isSubmitting}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Channel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
