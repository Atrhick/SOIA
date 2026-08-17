'use server'

import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { sendWelcomeInvite } from '@/lib/actions/password-reset'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { ProspectStatus } from '@prisma/client'
import crypto from 'crypto'

// ============================================
// SCHEMAS
// ============================================

const createProspectSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  phoneCountryCode: z.string().optional(),
  referrerName: z.string().optional(),
  assessmentSurveyId: z.string().optional(),
  assessmentSubmissionId: z.string().optional(),
})

// Legacy schema - kept for backward compatibility
const businessFormSchemaLegacy = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  bio: z.string().min(10, 'Bio must be at least 10 characters'),
  visionStatement: z.string().min(10, 'Vision statement is required'),
  missionStatement: z.string().min(10, 'Mission statement is required'),
  servicesInterested: z.array(z.string()).min(1, 'Select at least one service'),
  proposedCostOfServices: z.string().min(1, 'Please describe your proposed pricing'),
})

// Service package schema (strict - for final submission)
const servicePackageSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Package name is required'),
  description: z.string(),
  price: z.string().min(1, 'Price is required'),
  duration: z.string().optional(),
})

// Service package schema (lenient - for draft saving)
const servicePackageDraftSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.string(),
  duration: z.string().optional(),
})

// Draft schema - allows partial data for saving progress
const businessFormDraftSchema = z.object({
  currentStep: z.number().min(0).max(4),
  // Step 1: Business Identity
  companyName: z.string().optional(),
  tagline: z.string().optional(),
  bio: z.string().optional(),
  businessType: z.string().optional(),
  businessTypeOther: z.string().optional(),
  // Step 2: Online Presence
  websiteUrl: z.string().optional(),
  needsWebsiteHelp: z.boolean().optional(),
  instagramHandle: z.string().optional(),
  facebookHandle: z.string().optional(),
  linkedinHandle: z.string().optional(),
  tiktokHandle: z.string().optional(),
  // Step 3: Services & Packages
  servicePackages: z.array(servicePackageDraftSchema).optional(),
  // Step 4: Target Audience
  idealClient: z.string().optional(),
  uniqueValue: z.string().optional(),
  certifications: z.string().optional(),
  // Step 5: Goals
  threeYearRevenueGoal: z.string().optional(),
  threeYearClientGoal: z.string().optional(),
  visionStatement: z.string().optional(),
  missionStatement: z.string().optional(),
})

// Full submission schema - validates all required fields
const businessFormSchema = z.object({
  // Step 1: Business Identity - Required
  companyName: z.string().min(1, 'Company name is required'),
  tagline: z.string().optional(),
  bio: z.string().min(10, 'Bio must be at least 10 characters'),
  businessType: z.string().min(1, 'Business type is required'),
  businessTypeOther: z.string().optional(),
  // Step 2: Online Presence - Optional (accepts with or without http://)
  websiteUrl: z.string().optional().transform((val) => {
    if (!val || val.trim() === '') return undefined
    // Add https:// if no protocol specified
    if (!/^https?:\/\//i.test(val)) {
      return `https://${val}`
    }
    return val
  }),
  needsWebsiteHelp: z.boolean().optional(),
  instagramHandle: z.string().optional(),
  facebookHandle: z.string().optional(),
  linkedinHandle: z.string().optional(),
  tiktokHandle: z.string().optional(),
  // Step 3: Services & Packages - At least one required
  servicePackages: z.array(servicePackageSchema).min(1, 'Add at least one service package'),
  // Step 4: Target Audience - Required
  idealClient: z.string().min(10, 'Describe your ideal client (at least 10 characters)'),
  uniqueValue: z.string().min(10, 'Describe what makes you unique (at least 10 characters)'),
  certifications: z.string().optional(),
  // Step 5: Goals - Required
  threeYearRevenueGoal: z.string().min(1, 'Revenue goal is required'),
  threeYearClientGoal: z.string().min(1, 'Client goal is required'),
  visionStatement: z.string().min(10, 'Vision statement is required (at least 10 characters)'),
  missionStatement: z.string().min(10, 'Mission statement is required (at least 10 characters)'),
})

const acceptTermsSchema = z.object({
  termsAccepted: z.boolean().refine(val => val === true, 'You must accept the terms of service'),
  privacyAccepted: z.boolean().refine(val => val === true, 'You must accept the privacy policy'),
  nonRefundAcknowledged: z.boolean().refine(val => val === true, 'You must acknowledge the refund policy'),
})

// ============================================
// PROSPECT CRUD
// ============================================

export async function createProspect(data: z.infer<typeof createProspectSchema>) {
  try {
    const validated = createProspectSchema.safeParse(data)
    if (!validated.success) {
      return { error: validated.error.issues[0]?.message || 'Invalid data' }
    }

    // Check if prospect with this email already exists
    const existing = await prisma.prospect.findUnique({
      where: { email: validated.data.email },
    })

    if (existing) {
      return { error: 'A prospect with this email already exists' }
    }

    const prospect = await prisma.prospect.create({
      data: {
        ...validated.data,
        status: 'ASSESSMENT_COMPLETED',
        assessmentCompletedAt: new Date(),
        statusHistory: {
          create: {
            fromStatus: null,
            toStatus: 'ASSESSMENT_COMPLETED',
            notes: 'Assessment submitted',
          },
        },
      },
    })

    // Notify admins
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', status: 'ACTIVE' },
      select: { id: true },
    })

    if (admins.length > 0) {
      await prisma.adminNotification.createMany({
        data: admins.map(admin => ({
          userId: admin.id,
          type: 'PROSPECT_ASSESSMENT_COMPLETED',
          title: 'New Assessment Completed',
          message: `${validated.data.firstName} ${validated.data.lastName} has completed the coach assessment.`,
          entityType: 'Prospect',
          entityId: prospect.id,
          actionUrl: `/admin/prospects/${prospect.id}`,
        })),
      })
    }

    return { success: true, prospect }
  } catch (error) {
    console.error('Error creating prospect:', error)
    return { error: 'Failed to create prospect' }
  }
}

