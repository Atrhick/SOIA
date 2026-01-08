import { PrismaClient, UserRole, OnboardingTaskType, AmbassadorOnboardingTaskType } from '@prisma/client'
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

  // Create Ambassador Onboarding Tasks
  const ambassadorOnboardingTasks = [
    {
      id: 'interview',
      label: 'Complete Interview',
      description: 'Schedule and complete your interview with a director or admin staff.',
      type: AmbassadorOnboardingTaskType.INTERVIEW,
      isRequired: true,
      sortOrder: 1,
    },
    {
      id: 'whatsapp-team',
      label: 'WhatsApp Support Team',
      description: 'Your support team WhatsApp group will be created by admin.',
      type: AmbassadorOnboardingTaskType.WHATSAPP_TEAM,
      isRequired: true,
      sortOrder: 2,
    },
    {
      id: 'business-idea',
      label: 'Submit Business Idea',
      description: 'Submit your business idea for review by the admin team.',
      type: AmbassadorOnboardingTaskType.BUSINESS_IDEA,
      isRequired: true,
      sortOrder: 3,
    },
    {
      id: 'power-team',
      label: 'Join Power Team',
      description: 'Get invited to the Power Team group after your business idea is approved.',
      type: AmbassadorOnboardingTaskType.POWER_TEAM,
      isRequired: true,
      sortOrder: 4,
    },
    {
      id: 'class-selection',
      label: 'Enroll in a Class',
      description: 'Browse and enroll in at least one class offered by coaches.',
      type: AmbassadorOnboardingTaskType.CLASS_SELECTION,
      isRequired: true,
      sortOrder: 5,
    },
  ]

  for (const task of ambassadorOnboardingTasks) {
    await prisma.ambassadorOnboardingTask.upsert({
      where: { id: task.id },
      update: task,
      create: task,
    })
  }
  console.log('Created ambassador onboarding tasks')

  // Create Demo Ambassador User
  const ambassadorPassword = await bcrypt.hash('ambassador123', 12)
  const ambassadorUser = await prisma.user.upsert({
    where: { email: 'ambassador@stageoneinaction.com' },
    update: {},
    create: {
      email: 'ambassador@stageoneinaction.com',
      password: ambassadorPassword,
      role: UserRole.AMBASSADOR,
    },
  })

  // Create Ambassador Profile
  const ambassador = await prisma.ambassador.upsert({
    where: { userId: ambassadorUser.id },
    update: {},
    create: {
      userId: ambassadorUser.id,
      coachId: coachProfile.id,
      firstName: 'Demo',
      lastName: 'Ambassador',
      email: 'ambassador@stageoneinaction.com',
      dateOfBirth: new Date('2008-05-15'), // 16 years old
      region: 'Georgia',
      status: 'PENDING',
    },
  })
  console.log('Created demo ambassador:', ambassadorUser.email)

  // Create onboarding progress for the ambassador (interview as first step)
  const interviewTask = await prisma.ambassadorOnboardingTask.findFirst({
    where: { type: AmbassadorOnboardingTaskType.INTERVIEW },
  })
  if (interviewTask) {
    await prisma.ambassadorOnboardingProgress.upsert({
      where: {
        ambassadorId_taskId: {
          ambassadorId: ambassador.id,
          taskId: interviewTask.id,
        },
      },
      update: {},
      create: {
        ambassadorId: ambassador.id,
        taskId: interviewTask.id,
        status: 'NOT_STARTED',
      },
    })
  }
  console.log('Created ambassador onboarding progress')

  // Create Sample Classes from Coach
  const sampleClasses = [
    {
      id: 'business-basics',
      coachId: coachProfile.id,
      title: 'Business Basics 101',
      description: 'Learn the fundamentals of starting and running a business. Perfect for young entrepreneurs!',
      date: new Date('2025-02-15T10:00:00'),
      duration: 60,
      location: 'Community Center Room A',
      isOnline: false,
      isFree: true,
      maxCapacity: 20,
      isActive: true,
    },
    {
      id: 'marketing-essentials',
      coachId: coachProfile.id,
      title: 'Marketing Essentials',
      description: 'Discover how to market your business effectively using social media and other channels.',
      date: new Date('2025-02-22T14:00:00'),
      duration: 90,
      isOnline: true,
      meetingLink: 'https://zoom.us/j/example',
      isFree: false,
      price: 25.00,
      maxCapacity: 15,
      isActive: true,
    },
    {
      id: 'financial-literacy',
      coachId: coachProfile.id,
      title: 'Financial Literacy for Young Entrepreneurs',
      description: 'Understanding money management, budgeting, and basic accounting for your business.',
      date: new Date('2025-03-01T11:00:00'),
      duration: 75,
      location: 'Online via Zoom',
      isOnline: true,
      isFree: true,
      maxCapacity: 30,
      isActive: true,
    },
  ]

  for (const classData of sampleClasses) {
    await prisma.coachClass.upsert({
      where: { id: classData.id },
      update: classData,
      create: classData,
    })
  }
  console.log('Created sample classes')

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

  // Create Feature Configurations
  const featureConfigs = [
    {
      feature: 'CRM',
      isEnabled: true,
      enabledForCoaches: true,
      enabledForAmbassadors: false,
    },
    {
      feature: 'PROJECT_MANAGEMENT',
      isEnabled: true,
      enabledForCoaches: true,
      enabledForAmbassadors: false,
    },
    {
      feature: 'COLLABORATION',
      isEnabled: true,
      enabledForCoaches: true,
      enabledForAmbassadors: true,
    },
    {
      feature: 'TIME_CLOCK',
      isEnabled: true,
      enabledForCoaches: true,
      enabledForAmbassadors: true,
    },
    {
      feature: 'SCHEDULING',
      isEnabled: true,
      enabledForCoaches: true,
      enabledForAmbassadors: true,
    },
    {
      feature: 'KNOWLEDGE_BASE',
      isEnabled: true,
      enabledForCoaches: true,
      enabledForAmbassadors: true,
    },
  ]

  for (const config of featureConfigs) {
    await prisma.featureConfig.upsert({
      where: { feature: config.feature },
      update: config,
      create: config,
    })
  }
  console.log('Created feature configurations')

  // Create sample CRM Pipeline Stages
  const pipelineStages = [
    { id: 'lead', name: 'Lead', color: '#6B7280', sortOrder: 1 },
    { id: 'contacted', name: 'Contacted', color: '#3B82F6', sortOrder: 2 },
    { id: 'qualified', name: 'Qualified', color: '#8B5CF6', sortOrder: 3 },
    { id: 'proposal', name: 'Proposal', color: '#F59E0B', sortOrder: 4 },
    { id: 'negotiation', name: 'Negotiation', color: '#EF4444', sortOrder: 5 },
    { id: 'won', name: 'Won', color: '#10B981', sortOrder: 6 },
    { id: 'lost', name: 'Lost', color: '#6B7280', sortOrder: 7 },
  ]

  for (const stage of pipelineStages) {
    await prisma.cRMPipelineStage.upsert({
      where: { id: stage.id },
      update: stage,
      create: stage,
    })
  }
  console.log('Created CRM pipeline stages')

  // Create sample Knowledge Base Categories
  const kbCategories = [
    {
      id: 'getting-started',
      name: 'Getting Started',
      slug: 'getting-started',
      description: 'Everything you need to know to get started',
      sortOrder: 1,
      allowedRoles: ['ADMIN', 'COACH', 'AMBASSADOR'],
    },
    {
      id: 'coaching-resources',
      name: 'Coaching Resources',
      slug: 'coaching-resources',
      description: 'Resources for coaches',
      sortOrder: 2,
      allowedRoles: ['ADMIN', 'COACH'],
    },
    {
      id: 'ambassador-guides',
      name: 'Ambassador Guides',
      slug: 'ambassador-guides',
      description: 'Guides for ambassadors',
      sortOrder: 3,
      allowedRoles: ['ADMIN', 'COACH', 'AMBASSADOR'],
    },
  ]

  for (const category of kbCategories) {
    await prisma.kBCategory.upsert({
      where: { id: category.id },
      update: category,
      create: category,
    })
  }
  console.log('Created knowledge base categories')

  // Create sample Knowledge Base Article
  await prisma.kBArticle.upsert({
    where: { slug: 'welcome-to-stageoneinaction' },
    update: {},
    create: {
      categoryId: 'getting-started',
      authorId: admin.id,
      title: 'Welcome to StageOneInAction',
      slug: 'welcome-to-stageoneinaction',
      content: `# Welcome to StageOneInAction

Welcome to our platform! This guide will help you get started.

## Getting Started

1. Complete your profile
2. Review the onboarding checklist
3. Connect with your team

## Need Help?

Contact your coach or administrator for assistance.`,
      excerpt: 'Get started with StageOneInAction platform.',
      status: 'PUBLISHED',
      publishedAt: new Date(),
      tags: ['welcome', 'getting-started'],
      allowedRoles: ['ADMIN', 'COACH', 'AMBASSADOR'],
    },
  })
  console.log('Created sample knowledge base article')

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
