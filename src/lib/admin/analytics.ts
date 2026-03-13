import { createServiceClient } from '@/lib/supabase/server'

export interface UserStats {
  total: number
  employees: number
  sales: number
  public: number
  admin: number
}

export interface ActivityStats {
  activeThisMonth: number
}

export interface CourseStats {
  publishedCourses: number
}

export interface CertStats {
  totalIssued: number
  issuedThisMonth: number
}

export interface CoursePerformanceRow {
  courseId: string
  courseTitle: string
  enrolled: number
  completed: number
  passRate: number
  avgScore: number | null
}

export interface MissedQuestionRow {
  questionId: string
  questionText: string
  courseName: string
  quizTitle: string
  incorrectRate: number
  totalAttempts: number
}

export interface RecentCertRow {
  certNumber: string
  recipientName: string
  certificationName: string
  issuedAt: string
  score: number | null
}

/**
 * Fetches user count stats broken down by role.
 */
export async function getUserStats(): Promise<UserStats> {
  const supabase = createServiceClient()

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('role')

  if (error || !profiles) {
    return { total: 0, employees: 0, sales: 0, public: 0, admin: 0 }
  }

  const stats: UserStats = { total: profiles.length, employees: 0, sales: 0, public: 0, admin: 0 }
  for (const p of profiles) {
    if (p.role === 'employee') stats.employees++
    else if (p.role === 'sales') stats.sales++
    else if (p.role === 'public') stats.public++
    else if (p.role === 'admin') stats.admin++
  }

  return stats
}

/**
 * Counts users with any lesson_progress or quiz_attempt in the last 30 days.
 */
export async function getActivityStats(): Promise<ActivityStats> {
  const supabase = createServiceClient()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const since = thirtyDaysAgo.toISOString()

  // Get distinct user IDs from lesson_progress in last 30 days
  const { data: lpUsers } = await supabase
    .from('lesson_progress')
    .select('user_id')
    .gte('started_at', since)

  // Get distinct user IDs from quiz_attempts in last 30 days
  const { data: qaUsers } = await supabase
    .from('quiz_attempts')
    .select('user_id')
    .gte('started_at', since)

  const uniqueUsers = new Set<string>()
  if (lpUsers) lpUsers.forEach(r => uniqueUsers.add(r.user_id))
  if (qaUsers) qaUsers.forEach(r => uniqueUsers.add(r.user_id))

  return { activeThisMonth: uniqueUsers.size }
}

/**
 * Counts published courses.
 */
export async function getCourseStats(): Promise<CourseStats> {
  const supabase = createServiceClient()

  const { count, error } = await supabase
    .from('courses')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published')

  return { publishedCourses: error ? 0 : (count ?? 0) }
}

/**
 * Counts total and this-month certificates issued.
 */
export async function getCertStats(): Promise<CertStats> {
  const supabase = createServiceClient()

  const { count: totalCount } = await supabase
    .from('certificates')
    .select('id', { count: 'exact', head: true })
    .eq('revoked', false)

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { count: monthCount } = await supabase
    .from('certificates')
    .select('id', { count: 'exact', head: true })
    .eq('revoked', false)
    .gte('issued_at', thirtyDaysAgo.toISOString())

  return {
    totalIssued: totalCount ?? 0,
    issuedThisMonth: monthCount ?? 0,
  }
}

/**
 * Fetches course performance: enrolled, completed, pass rate, avg score.
 * Sorted by enrollment count descending.
 */
export async function getCoursePerformance(): Promise<CoursePerformanceRow[]> {
  const supabase = createServiceClient()

  const { data: courses } = await supabase
    .from('courses')
    .select('id, title')
    .eq('status', 'published')

  if (!courses || courses.length === 0) return []

  const { data: enrollments } = await supabase
    .from('course_enrollments')
    .select('course_id, status, final_score')

  if (!enrollments) return []

  // Aggregate per course
  const courseMap = new Map<string, { title: string; enrolled: number; completed: number; passed: number; scores: number[] }>()

  for (const c of courses) {
    courseMap.set(c.id, { title: c.title, enrolled: 0, completed: 0, passed: 0, scores: [] })
  }

  for (const e of enrollments) {
    const course = courseMap.get(e.course_id)
    if (!course) continue
    course.enrolled++
    if (e.status === 'passed' || e.status === 'failed') {
      course.completed++
      if (e.final_score !== null) course.scores.push(e.final_score)
    }
    if (e.status === 'passed') course.passed++
  }

  const rows: CoursePerformanceRow[] = []
  for (const [courseId, data] of courseMap) {
    rows.push({
      courseId,
      courseTitle: data.title,
      enrolled: data.enrolled,
      completed: data.completed,
      passRate: data.completed > 0 ? Math.round((data.passed / data.completed) * 100) : 0,
      avgScore: data.scores.length > 0
        ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length * 10) / 10
        : null,
    })
  }

  rows.sort((a, b) => b.enrolled - a.enrolled)
  return rows
}