export async function createManualProspect(data: {
  firstName: string
  lastName: string
  email: string
  phone?: string
  referrerName?: string
  status?: ProspectStatus
}) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    // Check if prospect with this email already exists
    const existing = await prisma.prospect.findUnique({
      where: { email: data.email },
    })

    if (existing) {
      return { error: 'A prospect with this email already exists' }
    }

    const initialStatus = data.status || 'ASSESSMENT_COMPLETED'

    const prospect = await prisma.prospect.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        referrerName: data.referrerName,
        status: initialStatus,
        assessmentCompletedAt: new Date(),
        statusHistory: {
          create: {
            fromStatus: null,
            toStatus: initialStatus,
            changedBy: session.user.id,
            notes: 'Manually added by admin',
          },
        },
      },
    })

    revalidatePath('/admin/prospects')

    return { success: true, prospect }
  } catch (error) {
    console.error('Error creating manual prospect:', error)
    return { error: 'Failed to create prospect' }
  }
}

export async function getProspect(id: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const prospect = await prisma.prospect.findUnique({
      where: { id },
      include: {
        payment: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        coachProfile: {
          include: {
            user: { select: { email: true } },
          },
        },
        calendarBookings: {
          include: {
            calendar: { select: { id: true, name: true, meetingLink: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    })

    if (!prospect) {
      return { error: 'Prospect not found' }
    }

    return {
      prospect: {
        ...prospect,
        createdAt: prospect.createdAt.toISOString(),
        updatedAt: prospect.updatedAt.toISOString(),
        assessmentCompletedAt: prospect.assessmentCompletedAt?.toISOString() || null,
        orientationScheduledAt: prospect.orientationScheduledAt?.toISOString() || null,
        orientationCompletedAt: prospect.orientationCompletedAt?.toISOString() || null,
        businessFormSubmittedAt: prospect.businessFormSubmittedAt?.toISOString() || null,
        businessFormLastSavedAt: prospect.businessFormLastSavedAt?.toISOString() || null,
        interviewScheduledAt: prospect.interviewScheduledAt?.toISOString() || null,
        interviewCompletedAt: prospect.interviewCompletedAt?.toISOString() || null,
        termsAcceptedAt: prospect.termsAcceptedAt?.toISOString() || null,
        privacyAcceptedAt: prospect.privacyAcceptedAt?.toISOString() || null,
        nonRefundAcknowledgedAt: prospect.nonRefundAcknowledgedAt?.toISOString() || null,
        // Cast JSON fields to proper types
        servicePackages: prospect.servicePackages as { id: string; name: string; description: string; price: string; duration?: string }[] | null,
        businessFormDraft: prospect.businessFormDraft as Record<string, unknown> | null,
        payment: prospect.payment ? {
          ...prospect.payment,
          amount: prospect.payment.amount.toNumber(),
          createdAt: prospect.payment.createdAt.toISOString(),
          updatedAt: prospect.payment.updatedAt.toISOString(),
          paidAt: prospect.payment.paidAt?.toISOString() || null,
          failedAt: prospect.payment.failedAt?.toISOString() || null,
          manualApprovedAt: prospect.payment.manualApprovedAt?.toISOString() || null,
        } : null,
        statusHistory: prospect.statusHistory.map(h => ({
          ...h,
          createdAt: h.createdAt.toISOString(),
        })),
        // Active interview booking
        interviewBooking: (() => {
          const booking = prospect.calendarBookings.find(b =>
            (b.calendar.name === 'Biz Dev Interview' || b.calendar.name?.toLowerCase().includes('interview')) &&
            (b.status === 'PENDING' || b.status === 'CONFIRMED')
          )
          if (!booking) return null
          return {
            id: booking.id,
            calendarId: booking.calendarId,
            startTime: booking.startTime.toISOString(),
            endTime: booking.endTime.toISOString(),
            meetingLink: booking.calendar.meetingLink,
          }
        })(),
        // History of all interview bookings (for showing reschedule history)
        interviewBookingHistory: prospect.calendarBookings
          .filter(b =>
            b.calendar.name === 'Biz Dev Interview' || b.calendar.name?.toLowerCase().includes('interview')
          )
          .map(b => ({
            id: b.id,
            status: b.status,
            startTime: b.startTime.toISOString(),
            endTime: b.endTime.toISOString(),
            createdAt: b.createdAt.toISOString(),
            cancellationReason: b.cancellationReason || null,
          })),
      },
    }
  } catch (error) {
    console.error('Error getting prospect:', error)
    return { error: 'Failed to get prospect' }
  }
}

export async function getProspectByToken(token: string, tokenType: 'assessment' | 'orientation' | 'business' | 'acceptance') {
  // Validate token format before querying DB
  if (!token || typeof token !== 'string' || token.length < 10 || token.length > 100) {
    return { error: 'Invalid or expired link' }
  }

  try {
    const whereClause = tokenType === 'assessment'
      ? { assessmentToken: token }
      : tokenType === 'orientation'
        ? { orientationToken: token }
        : tokenType === 'business'
          ? { businessFormToken: token }
          : { acceptanceToken: token }

    const prospect = await prisma.prospect.findFirst({
      where: whereClause,
      include: {
        payment: true,
      },
    })

    if (!prospect) {
      return { error: 'Invalid or expired link' }
    }

    return {
      prospect: {
        id: prospect.id,
        firstName: prospect.firstName,
        lastName: prospect.lastName,
        email: prospect.email,
        status: prospect.status,
        companyName: prospect.companyName,
        bio: prospect.bio,
        visionStatement: prospect.visionStatement,
        missionStatement: prospect.missionStatement,
        servicesInterested: prospect.servicesInterested,
        proposedCostOfServices: prospect.proposedCostOfServices,
        termsAcceptedAt: prospect.termsAcceptedAt?.toISOString() || null,
        privacyAcceptedAt: prospect.privacyAcceptedAt?.toISOString() || null,
        nonRefundAcknowledgedAt: prospect.nonRefundAcknowledgedAt?.toISOString() || null,
        payment: prospect.payment ? {
          status: prospect.payment.status,
          amount: prospect.payment.amount.toNumber(),
          method: prospect.payment.method,
        } : null,
      },
    }
  } catch (error) {
    console.error('Error getting prospect by token:', error)
    return { error: 'Failed to get prospect' }
  }
}

export async function getAllProspects(filters?: {
  status?: ProspectStatus
  search?: string
}) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const where: Record<string, unknown> = {}

    if (filters?.status) {
      where.status = filters.status
    }

    if (filters?.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { companyName: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    const prospects = await prisma.prospect.findMany({
      where,
      include: {
        payment: {
          select: { status: true, amount: true, method: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    return {
      prospects: prospects.map(p => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        phone: p.phone,
        referrerName: p.referrerName,
        status: p.status,
        companyName: p.companyName,
        createdAt: p.createdAt.toISOString(),
        assessmentCompletedAt: p.assessmentCompletedAt?.toISOString() || null,
        interviewCompletedAt: p.interviewCompletedAt?.toISOString() || null,
        paymentStatus: p.payment?.status || null,
      })),
    }
  } catch (error) {
    console.error('Error getting prospects:', error)
    return { error: 'Failed to get prospects' }
  }
}

// ============================================
// STATUS MANAGEMENT
// ============================================

export async function updateProspectStatus(
  id: string,
  status: ProspectStatus,
  notes?: string
) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const prospect = await prisma.prospect.findUnique({
      where: { id },
      select: { status: true },
    })

    if (!prospect) {
      return { error: 'Prospect not found' }
    }

    const updated = await prisma.prospect.update({
      where: { id },
      data: {
        status,
        statusHistory: {
          create: {
            fromStatus: prospect.status,
            toStatus: status,
            changedBy: session.user.id,
            notes,
          },
        },
      },
    })

    // Create notification for status change
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', status: 'ACTIVE', id: { not: session.user.id } },
      select: { id: true },
    })

    if (admins.length > 0) {
      await prisma.adminNotification.createMany({
        data: admins.map(admin => ({
          userId: admin.id,
          type: 'PROSPECT_STATUS_CHANGED',
          title: 'Prospect Status Updated',
          message: `Prospect status changed to ${status.replace(/_/g, ' ').toLowerCase()}.`,
          entityType: 'Prospect',
          entityId: id,
          actionUrl: `/admin/prospects/${id}`,
        })),
      })
    }

    revalidatePath('/admin/prospects')
    revalidatePath(`/admin/prospects/${id}`)

    return { success: true, prospect: updated }
  } catch (error) {
    console.error('Error updating prospect status:', error)
    return { error: 'Failed to update prospect status' }
  }
}

export async function scheduleOrientation(id: string, scheduledAt: Date) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const result = await updateProspectStatus(id, 'ORIENTATION_SCHEDULED', `Orientation scheduled for ${scheduledAt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} at ${scheduledAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`)
    if (result.error) return result

    await prisma.prospect.update({
      where: { id },
      data: { orientationScheduledAt: scheduledAt },
    })

    revalidatePath('/admin/prospects')
    return { success: true }
  } catch (error) {
    console.error('Error scheduling orientation:', error)
    return { error: 'Failed to schedule orientation' }
  }
}

export async function completeOrientation(id: string, notes?: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const result = await updateProspectStatus(id, 'ORIENTATION_COMPLETED', notes)
    if (result.error) return result

    await prisma.prospect.update({
      where: { id },
      data: {
        orientationCompletedAt: new Date(),
        orientationNotes: notes,
      },
    })

    revalidatePath('/admin/prospects')
    return { success: true }
  } catch (error) {
    console.error('Error completing orientation:', error)
    return { error: 'Failed to complete orientation' }
  }
}

