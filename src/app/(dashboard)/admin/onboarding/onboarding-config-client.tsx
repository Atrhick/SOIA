'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  createCoachOnboardingTask,
  updateCoachOnboardingTask,
  deleteCoachOnboardingTask,
  reorderCoachOnboardingTasks,
  createAmbassadorOnboardingTask,
  updateAmbassadorOnboardingTask,
  deleteAmbassadorOnboardingTask,
  reorderAmbassadorOnboardingTasks,
  toggleTaskActive,
} from '@/lib/actions/onboarding-config'
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Users,
  UserCheck,
  CheckCircle2,
  XCircle,
  ArrowUp,
  ArrowDown,
  Video,
  FileQuestion,
  Upload,
  ToggleLeft,
  ClipboardCheck,
  MessageSquare,
  Lightbulb,
  UsersRound,
  GraduationCap,
} from 'lucide-react'

interface Task {
  id: string
  label: string
  description: string | null
  type: string
  isRequired: boolean
  sortOrder: number
  isActive: boolean
  progressCount: number
  createdAt: string
  updatedAt: string
}

interface OnboardingConfigClientProps {
  coachTasks: Task[]
  ambassadorTasks: Task[]
}

const coachTaskTypes = [
  { value: 'MANUAL_STATUS', label: 'Manual Status', icon: ClipboardCheck },
  { value: 'VIDEO', label: 'Video', icon: Video },
  { value: 'QUIZ', label: 'Quiz', icon: FileQuestion },
  { value: 'UPLOAD', label: 'Upload', icon: Upload },
  { value: 'BOOLEAN', label: 'Checkbox', icon: ToggleLeft },
]

const ambassadorTaskTypes = [
  { value: 'INTERVIEW', label: 'Interview', icon: UserCheck },
  { value: 'WHATSAPP_TEAM', label: 'WhatsApp Team', icon: MessageSquare },
  { value: 'BUSINESS_IDEA', label: 'Business Idea', icon: Lightbulb },
  { value: 'POWER_TEAM', label: 'Power Team', icon: UsersRound },
  { value: 'CLASS_SELECTION', label: 'Class Selection', icon: GraduationCap },
  { value: 'MANUAL_STATUS', label: 'Manual Status', icon: ClipboardCheck },
]

