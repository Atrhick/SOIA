'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  GraduationCap,
  Calendar,
  Clock,
  MapPin,
  Video,
  Users,
  DollarSign,
  CheckCircle2,
  Loader2,
  BookOpen
} from 'lucide-react'
import { enrollInClass, withdrawFromClass } from '@/lib/actions/classes'
import { useRouter } from 'next/navigation'

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
  coach: {
    firstName: string
    lastName: string
  }
  _count: {
    enrollments: number
  }
  enrollments: Array<{
    id: string
    status: string
    paymentStatus: string
  }>
}

export default function ClassesPage() {
  const router = useRouter()
  const [classes, setClasses] = useState<CoachClass[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [enrollingId, setEnrollingId] = useState<string | null>(null)
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchClasses()
  }, [])

  const fetchClasses = async () => {
    try {
      const response = await fetch('/api/ambassador/classes')
      if (response.ok) {
        const data = await response.json()
        setClasses(data.classes || [])
      }
    } catch (err) {
      setError('Failed to load classes')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEnroll = async (classId: string) => {
    setError(null)
    setEnrollingId(classId)

    const result = await enrollInClass(classId)
    if (result.error) {
      setError(result.error)
    } else {
      fetchClasses()
      router.refresh()
    }
    setEnrollingId(null)
  }

  const handleWithdraw = async (classId: string) => {
    setError(null)
    setWithdrawingId(classId)

    const result = await withdrawFromClass(classId)
    if (result.error) {
      setError(result.error)
    } else {
      fetchClasses()
      router.refresh()
    }
    setWithdrawingId(null)
  }

  const enrolledClasses = classes.filter(c => c.enrollments.length > 0)
  const availableClasses = classes.filter(c => c.enrollments.length === 0)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    )
  }

  const ClassCard = ({ classItem, isEnrolled }: { classItem: CoachClass; isEnrolled: boolean }) => {
    const enrollment = classItem.enrollments[0]
    const isFull = classItem.maxCapacity && classItem._count.enrollments >= classItem.maxCapacity
    const spotsLeft = classItem.maxCapacity ? classItem.maxCapacity - classItem._count.enrollments : null

    return (
      <Card className={`border-2 transition-all ${isEnrolled ? 'border-green-200 bg-green-50/50' : 'hover:border-amber-200'}`}>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-gray-900 truncate">{classItem.title}</h3>
                {classItem.isFree ? (
                  <Badge className="bg-green-100 text-green-700">Free</Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-700">
                    <DollarSign className="w-3 h-3 mr-0.5" />
                    {classItem.price?.toFixed(2)}
                  </Badge>
                )}
              </div>

              <p className="text-sm text-gray-500 mb-3">
                By {classItem.coach.firstName} {classItem.coach.lastName}
              </p>

              {classItem.description && (
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                  {classItem.description}
                </p>
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
                {classItem.maxCapacity && (
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {classItem._count.enrollments}/{classItem.maxCapacity}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-shrink-0">
              {isEnrolled ? (
                <div className="space-y-2">
                  <Badge className="bg-green-100 text-green-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Enrolled
                  </Badge>
                  {enrollment?.paymentStatus === 'PENDING' && (
                    <Badge className="bg-yellow-100 text-yellow-700">
                      Payment Pending
                    </Badge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleWithdraw(classItem.id)}
                    disabled={withdrawingId === classItem.id}
                    className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    {withdrawingId === classItem.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Withdraw'
                    )}
                  </Button>
                </div>
              ) : isFull ? (
                <Badge className="bg-gray-100 text-gray-700">Full</Badge>
              ) : (
                <Button
                  onClick={() => handleEnroll(classItem.id)}
                  disabled={enrollingId === classItem.id}
                  className="bg-amber-500 hover:bg-amber-600"
                >
                  {enrollingId === classItem.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Enroll'
                  )}
                </Button>
              )}
            </div>
          </div>

          {spotsLeft !== null && spotsLeft > 0 && spotsLeft <= 5 && !isEnrolled && (
            <p className="mt-3 text-xs text-orange-600 font-medium">
              Only {spotsLeft} spot{spotsLeft === 1 ? '' : 's'} left!
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Classes</h1>
        <p className="text-gray-600 mt-1">
          Browse and enroll in classes offered by coaches
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <Tabs defaultValue="available" className="space-y-6">
        <TabsList>
          <TabsTrigger value="available" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Available ({availableClasses.length})
          </TabsTrigger>
          <TabsTrigger value="enrolled" className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4" />
            My Classes ({enrolledClasses.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="space-y-4">
          {availableClasses.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No available classes at the moment</p>
                  <p className="text-sm text-gray-400 mt-1">Check back later for new classes</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            availableClasses.map((classItem) => (
              <ClassCard key={classItem.id} classItem={classItem} isEnrolled={false} />
            ))
          )}
        </TabsContent>

        <TabsContent value="enrolled" className="space-y-4">
          {enrolledClasses.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">You haven&apos;t enrolled in any classes yet</p>
                  <p className="text-sm text-gray-400 mt-1">Browse available classes to get started</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            enrolledClasses.map((classItem) => (
              <ClassCard key={classItem.id} classItem={classItem} isEnrolled={true} />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Info Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">About Classes</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-500" />
              <span><strong>Free classes:</strong> Enroll instantly with no payment required</span>
            </li>
            <li className="flex items-start gap-2">
              <DollarSign className="w-4 h-4 mt-0.5 text-amber-500" />
              <span><strong>Paid classes:</strong> Payment details will be provided after enrollment</span>
            </li>
            <li className="flex items-start gap-2">
              <Users className="w-4 h-4 mt-0.5 text-blue-500" />
              <span><strong>Capacity:</strong> Some classes have limited spots - enroll early!</span>
            </li>
            <li className="flex items-start gap-2">
              <Video className="w-4 h-4 mt-0.5 text-purple-500" />
              <span><strong>Online classes:</strong> Meeting link will be available after enrollment</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