// ============================================
// ORIENTATION TOKEN
// ============================================

export async function generateOrientationToken(prospectId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    // Check if prospect already has a token
    const existingProspect = await prisma.prospect.findUnique({
      where: { id: prospectId },
      select: { orientationToken: true, status: true },
    })

    if (existingProspect?.orientationToken) {
      return { success: true, token: existingProspect.orientationToken }
    }

    const token = `or_${crypto.randomBytes(24).toString('hex')}`

    await prisma.prospect.update({
      where: { id: prospectId },
      data: {
        orientationToken: token,
      },
    })

    revalidatePath('/admin/prospects')
    return { success: true, token }
  } catch (error) {
    console.error('Error generating orientation token:', error)
    return { error: 'Failed to generate orientation link' }
  }
}

export async function generateBizDevInterviewToken(prospectId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    // Check if prospect already has a token
    const existingProspect = await prisma.prospect.findUnique({
      where: { id: prospectId },
      select: { bizDevInterviewToken: true, status: true },
    })

    if (existingProspect?.bizDevInterviewToken) {
      return { success: true, token: existingProspect.bizDevInterviewToken }
    }

    const token = `bdi_${crypto.randomBytes(24).toString('hex')}`

    await prisma.prospect.update({
      where: { id: prospectId },
      data: {
        bizDevInterviewToken: token,
      },
    })

    revalidatePath('/admin/prospects')
    return { success: true, token }
  } catch (error) {
    console.error('Error generating biz dev interview token:', error)
    return { error: 'Failed to generate biz dev interview link' }
  }
}

