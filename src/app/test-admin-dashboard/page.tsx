'use client'

import { ExportButtons } from '@/components/admin/ExportButtons'

/**
 * Test page for admin analytics dashboard E2E tests.
 * Renders the dashboard UI with mock data, bypassing auth and DB calls.
 */
export default function TestAdminDashboardPage() {
  const userStats = { total: 42, employees: 25, sales: 10, public: 5, admin: 2 }
  const activityStats = { activeThisMonth: 18 }
  const courseStats = { publishedCourses: 7 }
  const certStats = { totalIssued: 23, issuedThisMonth: 5 }

  const coursePerformance = [
    { courseId: 'c1', courseTitle: 'AAVA Foundations', enrolled: 30, completed: 22, passRate: 86, avgScore: 82.5 },
    { courseId: 'c2', courseTitle: 'Sprint Planning Mastery', enrolled: 18, completed: 12, passRate: 75, avgScore: 78.3 },
    { courseId: 'c3', courseTitle: 'Sales Enablement 101', enrolled: 10, completed: 8, passRate: 100, avgScore: 91.0 },
  ]

  const missedQuestions = [
    { questionId: 'q1', questionText: 'What is the primary difference between velocity and throughput in agile metrics?', courseName: 'AAVA Foundations', quizTitle: 'Metrics Quiz', incorrectRate: 78, totalAttempts: 50 },
    { questionId: 'q2', questionText: 'Which OKR framework component ensures alignment across teams?', courseName: 'Sprint Planning Mastery', quizTitle: 'OKR Quiz', incorrectRate: 65, totalAttempts: 40 },
    { questionId: 'q3', questionText: 'Explain the key benefits of the AAVA retrospective model', courseName: 'AAVA Foundations', quizTitle: 'Retro Quiz', incorrectRate: 52, totalAttempts: 35 },
  ]

  const recentCerts = [
    { certNumber: 'AAVA-2026-000023', recipientName: 'Alice Johnson', certificationName: 'AAVA Practitioner', issuedAt: '2026-03-12T10:00:00Z', score: 92 },
    { certNumber: 'AAVA-2026-000022', recipientName: 'Bob Smith', certificationName: 'AAVA Foundations', issuedAt: '2026-03-10T14:00:00Z', score: 85 },
    { certNumber: 'AAVA-2026-000021', recipientName: 'Carol Williams', certificationName: 'AAVA Foundations', issuedAt: '2026-03-08T09:00:00Z', score: 88 },
  ]

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <ExportButtons />
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Users"
            value={userStats.total}
            subtitle={`${userStats.employees} employees, ${userStats.sales} sales, ${userStats.public} public`}
          />
          <StatCard
            title="Active This Month"
            value={activityStats.activeThisMonth}
            subtitle="Users with activity in last 30 days"
          />
          <StatCard
            title="Courses Published"
            value={courseStats.publishedCourses}
            subtitle="Available to learners"
          />
          <StatCard
            title="Certifications Issued"
            value={certStats.totalIssued}
            subtitle={`${certStats.issuedThisMonth} this month`}
          />
        </div>

        {/* Course Performance Table */}
        <section>
          <h2 className="mb-4 text-xl font-semibold text-foreground">Course Performance</h2>
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-foreground-muted">
                  <th className="px-4 py-3 font-medium">Course</th>
                  <th className="px-4 py-3 font-medium text-right">Enrolled</th>
                  <th className="px-4 py-3 font-medium text-right">Completed</th>
                  <th className="px-4 py-3 font-medium text-right">Pass Rate</th>
                  <th className="px-4 py-3 font-medium text-right">Avg Score</th>
                </tr>
              </thead>
              <tbody>
                {coursePerformance.map((row) => (
                  <tr key={row.courseId} className="border-b border-border-subtle last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">{row.courseTitle}</td>
                    <td className="px-4 py-3 text-right text-foreground-muted">{row.enrolled}</td>
                    <td className="px-4 py-3 text-right text-foreground-muted">{row.completed}</td>
                    <td className="px-4 py-3 text-right text-foreground-muted">{row.passRate}%</td>
                    <td className="px-4 py-3 text-right text-foreground-muted">
                      {row.avgScore !== null ? `${row.avgScore}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Most Missed Questions */}
        <section>
          <h2 className="mb-4 text-xl font-semibold text-foreground">Most Missed Questions</h2>
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-foreground-muted">
                  <th className="px-4 py-3 font-medium">Question</th>
                  <th className="px-4 py-3 font-medium">Course</th>
                  <th className="px-4 py-3 font-medium">Quiz</th>
                  <th className="px-4 py-3 font-medium text-right">% Incorrect</th>
                </tr>
              </thead>
              <tbody>
                {missedQuestions.map((row) => (
                  <tr key={row.questionId} className="border-b border-border-subtle last:border-0">
                    <td className="max-w-xs truncate px-4 py-3 text-foreground" title={row.questionText}>
                      {row.questionText.length > 80 ? row.questionText.slice(0, 80) + '...' : row.questionText}
                    </td>
                    <td className="px-4 py-3 text-foreground-muted">{row.courseName}</td>
                    <td className="px-4 py-3 text-foreground-muted">{row.quizTitle}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={row.incorrectRate >= 70 ? 'text-destructive' : row.incorrectRate >= 50 ? 'text-warning' : 'text-foreground-muted'}>
                        {row.incorrectRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Recent Certifications */}
        <section>
          <h2 className="mb-4 text-xl font-semibold text-foreground">Recent Certifications</h2>
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-foreground-muted">
                  <th className="px-4 py-3 font-medium">Recipient</th>
                  <th className="px-4 py-3 font-medium">Certification</th>
                  <th className="px-4 py-3 font-medium">Issued</th>
                  <th className="px-4 py-3 font-medium text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {recentCerts.map((row) => (
                  <tr key={row.certNumber} className="border-b border-border-subtle last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">{row.recipientName}</td>
                    <td className="px-4 py-3 text-foreground-muted">{row.certificationName}</td>
                    <td className="px-4 py-3 text-foreground-muted">
                      {new Date(row.issuedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground-muted">
                      {row.score !== null ? `${row.score}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}

function StatCard({ title, value, subtitle }: { title: string; value: number; subtitle: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-card" data-testid="stat-card">
      <p className="text-sm font-medium text-foreground-muted">{title}</p>
      <p className="mt-1 text-3xl font-bold text-foreground" data-testid="stat-value">{value}</p>
      <p className="mt-1 text-xs text-foreground-muted">{subtitle}</p>
    </div>
  )
}
