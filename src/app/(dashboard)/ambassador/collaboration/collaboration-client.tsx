'use client'

import { useState, useEffect } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  MessageSquare,
  FileText,
  Hash,
  Users,
  Lock,
  Globe,
  Loader2,
  Send,
  ArrowLeft,
  Pin,
  Plus,
  Mail,
  User,
} from 'lucide-react'
import {
  getChannel,
  createPost,
  createReply,
  joinChannel,
  leaveChannel,
  getDirectMessages,
  getOrCreateDirectMessage,
  sendDirectMessage,
  getDirectMessageHistory,
  getUsersForDM,
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

type Document = {
  id: string
  uploaderId: string
  title: string
  description: string | null
  fileName: string
  fileUrl: string
  fileSize: number | null
  mimeType: string | null
  isPublic: boolean
  allowedRoles: string[]
  category: string | null
  createdAt: string
  updatedAt: string
}

type DMParticipant = {
  userId: string
  name: string
  email: string
  role: string
}

type DirectMessage = {
  id: string
  participants: DMParticipant[]
  lastMessage: {
    content: string
    createdAt: string
    authorId: string
  } | null
  messageCount: number
  createdAt: string
  updatedAt: string
}

type DMConversation = {
  id: string
  participants: {
    userId: string
    name: string
    email: string
    role: string
    isCurrentUser: boolean
  }[]
  messages: {
    id: string
    content: string
    authorId: string
    authorName: string
    isCurrentUser: boolean
    createdAt: string
  }[]
}

type AvailableUser = {
  id: string
  email: string
  role: string
  name: string
}

export function CollaborationClient({
  channels: initialChannels,
  documents,
  userRole,
  userId,
}: {
  channels: Channel[]
  documents: Document[]
  userRole: string
  userId: string
}) {
  const [channels] = useState(initialChannels)
  const [selectedChannel, setSelectedChannel] = useState<ChannelDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [newPostContent, setNewPostContent] = useState('')
  const [replyContent, setReplyContent] = useState<Record<string, string>>({})
  const [showReplyFor, setShowReplyFor] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // DM state
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([])
  const [selectedDM, setSelectedDM] = useState<DMConversation | null>(null)
  const [newDMContent, setNewDMContent] = useState('')
  const [showNewDMDialog, setShowNewDMDialog] = useState(false)
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [dmLoading, setDmLoading] = useState(false)

  // Load DMs on mount
  useEffect(() => {
    loadDirectMessages()
  }, [])

  const loadDirectMessages = async () => {
    const result = await getDirectMessages()
    if (result.directMessages) {
      setDirectMessages(result.directMessages as DirectMessage[])
    }
  }

  const loadAvailableUsers = async () => {
    const result = await getUsersForDM()
    if (result.users) {
      setAvailableUsers(result.users)
    }
  }

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

  const handleCreatePost = async () => {
    if (!selectedChannel || !newPostContent.trim()) return

    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.set('channelId', selectedChannel.id)
      formData.set('content', newPostContent)

      const result = await createPost(formData)
      if (result.success) {
        // Refresh channel data
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
        // Refresh channel data
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
      // Refresh channel if viewing it
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // DM handlers
  const handleOpenNewDMDialog = async () => {
    setShowNewDMDialog(true)
    await loadAvailableUsers()
  }

  const handleStartNewDM = async () => {
    if (!selectedUserId) return
    setDmLoading(true)
    try {
      const result = await getOrCreateDirectMessage(selectedUserId)
      if (result.channelId) {
        // Open the DM
        await handleSelectDM(result.channelId)
        setShowNewDMDialog(false)
        setSelectedUserId('')
      }
    } catch (error) {
      console.error('Error starting DM:', error)
    } finally {
      setDmLoading(false)
    }
  }

  const handleSelectDM = async (dmId: string) => {
    setDmLoading(true)
    try {
      const result = await getDirectMessageHistory(dmId)
      if (result.conversation) {
        setSelectedDM(result.conversation as DMConversation)
      }
    } catch (error) {
      console.error('Error loading DM:', error)
    } finally {
      setDmLoading(false)
    }
  }

  const handleSendDM = async () => {
    if (!selectedDM || !newDMContent.trim()) return

    setIsSubmitting(true)
    try {
      const result = await sendDirectMessage(selectedDM.id, newDMContent)
      if (result.success) {
        // Refresh conversation
        const refreshed = await getDirectMessageHistory(selectedDM.id)
        if (refreshed.conversation) {
          setSelectedDM(refreshed.conversation as DMConversation)
        }
        setNewDMContent('')
        // Refresh DM list to update last message
        loadDirectMessages()
      }
    } catch (error) {
      console.error('Error sending DM:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBackFromDM = () => {
    setSelectedDM(null)
    setNewDMContent('')
  }

  // DM conversation view
  if (selectedDM) {
    const otherParticipant = selectedDM.participants.find(p => !p.isCurrentUser)

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBackFromDM}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Messages
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <User className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <CardTitle>{otherParticipant?.name || 'Conversation'}</CardTitle>
                <CardDescription className="flex items-center gap-2">
                  {otherParticipant?.email}
                  <Badge variant="outline" className="text-xs">{otherParticipant?.role}</Badge>
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Message Input */}
            <div className="flex gap-2">
              <Textarea
                value={newDMContent}
                onChange={(e) => setNewDMContent(e.target.value)}
                placeholder="Type a message..."
                rows={2}
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendDM()
                  }
                }}
              />
              <Button
                onClick={handleSendDM}
                disabled={!newDMContent.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Messages */}
            <div className="space-y-3 mt-6 max-h-[500px] overflow-y-auto">
              {selectedDM.messages.length === 0 ? (
                <div className="text-center py-8">
                  <Mail className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                selectedDM.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.isCurrentUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] p-3 rounded-lg ${
                        message.isCurrentUser
                          ? 'bg-amber-500 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      {!message.isCurrentUser && (
                        <p className="text-xs font-medium mb-1 opacity-70">{message.authorName}</p>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p className={`text-xs mt-1 ${message.isCurrentUser ? 'opacity-70' : 'text-gray-500'}`}>
                        {formatDate(message.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
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
                  <Button size="sm" onClick={() => handleJoinChannel(selectedChannel.id)}>
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Collaboration</h1>
        <p className="text-gray-600">
          Team discussions, direct messages, and document sharing
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Channels */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              Channels
            </CardTitle>
            <CardDescription>
              Join team discussions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {channels.length === 0 ? (
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
                    className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
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
                          <p className="text-xs text-gray-500 line-clamp-1">{channel.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {channel.postCount} posts
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Direct Messages */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Direct Messages
                </CardTitle>
                <CardDescription>
                  Private conversations
                </CardDescription>
              </div>
              <Button size="sm" onClick={handleOpenNewDMDialog}>
                <Plus className="h-4 w-4 mr-1" />
                New
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {directMessages.length === 0 ? (
              <div className="text-center py-8">
                <Mail className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No conversations yet</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={handleOpenNewDMDialog}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Start a Conversation
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {directMessages.map((dm) => {
                  const participant = dm.participants[0]
                  return (
                    <button
                      key={dm.id}
                      onClick={() => handleSelectDM(dm.id)}
                      className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <User className="h-4 w-4 text-purple-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{participant?.name || 'Unknown'}</span>
                            <Badge variant="outline" className="text-xs">{participant?.role}</Badge>
                          </div>
                          {dm.lastMessage && (
                            <p className="text-xs text-gray-500 line-clamp-1">
                              {dm.lastMessage.content}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {dm.messageCount} messages
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Shared Documents */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Documents
            </CardTitle>
            <CardDescription>
              Shared documents and files
            </CardDescription>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No documents shared</p>
              </div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {documents.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        {doc.isPublic ? (
                          <Globe className="h-4 w-4 text-green-600" />
                        ) : (
                          <FileText className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                      <div>
                        <span className="font-medium">{doc.title}</span>
                        <p className="text-xs text-gray-500">{doc.fileName}</p>
                      </div>
                    </div>
                    {doc.category && (
                      <Badge variant="outline" className="text-xs">
                        {doc.category}
                      </Badge>
                    )}
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New DM Dialog */}
      <Dialog open={showNewDMDialog} onOpenChange={setShowNewDMDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Message</DialogTitle>
            <DialogDescription>
              Start a private conversation with someone
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select a person</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose someone to message..." />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center gap-2">
                        <span>{user.name}</span>
                        <span className="text-xs text-gray-500">({user.role})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableUsers.length === 0 && (
                <p className="text-xs text-gray-500">Loading available users...</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowNewDMDialog(false)
                setSelectedUserId('')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleStartNewDM}
              disabled={!selectedUserId || dmLoading}
            >
              {dmLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Start Conversation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
