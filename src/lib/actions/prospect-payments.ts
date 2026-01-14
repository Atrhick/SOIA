'use server'

import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { PaymentMethod, ProspectPaymentStatus } from '@prisma/client'

const PROGRAM_FEE = parseFloat(process.env.COACH_PROGRAM_FEE || '500')

// ============================================
// INITIALIZE PAYMENT
// ============================================

export async function initializePayment(
  prospectId: string,
  method: PaymentMethod
) {
  try {
    const prospect = await prisma.prospect.findUnique({
      where: { id: prospectId },
      include: { payment: true },
    })

    if (!prospect) {
      return { error: 'Prospect not found' }
    }

    // Create or update payment record
    const payment = await prisma.prospectPayment.upsert({
      where: { prospectId },
      create: {
        prospectId,
        method,
        amount: PROGRAM_FEE,
        currency: 'USD',
        status: 'PENDING',
      },
      update: {
        method,
        status: 'PENDING',
      },
    })

    return { success: true, payment }
  } catch (error) {
    console.error('Error initializing payment:', error)
    return { error: 'Failed to initialize payment' }
  }
}

// ============================================
// MANUAL PAYMENT
// ============================================

export async function recordManualPayment(
  prospectId: string,
  reference: string
) {
  try {
    const prospect = await prisma.prospect.findUnique({
      where: { id: prospectId },
    })

    if (!prospect) {
      return { error: 'Prospect not found' }
    }

    // Create payment record for manual payment
    await prisma.prospectPayment.upsert({
      where: { prospectId },
      create: {
        prospectId,
        method: 'MANUAL',
        amount: PROGRAM_FEE,
        currency: 'USD',
        status: 'PENDING',
        manualReference: reference,
      },
      update: {
        method: 'MANUAL',
        status: 'PENDING',
        manualReference: reference,
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
          type: 'PAYMENT_RECEIVED',
          title: 'Manual Payment Pending',
          message: `${prospect.firstName} ${prospect.lastName} has initiated a manual payment. Reference: ${reference}`,
          entityType: 'ProspectPayment',
          entityId: prospectId,
          actionUrl: `/admin/prospects/${prospectId}`,
        })),
      })
    }

    return { success: true }
  } catch (error) {
    console.error('Error recording manual payment:', error)
    return { error: 'Failed to record payment' }
  }
}

export async function approveManualPayment(prospectId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const payment = await prisma.prospectPayment.findUnique({
      where: { prospectId },
      include: { prospect: true },
    })

    if (!payment) {
      return { error: 'Payment not found' }
    }

    if (payment.method !== 'MANUAL') {
      return { error: 'Only manual payments can be approved this way' }
    }

    // Update payment status
    await prisma.prospectPayment.update({
      where: { id: payment.id },
      data: {
        status: 'COMPLETED',
        paidAt: new Date(),
        manualApprovedBy: session.user.id,
        manualApprovedAt: new Date(),
      },
    })

    // Update prospect status
    await prisma.prospect.update({
      where: { id: prospectId },
      data: {
        status: 'PAYMENT_COMPLETED',
        statusHistory: {
          create: {
            fromStatus: 'PAYMENT_PENDING',
            toStatus: 'PAYMENT_COMPLETED',
            changedBy: session.user.id,
            notes: 'Manual payment approved',
          },
        },
      },
    })

    revalidatePath('/admin/prospects')
    revalidatePath(`/admin/prospects/${prospectId}`)

    return { success: true }
  } catch (error) {
    console.error('Error approving manual payment:', error)
    return { error: 'Failed to approve payment' }
  }
}

export async function rejectManualPayment(prospectId: string, reason: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const payment = await prisma.prospectPayment.findUnique({
      where: { prospectId },
    })

    if (!payment) {
      return { error: 'Payment not found' }
    }

    // Update payment status
    await prisma.prospectPayment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        failureReason: reason,
      },
    })

    revalidatePath('/admin/prospects')
    revalidatePath(`/admin/prospects/${prospectId}`)

    return { success: true }
  } catch (error) {
    console.error('Error rejecting manual payment:', error)
    return { error: 'Failed to reject payment' }
  }
}

// ============================================
// PAYMENT STATUS UPDATES (for webhooks)
// ============================================

export async function updatePaymentStatus(
  prospectId: string,
  status: ProspectPaymentStatus,
  transactionData?: {
    stripePaymentIntentId?: string
    stripeSessionId?: string
    paypalOrderId?: string
    paypalTransactionId?: string
    failureReason?: string
  }
) {
  try {
    const payment = await prisma.prospectPayment.findUnique({
      where: { prospectId },
      include: { prospect: true },
    })

    if (!payment) {
      return { error: 'Payment not found' }
    }

    // Update payment record
    await prisma.prospectPayment.update({
      where: { id: payment.id },
      data: {
        status,
        ...transactionData,
        paidAt: status === 'COMPLETED' ? new Date() : undefined,
        failedAt: status === 'FAILED' ? new Date() : undefined,
      },
    })

    // If payment completed, update prospect status
    if (status === 'COMPLETED') {
      await prisma.prospect.update({
        where: { id: prospectId },
        data: {
          status: 'PAYMENT_COMPLETED',
          statusHistory: {
            create: {
              fromStatus: payment.prospect.status,
              toStatus: 'PAYMENT_COMPLETED',
              notes: `Payment completed via ${payment.method.toLowerCase()}`,
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
            type: 'PAYMENT_RECEIVED',
            title: 'Payment Received',
            message: `${payment.prospect.firstName} ${payment.prospect.lastName} has completed payment.`,
            entityType: 'ProspectPayment',
            entityId: prospectId,
            actionUrl: `/admin/prospects/${prospectId}`,
          })),
        })
      }
    }

    revalidatePath('/admin/prospects')
    revalidatePath(`/admin/prospects/${prospectId}`)

    return { success: true }
  } catch (error) {
    console.error('Error updating payment status:', error)
    return { error: 'Failed to update payment status' }
  }
}

// ============================================
// GET PAYMENT INFO
// ============================================

export async function getPaymentByProspectId(prospectId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const payment = await prisma.prospectPayment.findUnique({
      where: { prospectId },
    })

    if (!payment) {
      return { error: 'Payment not found' }
    }

    return {
      payment: {
        id: payment.id,
        method: payment.method,
        status: payment.status,
        amount: payment.amount.toNumber(),
        currency: payment.currency,
        stripePaymentIntentId: payment.stripePaymentIntentId,
        stripeSessionId: payment.stripeSessionId,
        paypalOrderId: payment.paypalOrderId,
        paypalTransactionId: payment.paypalTransactionId,
        manualReference: payment.manualReference,
        manualApprovedBy: payment.manualApprovedBy,
        manualApprovedAt: payment.manualApprovedAt?.toISOString() || null,
        paidAt: payment.paidAt?.toISOString() || null,
        failedAt: payment.failedAt?.toISOString() || null,
        failureReason: payment.failureReason,
        createdAt: payment.createdAt.toISOString(),
      },
    }
  } catch (error) {
    console.error('Error getting payment:', error)
    return { error: 'Failed to get payment' }
  }
}
