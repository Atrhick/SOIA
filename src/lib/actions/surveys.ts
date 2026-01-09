'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import type { SurveyType, SurveyPublishStatus, SurveyQuestionType, QuizScoreMode } from '@prisma/client'

// ============================================
// VALIDATION SCHEMAS
// ============================================

const createSurveySchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  type: z.enum(['QUIZ', 'SURVEY']),
  allowedRoles: z.array(z.string()).min(1, 'At least one role must be selected'),
  isAnonymous: z.boolean().default(false),
  scoreMode: z.enum(['NO_SCORING', 'SCORE_ONLY', 'PASS_FAIL']).default('SCORE_ONLY'),
  passingScore: z.number().min(1).max(100).optional(),
  showResults: z.boolean().default(true),
  allowRetake: z.boolean().default(true),
  closesAt: z.string().optional(),
})

const updateSurveySchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  allowedRoles: z.array(z.string()).min(1, 'At least one role must be selected'),
  isAnonymous: z.boolean().default(false),
  scoreMode: z.enum(['NO_SCORING', 'SCORE_ONLY', 'PASS_FAIL']).optional(),
  passingScore: z.number().min(1).max(100).optional().nullable(),
  showResults: z.boolean().default(true),
  allowRetake: z.boolean().default(true),
  closesAt: z.string().optional().nullable(),
})

const questionSchema = z.object({
  questionText: z.string().min(1, 'Question text is required'),
  questionType: z.enum(['MULTIPLE_CHOICE', 'MULTIPLE_SELECT', 'LIKERT_SCALE', 'TEXT_SHORT', 'TEXT_LONG']),
  isRequired: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  likertConfig: z.object({
    minLabel: z.string(),
    maxLabel: z.string(),
    minValue: z.number(),
    maxValue: z.number(),
  }).optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  options: z.array(z.object({
    optionText: z.string().min(1, 'Option text is required'),
    isCorrect: z.boolean().default(false),
  })).optional(),
})

// ============================================
// SURVEY CRUD OPERATIONS
// ============================================

export async function createSurvey(formData: FormData) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  const scoreMode = (formData.get('scoreMode') as string) || 'SCORE_ONLY'
  const data = {
    title: formData.get('title') as string,
    description: formData.get('description') as string || undefined,
    type: formData.get('type') as 'QUIZ' | 'SURVEY',
    allowedRoles: JSON.parse(formData.get('allowedRoles') as string || '[]'),
    isAnonymous: formData.get('isAnonymous') === 'true',
    scoreMode: scoreMode as 'NO_SCORING' | 'SCORE_ONLY' | 'PASS_FAIL',
    passingScore: scoreMode === 'PASS_FAIL' && formData.get('passingScore')
      ? parseInt(formData.get('passingScore') as string)
      : undefined,
    showResults: formData.get('showResults') !== 'false',
    allowRetake: formData.get('allowRetake') !== 'false',
    closesAt: formData.get('closesAt') as string || undefined,
  }

  const validated = createSurveySchema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Validation failed' }
  }

  try {
    const survey = await prisma.survey.create({
      data: {
        title: validated.data.title,
        description: validated.data.description,
        type: validated.data.type,
        allowedRoles: validated.data.allowedRoles,
        isAnonymous: validated.data.isAnonymous,
        scoreMode: validated.data.scoreMode,
        passingScore: validated.data.passingScore,
        showResults: validated.data.showResults,
        allowRetake: validated.data.allowRetake,
        closesAt: validated.data.closesAt ? new Date(validated.data.closesAt) : null,
        createdBy: session.user.id,
        status: 'DRAFT',
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE_SURVEY',
        entityType: 'Survey',
        entityId: survey.id,
        details: `Created ${validated.data.type.toLowerCase()}: ${validated.data.title}`,
      },
    })

    revalidatePath('/admin/surveys')
    return { success: true, surveyId: survey.id }
  } catch (error) {
    console.error('Error creating survey:', error)
    return { error: 'Failed to create survey' }
  }
}