/**
 * Fetches top 10 most-missed questions by incorrect answer rate.
 */
export async function getMostMissedQuestions(): Promise<MissedQuestionRow[]> {
  const supabase = createServiceClient()

  // Fetch all question responses with question details
  const { data: responses } = await supabase
    .from('question_responses')
    .select('question_id, is_correct')

  if (!responses || responses.length === 0) return []

  // Aggregate by question
  const questionStats = new Map<string, { correct: number; total: number }>()
  for (const r of responses) {
    const stats = questionStats.get(r.question_id) ?? { correct: 0, total: 0 }
    stats.total++
    if (r.is_correct) stats.correct++
    questionStats.set(r.question_id, stats)
  }

  // Sort by incorrect rate descending, take top 10
  const sorted = Array.from(questionStats.entries())
    .map(([qId, stats]) => ({
      questionId: qId,
      incorrectRate: Math.round(((stats.total - stats.correct) / stats.total) * 100),
      totalAttempts: stats.total,
    }))
    .filter(q => q.totalAttempts >= 3) // Only questions with enough data
    .sort((a, b) => b.incorrectRate - a.incorrectRate)
    .slice(0, 10)

  if (sorted.length === 0) return []

  // Fetch question details
  const questionIds = sorted.map(q => q.questionId)
  const { data: questions } = await supabase
    .from('questions')
    .select('id, question_text, quiz_id')
    .in('id', questionIds)

  if (!questions) return []

  // Fetch quiz + lesson + course names
  const quizIds = [...new Set(questions.map(q => q.quiz_id))]
  const { data: quizzes } = await supabase
    .from('quizzes')
    .select('id, title, lesson_id')
    .in('id', quizIds)

  const lessonIds = quizzes ? [...new Set(quizzes.map(q => q.lesson_id))] : []
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, course_id')
    .in('id', lessonIds.length > 0 ? lessonIds : ['_none_'])

  const courseIds = lessons ? [...new Set(lessons.map(l => l.course_id))] : []
  const { data: coursesData } = await supabase
    .from('courses')
    .select('id, title')
    .in('id', courseIds.length > 0 ? courseIds : ['_none_'])

  // Build lookup maps
  const quizMap = new Map(quizzes?.map(q => [q.id, q]) ?? [])
  const lessonMap = new Map(lessons?.map(l => [l.id, l]) ?? [])
  const courseNameMap = new Map(coursesData?.map(c => [c.id, c.title]) ?? [])
  const questionMap = new Map(questions.map(q => [q.id, q]))

  return sorted.map(s => {
    const question = questionMap.get(s.questionId)
    const quiz = question ? quizMap.get(question.quiz_id) : null
    const lesson = quiz ? lessonMap.get(quiz.lesson_id) : null
    const courseName = lesson ? courseNameMap.get(lesson.course_id) ?? 'Unknown' : 'Unknown'

    return {
      questionId: s.questionId,
      questionText: question?.question_text ?? 'Unknown question',
      courseName,
      quizTitle: quiz?.title ?? 'Unknown quiz',
      incorrectRate: s.incorrectRate,
      totalAttempts: s.totalAttempts,
    }
  })
}

/**
 * Fetches the last 20 certificates issued with recipient and track info.
 */