export async function getProspectByBizDevInterviewToken(token: string) {
  try {
    const prospect = await prisma.prospect.findUnique({
      where: { bizDevInterviewToken: token },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        status: true,
        interviewScheduledAt: true,
      },
    })

    if (!prospect) {
      return { error: 'Invalid token' }
    }

    return { prospect }
  } catch (error) {
    console.error('Error fetching prospect by biz dev interview token:', error)
    return { error: 'Failed to fetch prospect' }
  }
}

export async function getProspectByOrientationToken(token: string) {
  try {
    const prospect = await prisma.prospect.findFirst({
      where: { orientationToken: token },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        status: true,
        orientationScheduledAt: true,
      },
    })

    if (!prospect) {
      return { error: 'Invalid or expired link' }
    }

    // Check if orientation is already scheduled or completed
    if (prospect.orientationScheduledAt) {
      return { error: 'Orientation has already been scheduled' }
    }

    return { prospect }
  } catch (error) {
    console.error('Error getting prospect by orientation token:', error)
    return { error: 'Failed to validate link' }
  }
}

// ============================================
// BUSINESS FORM
// ============================================

export async function generateBusinessFormToken(prospectId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const token = `bf_${crypto.randomBytes(24).toString('hex')}`

    await prisma.prospect.update({
      where: { id: prospectId },
      data: {
        businessFormToken: token,
        status: 'BUSINESS_FORM_PENDING',
        statusHistory: {
          create: {
            fromStatus: 'ORIENTATION_COMPLETED',
            toStatus: 'BUSINESS_FORM_PENDING',
            changedBy: session.user.id,
            notes: 'Business form link generated',
          },
        },
      },
    })

    revalidatePath('/admin/prospects')
    return { success: true, token }
  } catch (error) {
    console.error('Error generating business form token:', error)
    return { error: 'Failed to generate business form link' }
  }
}

export async function saveBusinessFormDraft(
  token: string,
  data: z.infer<typeof businessFormDraftSchema>
) {
  try {
    const validated = businessFormDraftSchema.safeParse(data)
    if (!validated.success) {
      return { error: validated.error.issues[0]?.message || 'Invalid data' }
    }

    const prospect = await prisma.prospect.findFirst({
      where: { businessFormToken: token },
    })

    if (!prospect) {
      return { error: 'Invalid or expired link' }
    }

    await prisma.prospect.update({
      where: { id: prospect.id },
      data: {
        businessFormDraft: validated.data,
        businessFormLastSavedAt: new Date(),
      },
    })

    return { success: true, lastSavedAt: new Date().toISOString() }
  } catch (error) {
    console.error('Error saving business form draft:', error)
    return { error: 'Failed to save draft' }
  }
}

export async function loadBusinessFormDraft(token: string) {
  try {
    const prospect = await prisma.prospect.findFirst({
      where: { businessFormToken: token },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        businessFormDraft: true,
        businessFormLastSavedAt: true,
        businessFormSubmittedAt: true,
        // Also include any previously saved fields
        companyName: true,
        tagline: true,
        bio: true,
        businessType: true,
        businessTypeOther: true,
        websiteUrl: true,
        needsWebsiteHelp: true,
        instagramHandle: true,
        facebookHandle: true,
        linkedinHandle: true,
        tiktokHandle: true,
        servicePackages: true,
        idealClient: true,
        uniqueValue: true,
        certifications: true,
        threeYearRevenueGoal: true,
        threeYearClientGoal: true,
        visionStatement: true,
        missionStatement: true,
      },
    })

    if (!prospect) {
      return { error: 'Invalid or expired link' }
    }

    // If form was already submitted, don't allow edits
    if (prospect.businessFormSubmittedAt) {
      return { error: 'Business form has already been submitted' }
    }

    // Return the draft data if exists, otherwise return any saved field data
    const draft = prospect.businessFormDraft as z.infer<typeof businessFormDraftSchema> | null

    return {
      prospect: {
        firstName: prospect.firstName,
        lastName: prospect.lastName,
        email: prospect.email,
      },
      draft: draft || {
        currentStep: 0,
        companyName: prospect.companyName || '',
        tagline: prospect.tagline || '',
        bio: prospect.bio || '',
        businessType: prospect.businessType || '',
        businessTypeOther: prospect.businessTypeOther || '',
        websiteUrl: prospect.websiteUrl || '',
        needsWebsiteHelp: prospect.needsWebsiteHelp || false,
        instagramHandle: prospect.instagramHandle || '',
        facebookHandle: prospect.facebookHandle || '',
        linkedinHandle: prospect.linkedinHandle || '',
        tiktokHandle: prospect.tiktokHandle || '',
        servicePackages: (prospect.servicePackages as unknown[]) || [],
        idealClient: prospect.idealClient || '',
        uniqueValue: prospect.uniqueValue || '',
        certifications: prospect.certifications || '',
        threeYearRevenueGoal: prospect.threeYearRevenueGoal || '',
        threeYearClientGoal: prospect.threeYearClientGoal || '',
        visionStatement: prospect.visionStatement || '',
        missionStatement: prospect.missionStatement || '',
      },
      lastSavedAt: prospect.businessFormLastSavedAt?.toISOString() || null,
    }
  } catch (error) {
    console.error('Error loading business form draft:', error)
    return { error: 'Failed to load draft' }
  }
}

