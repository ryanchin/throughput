import { CertExamPlayer } from '@/components/certifications/CertExamPlayer'

export default function TestCertExamPage() {
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
        attemptsUsed={1}
        maxAttempts={3}
        cooldownUntil={null}
        hasInProgressAttempt={false}
      />
    </div>
  )
}
