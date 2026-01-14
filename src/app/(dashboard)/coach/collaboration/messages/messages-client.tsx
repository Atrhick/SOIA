'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  Mail,
  User,
  Loader2,
  Send,
  ArrowLeft,
  Plus,
} from 'lucide-react'
import {
  getOrCreateDirectMessage,
  sendDirectMessage,
  getDirectMessageHistory,
} from '@/lib/actions/collaboration'

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

export function MessagesClient({
  directMessages: initialDMs,
  availableUsers: initialUsers,
  userId,
}: {
  directMessages: DirectMessage[]
  availableUsers: AvailableUser[]
  userId: string
}) {
  const [directMessages, setDirectMessages] = useState(initialDMs)
  const [availableUsers] = useState(initialUsers)
  const [selectedDM, setSelectedDM] = useState<DMConversation | null>(null)
  const [newDMContent, setNewDMContent] = useState('')
  const [showNewDMDialog, setShowNewDMDialog] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleStartNewDM = async () => {
    if (!selectedUserId) return
    setIsLoading(true)
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
      setIsLoading(false)
    }
  }

  const handleSelectDM = async (dmId: string) => {
    setIsLoading(true)
    try {
      const result = await getDirectMessageHistory(dmId)
      if (result.conversation) {
        setSelectedDM(result.conversation as DMConversation)
      }
    } catch (error) {
      console.error('Error loading DM:', error)
    } finally {
      setIsLoading(false)
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

  // DM list view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Direct Messages</h1>
          <p className="text-gray-600">
            Private conversations with team members
          </p>
        </div>
        <Button onClick={() => setShowNewDMDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Message
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Conversations
          </CardTitle>
          <CardDescription>
            Your private message threads
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : directMessages.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No conversations yet</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setShowNewDMDialog(true)}
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
                    className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
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
                          <p className="text-sm text-gray-500 line-clamp-1">
                            {dm.lastMessage.content}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {dm.messageCount} messages
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
              disabled={!selectedUserId || isLoading}
            >
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Start Conversation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