export async function updateSurvey(surveyId: string, formData: FormData) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  const scoreMode = formData.get('scoreMode') as string | null
  const data = {
    title: formData.get('title') as string,
    description: formData.get('description') as string || undefined,
    allowedRoles: JSON.parse(formData.get('allowedRoles') as string || '[]'),
    isAnonymous: formData.get('isAnonymous') === 'true',
    scoreMode: scoreMode as 'NO_SCORING' | 'SCORE_ONLY' | 'PASS_FAIL' | undefined,
    passingScore: scoreMode === 'PASS_FAIL' && formData.get('passingScore')
      ? parseInt(formData.get('passingScore') as string)
      : null,
    showResults: formData.get('showResults') !== 'false',
    allowRetake: formData.get('allowRetake') !== 'false',
    closesAt: formData.get('closesAt') as string || null,
  }

  const validated = updateSurveySchema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Validation failed' }
  }

  try {
    await prisma.survey.update({
      where: { id: surveyId },
      data: {
        title: validated.data.title,
        description: validated.data.description,
        allowedRoles: validated.data.allowedRoles,
        isAnonymous: validated.data.isAnonymous,
        scoreMode: validated.data.scoreMode,
        passingScore: validated.data.passingScore,
        showResults: validated.data.showResults,
        allowRetake: validated.data.allowRetake,
        closesAt: validated.data.closesAt ? new Date(validated.data.closesAt) : null,
      },
    })

    revalidatePath('/admin/surveys')
    revalidatePath(`/admin/surveys/${surveyId}`)
    return { success: true }
  } catch (error) {
    console.error('Error updating survey:', error)
    return { error: 'Failed to update survey' }
  }
}

export async function deleteSurvey(surveyId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  try {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
    })

    if (!survey) {
      return { error: 'Survey not found' }
    }

    await prisma.survey.delete({
      where: { id: surveyId },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE_SURVEY',
        entityType: 'Survey',
        entityId: surveyId,
        details: `Deleted ${survey.type.toLowerCase()}: ${survey.title}`,
      },
    })

    revalidatePath('/admin/surveys')
    return { success: true }
  } catch (error) {
    console.error('Error deleting survey:', error)
    return { error: 'Failed to delete survey' }
  }
}

export async function updateSurveyStatus(surveyId: string, status: SurveyPublishStatus) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  try {
    const survey = await prisma.survey.update({
      where: { id: surveyId },
      data: {
        status,
        publishedAt: status === 'PUBLISHED' ? new Date() : undefined,
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE_SURVEY_STATUS',
        entityType: 'Survey',
        entityId: surveyId,
        details: `Updated status to: ${status}`,
      },
    })

    revalidatePath('/admin/surveys')
    revalidatePath(`/admin/surveys/${surveyId}`)
    return { success: true }
  } catch (error) {
    console.error('Error updating survey status:', error)
    return { error: 'Failed to update status' }
  }
}