export async function submitBusinessForm(
  token: string,
  data: z.infer<typeof businessFormSchema>
) {
  try {
    const validated = businessFormSchema.safeParse(data)
    if (!validated.success) {
      return { error: validated.error.issues[0]?.message || 'Invalid data' }
    }

    const prospect = await prisma.prospect.findFirst({
      where: { businessFormToken: token },
    })

    if (!prospect) {
      return { error: 'Invalid or expired link' }
    }

    await prisma.prospect.update({
      where: { id: prospect.id },
      data: {
        ...validated.data,
        businessFormSubmittedAt: new Date(),
        businessFormDraft: undefined, // Clear draft after submission
        status: 'BUSINESS_FORM_SUBMITTED',
        statusHistory: {
          create: {
            fromStatus: prospect.status,
            toStatus: 'BUSINESS_FORM_SUBMITTED',
            notes: 'Business development form submitted',
          },
        },
      },
    })

    // Notify admins
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', status: 'ACTIVE' },
      select: { id: true },
    })

    if (admins.length > 0) {
      await prisma.adminNotification.createMany({
        data: admins.map(admin => ({
          userId: admin.id,
          type: 'PROSPECT_STATUS_CHANGED',
          title: 'Business Form Submitted',
          message: `${prospect.firstName} ${prospect.lastName} has submitted their business development form.`,
          entityType: 'Prospect',
          entityId: prospect.id,
          actionUrl: `/admin/prospects/${prospect.id}`,
        })),
      })
    }

    return { success: true }
  } catch (error) {
    console.error('Error submitting business form:', error)
    return { error: 'Failed to submit business form' }
  }
}

// ============================================
// INTERVIEW
// ============================================

export async function scheduleInterview(id: string, scheduledAt: Date) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const result = await updateProspectStatus(id, 'INTERVIEW_SCHEDULED', `Interview scheduled for ${scheduledAt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} at ${scheduledAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`)
    if (result.error) return result

    await prisma.prospect.update({
      where: { id },
      data: { interviewScheduledAt: scheduledAt },
    })

    revalidatePath('/admin/prospects')
    return { success: true }
  } catch (error) {
    console.error('Error scheduling interview:', error)
    return { error: 'Failed to schedule interview' }
  }
}

export async function completeInterview(
  id: string,
  result: 'APPROVED' | 'REJECTED',
  notes?: string
) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const newStatus = result === 'APPROVED' ? 'APPROVED' : 'REJECTED'
    const statusResult = await updateProspectStatus(id, newStatus, notes)
    if (statusResult.error) return statusResult

    await prisma.prospect.update({
      where: { id },
      data: {
        interviewCompletedAt: new Date(),
        interviewNotes: notes,
        interviewResult: result,
      },
    })

    // Update active interview bookings on the calendar
    const activeBookings = await prisma.calendarBooking.findMany({
      where: {
        prospectId: id,
        status: { in: ['PENDING', 'CONFIRMED'] },
        calendar: {
          OR: [
            { name: 'Biz Dev Interview' },
            { publicSlug: 'biz-dev-interview' },
          ],
        },
      },
    })

    if (activeBookings.length > 0) {
      const bookingIds = activeBookings.map(b => b.id)
      if (result === 'APPROVED') {
        await prisma.calendarBooking.updateMany({
          where: { id: { in: bookingIds } },
          data: { status: 'COMPLETED' },
        })
      } else {
        await prisma.calendarBooking.updateMany({
          where: { id: { in: bookingIds } },
          data: {
            status: 'CANCELLED',
            cancelledBy: session.user.id,
            cancelledAt: new Date(),
            cancellationReason: 'Prospect rejected',
          },
        })
      }
    }

    revalidatePath('/admin/prospects')
    return { success: true }
  } catch (error) {
    console.error('Error completing interview:', error)
    return { error: 'Failed to complete interview' }
  }
}

