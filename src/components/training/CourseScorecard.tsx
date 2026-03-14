'use client'

import { useEffect, useState, useRef } from 'react'

interface QuizBreakdownItem {
  quizTitle: string
  lessonTitle: string
  score: number
  maxScore: number
  percentage: number
  passed: boolean
}

interface CourseScorecardProps {
  courseTitle: string
  courseSlug: string
  finalScore: number
  passingScore: number
  passed: boolean
  completedAt: string | null
  breakdown: QuizBreakdownItem[]
  zone: 'training' | 'sales'
  hasCertification?: boolean
}

/**
 * Course completion scorecard with animated progress ring,
 * pass/fail status, quiz breakdown table, and action buttons.
 */
export default function CourseScorecard({
  courseTitle,
  courseSlug,
  finalScore,
  passingScore,
  passed,
  completedAt,
  breakdown,
  zone,
  hasCertification = false,
}: CourseScorecardProps) {
  const [animatedScore, setAnimatedScore] = useState(0)
  const [showConfetti, setShowConfetti] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Animate score fill on mount
  useEffect(() => {
    const duration = 1500
    const start = performance.now()
    const animate = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out curve
      const eased = 1 - Math.pow(1 - progress, 3)
      setAnimatedScore(Math.round(eased * finalScore))
      if (progress < 1) {
        requestAnimationFrame(animate)
      } else if (passed) {
        setShowConfetti(true)
      }
    }
    requestAnimationFrame(animate)
  }, [finalScore, passed])

  // Confetti animation
  useEffect(() => {
    if (!showConfetti || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    const particles: Array<{
      x: number; y: number; vx: number; vy: number
      color: string; size: number; rotation: number; rotationSpeed: number
    }> = []

    const colors = ['#009673', '#f50f7d', '#6464d7', '#ffc30f', '#f5821e']

    for (let i = 0; i < 80; i++) {
      particles.push({
        x: canvas.width / 2,
        y: canvas.height / 3,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 1) * 10 - 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 6 + 3,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
      })
    }

    let frame = 0
    const maxFrames = 120

    const draw = () => {
      if (frame >= maxFrames) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        return
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const p of particles) {
        p.x += p.vx
        p.vy += 0.15 // gravity
        p.y += p.vy
        p.rotation += p.rotationSpeed
        p.vx *= 0.99

        const alpha = 1 - frame / maxFrames
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.globalAlpha = alpha
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
        ctx.restore()
      }

      frame++
      requestAnimationFrame(draw)
    }

    requestAnimationFrame(draw)
  }, [showConfetti])

  // Progress ring dimensions
  const size = 160
  const strokeWidth = 10
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference

  const scoreColor = passed ? 'var(--success)' : 'var(--warning)'

  const linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
    `${typeof window !== 'undefined' ? window.location.origin : ''}/${zone}/${courseSlug}/results`
  )}`

  const formattedDate = completedAt
    ? new Date(completedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  return (
    <div className="relative" data-testid="course-scorecard">
      {/* Confetti canvas overlay */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
        data-testid="confetti-canvas"
      />

      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-brand bg-clip-text text-transparent">
            Course Complete
          </h1>
          <p className="text-foreground-muted text-lg">{courseTitle}</p>
          {formattedDate && (
            <p className="text-foreground-muted text-sm">Completed on {formattedDate}</p>
          )}
        </div>

        {/* Score Ring */}
        <div className="flex flex-col items-center space-y-4">
          <div className="relative inline-flex items-center justify-center">
            <svg width={size} height={size} className="-rotate-90">
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="var(--border)"
                strokeWidth={strokeWidth}
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={scoreColor}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-none"
              />
            </svg>
            <span
              className="absolute text-4xl font-bold"
              style={{ color: scoreColor }}
              data-testid="final-score"
            >
              {animatedScore}
            </span>
          </div>

          {/* Pass/Fail Badge */}
          <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${
              passed
                ? 'bg-[var(--success-muted)] text-[var(--success)] border border-[var(--success)]'
                : 'bg-[var(--warning-muted)] text-[var(--warning)] border border-[var(--warning)]'
            }`}
            data-testid="pass-fail-badge"
          >
            {passed ? 'PASSED' : 'NOT PASSED'}
          </div>

          {!passed && (
            <p className="text-foreground-muted text-sm text-center max-w-md">
              You needed {passingScore}% to pass. Review the breakdown below and retake
              quizzes to improve your score.
            </p>
          )}
        </div>

        {/* Quiz Breakdown Table */}
        {breakdown.length > 0 && (
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">Score Breakdown</h2>
            </div>
            <table className="w-full" data-testid="quiz-breakdown-table">
              <thead>
                <tr className="border-b border-border text-foreground-muted text-sm">
                  <th className="text-left px-4 py-2">Quiz</th>
                  <th className="text-right px-4 py-2">Score</th>
                  <th className="text-right px-4 py-2">Max</th>
                  <th className="text-right px-4 py-2">%</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((item, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-border-subtle last:border-b-0"
                    data-testid="breakdown-row"
                  >
                    <td className="px-4 py-3">
                      <div className="text-foreground text-sm">{item.quizTitle}</div>
                      <div className="text-foreground-muted text-xs">{item.lessonTitle}</div>
                    </td>
                    <td className="text-right px-4 py-3 text-foreground text-sm">
                      {item.score}
                    </td>
                    <td className="text-right px-4 py-3 text-foreground-muted text-sm">
                      {item.maxScore}
                    </td>
                    <td className="text-right px-4 py-3">
                      <span
                        className={`text-sm font-medium ${
                          item.passed ? 'text-[var(--success)]' : 'text-[var(--warning)]'
                        }`}
                      >
                        {item.percentage}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {passed && (
            <a
              href={linkedInShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#0A66C2] text-white rounded-lg hover:bg-[#004182] transition-colors text-sm font-medium"
              data-testid="linkedin-share-btn"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              Share to LinkedIn
            </a>
          )}

          {hasCertification && passed && (
            <a
              href={`/${zone}/${courseSlug}/certificate`}
              className="inline-flex items-center justify-center px-6 py-3 bg-accent text-background rounded-lg hover:bg-accent-hover transition-colors text-sm font-medium"
              data-testid="view-certificate-btn"
            >
              View Certificate
            </a>
          )}

          <a
            href={`/${zone}`}
            className="inline-flex items-center justify-center px-6 py-3 bg-muted border border-border text-foreground rounded-lg hover:bg-raised transition-colors text-sm font-medium"
            data-testid="browse-courses-btn"
          >
            Browse More Courses
          </a>
        </div>
      </div>
    </div>
  )
}
