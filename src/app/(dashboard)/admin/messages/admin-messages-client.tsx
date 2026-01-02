'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  replyToThread,
  markMessagesAsRead,
  updateThreadStatus,
} from '@/lib/actions/messaging'
import {
  MessageSquare,
  Send,
  ArrowLeft,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  Mail,
  Inbox,
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
  coach?: {
    id: string
    email: string
    role: string
  }
}

interface Stats {
  total: number
  open: number
  inProgress: number
  resolved: number
  unread: number
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

type StatusFilter = 'ALL' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'

export function AdminMessagesClient({
  threads,
  currentUserId,
  stats,
}: {
  threads: Thread[]
  currentUserId: string
  stats: Stats
}) {
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('ALL')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const filteredThreads = threads.filter((t) => {
    if (filter === 'ALL') return true
    return t.status === filter
  })

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

  const handleStatusChange = async (
    threadId: string,
    status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'
  ) => {
    setIsLoading(true)
    setError('')
    const result = await updateThreadStatus(threadId, status)
    if (result.error) {
      setError(result.error)
    }
    setIsLoading(false)
  }

  // Thread List View
  if (!selectedThread) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Message Center</h1>
          <p className="text-gray-600">View and respond to coach messages</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardContent className="py-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-gray-500">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="py-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-700">{stats.open}</p>
                <p className="text-xs text-yellow-600">Open</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="py-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-700">{stats.inProgress}</p>
                <p className="text-xs text-orange-600">In Progress</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50">
            <CardContent className="py-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-700">{stats.resolved}</p>
                <p className="text-xs text-green-600">Resolved</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-red-700">{stats.unread}</p>
                <p className="text-xs text-red-600">Unread</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>
        )}

        {/* Filters */}
        <div className="flex gap-2">
          <Button
            variant={filter === 'ALL' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('ALL')}
          >
            All ({threads.length})
          </Button>
          <Button
            variant={filter === 'OPEN' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('OPEN')}
          >
            <Clock className="h-4 w-4 mr-1" />
            Open ({stats.open})
          </Button>
          <Button
            variant={filter === 'IN_PROGRESS' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('IN_PROGRESS')}
          >
            <AlertCircle className="h-4 w-4 mr-1" />
            In Progress ({stats.inProgress})
          </Button>
          <Button
            variant={filter === 'RESOLVED' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('RESOLVED')}
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            Resolved ({stats.resolved})
          </Button>
        </div>

        {/* Thread List */}
        <Card>
          <CardHeader>
            <CardTitle>Conversations</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredThreads.length > 0 ? (
              <div className="divide-y">
                {filteredThreads.map((thread) => {
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
                            {thread.coach && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {thread.coach.email}
                              </span>
                            )}
                          </div>
                          {lastMessage && (
                            <p className="text-sm text-gray-500 mt-2 truncate">
                              <span className="font-medium">
                                {lastMessage.sender.role === 'ADMIN'
                                  ? 'You'
                                  : 'Coach'}
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
                <Inbox className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-4 text-gray-500">
                  {filter === 'ALL'
                    ? 'No messages yet'
                    : `No ${filter.toLowerCase().replace('_', ' ')} conversations`}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Thread Detail View
  const statusInfo = statusConfig[selectedThread.status]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setSelectedThread(null)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">
                {selectedThread.subject}
              </h1>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
              <Badge variant="secondary" className="text-xs">
                {categoryLabels[selectedThread.category]}
              </Badge>
              {selectedThread.coach && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {selectedThread.coach.email}
                </span>
              )}
              <span>Started {new Date(selectedThread.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Status Controls */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Status:</span>
          <select
            value={selectedThread.status}
            onChange={(e) =>
              handleStatusChange(
                selectedThread.id,
                e.target.value as 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'
              )
            }
            disabled={isLoading}
            className="text-sm rounded-md border border-input bg-background px-2 py-1"
          >
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
          </select>
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
              const isAdmin = message.sender.role === 'ADMIN'

              return (
                <div
                  key={message.id}
                  className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      isAdmin
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {!isAdmin && (
                        <Badge variant="secondary" className="text-xs">
                          Coach
                        </Badge>
                      )}
                      <span className={`text-xs ${isAdmin ? 'text-primary-200' : 'text-gray-500'}`}>
                        {isAdmin ? 'You' : message.sender.email}
                      </span>
                      <span className={`text-xs ${isAdmin ? 'text-primary-200' : 'text-gray-400'}`}>
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
              <p className="text-sm text-gray-500 mt-2">
                Change status to reopen this conversation
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