export async function checkPriorBookingAvailability(prospectId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const lastBooking = await prisma.calendarBooking.findFirst({
      where: {
        prospectId,
        calendar: {
          OR: [
            { name: 'Biz Dev Interview' },
            { publicSlug: 'biz-dev-interview' },
          ],
        },
        status: { in: ['CANCELLED', 'COMPLETED'] },
      },
      orderBy: { createdAt: 'desc' },
      include: { event: true },
    })

    if (!lastBooking || new Date(lastBooking.startTime) <= new Date()) {
      return {
        available: false,
        reason: lastBooking ? 'past' : 'none',
      }
    }

    // Check if the slot/event is still free
    let slotAvailable = true
    let unavailableReason = ''

    if (lastBooking.eventId) {
      const otherBookings = await prisma.calendarBooking.count({
        where: {
          eventId: lastBooking.eventId,
          status: { in: ['PENDING', 'CONFIRMED'] },
          id: { not: lastBooking.id },
        },
      })
      if (otherBookings > 0) {
        slotAvailable = false
        unavailableReason = 'taken'
      }
      if (lastBooking.event && lastBooking.event.startTime.getTime() !== lastBooking.startTime.getTime()) {
        slotAvailable = false
        unavailableReason = 'moved'
      }
    } else if (lastBooking.slotId) {
      const slot = await prisma.calendarSlot.findUnique({ where: { id: lastBooking.slotId } })
      if (slot) {
        const otherBookings = await prisma.calendarBooking.count({
          where: {
            slotId: lastBooking.slotId,
            bookingDate: lastBooking.bookingDate,
            status: { in: ['PENDING', 'CONFIRMED'] },
            id: { not: lastBooking.id },
          },
        })
        if (otherBookings >= slot.maxBookings) {
          slotAvailable = false
          unavailableReason = 'taken'
        }
      } else {
        slotAvailable = false
        unavailableReason = 'deleted'
      }
    }

    return {
      available: slotAvailable,
      reason: slotAvailable ? undefined : unavailableReason,
      booking: {
        startTime: lastBooking.startTime.toISOString(),
        endTime: lastBooking.endTime.toISOString(),
      },
    }
  } catch (error) {
    console.error('Error checking prior booking:', error)
    return { error: 'Failed to check booking availability' }
  }
}

export async function revertInterviewDecision(prospectId: string, restorePriorBooking: boolean) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const prospect = await prisma.prospect.findUnique({
      where: { id: prospectId },
    })

    if (!prospect) {
      return { error: 'Prospect not found' }
    }

    if (prospect.status !== 'APPROVED' && prospect.status !== 'REJECTED') {
      return { error: 'Prospect is not in an approved or rejected status' }
    }

    const previousDecision = prospect.status
    let rebooked = false

    if (restorePriorBooking) {
      // Find and re-activate the most recent interview booking
      const lastBooking = await prisma.calendarBooking.findFirst({
        where: {
          prospectId,
          calendar: {
            OR: [
              { name: 'Biz Dev Interview' },
              { publicSlug: 'biz-dev-interview' },
            ],
          },
          status: { in: ['CANCELLED', 'COMPLETED'] },
        },
        orderBy: { createdAt: 'desc' },
      })

      if (lastBooking && new Date(lastBooking.startTime) > new Date()) {
        await prisma.calendarBooking.update({
          where: { id: lastBooking.id },
          data: {
            status: 'CONFIRMED',
            cancelledBy: null,
            cancelledAt: null,
            cancellationReason: null,
          },
        })

        await prisma.prospect.update({
          where: { id: prospectId },
          data: {
            status: 'INTERVIEW_SCHEDULED',
            interviewCompletedAt: null,
            interviewNotes: null,
            interviewResult: null,
            interviewScheduledAt: lastBooking.startTime,
          },
        })
        rebooked = true
      }
    }

    // If not restoring or restore failed, revert to BUSINESS_FORM_SUBMITTED
    if (!rebooked) {
      await prisma.prospect.update({
        where: { id: prospectId },
        data: {
          status: 'BUSINESS_FORM_SUBMITTED',
          interviewCompletedAt: null,
          interviewNotes: null,
          interviewResult: null,
          interviewScheduledAt: null,
        },
      })
    }

    const revertStatus = rebooked ? 'INTERVIEW_SCHEDULED' : 'BUSINESS_FORM_SUBMITTED'
    await prisma.prospectStatusHistory.create({
      data: {
        prospectId,
        fromStatus: previousDecision,
        toStatus: revertStatus,
        changedBy: session.user.id,
        notes: rebooked
          ? `Decision reverted from ${previousDecision} - prior appointment restored`
          : `Decision reverted from ${previousDecision} - needs new appointment`,
      },
    })

    revalidatePath(`/admin/prospects/${prospectId}`)
    revalidatePath('/admin/prospects')
    return { success: true, rebooked }
  } catch (error) {
    console.error('Error reverting interview decision:', error)
    return { error: 'Failed to revert decision' }
  }
}

export async function cancelInterviewBooking(prospectId: string, reason?: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const prospect = await prisma.prospect.findUnique({
      where: { id: prospectId },
      include: {
        calendarBookings: {
          where: {
            status: { in: ['PENDING', 'CONFIRMED'] },
            calendar: {
              OR: [
                { name: 'Biz Dev Interview' },
                { publicSlug: 'biz-dev-interview' },
              ],
            },
          },
        },
      },
    })

    if (!prospect) {
      return { error: 'Prospect not found' }
    }

    if (prospect.status !== 'INTERVIEW_SCHEDULED') {
      return { error: 'Prospect is not in interview scheduled status' }
    }

    // Cancel all active interview bookings in batch
    if (prospect.calendarBookings.length > 0) {
      await prisma.calendarBooking.updateMany({
        where: { id: { in: prospect.calendarBookings.map(b => b.id) } },
        data: {
          status: 'CANCELLED',
          cancelledBy: session.user.id,
          cancelledAt: new Date(),
          cancellationReason: reason || 'Interview cancelled by admin',
        },
      })
    }

    // Revert prospect status to BUSINESS_FORM_SUBMITTED
    await prisma.prospect.update({
      where: { id: prospectId },
      data: {
        status: 'BUSINESS_FORM_SUBMITTED',
        interviewScheduledAt: null,
      },
    })

    // Add status history
    await prisma.prospectStatusHistory.create({
      data: {
        prospectId,
        fromStatus: 'INTERVIEW_SCHEDULED',
        toStatus: 'BUSINESS_FORM_SUBMITTED',
        changedBy: session.user.id,
        notes: 'Biz Dev Interview cancelled by admin',
      },
    })

    revalidatePath(`/admin/prospects/${prospectId}`)
    revalidatePath('/admin/prospects')

    return { success: true }
  } catch (error) {
    console.error('Error cancelling interview booking:', error)
    return { error: 'Failed to cancel interview' }
  }
}