export function OnboardingConfigClient({ coachTasks, ambassadorTasks }: OnboardingConfigClientProps) {
  const [activeTab, setActiveTab] = useState<'coach' | 'ambassador'>('coach')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tasks = activeTab === 'coach' ? coachTasks : ambassadorTasks
  const taskTypes = activeTab === 'coach' ? coachTaskTypes : ambassadorTaskTypes

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const result = activeTab === 'coach'
      ? await createCoachOnboardingTask(formData)
      : await createAmbassadorOnboardingTask(formData)

    if (result.error) {
      setError(result.error)
    } else {
      setIsCreateOpen(false)
    }
    setIsSubmitting(false)
  }

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingTask) return

    setIsSubmitting(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const result = activeTab === 'coach'
      ? await updateCoachOnboardingTask(editingTask.id, formData)
      : await updateAmbassadorOnboardingTask(editingTask.id, formData)

    if (result.error) {
      setError(result.error)
    } else {
      setEditingTask(null)
    }
    setIsSubmitting(false)
  }

  const handleDelete = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task? If coaches/ambassadors have progress on this task, it will be deactivated instead.')) {
      return
    }

    const result = activeTab === 'coach'
      ? await deleteCoachOnboardingTask(taskId)
      : await deleteAmbassadorOnboardingTask(taskId)

    if (result.error) {
      alert(result.error)
    }
  }

  const handleToggleActive = async (taskId: string) => {
    await toggleTaskActive(taskId, activeTab)
  }

  const handleMoveUp = async (index: number) => {
    if (index === 0) return
    const newOrder = [...tasks]
    const temp = newOrder[index]
    newOrder[index] = newOrder[index - 1]
    newOrder[index - 1] = temp

    const taskIds = newOrder.map((t) => t.id)
    activeTab === 'coach'
      ? await reorderCoachOnboardingTasks(taskIds)
      : await reorderAmbassadorOnboardingTasks(taskIds)
  }

  const handleMoveDown = async (index: number) => {
    if (index === tasks.length - 1) return
    const newOrder = [...tasks]
    const temp = newOrder[index]
    newOrder[index] = newOrder[index + 1]
    newOrder[index + 1] = temp

    const taskIds = newOrder.map((t) => t.id)
    activeTab === 'coach'
      ? await reorderCoachOnboardingTasks(taskIds)
      : await reorderAmbassadorOnboardingTasks(taskIds)
  }

  const getTaskTypeIcon = (type: string) => {
    const taskType = taskTypes.find((t) => t.value === type)
    return taskType?.icon || ClipboardCheck
  }

  const getTaskTypeLabel = (type: string) => {
    const taskType = taskTypes.find((t) => t.value === type)
    return taskType?.label || type
  }

  const TaskForm = ({ task, onSubmit, isEdit }: { task?: Task; onSubmit: (e: React.FormEvent<HTMLFormElement>) => void; isEdit: boolean }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="label">Task Label *</Label>
        <Input
          id="label"
          name="label"
          defaultValue={task?.label || ''}
          placeholder="e.g., Complete Profile"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          name="description"
          defaultValue={task?.description || ''}
          placeholder="Describe what the user needs to do..."
          rows={3}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">Task Type *</Label>
        <Select name="type" defaultValue={task?.type || taskTypes[0].value}>
          <SelectTrigger>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {taskTypes.map((type) => {
              const Icon = type.icon
              return (
                <SelectItem key={type.value} value={type.value}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {type.label}
                  </div>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sortOrder">Sort Order</Label>
          <Input
            id="sortOrder"
            name="sortOrder"
            type="number"
            defaultValue={task?.sortOrder || tasks.length + 1}
            min={1}
          />
        </div>

        <div className="space-y-2">
          <Label>Options</Label>
          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isRequired"
                value="true"
                defaultChecked={task?.isRequired ?? true}
                className="rounded border-gray-300"
              />
              Required task
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isActive"
                value="true"
                defaultChecked={task?.isActive ?? true}
                className="rounded border-gray-300"
              />
              Active (visible to users)
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => isEdit ? setEditingTask(null) : setIsCreateOpen(false)}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Task'}
        </Button>
      </div>
    </form>
  )

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('coach')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
            activeTab === 'coach'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <UserCheck className="h-4 w-4" />
          Coach Tasks ({coachTasks.length})
        </button>
        <button
          onClick={() => setActiveTab('ambassador')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
            activeTab === 'ambassador'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="h-4 w-4" />
          Ambassador Tasks ({ambassadorTasks.length})
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{tasks.length}</div>
            <p className="text-sm text-gray-500">Total Tasks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {tasks.filter((t) => t.isActive).length}
            </div>
            <p className="text-sm text-gray-500">Active Tasks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">
              {tasks.filter((t) => t.isRequired).length}
            </div>
            <p className="text-sm text-gray-500">Required Tasks</p>
          </CardContent>
        </Card>
      </div>

      {/* Task List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>
              {activeTab === 'coach' ? 'Coach' : 'Ambassador'} Onboarding Tasks
            </CardTitle>
            <CardDescription>
              {activeTab === 'coach'
                ? 'Tasks that coaches must complete during onboarding'
                : 'Tasks that ambassadors must complete during onboarding'}
            </CardDescription>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Onboarding Task</DialogTitle>
                <DialogDescription>
                  Add a new {activeTab === 'coach' ? 'coach' : 'ambassador'} onboarding task
                </DialogDescription>
              </DialogHeader>
              <TaskForm onSubmit={handleCreate} isEdit={false} />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No onboarding tasks configured yet.</p>
              <p className="text-sm">Click &quot;Add Task&quot; to create one.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task, index) => {
                const Icon = getTaskTypeIcon(task.type)
                return (
                  <div
                    key={task.id}
                    className={`flex items-center gap-4 p-4 rounded-lg border ${
                      task.isActive ? 'bg-white' : 'bg-gray-50 opacity-60'
                    }`}
                  >
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleMoveDown(index)}
                        disabled={index === tasks.length - 1}
                        className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-600 font-medium text-sm">
                      {task.sortOrder}
                    </div>

                    <div className="p-2 rounded-lg bg-primary-50">
                      <Icon className="h-5 w-5 text-primary-600" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{task.label}</h3>
                        {task.isRequired && (
                          <Badge variant="secondary" className="text-xs">Required</Badge>
                        )}
                        {!task.isActive && (
                          <Badge variant="destructive" className="text-xs">Inactive</Badge>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-sm text-gray-500 truncate">{task.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                        <span>Type: {getTaskTypeLabel(task.type)}</span>
                        <span>{task.progressCount} users with progress</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={task.isActive}
                        onCheckedChange={() => handleToggleActive(task.id)}
                      />

                      <Dialog open={editingTask?.id === task.id} onOpenChange={(open) => !open && setEditingTask(null)}>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingTask(task)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit Onboarding Task</DialogTitle>
                            <DialogDescription>
                              Update the task details
                            </DialogDescription>
                          </DialogHeader>
                          <TaskForm task={task} onSubmit={handleUpdate} isEdit={true} />
                        </DialogContent>
                      </Dialog>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(task.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Task Type Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {taskTypes.map((type) => {
              const Icon = type.icon
              return (
                <div key={type.value} className="flex items-center gap-2 text-sm">
                  <Icon className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">{type.label}</span>
                </div>
              )
            })}
          </div>
          <p className="mt-4 text-sm text-gray-500">
            {activeTab === 'coach' ? (
              <>
                <strong>Manual Status:</strong> Admin manually marks as complete.{' '}
                <strong>Video:</strong> User watches a video.{' '}
                <strong>Quiz:</strong> User passes an assessment.{' '}
                <strong>Upload:</strong> User uploads a file.{' '}
                <strong>Checkbox:</strong> User confirms completion.
              </>
            ) : (
              <>
                <strong>Interview:</strong> Admin approves after interview.{' '}
                <strong>WhatsApp Team:</strong> Admin creates support group.{' '}
                <strong>Business Idea:</strong> User submits business idea.{' '}
                <strong>Power Team:</strong> Admin invites to power team.{' '}
                <strong>Class Selection:</strong> User enrolls in a class.
              </>
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