export async function getAllSurveys(type?: SurveyType) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized', surveys: [] }
  }

  try {
    const surveys = await prisma.survey.findMany({
      where: type ? { type } : undefined,
      include: {
        questions: {
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: { submissions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return {
      surveys: surveys.map(s => ({
        id: s.id,
        title: s.title,
        description: s.description,
        type: s.type,
        status: s.status,
        allowedRoles: s.allowedRoles,
        isAnonymous: s.isAnonymous,
        passingScore: s.passingScore,
        showResults: s.showResults,
        allowRetake: s.allowRetake,
        publishedAt: s.publishedAt?.toISOString() || null,
        closesAt: s.closesAt?.toISOString() || null,
        createdAt: s.createdAt.toISOString(),
        questionCount: s.questions.length,
        submissionCount: s._count.submissions,
      })),
    }
  } catch (error) {
    console.error('Error fetching surveys:', error)
    return { error: 'Failed to fetch surveys', surveys: [] }
  }
}

export async function getSurveyById(surveyId: string) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        questions: {
          include: {
            options: {
              orderBy: { sortOrder: 'asc' },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: { submissions: true },
        },
      },
    })

    if (!survey) {
      return { error: 'Survey not found' }
    }

    // Check if user has access
    if (session.user.role !== 'ADMIN') {
      if (!survey.allowedRoles.includes(session.user.role)) {
        return { error: 'Access denied' }
      }
      if (survey.status !== 'PUBLISHED') {
        return { error: 'Survey is not available' }
      }
    }

    return {
      survey: {
        id: survey.id,
        title: survey.title,
        description: survey.description,
        type: survey.type,
        status: survey.status,
        allowedRoles: survey.allowedRoles,
        isAnonymous: survey.isAnonymous,
        scoreMode: survey.scoreMode,
        passingScore: survey.passingScore,
        showResults: survey.showResults,
        allowRetake: survey.allowRetake,
        publishedAt: survey.publishedAt?.toISOString() || null,
        closesAt: survey.closesAt?.toISOString() || null,
        createdAt: survey.createdAt.toISOString(),
        submissionCount: survey._count.submissions,
        questions: survey.questions.map(q => ({
          id: q.id,
          questionText: q.questionText,
          questionType: q.questionType,
          isRequired: q.isRequired,
          sortOrder: q.sortOrder,
          likertConfig: q.likertConfig,
          minLength: q.minLength,
          maxLength: q.maxLength,
          options: q.options.map(o => ({
            id: o.id,
            optionText: o.optionText,
            isCorrect: session.user.role === 'ADMIN' ? o.isCorrect : undefined,
            sortOrder: o.sortOrder,
          })),
        })),
      },
    }
  } catch (error) {
    console.error('Error fetching survey:', error)
    return { error: 'Failed to fetch survey' }
  }
}

export async function getSurveysForRole(role: 'COACH' | 'AMBASSADOR') {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized', surveys: [] }
  }

  try {
    const surveys = await prisma.survey.findMany({
      where: {
        status: 'PUBLISHED',
        allowedRoles: { has: role },
        OR: [
          { closesAt: null },
          { closesAt: { gte: new Date() } },
        ],
      },
      include: {
        _count: {
          select: { questions: true },
        },
        submissions: {
          where: { userId: session.user.id },
          select: { id: true, score: true, passed: true, submittedAt: true },
        },
      },
      orderBy: { publishedAt: 'desc' },
    })

    return {
      surveys: surveys.map(s => ({
        id: s.id,
        title: s.title,
        description: s.description,
        type: s.type,
        isAnonymous: s.isAnonymous,
        passingScore: s.passingScore,
        allowRetake: s.allowRetake,
        closesAt: s.closesAt?.toISOString() || null,
        questionCount: s._count.questions,
        submission: s.submissions[0] ? {
          id: s.submissions[0].id,
          score: s.submissions[0].score,
          passed: s.submissions[0].passed,
          submittedAt: s.submissions[0].submittedAt.toISOString(),
        } : null,
      })),
    }
  } catch (error) {
    console.error('Error fetching surveys for role:', error)
    return { error: 'Failed to fetch surveys', surveys: [] }
  }
}

// ============================================
// QUESTION MANAGEMENT
// ============================================

export async function addQuestion(surveyId: string, data: z.infer<typeof questionSchema>) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  const validated = questionSchema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Validation failed' }
  }

  // Validate based on question type
  if (['MULTIPLE_CHOICE', 'MULTIPLE_SELECT'].includes(validated.data.questionType)) {
    if (!validated.data.options || validated.data.options.length < 2) {
      return { error: 'At least 2 options are required' }
    }
  }

  try {
    // Get the current max sort order
    const maxSortOrder = await prisma.surveyQuestion.aggregate({
      where: { surveyId },
      _max: { sortOrder: true },
    })

    const question = await prisma.surveyQuestion.create({
      data: {
        surveyId,
        questionText: validated.data.questionText,
        questionType: validated.data.questionType as SurveyQuestionType,
        isRequired: validated.data.isRequired,
        sortOrder: (maxSortOrder._max.sortOrder || 0) + 1,
        likertConfig: validated.data.likertConfig || null,
        minLength: validated.data.minLength,
        maxLength: validated.data.maxLength,
        options: validated.data.options ? {
          createMany: {
            data: validated.data.options.map((opt, idx) => ({
              optionText: opt.optionText,
              isCorrect: opt.isCorrect,
              sortOrder: idx,
            })),
          },
        } : undefined,
      },
      include: {
        options: true,
      },
    })

    revalidatePath(`/admin/surveys/${surveyId}`)
    return { success: true, question }
  } catch (error) {
    console.error('Error adding question:', error)
    return { error: 'Failed to add question' }
  }
}

