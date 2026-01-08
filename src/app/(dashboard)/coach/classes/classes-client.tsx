'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  BookOpen,
  Plus,
  Edit,
  Trash2,
  Calendar,
  Clock,
  MapPin,
  Video,
  Users,
  DollarSign,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react'
import { createClass, updateClass, deleteClass, toggleClassActive, markAttendance } from '@/lib/actions/classes'
import { useRouter } from 'next/navigation'

interface Enrollment {
  id: string
  status: string
  paymentStatus: string
  enrolledAt: string
  attendedAt: string | null
  ambassador: {
    id: string
    firstName: string
    lastName: string
  }
}

interface CoachClass {
  id: string
  title: string
  description: string | null
  date: string | null
  duration: number | null
  location: string | null
  isOnline: boolean
  meetingLink: string | null
  isFree: boolean
  price: number | null
  maxCapacity: number | null
  isActive: boolean
  enrollments: Enrollment[]
  _count: {
    enrollments: number
  }
}

interface ClassesClientProps {
  classes: CoachClass[]
}

export function ClassesClient({ classes: initialClasses }: ClassesClientProps) {
  const router = useRouter()
  const [classes, setClasses] = useState(initialClasses)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingClass, setEditingClass] = useState<CoachClass | null>(null)
  const [viewingClass, setViewingClass] = useState<CoachClass | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [duration, setDuration] = useState('')
  const [location, setLocation] = useState('')
  const [isOnline, setIsOnline] = useState(false)
  const [meetingLink, setMeetingLink] = useState('')
  const [isFree, setIsFree] = useState(true)
  const [price, setPrice] = useState('')
  const [maxCapacity, setMaxCapacity] = useState('')

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setDate('')
    setDuration('')
    setLocation('')
    setIsOnline(false)
    setMeetingLink('')
    setIsFree(true)
    setPrice('')
    setMaxCapacity('')
  }

  const openEditDialog = (classItem: CoachClass) => {
    setEditingClass(classItem)
    setTitle(classItem.title)
    setDescription(classItem.description || '')
    setDate(classItem.date ? classItem.date.split('T')[0] : '')
    setDuration(classItem.duration?.toString() || '')
    setLocation(classItem.location || '')
    setIsOnline(classItem.isOnline)
    setMeetingLink(classItem.meetingLink || '')
    setIsFree(classItem.isFree)
    setPrice(classItem.price?.toString() || '')
    setMaxCapacity(classItem.maxCapacity?.toString() || '')
  }

  const handleCreate = async () => {
    setError(null)
    setIsSubmitting(true)

    const formData = new FormData()
    formData.set('title', title)
    formData.set('description', description)
    if (date) formData.set('date', date)
    if (duration) formData.set('duration', duration)
    if (location) formData.set('location', location)
    formData.set('isOnline', isOnline.toString())
    if (meetingLink) formData.set('meetingLink', meetingLink)
    formData.set('isFree', isFree.toString())
    if (!isFree && price) formData.set('price', price)
    if (maxCapacity) formData.set('maxCapacity', maxCapacity)

    const result = await createClass(formData)
    if (result.error) {
      setError(result.error)
    } else {
      setIsCreateOpen(false)
      resetForm()
      router.refresh()
    }
    setIsSubmitting(false)
  }

  const handleUpdate = async () => {
    if (!editingClass) return
    setError(null)
    setIsSubmitting(true)

    const formData = new FormData()
    formData.set('title', title)
    formData.set('description', description)
    if (date) formData.set('date', date)
    if (duration) formData.set('duration', duration)
    if (location) formData.set('location', location)
    formData.set('isOnline', isOnline.toString())
    if (meetingLink) formData.set('meetingLink', meetingLink)
    formData.set('isFree', isFree.toString())
    if (!isFree && price) formData.set('price', price)
    if (maxCapacity) formData.set('maxCapacity', maxCapacity)

    const result = await updateClass(editingClass.id, formData)
    if (result.error) {
      setError(result.error)
    } else {
      setEditingClass(null)
      resetForm()
      router.refresh()
    }
    setIsSubmitting(false)
  }

  const handleDelete = async (classId: string) => {
    if (!confirm('Are you sure you want to delete this class?')) return

    const result = await deleteClass(classId)
    if (result.error) {
      alert(result.error)
    } else {
      router.refresh()
    }
  }

  const handleToggleActive = async (classId: string) => {
    const result = await toggleClassActive(classId)
    if (result.error) {
      alert(result.error)
    } else {
      router.refresh()
    }
  }

  const handleMarkAttendance = async (classId: string, ambassadorId: string, attended: boolean) => {
    const result = await markAttendance(classId, [ambassadorId], attended)
    if (result.error) {
      alert(result.error)
    } else {
      router.refresh()
    }
  }

  const ClassForm = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Class Title *</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Introduction to Business Planning"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What will students learn in this class?"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="duration">Duration (minutes)</Label>
          <Input
            id="duration"
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="60"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="isOnline"
          checked={isOnline}
          onCheckedChange={setIsOnline}
        />
        <Label htmlFor="isOnline">Online Class</Label>
      </div>

      {isOnline ? (
        <div className="space-y-2">
          <Label htmlFor="meetingLink">Meeting Link</Label>
          <Input
            id="meetingLink"
            value={meetingLink}
            onChange={(e) => setMeetingLink(e.target.value)}
            placeholder="https://zoom.us/..."
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Room 101, Community Center"
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <Switch
          id="isFree"
          checked={isFree}
          onCheckedChange={setIsFree}
        />
        <Label htmlFor="isFree">Free Class</Label>
      </div>

      {!isFree && (
        <div className="space-y-2">
          <Label htmlFor="price">Price ($)</Label>
          <Input
            id="price"
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="25.00"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="maxCapacity">Max Capacity (leave empty for unlimited)</Label>
        <Input
          id="maxCapacity"
          type="number"
          value={maxCapacity}
          onChange={(e) => setMaxCapacity(e.target.value)}
          placeholder="20"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Classes</h1>
          <p className="text-gray-600 mt-1">
            Create and manage classes for ambassadors
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetForm() }}>
          <DialogTrigger asChild>
            <Button className="bg-primary-600 hover:bg-primary-700">
              <Plus className="w-4 h-4 mr-2" />
              Create Class
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Class</DialogTitle>
              <DialogDescription>
                Create a class that ambassadors can enroll in.
              </DialogDescription>
            </DialogHeader>
            <ClassForm />
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm() }}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={isSubmitting || !title}>
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Create Class
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Classes List */}
      {classes.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No classes created yet</p>
              <p className="text-sm text-gray-400 mt-1">Create your first class to get started</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {classes.map((classItem) => (
            <Card key={classItem.id} className={`border-2 ${!classItem.isActive ? 'opacity-60' : ''}`}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900">{classItem.title}</h3>
                      {classItem.isFree ? (
                        <Badge className="bg-green-100 text-green-700">Free</Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700">
                          ${classItem.price?.toFixed(2)}
                        </Badge>
                      )}
                      {!classItem.isActive && (
                        <Badge className="bg-gray-100 text-gray-700">Inactive</Badge>
                      )}
                    </div>

                    {classItem.description && (
                      <p className="text-sm text-gray-600 mb-3">{classItem.description}</p>
                    )}

                    <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                      {classItem.date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(classItem.date).toLocaleDateString()}
                        </div>
                      )}
                      {classItem.duration && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {classItem.duration} min
                        </div>
                      )}
                      {classItem.isOnline ? (
                        <div className="flex items-center gap-1">
                          <Video className="w-4 h-4" />
                          Online
                        </div>
                      ) : classItem.location ? (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {classItem.location}
                        </div>
                      ) : null}
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {classItem._count.enrollments}
                        {classItem.maxCapacity ? `/${classItem.maxCapacity}` : ''} enrolled
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setViewingClass(classItem)}
                    >
                      <Users className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(classItem.id)}
                    >
                      {classItem.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(classItem)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(classItem.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingClass} onOpenChange={(open) => { if (!open) { setEditingClass(null); resetForm() } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Class</DialogTitle>
            <DialogDescription>
              Update the class details.
            </DialogDescription>
          </DialogHeader>
          <ClassForm />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingClass(null); resetForm() }}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isSubmitting || !title}>
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Enrollments Dialog */}
      <Dialog open={!!viewingClass} onOpenChange={(open) => { if (!open) setViewingClass(null) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewingClass?.title} - Enrollments</DialogTitle>
            <DialogDescription>
              View and manage enrolled ambassadors.
            </DialogDescription>
          </DialogHeader>
          {viewingClass && viewingClass.enrollments.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No enrollments yet</p>
            </div>
          ) : viewingClass ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ambassador</TableHead>
                  <TableHead>Enrolled</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Attendance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {viewingClass.enrollments.map((enrollment) => (
                  <TableRow key={enrollment.id}>
                    <TableCell className="font-medium">
                      {enrollment.ambassador.firstName} {enrollment.ambassador.lastName}
                    </TableCell>
                    <TableCell>
                      {new Date(enrollment.enrolledAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        enrollment.status === 'ATTENDED' ? 'bg-green-100 text-green-700' :
                        enrollment.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      }>
                        {enrollment.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        enrollment.paymentStatus === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                        enrollment.paymentStatus === 'NOT_REQUIRED' ? 'bg-gray-100 text-gray-700' :
                        'bg-yellow-100 text-yellow-700'
                      }>
                        {enrollment.paymentStatus.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMarkAttendance(
                          viewingClass.id,
                          enrollment.ambassador.id,
                          enrollment.status !== 'ATTENDED'
                        )}
                        className={enrollment.status === 'ATTENDED' ? 'text-green-600' : ''}
                      >
                        {enrollment.status === 'ATTENDED' ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Attended
                          </>
                        ) : (
                          'Mark Attended'
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
