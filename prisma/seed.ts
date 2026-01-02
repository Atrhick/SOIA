import { PrismaClient, UserRole, OnboardingTaskType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create Admin User
  const adminPassword = await bcrypt.hash('admin123', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@stageoneinaction.com' },
    update: {},
    create: {
      email: 'admin@stageoneinaction.com',
      password: adminPassword,
      role: UserRole.ADMIN,
    },
  })
  console.log('Created admin user:', admin.email)

  // Create Demo Coach User
  const coachPassword = await bcrypt.hash('coach123', 12)
  const coachUser = await prisma.user.upsert({
    where: { email: 'coach@stageoneinaction.com' },
    update: {},
    create: {
      email: 'coach@stageoneinaction.com',
      password: coachPassword,
      role: UserRole.COACH,
    },
  })

  // Create Coach Profile
  const coachProfile = await prisma.coachProfile.upsert({
    where: { userId: coachUser.id },
    update: {},
    create: {
      userId: coachUser.id,
      firstName: 'Demo',
      lastName: 'Coach',
      bio: 'A passionate coach dedicated to developing young leaders.',
      city: 'Atlanta',
      region: 'Georgia',
      country: 'USA',
    },
  })
  console.log('Created demo coach:', coachUser.email)

  // Create Onboarding Tasks
  const onboardingTasks = [
    {
      label: 'Upload Profile Photo',
      description: 'Upload a professional photo for your coach profile.',
      type: OnboardingTaskType.UPLOAD,
      sortOrder: 1,
    },
    {
      label: 'Complete Coach Profile',
      description: 'Fill in your bio, contact information, and location.',
      type: OnboardingTaskType.MANUAL_STATUS,
      sortOrder: 2,
    },
    {
      label: 'Watch Anti-Human Trafficking Course',
      description: 'Complete the required anti-human trafficking training video.',
      type: OnboardingTaskType.VIDEO,
      sortOrder: 3,
    },
    {
      label: 'Pass Anti-Human Trafficking Assessment',
      description: 'Complete the assessment with at least 80% score.',
      type: OnboardingTaskType.QUIZ,
      sortOrder: 4,
    },
    {
      label: 'Complete Mental Fitness Assessment',
      description: 'Complete the mental fitness self-assessment.',
      type: OnboardingTaskType.MANUAL_STATUS,
      sortOrder: 5,
    },
    {
      label: 'Confirm Receipt of Coach Workbook',
      description: 'Confirm that you have received and reviewed the Coach Workbook.',
      type: OnboardingTaskType.BOOLEAN,
      sortOrder: 6,
    },
    {
      label: 'Complete Coach Interview',
      description: 'Schedule and complete your coach interview with administration.',
      type: OnboardingTaskType.MANUAL_STATUS,
      sortOrder: 7,
    },
    {
      label: 'Confirm Coach Fee Payment',
      description: 'Confirm that the $1,500 coach fee has been paid or approved.',
      type: OnboardingTaskType.MANUAL_STATUS,
      sortOrder: 8,
    },
    {
      label: 'Have 2 Approved Ambassadors',
      description: 'Have at least 2 ambassadors approved and assigned to you.',
      type: OnboardingTaskType.MANUAL_STATUS,
      sortOrder: 9,
    },
  ]

  for (const task of onboardingTasks) {
    await prisma.onboardingTask.upsert({
      where: { id: task.label.toLowerCase().replace(/\s+/g, '-') },
      update: task,
      create: {
        id: task.label.toLowerCase().replace(/\s+/g, '-'),
        ...task,
      },
    })
  }
  console.log('Created onboarding tasks')

  // Create Anti-Human Trafficking Course
  const course = await prisma.course.upsert({
    where: { id: 'anti-human-trafficking' },
    update: {},
    create: {
      id: 'anti-human-trafficking',
      name: 'Anti-Human Trafficking Training',
      description: 'Required training course on human trafficking awareness and prevention.',
      videoUrl: 'https://example.com/training-video',
      isRequired: true,
      sortOrder: 1,
    },
  })

  // Create sample quiz questions
  const questions = [
    {
      questionText: 'What is human trafficking?',
      options: [
        { text: 'The legal transport of goods across borders', isCorrect: false },
        { text: 'A form of modern slavery involving force, fraud, or coercion', isCorrect: true },
        { text: 'International travel for business', isCorrect: false },
        { text: 'Moving to a new country', isCorrect: false },
      ],
    },
    {
      questionText: 'What are common warning signs of trafficking?',
      options: [
        { text: 'Signs of physical abuse or malnourishment', isCorrect: true },
        { text: 'Having a regular 9-5 job', isCorrect: false },
        { text: 'Owning a smartphone', isCorrect: false },
        { text: 'Living with family', isCorrect: false },
      ],
    },
    {
      questionText: 'What should you do if you suspect trafficking?',
      options: [
        { text: 'Ignore it', isCorrect: false },
        { text: 'Confront the suspected trafficker', isCorrect: false },
        { text: 'Report to the National Human Trafficking Hotline', isCorrect: true },
        { text: 'Post about it on social media', isCorrect: false },
      ],
    },
  ]

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    const question = await prisma.quizQuestion.create({
      data: {
        courseId: course.id,
        questionText: q.questionText,
        sortOrder: i + 1,
      },
    })

    for (let j = 0; j < q.options.length; j++) {
      await prisma.quizOption.create({
        data: {
          questionId: question.id,
          optionText: q.options[j].text,
          isCorrect: q.options[j].isCorrect,
          sortOrder: j + 1,
        },
      })
    }
  }
  console.log('Created quiz questions')

  // Create Ambassador Workbook Course
  await prisma.course.upsert({
    where: { id: 'ambassador-workbook' },
    update: {},
    create: {
      id: 'ambassador-workbook',
      name: 'Ambassador Workbook Course',
      description: 'Training on how to use the Ambassador Workbook effectively.',
      videoUrl: 'https://example.com/workbook-training',
      isRequired: false,
      sortOrder: 2,
    },
  })
  console.log('Created Ambassador Workbook course')

  // Create sample events
  const events = [
    {
      id: 'leadership-conference-2025',
      name: 'Leadership Conference 2025',
      description: 'Annual mid-year leadership conference for qualified coaches.',
      location: 'Atlanta, GA',
      startDate: new Date('2025-06-15'),
      endDate: new Date('2025-06-17'),
      requireOnboardingComplete: true,
      requiredApprovedAmbassadors: 2,
    },
    {
      id: 'youth-convention-2025',
      name: 'Youth Convention 2025',
      description: 'Annual youth convention after Thanksgiving.',
      location: 'Dallas, TX',
      startDate: new Date('2025-11-28'),
      endDate: new Date('2025-11-30'),
      requireOnboardingComplete: true,
      requiredApprovedAmbassadors: 3,
    },
  ]

  for (const event of events) {
    await prisma.event.upsert({
      where: { id: event.id },
      update: event,
      create: event,
    })
  }
  console.log('Created events')

  console.log('Seeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