// ============================================
// ACCEPTANCE & TERMS
// ============================================

export async function generateAcceptanceToken(prospectId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const token = `ac_${crypto.randomBytes(24).toString('hex')}`

    await prisma.prospect.update({
      where: { id: prospectId },
      data: {
        acceptanceToken: token,
        status: 'ACCEPTANCE_PENDING',
        statusHistory: {
          create: {
            fromStatus: 'APPROVED',
            toStatus: 'ACCEPTANCE_PENDING',
            changedBy: session.user.id,
            notes: 'Acceptance letter link generated',
          },
        },
      },
    })

    revalidatePath('/admin/prospects')
    return { success: true, token }
  } catch (error) {
    console.error('Error generating acceptance token:', error)
    return { error: 'Failed to generate acceptance link' }
  }
}

export async function acceptTerms(
  token: string,
  data: z.infer<typeof acceptTermsSchema>
) {
  try {
    const validated = acceptTermsSchema.safeParse(data)
    if (!validated.success) {
      return { error: validated.error.issues[0]?.message || 'Invalid data' }
    }

    const prospect = await prisma.prospect.findFirst({
      where: { acceptanceToken: token },
    })

    if (!prospect) {
      return { error: 'Invalid or expired link' }
    }

    const now = new Date()

    await prisma.prospect.update({
      where: { id: prospect.id },
      data: {
        termsAcceptedAt: now,
        privacyAcceptedAt: now,
        nonRefundAcknowledgedAt: now,
        status: 'PAYMENT_PENDING',
        statusHistory: {
          create: {
            fromStatus: prospect.status,
            toStatus: 'PAYMENT_PENDING',
            notes: 'Terms accepted, awaiting payment',
          },
        },
      },
    })

    return { success: true, prospectId: prospect.id }
  } catch (error) {
    console.error('Error accepting terms:', error)
    return { error: 'Failed to accept terms' }
  }
}

// ============================================
// ACCOUNT CREATION
// ============================================

export async function createCoachFromProspect(
  prospectId: string,
  password?: string
) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const prospect = await prisma.prospect.findUnique({
      where: { id: prospectId },
      include: { payment: true },
    })

    if (!prospect) {
      return { error: 'Prospect not found' }
    }

    if (prospect.status !== 'PAYMENT_COMPLETED') {
      return { error: 'Cannot create account until payment is completed' }
    }

    if (prospect.coachProfileId) {
      return { error: 'Account already created for this prospect' }
    }

    // Check if user with this email exists
    const existingUser = await prisma.user.findUnique({
      where: { email: prospect.email },
    })

    if (existingUser) {
      return { error: 'A user with this email already exists' }
    }

    // Generate password if not provided
    const tempPassword = password || `Coach${crypto.randomBytes(6).toString('hex').toUpperCase()}!${crypto.randomInt(1000, 9999)}`
    const hashedPassword = await bcrypt.hash(tempPassword, 12)

    // Create user and coach profile in transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: prospect.email,
          password: hashedPassword,
          role: 'COACH',
          status: 'ACTIVE',
        },
      })

      const coachProfile = await tx.coachProfile.create({
        data: {
          userId: user.id,
          firstName: prospect.firstName,
          lastName: prospect.lastName,
          phone: prospect.phone,
          bio: prospect.bio,
          coachStatus: 'ONBOARDING_INCOMPLETE',
        },
      })

      // Create supporting records
      await tx.businessExcellenceCRM.create({
        data: { coachId: coachProfile.id },
      })

      await tx.websiteContentStatus.create({
        data: {
          coachId: coachProfile.id,
          visionStatement: prospect.visionStatement,
          missionStatement: prospect.missionStatement,
          visionMissionSubmitted: !!(prospect.visionStatement && prospect.missionStatement),
          bioContent: prospect.bio,
          bioSubmitted: !!prospect.bio,
        },
      })

      // Update prospect with coach profile link
      await tx.prospect.update({
        where: { id: prospectId },
        data: {
          coachProfileId: coachProfile.id,
          status: 'ACCOUNT_CREATED',
          statusHistory: {
            create: {
              fromStatus: 'PAYMENT_COMPLETED',
              toStatus: 'ACCOUNT_CREATED',
              changedBy: session.user.id,
              notes: 'Coach account created',
            },
          },
        },
      })

      return { user, coachProfile }
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE_COACH_FROM_PROSPECT',
        entityType: 'CoachProfile',
        entityId: result.coachProfile.id,
        details: `Created coach account for prospect ${prospect.firstName} ${prospect.lastName}`,
      },
    })

    revalidatePath('/admin/prospects')
    revalidatePath('/admin/coaches')

    // Email the new coach a one-time link to set their own password. After the
    // transaction, so a mail failure cannot roll back the account - the admin
    // still has the temporary password on screen as a fallback.
    const invite = await sendWelcomeInvite(result.user.id, prospect.firstName, 'coach')

    return {
      success: true,
      userId: result.user.id,
      coachProfileId: result.coachProfile.id,
      tempPassword: password ? undefined : tempPassword, // Only return if generated
      inviteSent: invite.sent,
      inviteError: invite.error,
    }
  } catch (error) {
    console.error('Error creating coach from prospect:', error)
    return { error: 'Failed to create coach account' }
  }
}

