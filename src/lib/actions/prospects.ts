'use server'

import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { ProspectStatus } from '@prisma/client'

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

const businessFormSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  bio: z.string().min(10, 'Bio must be at least 10 characters'),
  visionStatement: z.string().min(10, 'Vision statement is required'),
  missionStatement: z.string().min(10, 'Mission statement is required'),
  servicesInterested: z.array(z.string()).min(1, 'Select at least one service'),
  proposedCostOfServices: z.string().min(1, 'Please describe your proposed pricing'),
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
        },
        coachProfile: {
          include: {
            user: { select: { email: true } },
          },
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
        interviewScheduledAt: prospect.interviewScheduledAt?.toISOString() || null,
        interviewCompletedAt: prospect.interviewCompletedAt?.toISOString() || null,
        termsAcceptedAt: prospect.termsAcceptedAt?.toISOString() || null,
        privacyAcceptedAt: prospect.privacyAcceptedAt?.toISOString() || null,
        nonRefundAcknowledgedAt: prospect.nonRefundAcknowledgedAt?.toISOString() || null,
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
      },
    }
  } catch (error) {
    console.error('Error getting prospect:', error)
    return { error: 'Failed to get prospect' }
  }
}

export async function getProspectByToken(token: string, tokenType: 'assessment' | 'business' | 'acceptance') {
  try {
    const whereClause = tokenType === 'assessment'
      ? { assessmentToken: token }
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
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
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
    const result = await updateProspectStatus(id, 'ORIENTATION_SCHEDULED', `Orientation scheduled for ${scheduledAt.toISOString()}`)
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
// BUSINESS FORM
// ============================================

export async function generateBusinessFormToken(prospectId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const token = `bf_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`

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
    const result = await updateProspectStatus(id, 'INTERVIEW_SCHEDULED', `Interview scheduled for ${scheduledAt.toISOString()}`)
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

    revalidatePath('/admin/prospects')
    return { success: true }
  } catch (error) {
    console.error('Error completing interview:', error)
    return { error: 'Failed to complete interview' }
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
    const token = `ac_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`

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
    const tempPassword = password || `Welcome${Math.random().toString(36).substring(2, 10)}!`
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

    return {
      success: true,
      userId: result.user.id,
      coachProfileId: result.coachProfile.id,
      tempPassword: password ? undefined : tempPassword, // Only return if generated
    }
  } catch (error) {
    console.error('Error creating coach from prospect:', error)
    return { error: 'Failed to create coach account' }
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
