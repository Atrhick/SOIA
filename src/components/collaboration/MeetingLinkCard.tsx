'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Video, ExternalLink, Calendar, Clock, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type MeetingProvider = 'ZOOM' | 'GOOGLE_MEET' | 'MICROSOFT_TEAMS' | 'CUSTOM'

type MeetingLinkCardProps = {
  id: string
  provider: MeetingProvider
  url: string
  title?: string | null
  scheduledAt?: string | null
  duration?: number | null
  onRemove?: (id: string) => Promise<void>
  compact?: boolean
}

const PROVIDER_CONFIG: Record<MeetingProvider, { name: string; color: string; bgColor: string }> = {
  ZOOM: { name: 'Zoom', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  GOOGLE_MEET: { name: 'Google Meet', color: 'text-green-600', bgColor: 'bg-green-100' },
  MICROSOFT_TEAMS: { name: 'Teams', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  CUSTOM: { name: 'Meeting', color: 'text-gray-600', bgColor: 'bg-gray-100' },
}

export function MeetingLinkCard({
  id,
  provider,
  url,
  title,
  scheduledAt,
  duration,
  onRemove,
  compact = false,
}: MeetingLinkCardProps) {
  const config = PROVIDER_CONFIG[provider]

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  const handleJoin = () => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
        <div className={cn('p-1 rounded', config.bgColor)}>
          <Video className={cn('h-3 w-3', config.color)} />
        </div>
        <span className="text-sm font-medium">{config.name}</span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={handleJoin}
        >
          Join
          <ExternalLink className="h-3 w-3 ml-1" />
        </Button>
      </div>
    )
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={cn('p-2 rounded-lg', config.bgColor)}>
            <Video className={cn('h-5 w-5', config.color)} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">
                {title || config.name}
              </span>
              <span className={cn('text-xs px-2 py-0.5 rounded', config.bgColor, config.color)}>
                {config.name}
              </span>
            </div>

            {(scheduledAt || duration) && (
              <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                {scheduledAt && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDateTime(scheduledAt)}
                  </span>
                )}
                {duration && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDuration(duration)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onRemove && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
              onClick={() => onRemove(id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleJoin}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Join
          </Button>
        </div>
      </div>
    </Card>
  )
}

// Helper to detect meeting URL provider
export function detectMeetingProvider(url: string): MeetingProvider | null {
  const lowerUrl = url.toLowerCase()
  if (lowerUrl.includes('zoom.us') || lowerUrl.includes('zoom.com')) {
    return 'ZOOM'
  }
  if (lowerUrl.includes('meet.google.com')) {
    return 'GOOGLE_MEET'
  }
  if (lowerUrl.includes('teams.microsoft.com') || lowerUrl.includes('teams.live.com')) {
    return 'MICROSOFT_TEAMS'
  }
  return null
}

// Component for adding meeting links
type AddMeetingLinkProps = {
  onAdd: (provider: MeetingProvider, url: string, title?: string) => Promise<void>
}

export function AddMeetingLinkForm({ onAdd }: AddMeetingLinkProps) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const detectedProvider = url ? detectMeetingProvider(url) : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    const provider = detectedProvider || 'CUSTOM'
    setIsSubmitting(true)
    try {
      await onAdd(provider, url, title || undefined)
      setUrl('')
      setTitle('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste meeting link (Zoom, Google Meet, Teams)..."
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        {detectedProvider && (
          <p className="mt-1 text-xs text-green-600">
            Detected: {PROVIDER_CONFIG[detectedProvider].name}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Meeting title (optional)"
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <Button type="submit" size="sm" disabled={!url.trim() || isSubmitting}>
          Add
        </Button>
      </div>
    </form>
  )
}