// ============================================
// STATISTICS
// ============================================

// ============================================
// DELETE PROSPECT
// ============================================

export async function deleteProspect(id: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const prospect = await prisma.prospect.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        coachProfileId: true,
        status: true,
      },
    })

    if (!prospect) {
      return { error: 'Prospect not found' }
    }

    // Don't allow deletion if account has been created
    if (prospect.coachProfileId) {
      return { error: 'Cannot delete prospect after coach account has been created. Delete the coach account instead.' }
    }

    // Delete the prospect (cascade will handle related records)
    await prisma.prospect.delete({
      where: { id },
    })

    // Log the deletion
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE_PROSPECT',
        entityType: 'Prospect',
        entityId: id,
        details: `Deleted prospect: ${prospect.firstName} ${prospect.lastName} (${prospect.email})`,
      },
    })

    revalidatePath('/admin/prospects')

    return { success: true }
  } catch (error) {
    console.error('Error deleting prospect:', error)
    return { error: 'Failed to delete prospect' }
  }
}

// ============================================
// ASSESSMENT RESULTS
// ============================================

export async function getProspectAssessmentResults(prospectId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const prospect = await prisma.prospect.findUnique({
      where: { id: prospectId },
      select: {
        id: true,
        email: true,
        assessmentSubmissionId: true,
        assessmentSurveyId: true,
        assessmentCompletedAt: true,
      },
    })

    if (!prospect) {
      return { error: 'Prospect not found' }
    }

    let submissionId = prospect.assessmentSubmissionId

    // If no direct submission ID, find by email across known survey IDs in a single query
    if (!submissionId) {
      const surveyFilters: Record<string, unknown>[] = []
      if (prospect.assessmentSurveyId) {
        surveyFilters.push({ surveyId: prospect.assessmentSurveyId })
      }
      // Also check by survey title as fallback
      surveyFilters.push({ survey: { title: 'Coach Assessment' } })

      const matchingSubmission = await prisma.surveySubmission.findFirst({
        where: {
          contactEmail: prospect.email,
          OR: surveyFilters,
        },
        orderBy: { submittedAt: 'desc' },
        select: { id: true, surveyId: true },
      })

      if (matchingSubmission) {
        submissionId = matchingSubmission.id
        // Cache the found submission ID on the prospect for future lookups
        await prisma.prospect.update({
          where: { id: prospectId },
          data: {
            assessmentSubmissionId: submissionId,
            ...(!prospect.assessmentSurveyId ? { assessmentSurveyId: matchingSubmission.surveyId } : {}),
          },
        })
      }
    }

    if (!submissionId) {
      return { error: 'No assessment submission found for this prospect' }
    }

    // Get the submission with answers
    const submission = await prisma.surveySubmission.findUnique({
      where: { id: submissionId },
      include: {
        answers: {
          include: {
            question: {
              select: {
                id: true,
                questionText: true,
                questionType: true,
                sortOrder: true,
              },
            },
            selectedOptions: {
              select: {
                id: true,
                optionText: true,
              },
            },
          },
        },
        survey: {
          select: {
            id: true,
            title: true,
            type: true,
          },
        },
      },
    })

    if (!submission) {
      return { error: 'Assessment submission not found' }
    }

    // Format the results
    const results = {
      surveyTitle: submission.survey.title,
      surveyType: submission.survey.type,
      submittedAt: submission.submittedAt.toISOString(),
      score: submission.score,
      passed: submission.passed,
      answers: submission.answers
        .sort((a, b) => a.question.sortOrder - b.question.sortOrder)
        .map(answer => ({
          questionId: answer.question.id,
          questionText: answer.question.questionText,
          questionType: answer.question.questionType,
          textResponse: answer.textResponse,
          likertValue: answer.likertValue,
          selectedOptions: answer.selectedOptions.map(opt => opt.optionText),
          isCorrect: answer.isCorrect,
        })),
    }

    return { results }
  } catch (error) {
    console.error('Error getting prospect assessment results:', error)
    return { error: 'Failed to get assessment results' }
  }
}

// ============================================
// STATISTICS
// ============================================

export async function getProspectStats() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const [
      total,
      assessmentCompleted,
      orientationPending,
      businessFormPending,
      interviewPending,
      approved,
      paymentPending,
      accountCreated,
      rejected,
    ] = await Promise.all([
      prisma.prospect.count(),
      prisma.prospect.count({ where: { status: 'ASSESSMENT_COMPLETED' } }),
      prisma.prospect.count({ where: { status: { in: ['ORIENTATION_SCHEDULED', 'ORIENTATION_COMPLETED'] } } }),
      prisma.prospect.count({ where: { status: { in: ['BUSINESS_FORM_PENDING', 'BUSINESS_FORM_SUBMITTED'] } } }),
      prisma.prospect.count({ where: { status: { in: ['INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED'] } } }),
      prisma.prospect.count({ where: { status: 'APPROVED' } }),
      prisma.prospect.count({ where: { status: { in: ['ACCEPTANCE_PENDING', 'PAYMENT_PENDING'] } } }),
      prisma.prospect.count({ where: { status: 'ACCOUNT_CREATED' } }),
      prisma.prospect.count({ where: { status: 'REJECTED' } }),
    ])

    return {
      stats: {
        total,
        assessmentCompleted,
        orientationPending,
        businessFormPending,
        interviewPending,
        approved,
        paymentPending,
        accountCreated,
        rejected,
      },
    }
  } catch (error) {
    console.error('Error getting prospect stats:', error)
    return { error: 'Failed to get statistics' }
  }
}
