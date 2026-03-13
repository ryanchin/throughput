'use client'

interface ProgressRingProps {
  completed: number
  total: number
  size?: number
  strokeWidth?: number
  className?: string
}

export default function ProgressRing({
  completed,
  total,
  size = 80,
  strokeWidth = 6,
  className,
}: ProgressRingProps) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
  const clampedPercentage = Math.min(Math.max(percentage, 0), 100)

  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (clampedPercentage / 100) * circumference

  return (
    <div
      className={className}
      role="progressbar"
      aria-valuenow={completed}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={`${completed} of ${total} complete (${clampedPercentage}%)`}
      data-testid="progress-ring"
    >
      <div className="relative inline-flex items-center justify-center">
        <svg width={size} height={size} className="-rotate-90">
          {/* Track circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={strokeWidth}
          />
          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={clampedPercentage === 100 ? 'var(--success)' : 'var(--accent)'}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
          />
        </svg>
        <span
          className="absolute text-foreground font-semibold"
          style={{ fontSize: size * 0.18 }}
        >
          {completed}/{total}
        </span>
      </div>
    </div>
  )
}
