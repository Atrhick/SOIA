'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  MessageSquare,
  Users,
  Lightbulb,
  Zap,
  GraduationCap,
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import {
  approveInterview,
  markWhatsAppTeamCreated,
  inviteToPowerTeam,
  updateAmbassadorOnboardingProgress
} from '@/lib/actions/ambassador-onboarding'
import { useRouter } from 'next/navigation'

interface OnboardingTask {
  id: string
  label: string
  description: string | null
  type: string
  isRequired: boolean
  sortOrder: number
}

interface OnboardingProgress {
  id: string
  taskId: string
  status: string
  completedAt: string | null
  notes: string | null
  task: OnboardingTask
}

interface BusinessIdea {
  id: string
  title: string
  status: string
}

interface Ambassador {
  id: string
  firstName: string
  lastName: string
  email: string | null
  user: {
    email: string
    status: string
  } | null
  coach: {
    firstName: string
    lastName: string
  }
  onboardingProgress: OnboardingProgress[]
  businessIdea: BusinessIdea | null
  whatsappGroupCreated: boolean
  whatsappGroupLink: string | null
  powerTeamInvited: boolean
  createdAt: string
}

interface AmbassadorOnboardingClientProps {
  ambassadors: Ambassador[]
  tasks: OnboardingTask[]
}

const taskIcons: Record<string, React.ElementType> = {
  INTERVIEW: MessageSquare,
  WHATSAPP_TEAM: Users,
  BUSINESS_IDEA: Lightbulb,
  POWER_TEAM: Zap,
  CLASS_SELECTION: GraduationCap,
}

