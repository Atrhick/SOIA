'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  createMessageThread,
  replyToThread,
  markMessagesAsRead,
} from '@/lib/actions/messaging'
import {
  MessageSquare,
  Plus,
  Send,
  ArrowLeft,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  Mail,
} from 'lucide-react'

interface Message {
  id: string
  content: string
  isRead: boolean
  createdAt: string
  sender: {
    id: string
    email: string
    role: string
  }
}

interface Thread {
  id: string
  subject: string
  category: string
  status: string
  createdAt: string
  updatedAt: string
  participants: {
    id: string
    email: string
    role: string
  }[]
  messages: Message[]
  unreadCount: number
}

const categoryLabels: Record<string, string> = {
  ONBOARDING: 'Onboarding',
  AMBASSADORS: 'Ambassadors',
  SPONSORSHIP: 'Sponsorship',
  EVENTS: 'Events',
  TECHNICAL: 'Technical',
  OTHER: 'Other',
}

const statusConfig: Record<string, { label: string; variant: 'secondary' | 'warning' | 'success' }> = {
  OPEN: { label: 'Open', variant: 'secondary' },
  IN_PROGRESS: { label: 'In Progress', variant: 'warning' },
  RESOLVED: { label: 'Resolved', variant: 'success' },
}

export function MessagesClient({
  threads,
  currentUserId,
}: {
  threads: Thread[]
  currentUserId: string
}) {
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null)
  const [showNewThread, setShowNewThread] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (selectedThread && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [selectedThread])

  // Mark messages as read when opening a thread
  useEffect(() => {
    if (selectedThread && selectedThread.unreadCount > 0) {
      markMessagesAsRead(selectedThread.id)
    }
  }, [selectedThread])

  const handleCreateThread = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const result = await createMessageThread(formData)

    if (result.error) {
      setError(result.error)
    } else {
      setShowNewThread(false)
      ;(e.target as HTMLFormElement).reset()
    }
    setIsLoading(false)
  }

  const handleReply = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedThread) return

    setIsLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const result = await replyToThread(selectedThread.id, formData)

    if (result.error) {
      setError(result.error)
    } else {
      ;(e.target as HTMLFormElement).reset()
    }
    setIsLoading(false)
  }

  // Thread List View
  if (!selectedThread && !showNewThread) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
            <p className="text-gray-600">Communicate with administrators</p>
          </div>
          <Button onClick={() => setShowNewThread(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Message
          </Button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>
        )}

        {/* Thread List */}
        <Card>
          <CardHeader>
            <CardTitle>Your Conversations</CardTitle>
          </CardHeader>
          <CardContent>
            {threads.length > 0 ? (
              <div className="divide-y">
                {threads.map((thread) => {
                  const statusInfo = statusConfig[thread.status]
                  const lastMessage = thread.messages[thread.messages.length - 1]

                  return (
                    <button
                      key={thread.id}
                      onClick={() => setSelectedThread(thread)}
                      className="w-full text-left py-4 hover:bg-gray-50 -mx-6 px-6 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium truncate">
                              {thread.subject}
                            </h4>
                            {thread.unreadCount > 0 && (
                              <Badge variant="destructive" className="text-xs">
                                {thread.unreadCount} new
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {categoryLabels[thread.category]}
                            </Badge>
                            <Badge variant={statusInfo.variant} className="text-xs">
                              {statusInfo.label}
                            </Badge>
                          </div>
                          {lastMessage && (
                            <p className="text-sm text-gray-500 mt-2 truncate">
                              <span className="font-medium">
                                {lastMessage.sender.id === currentUserId
                                  ? 'You'
                                  : lastMessage.sender.role === 'ADMIN' ? 'Admin' : lastMessage.sender.email}
                                :
                              </span>{' '}
                              {lastMessage.content}
                            </p>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 whitespace-nowrap">
                          {new Date(thread.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-4 text-gray-500">No messages yet</p>
                <Button className="mt-4" onClick={() => setShowNewThread(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Start a Conversation
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // New Thread Form
  if (showNewThread) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setShowNewThread(false)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">New Message</h1>
            <p className="text-gray-600">Start a new conversation with admins</p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>
        )}

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleCreateThread} className="space-y-4">
              <Input
                name="subject"
                label="Subject"
                placeholder="What's this about?"
                required
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  name="category"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="ONBOARDING">Onboarding</option>
                  <option value="AMBASSADORS">Ambassadors</option>
                  <option value="SPONSORSHIP">Sponsorship</option>
                  <option value="EVENTS">Events</option>
                  <option value="TECHNICAL">Technical Support</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  name="message"
                  rows={6}
                  required
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Type your message here..."
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewThread(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={isLoading}>
                  <Send className="h-4 w-4 mr-2" />
                  Send Message
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Thread Detail View
  if (selectedThread) {
    const statusInfo = statusConfig[selectedThread.status]

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setSelectedThread(null)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">
                {selectedThread.subject}
              </h1>
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Badge variant="secondary" className="text-xs">
                {categoryLabels[selectedThread.category]}
              </Badge>
              <span>Started {new Date(selectedThread.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>
        )}

        {/* Messages */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {selectedThread.messages.map((message) => {
                const isOwn = message.sender.id === currentUserId
                const isAdmin = message.sender.role === 'ADMIN'

                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        isOwn
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {isAdmin && !isOwn && (
                          <Badge variant="secondary" className="text-xs">
                            Admin
                          </Badge>
                        )}
                        <span className={`text-xs ${isOwn ? 'text-primary-200' : 'text-gray-500'}`}>
                          {isOwn ? 'You' : isAdmin ? 'Admin' : message.sender.email}
                        </span>
                        <span className={`text-xs ${isOwn ? 'text-primary-200' : 'text-gray-400'}`}>
                          {new Date(message.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply Form */}
            {selectedThread.status !== 'RESOLVED' && (
              <form onSubmit={handleReply} className="mt-6 pt-4 border-t">
                <div className="flex gap-2">
                  <textarea
                    name="content"
                    rows={2}
                    required
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Type your reply..."
                  />
                  <Button type="submit" isLoading={isLoading}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            )}

            {selectedThread.status === 'RESOLVED' && (
              <div className="mt-6 pt-4 border-t text-center">
                <Badge variant="success" className="text-sm">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  This conversation has been resolved
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}