export async function updateQuestion(questionId: string, data: z.infer<typeof questionSchema>) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  const validated = questionSchema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Validation failed' }
  }

  try {
    const question = await prisma.surveyQuestion.findUnique({
      where: { id: questionId },
    })

    if (!question) {
      return { error: 'Question not found' }
    }

    // Delete existing options and recreate
    await prisma.surveyOption.deleteMany({
      where: { questionId },
    })

    await prisma.surveyQuestion.update({
      where: { id: questionId },
      data: {
        questionText: validated.data.questionText,
        questionType: validated.data.questionType as SurveyQuestionType,
        isRequired: validated.data.isRequired,
        likertConfig: validated.data.likertConfig || null,
        minLength: validated.data.minLength,
        maxLength: validated.data.maxLength,
        options: validated.data.options ? {
          createMany: {
            data: validated.data.options.map((opt, idx) => ({
              optionText: opt.optionText,
              isCorrect: opt.isCorrect,
              sortOrder: idx,
            })),
          },
        } : undefined,
      },
    })

    revalidatePath(`/admin/surveys/${question.surveyId}`)
    return { success: true }
  } catch (error) {
    console.error('Error updating question:', error)
    return { error: 'Failed to update question' }
  }
}

export async function deleteQuestion(questionId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  try {
    const question = await prisma.surveyQuestion.findUnique({
      where: { id: questionId },
    })

    if (!question) {
      return { error: 'Question not found' }
    }

    await prisma.surveyQuestion.delete({
      where: { id: questionId },
    })

    revalidatePath(`/admin/surveys/${question.surveyId}`)
    return { success: true }
  } catch (error) {
    console.error('Error deleting question:', error)
    return { error: 'Failed to delete question' }
  }
}

export async function reorderQuestions(surveyId: string, questionIds: string[]) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  try {
    await prisma.$transaction(
      questionIds.map((id, index) =>
        prisma.surveyQuestion.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    )

    revalidatePath(`/admin/surveys/${surveyId}`)
    return { success: true }
  } catch (error) {
    console.error('Error reordering questions:', error)
    return { error: 'Failed to reorder questions' }
  }
}

