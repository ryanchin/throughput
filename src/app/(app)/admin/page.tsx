import {
  getUserStats,
  getActivityStats,
  getCourseStats,
  getCertStats,
  getCoursePerformance,
  getMostMissedQuestions,
  getRecentCertifications,
} from '@/lib/admin/analytics'
import { ExportButtons } from '@/components/admin/ExportButtons'
import { GenerationHistory } from '@/components/admin/GenerationHistory'

export default async function AdminDashboardPage() {
  const [userStats, activityStats, courseStats, certStats, coursePerformance, missedQuestions, recentCerts] =
    await Promise.all([
      getUserStats(),
      getActivityStats(),
      getCourseStats(),
      getCertStats(),
      getCoursePerformance(),
      getMostMissedQuestions(),
      getRecentCertifications(),
    ])

  return (
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
        {coursePerformance.length > 0 ? (
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
        ) : (
          <p className="text-sm text-foreground-muted">No published courses yet.</p>
        )}
      </section>

      {/* Most Missed Questions */}
      <section>
        <h2 className="mb-4 text-xl font-semibold text-foreground">Most Missed Questions</h2>
        {missedQuestions.length > 0 ? (
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
        ) : (
          <p className="text-sm text-foreground-muted">No quiz data available yet.</p>
        )}
      </section>

      {/* Recent Certifications */}
      <section>
        <h2 className="mb-4 text-xl font-semibold text-foreground">Recent Certifications</h2>
        {recentCerts.length > 0 ? (
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
        ) : (
          <p className="text-sm text-foreground-muted">No certifications issued yet.</p>
        )}
      </section>

      {/* AI Generation History */}
      <section>
        <h2 className="mb-4 text-xl font-semibold text-foreground">AI Generation History</h2>
        <GenerationHistory />
      </section>
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