export async function getRecentCertifications(): Promise<RecentCertRow[]> {
  const supabase = createServiceClient()

  const { data: certs } = await supabase
    .from('certificates')
    .select('cert_number, user_id, track_id, attempt_id, issued_at')
    .eq('revoked', false)
    .order('issued_at', { ascending: false })
    .limit(20)

  if (!certs || certs.length === 0) return []

  // Fetch user names
  const userIds = [...new Set(certs.map(c => c.user_id))]
  const { data: users } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', userIds)

  const userMap = new Map(users?.map(u => [u.id, u.full_name ?? u.email]) ?? [])

  // Fetch track names
  const trackIds = [...new Set(certs.map(c => c.track_id))]
  const { data: tracks } = await supabase
    .from('certification_tracks')
    .select('id, title')
    .in('id', trackIds)

  const trackMap = new Map(tracks?.map(t => [t.id, t.title]) ?? [])

  // Fetch attempt scores
  const attemptIds = certs.map(c => c.attempt_id).filter(Boolean) as string[]
  const { data: attempts } = await supabase
    .from('cert_attempts')
    .select('id, score')
    .in('id', attemptIds.length > 0 ? attemptIds : ['_none_'])

  const attemptMap = new Map(attempts?.map(a => [a.id, a.score]) ?? [])

  return certs.map(c => ({
    certNumber: c.cert_number,
    recipientName: userMap.get(c.user_id) ?? 'Unknown',
    certificationName: trackMap.get(c.track_id) ?? 'Unknown',
    issuedAt: c.issued_at,
    score: c.attempt_id ? attemptMap.get(c.attempt_id) ?? null : null,
  }))
}

/**
 * Generates CSV content for user export with enrollment summary.
 */
export async function exportUsersCSV(): Promise<string> {
  const supabase = createServiceClient()

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, created_at')
    .order('created_at', { ascending: false })

  if (!profiles || profiles.length === 0) return 'Email,Name,Role,Joined,Courses Enrolled,Courses Completed\n'

  const { data: enrollments } = await supabase
    .from('course_enrollments')
    .select('user_id, status')

  const enrollmentMap = new Map<string, { enrolled: number; completed: number }>()
  if (enrollments) {
    for (const e of enrollments) {
      const stats = enrollmentMap.get(e.user_id) ?? { enrolled: 0, completed: 0 }
      stats.enrolled++
      if (e.status === 'passed' || e.status === 'failed') stats.completed++
      enrollmentMap.set(e.user_id, stats)
    }
  }

  const header = 'Email,Name,Role,Joined,Courses Enrolled,Courses Completed'
  const rows = profiles.map(p => {
    const stats = enrollmentMap.get(p.id) ?? { enrolled: 0, completed: 0 }
    return [
      csvEscape(p.email),
      csvEscape(p.full_name ?? ''),
      p.role,
      new Date(p.created_at).toISOString().split('T')[0],
      stats.enrolled,
      stats.completed,
    ].join(',')
  })

  return [header, ...rows].join('\n')
}

/**
 * Generates CSV content for course completions export.
 */
export async function exportCompletionsCSV(): Promise<string> {
  const supabase = createServiceClient()

  const { data: enrollments } = await supabase
    .from('course_enrollments')
    .select('user_id, course_id, status, final_score, enrolled_at, completed_at')
    .order('enrolled_at', { ascending: false })

  if (!enrollments || enrollments.length === 0) return 'User Email,User Name,Course,Status,Score,Enrolled,Completed\n'

  const userIds = [...new Set(enrollments.map(e => e.user_id))]
  const courseIds = [...new Set(enrollments.map(e => e.course_id))]

  const { data: users } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .in('id', userIds)

  const { data: courses } = await supabase
    .from('courses')
    .select('id, title')
    .in('id', courseIds)

  const userMap = new Map(users?.map(u => [u.id, { email: u.email, name: u.full_name ?? '' }]) ?? [])
  const courseMap = new Map(courses?.map(c => [c.id, c.title]) ?? [])

  const header = 'User Email,User Name,Course,Status,Score,Enrolled,Completed'
  const rows = enrollments.map(e => {
    const user = userMap.get(e.user_id) ?? { email: 'Unknown', name: '' }
    return [
      csvEscape(user.email),
      csvEscape(user.name),
      csvEscape(courseMap.get(e.course_id) ?? 'Unknown'),
      e.status,
      e.final_score ?? '',
      new Date(e.enrolled_at).toISOString().split('T')[0],
      e.completed_at ? new Date(e.completed_at).toISOString().split('T')[0] : '',
    ].join(',')
  })

  return [header, ...rows].join('\n')
}

/** Escapes a CSV field value. */
function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