export async function duplicateQuestion(questionId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  try {
    const original = await prisma.surveyQuestion.findUnique({
      where: { id: questionId },
      include: {
        options: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    if (!original) {
      return { error: 'Question not found' }
    }

    // Get the max sort order for the survey
    const maxSortOrder = await prisma.surveyQuestion.aggregate({
      where: { surveyId: original.surveyId },
      _max: { sortOrder: true },
    })

    // Create the duplicate
    const duplicate = await prisma.surveyQuestion.create({
      data: {
        surveyId: original.surveyId,
        questionText: `${original.questionText} (Copy)`,
        questionType: original.questionType,
        isRequired: original.isRequired,
        sortOrder: (maxSortOrder._max.sortOrder || 0) + 1,
        likertConfig: original.likertConfig,
        minLength: original.minLength,
        maxLength: original.maxLength,
        options: original.options.length > 0 ? {
          createMany: {
            data: original.options.map((opt, idx) => ({
              optionText: opt.optionText,
              isCorrect: opt.isCorrect,
              sortOrder: idx,
            })),
          },
        } : undefined,
      },
      include: {
        options: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    revalidatePath(`/admin/surveys/${original.surveyId}`)
    return {
      success: true,
      question: {
        id: duplicate.id,
        questionText: duplicate.questionText,
        questionType: duplicate.questionType,
        isRequired: duplicate.isRequired,
        sortOrder: duplicate.sortOrder,
        likertConfig: duplicate.likertConfig,
        minLength: duplicate.minLength,
        maxLength: duplicate.maxLength,
        options: duplicate.options.map(o => ({
          id: o.id,
          optionText: o.optionText,
          isCorrect: o.isCorrect,
          sortOrder: o.sortOrder,
        })),
      },
    }
  } catch (error) {
    console.error('Error duplicating question:', error)
    return { error: 'Failed to duplicate question' }
  }
}

// ============================================
// SUBMISSION HANDLING
// ============================================

interface AnswerInput {
  questionId: string
  selectedOptionIds?: string[]
  likertValue?: number
  textResponse?: string
}

export async function submitSurvey(surveyId: string, answers: AnswerInput[]) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        questions: {
          include: {
            options: true,
          },
        },
      },
    })

    if (!survey) {
      return { error: 'Survey not found' }
    }

    if (survey.status !== 'PUBLISHED') {
      return { error: 'Survey is not available' }
    }

    if (!survey.allowedRoles.includes(session.user.role)) {
      return { error: 'Access denied' }
    }

    // Check if already submitted (for non-anonymous, non-retake surveys)
    if (!survey.isAnonymous) {
      const existingSubmission = await prisma.surveySubmission.findFirst({
        where: {
          surveyId,
          userId: session.user.id,
        },
      })

      if (existingSubmission) {
        if (!survey.allowRetake) {
          return { error: 'You have already completed this survey' }
        }
        // Delete previous submission for retake
        await prisma.surveySubmission.delete({
          where: { id: existingSubmission.id },
        })
      }
    }

    // Calculate score for quizzes based on scoreMode
    let score: number | null = null
    let passed: boolean | null = null

    if (survey.type === 'QUIZ' && survey.scoreMode !== 'NO_SCORING') {
      const scorableQuestions = survey.questions.filter(q =>
        ['MULTIPLE_CHOICE', 'MULTIPLE_SELECT'].includes(q.questionType)
      )

      if (scorableQuestions.length > 0) {
        let correctCount = 0

        for (const question of scorableQuestions) {
          const answer = answers.find(a => a.questionId === question.id)
          if (!answer?.selectedOptionIds) continue

          const correctOptionIds = question.options
            .filter(o => o.isCorrect)
            .map(o => o.id)
            .sort()

          const selectedIds = answer.selectedOptionIds.sort()

          if (question.questionType === 'MULTIPLE_CHOICE') {
            if (selectedIds.length === 1 && correctOptionIds.includes(selectedIds[0])) {
              correctCount++
            }
          } else {
            // MULTIPLE_SELECT - all correct options must be selected, no incorrect ones
            if (JSON.stringify(selectedIds) === JSON.stringify(correctOptionIds)) {
              correctCount++
            }
          }
        }

        score = (correctCount / scorableQuestions.length) * 100

        // Only calculate pass/fail for PASS_FAIL mode
        if (survey.scoreMode === 'PASS_FAIL' && survey.passingScore) {
          passed = score >= survey.passingScore
        }
      }
    }

    // Create submission
    const submission = await prisma.surveySubmission.create({
      data: {
        surveyId,
        userId: survey.isAnonymous ? null : session.user.id,
        userRole: session.user.role,
        score,
        passed,
        answers: {
          create: answers.map(a => {
            const question = survey.questions.find(q => q.id === a.questionId)
            let isCorrect: boolean | null = null

            if (survey.type === 'QUIZ' && question) {
              if (['MULTIPLE_CHOICE', 'MULTIPLE_SELECT'].includes(question.questionType)) {
                const correctOptionIds = question.options
                  .filter(o => o.isCorrect)
                  .map(o => o.id)
                  .sort()

                const selectedIds = (a.selectedOptionIds || []).sort()

                if (question.questionType === 'MULTIPLE_CHOICE') {
                  isCorrect = selectedIds.length === 1 && correctOptionIds.includes(selectedIds[0])
                } else {
                  isCorrect = JSON.stringify(selectedIds) === JSON.stringify(correctOptionIds)
                }
              }
            }

            return {
              questionId: a.questionId,
              likertValue: a.likertValue,
              textResponse: a.textResponse,
              isCorrect,
              selectedOptions: a.selectedOptionIds ? {
                connect: a.selectedOptionIds.map(id => ({ id })),
              } : undefined,
            }
          }),
        },
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'SUBMIT_SURVEY',
        entityType: 'SurveySubmission',
        entityId: submission.id,
        details: `Submitted ${survey.type.toLowerCase()}: ${survey.title}${score !== null ? ` - Score: ${score.toFixed(1)}%` : ''}`,
      },
    })

    revalidatePath(`/coach/surveys`)
    revalidatePath(`/ambassador/surveys`)
    return {
      success: true,
      submissionId: submission.id,
      score,
      passed,
      showResults: survey.showResults,
    }
  } catch (error) {
    console.error('Error submitting survey:', error)
    return { error: 'Failed to submit survey' }
  }
}

// ============================================
// RESULTS & ANALYTICS
// ============================================

export async function getSurveyResults(surveyId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  try {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        questions: {
          include: {
            options: true,
            answers: {
              include: {
                selectedOptions: true,
                submission: {
                  select: {
                    userId: true,
                    userRole: true,
                    score: true,
                    passed: true,
                    submittedAt: true,
                  },
                },
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        submissions: {
          orderBy: { submittedAt: 'desc' },
        },
      },
    })

    if (!survey) {
      return { error: 'Survey not found' }
    }

    // Calculate aggregate stats
    const totalSubmissions = survey.submissions.length
    const roleBreakdown = survey.submissions.reduce((acc, s) => {
      const role = s.userRole || 'Unknown'
      acc[role] = (acc[role] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    let quizStats = null
    if (survey.type === 'QUIZ') {
      const scores = survey.submissions.filter(s => s.score !== null).map(s => s.score as number)
      const passCount = survey.submissions.filter(s => s.passed).length

      quizStats = {
        averageScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
        passRate: totalSubmissions > 0 ? (passCount / totalSubmissions) * 100 : 0,
        passCount,
        failCount: totalSubmissions - passCount,
      }
    }

    // Build question-level analytics
    const questionAnalytics = survey.questions.map(q => {
      const answers = q.answers

      if (['MULTIPLE_CHOICE', 'MULTIPLE_SELECT'].includes(q.questionType)) {
        const optionCounts = q.options.map(opt => ({
          id: opt.id,
          text: opt.optionText,
          isCorrect: opt.isCorrect,
          count: answers.filter(a => a.selectedOptions.some(so => so.id === opt.id)).length,
          percentage: answers.length > 0
            ? (answers.filter(a => a.selectedOptions.some(so => so.id === opt.id)).length / answers.length) * 100
            : 0,
        }))

        return {
          id: q.id,
          questionText: q.questionText,
          questionType: q.questionType,
          responseCount: answers.length,
          optionCounts,
        }
      }

      if (q.questionType === 'LIKERT_SCALE') {
        const values = answers.filter(a => a.likertValue !== null).map(a => a.likertValue as number)
        const config = q.likertConfig as { minValue: number; maxValue: number; minLabel: string; maxLabel: string } | null
        const min = config?.minValue || 1
        const max = config?.maxValue || 5

        const distribution: Record<number, number> = {}
        for (let i = min; i <= max; i++) {
          distribution[i] = values.filter(v => v === i).length
        }

        return {
          id: q.id,
          questionText: q.questionText,
          questionType: q.questionType,
          responseCount: answers.length,
          average: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
          distribution,
          config,
        }
      }

      // TEXT_SHORT or TEXT_LONG
      return {
        id: q.id,
        questionText: q.questionText,
        questionType: q.questionType,
        responseCount: answers.length,
        responses: answers
          .filter(a => a.textResponse)
          .map(a => ({
            text: a.textResponse,
            submittedAt: a.submission.submittedAt.toISOString(),
            userRole: a.submission.userRole,
          })),
      }
    })

    return {
      survey: {
        id: survey.id,
        title: survey.title,
        type: survey.type,
        isAnonymous: survey.isAnonymous,
        scoreMode: survey.scoreMode,
        passingScore: survey.passingScore,
      },
      stats: {
        totalSubmissions,
        roleBreakdown,
        quizStats,
      },
      questionAnalytics,
    }
  } catch (error) {
    console.error('Error fetching survey results:', error)
    return { error: 'Failed to fetch results' }
  }
}

export async function getIndividualResponses(surveyId: string, page = 1, limit = 20) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  try {
    const skip = (page - 1) * limit

    const [submissions, total] = await Promise.all([
      prisma.surveySubmission.findMany({
        where: { surveyId },
        include: {
          answers: {
            include: {
              question: true,
              selectedOptions: true,
            },
          },
        },
        orderBy: { submittedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.surveySubmission.count({ where: { surveyId } }),
    ])

    return {
      submissions: submissions.map(s => ({
        id: s.id,
        userId: s.userId,
        userRole: s.userRole,
        score: s.score,
        passed: s.passed,
        submittedAt: s.submittedAt.toISOString(),
        answers: s.answers.map(a => ({
          questionId: a.questionId,
          questionText: a.question.questionText,
          questionType: a.question.questionType,
          selectedOptions: a.selectedOptions.map(o => o.optionText),
          likertValue: a.likertValue,
          textResponse: a.textResponse,
          isCorrect: a.isCorrect,
        })),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  } catch (error) {
    console.error('Error fetching individual responses:', error)
    return { error: 'Failed to fetch responses' }
  }
}

export async function exportSurveyResultsCSV(surveyId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  try {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        questions: {
          orderBy: { sortOrder: 'asc' },
        },
        submissions: {
          include: {
            answers: {
              include: {
                selectedOptions: true,
              },
            },
          },
          orderBy: { submittedAt: 'desc' },
        },
      },
    })

    if (!survey) {
      return { error: 'Survey not found' }
    }

    // Build CSV headers
    const headers = ['Submission ID', 'User Role', 'Submitted At']
    if (survey.type === 'QUIZ') {
      headers.push('Score', 'Passed')
    }
    survey.questions.forEach((q, i) => {
      headers.push(`Q${i + 1}: ${q.questionText.substring(0, 50)}`)
    })

    // Build CSV rows
    const rows = survey.submissions.map(s => {
      const row: string[] = [
        s.id,
        s.userRole || 'Anonymous',
        s.submittedAt.toISOString(),
      ]

      if (survey.type === 'QUIZ') {
        row.push(s.score?.toFixed(1) || 'N/A')
        row.push(s.passed ? 'Yes' : 'No')
      }

      survey.questions.forEach(q => {
        const answer = s.answers.find(a => a.questionId === q.id)
        if (!answer) {
          row.push('')
        } else if (['MULTIPLE_CHOICE', 'MULTIPLE_SELECT'].includes(q.questionType)) {
          row.push(answer.selectedOptions.map(o => o.optionText).join('; '))
        } else if (q.questionType === 'LIKERT_SCALE') {
          row.push(answer.likertValue?.toString() || '')
        } else {
          row.push(answer.textResponse || '')
        }
      })

      return row
    })

    return {
      headers,
      rows,
      filename: `${survey.title.replace(/[^a-z0-9]/gi, '_')}_results_${new Date().toISOString().split('T')[0]}.csv`,
    }
  } catch (error) {
    console.error('Error exporting survey results:', error)
    return { error: 'Failed to export results' }
  }
}
