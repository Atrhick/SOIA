'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
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
  Plus,
  FileText,
  Hash,
  Users,
  Trash2,
  Edit,
  Lock,
  Globe,
  Loader2,
  Mail,
  User,
  Send,
  ArrowLeft,
} from 'lucide-react'
import {
  createChannel,
  updateChannel,
  deleteChannel,
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

export function CollaborationAdminClient({
  channels: initialChannels,
  documents: initialDocuments,
}: {
  channels: Channel[]
  documents: Document[]
}) {
  const [channels, setChannels] = useState(initialChannels)
  const [documents] = useState(initialDocuments)
  const [isChannelDialogOpen, setIsChannelDialogOpen] = useState(false)
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

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

  // Form state
  const [channelName, setChannelName] = useState('')
  const [channelDescription, setChannelDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [allowCoaches, setAllowCoaches] = useState(true)
  const [allowAmbassadors, setAllowAmbassadors] = useState(true)

  const resetForm = () => {
    setChannelName('')
    setChannelDescription('')
    setIsPrivate(false)
    setAllowCoaches(true)
    setAllowAmbassadors(true)
    setEditingChannel(null)
  }

  const openNewChannelDialog = () => {
    resetForm()
    setIsChannelDialogOpen(true)
  }

  const openEditChannelDialog = (channel: Channel) => {
    setEditingChannel(channel)
    setChannelName(channel.name)
    setChannelDescription(channel.description || '')
    setIsPrivate(channel.isPrivate)
    setAllowCoaches(channel.allowedRoles.includes('COACH'))
    setAllowAmbassadors(channel.allowedRoles.includes('AMBASSADOR'))
    setIsChannelDialogOpen(true)
  }

  const handleSubmitChannel = async () => {
    if (!channelName.trim()) return

    setIsSubmitting(true)

    const allowedRoles = ['ADMIN']
    if (allowCoaches) allowedRoles.push('COACH')
    if (allowAmbassadors) allowedRoles.push('AMBASSADOR')

    const formData = new FormData()
    formData.set('name', channelName)
    formData.set('description', channelDescription)
    formData.set('isPrivate', String(isPrivate))
    formData.set('allowedRoles', JSON.stringify(allowedRoles))

    try {
      const result = editingChannel
        ? await updateChannel(editingChannel.id, formData)
        : await createChannel(formData)

      if (result.success) {
        // Refresh the page to get updated data
        window.location.reload()
      }
    } catch (error) {
      console.error('Error saving channel:', error)
    } finally {
      setIsSubmitting(false)
      setIsChannelDialogOpen(false)
      resetForm()
    }
  }

  const handleDeleteChannel = async (channelId: string) => {
    setIsSubmitting(true)
    try {
      const result = await deleteChannel(channelId)
      if (result.success) {
        setChannels(channels.filter(c => c.id !== channelId))
      }
    } catch (error) {
      console.error('Error deleting channel:', error)
    } finally {
      setIsSubmitting(false)
      setDeleteConfirm(null)
    }
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
        const refreshed = await getDirectMessageHistory(selectedDM.id)
        if (refreshed.conversation) {
          setSelectedDM(refreshed.conversation as DMConversation)
        }
        setNewDMContent('')
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // DM conversation view
  if (selectedDM) {
    const otherParticipant = selectedDM.participants.find(p => !p.isCurrentUser)

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBackFromDM}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Collaboration
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
                          ? 'bg-primary-500 text-white'
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Collaboration Management</h1>
          <p className="text-gray-600">
            Manage channels and shared documents
          </p>
        </div>
        <Button onClick={openNewChannelDialog}>
          <Plus className="h-4 w-4 mr-2" />
          New Channel
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Hash className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{channels.length}</p>
                <p className="text-sm text-gray-500">Channels</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Mail className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{directMessages.length}</p>
                <p className="text-sm text-gray-500">Conversations</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <FileText className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{documents.length}</p>
                <p className="text-sm text-gray-500">Documents</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Users className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {channels.reduce((sum, c) => sum + c.memberCount, 0)}
                </p>
                <p className="text-sm text-gray-500">Active Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Channels List */}
        <Card>
          <CardHeader>
            <CardTitle>Channels</CardTitle>
            <CardDescription>
              Manage discussion channels
            </CardDescription>
          </CardHeader>
          <CardContent>
            {channels.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No channels created yet</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={openNewChannelDialog}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Channel
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {channels.map((channel) => (
                  <div
                    key={channel.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
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
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>{channel.postCount} posts</span>
                          <span>{channel.memberCount} members</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditChannelDialog(channel)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setDeleteConfirm(channel.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
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
                <CardTitle>Direct Messages</CardTitle>
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
              <div className="space-y-3">
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
      </div>

      {/* Shared Documents - Full Width */}
      <Card>
        <CardHeader>
          <CardTitle>Shared Documents</CardTitle>
          <CardDescription>
            Manage shared files and resources
          </CardDescription>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No documents uploaded</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
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
                  <Badge variant="outline" className="text-xs">
                    {doc.category || 'Uncategorized'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Channel Dialog */}
      <Dialog open={isChannelDialogOpen} onOpenChange={setIsChannelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingChannel ? 'Edit Channel' : 'Create New Channel'}
            </DialogTitle>
            <DialogDescription>
              {editingChannel
                ? 'Update the channel settings below.'
                : 'Create a new discussion channel for your team.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Channel Name</Label>
              <Input
                id="name"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="e.g., general-discussion"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={channelDescription}
                onChange={(e) => setChannelDescription(e.target.value)}
                placeholder="What is this channel for?"
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <Label htmlFor="private">Private Channel</Label>
                <p className="text-xs text-gray-500">Only invited members can see this channel</p>
              </div>
              <Switch
                id="private"
                checked={isPrivate}
                onCheckedChange={setIsPrivate}
              />
            </div>

            <div className="space-y-3 border-t pt-4">
              <Label>Access Permissions</Label>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm">Coaches can access</span>
                <Switch
                  checked={allowCoaches}
                  onCheckedChange={setAllowCoaches}
                />
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm">Ambassadors can access</span>
                <Switch
                  checked={allowAmbassadors}
                  onCheckedChange={setAllowAmbassadors}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsChannelDialogOpen(false)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitChannel}
              disabled={!channelName.trim() || isSubmitting}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingChannel ? 'Save Changes' : 'Create Channel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Channel</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this channel? All posts and replies will be permanently removed. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDeleteChannel(deleteConfirm)}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Channel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <Label>Select a person</Label>
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
