import { CertExamPlayer } from '@/components/certifications/CertExamPlayer'

export default function TestCertExamMaxedPage() {
  return (
    <div className="min-h-screen bg-background">
      <CertExamPlayer
        trackId="test-track-id"
        trackTitle="AAVA Foundations"
        trackSlug="aava-foundations"
        tier={1}
        passingScore={80}
        examDurationMinutes={60}
        questionsPerExam={30}
        attemptsUsed={3}
        maxAttempts={3}
        cooldownUntil={new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()}
        hasInProgressAttempt={false}
      />
    </div>
  )
}
