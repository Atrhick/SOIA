'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
  Calendar,
  Clock,
  MapPin,
  Video,
  Users,
  Search,
  CheckCircle2,
  Eye,
  EyeOff,
} from 'lucide-react'
import { toggleClassActive, markAttendance } from '@/lib/actions/classes'
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
  createdAt: string
  coach: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  enrollments: Enrollment[]
  _count: {
    enrollments: number
  }
}

interface Stats {
  totalClasses: number
  activeClasses: number
  totalEnrollments: number
  onlineClasses: number
}

interface AdminClassesClientProps {
  classes: CoachClass[]
  stats: Stats
}

export function AdminClassesClient({ classes: initialClasses, stats }: AdminClassesClientProps) {
  const router = useRouter()
  const [classes] = useState(initialClasses)
  const [viewingClass, setViewingClass] = useState<CoachClass | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCoach, setFilterCoach] = useState('')

  // Get unique coaches for filter
  const coaches = Array.from(new Set(classes.map(c => c.coach.id))).map(id => {
    const classItem = classes.find(c => c.coach.id === id)!
    return { id, name: `${classItem.coach.firstName} ${classItem.coach.lastName}` }
  })

  // Filter classes
  const filteredClasses = classes.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${c.coach.firstName} ${c.coach.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCoach = !filterCoach || c.coach.id === filterCoach
    return matchesSearch && matchesCoach
  })

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">All Classes</h1>
        <p className="text-gray-600 mt-1">
          View and manage all classes created by coaches
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <BookOpen className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Classes</p>
                <p className="text-2xl font-bold">{stats.totalClasses}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Active Classes</p>
                <p className="text-2xl font-bold">{stats.activeClasses}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Enrollments</p>
                <p className="text-2xl font-bold">{stats.totalEnrollments}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Video className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Online Classes</p>
                <p className="text-2xl font-bold">{stats.onlineClasses}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search classes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={filterCoach}
          onChange={(e) => setFilterCoach(e.target.value)}
          className="rounded-lg border p-2"
        >
          <option value="">All Coaches</option>
          {coaches.map(coach => (
            <option key={coach.id} value={coach.id}>{coach.name}</option>
          ))}
        </select>
      </div>

      {/* Classes List */}
      {filteredClasses.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No classes found</p>
              {searchTerm || filterCoach ? (
                <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
              ) : (
                <p className="text-sm text-gray-400 mt-1">Coaches can create classes from their dashboard</p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredClasses.map((classItem) => (
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

                    <p className="text-sm text-blue-600 mb-2">
                      Coach: {classItem.coach.firstName} {classItem.coach.lastName}
                    </p>

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
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