export function AmbassadorOnboardingClient({ ambassadors, tasks }: AmbassadorOnboardingClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actionDialog, setActionDialog] = useState<{
    type: string
    ambassadorId: string
    ambassadorName: string
  } | null>(null)
  const [notes, setNotes] = useState('')
  const [groupLink, setGroupLink] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const getProgressPercentage = (ambassador: Ambassador) => {
    const requiredTasks = tasks.filter(t => t.isRequired)
    const completedCount = requiredTasks.filter(t => {
      const progress = ambassador.onboardingProgress.find(p => p.taskId === t.id)
      return progress?.status === 'APPROVED'
    }).length
    return requiredTasks.length > 0 ? Math.round((completedCount / requiredTasks.length) * 100) : 0
  }

  const getTaskStatus = (ambassador: Ambassador, taskId: string) => {
    const progress = ambassador.onboardingProgress.find(p => p.taskId === taskId)
    return progress?.status || 'NOT_STARTED'
  }

  const filteredAmbassadors = ambassadors.filter(a => {
    const matchesSearch = search === '' ||
      `${a.firstName} ${a.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      a.email?.toLowerCase().includes(search.toLowerCase())

    if (statusFilter === 'all') return matchesSearch
    if (statusFilter === 'incomplete') {
      return matchesSearch && getProgressPercentage(a) < 100
    }
    if (statusFilter === 'complete') {
      return matchesSearch && getProgressPercentage(a) === 100
    }
    return matchesSearch
  })

  const handleAction = async () => {
    if (!actionDialog) return
    setIsSubmitting(true)

    let result
    switch (actionDialog.type) {
      case 'INTERVIEW':
        result = await approveInterview(actionDialog.ambassadorId, notes)
        break
      case 'WHATSAPP_TEAM':
        result = await markWhatsAppTeamCreated(actionDialog.ambassadorId, groupLink)
        break
      case 'POWER_TEAM':
        result = await inviteToPowerTeam(actionDialog.ambassadorId)
        break
      default:
        result = { error: 'Unknown action' }
    }

    if (result.error) {
      alert(result.error)
    } else {
      setActionDialog(null)
      setNotes('')
      setGroupLink('')
      router.refresh()
    }
    setIsSubmitting(false)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Badge className="bg-green-100 text-green-700">Approved</Badge>
      case 'SUBMITTED':
        return <Badge className="bg-yellow-100 text-yellow-700">Submitted</Badge>
      case 'IN_PROGRESS':
        return <Badge className="bg-blue-100 text-blue-700">In Progress</Badge>
      case 'REJECTED':
        return <Badge className="bg-red-100 text-red-700">Rejected</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-700">Not Started</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ambassador Onboarding</h1>
        <p className="text-gray-600 mt-1">
          Review and manage ambassador onboarding progress
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search ambassadors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Ambassadors</SelectItem>
            <SelectItem value="incomplete">Incomplete</SelectItem>
            <SelectItem value="complete">Complete</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Ambassadors List */}
      <div className="space-y-4">
        {filteredAmbassadors.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No ambassadors found</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredAmbassadors.map((ambassador) => {
            const progress = getProgressPercentage(ambassador)
            const isExpanded = expandedId === ambassador.id

            return (
              <Card key={ambassador.id} className="border-2">
                <CardContent className="pt-6">
                  {/* Summary Row */}
                  <div
                    className="flex items-center gap-4 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : ambassador.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">
                          {ambassador.firstName} {ambassador.lastName}
                        </h3>
                        {progress === 100 && (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        Coach: {ambassador.coach.firstName} {ambassador.coach.lastName}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">{progress}%</p>
                        <Progress value={progress} className="w-24 h-2" />
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-6 pt-6 border-t space-y-4">
                      {tasks.map((task) => {
                        const status = getTaskStatus(ambassador, task.id)
                        const TaskIcon = taskIcons[task.type] || AlertCircle
                        const canApprove = status !== 'APPROVED' && ['INTERVIEW', 'WHATSAPP_TEAM', 'POWER_TEAM'].includes(task.type)

                        return (
                          <div
                            key={task.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <TaskIcon className={`w-5 h-5 ${status === 'APPROVED' ? 'text-green-500' : 'text-gray-400'}`} />
                              <div>
                                <p className="font-medium text-gray-900">{task.label}</p>
                                {task.description && (
                                  <p className="text-xs text-gray-500">{task.description}</p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {getStatusBadge(status)}
                              {canApprove && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setActionDialog({
                                      type: task.type,
                                      ambassadorId: ambassador.id,
                                      ambassadorName: `${ambassador.firstName} ${ambassador.lastName}`
                                    })
                                  }}
                                >
                                  Approve
                                </Button>
                              )}
                              {task.type === 'BUSINESS_IDEA' && ambassador.businessIdea && (
                                <Badge className={
                                  ambassador.businessIdea.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                  ambassador.businessIdea.status === 'SUBMITTED' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-gray-100 text-gray-700'
                                }>
                                  {ambassador.businessIdea.status}
                                </Badge>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={(open) => { if (!open) { setActionDialog(null); setNotes(''); setGroupLink('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.type === 'INTERVIEW' && 'Approve Interview'}
              {actionDialog?.type === 'WHATSAPP_TEAM' && 'Mark WhatsApp Team Created'}
              {actionDialog?.type === 'POWER_TEAM' && 'Invite to Power Team'}
            </DialogTitle>
            <DialogDescription>
              {actionDialog?.ambassadorName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {actionDialog?.type === 'INTERVIEW' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Interview Notes (optional)</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes from the interview..."
                  rows={3}
                />
              </div>
            )}

            {actionDialog?.type === 'WHATSAPP_TEAM' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">WhatsApp Group Link (optional)</label>
                <Input
                  value={groupLink}
                  onChange={(e) => setGroupLink(e.target.value)}
                  placeholder="https://chat.whatsapp.com/..."
                />
              </div>
            )}

            {actionDialog?.type === 'POWER_TEAM' && (
              <p className="text-sm text-gray-600">
                This will mark the ambassador as invited to the Power Team group.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionDialog(null); setNotes(''); setGroupLink('') }}>
              Cancel
            </Button>
            <Button onClick={handleAction} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
