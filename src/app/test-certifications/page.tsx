import { CertificationCards } from '@/components/certifications/CertificationCards'

const mockTieredTracks = [
  {
    id: '1',
    title: 'AAVA Foundations',
    slug: 'aava-foundations',
    tier: 1,
    domain: null,
    description: 'Master the fundamentals of the AAVA methodology.',
    passingScore: 80,
    examDurationMinutes: 60,
    questionsPerExam: 30,
    questionPoolSize: 50,
    prerequisiteMet: null,
    prerequisiteTitle: null,
    prerequisiteSlug: null,
    earned: true,
  },
  {
    id: '2',
    title: 'AAVA Practitioner',
    slug: 'aava-practitioner',
    tier: 2,
    domain: null,
    description: 'Apply AAVA principles to real-world projects.',
    passingScore: 80,
    examDurationMinutes: 90,
    questionsPerExam: 40,
    questionPoolSize: 80,
    prerequisiteMet: true,
    prerequisiteTitle: 'AAVA Foundations',
    prerequisiteSlug: 'aava-foundations',
    earned: false,
  },
  {
    id: '3',
    title: 'AAVA Specialist',
    slug: 'aava-specialist',
    tier: 3,
    domain: null,
    description: 'Demonstrate expert-level mastery of AAVA.',
    passingScore: 80,
    examDurationMinutes: 120,
    questionsPerExam: 50,
    questionPoolSize: 100,
    prerequisiteMet: false,
    prerequisiteTitle: 'AAVA Practitioner',
    prerequisiteSlug: 'aava-practitioner',
    earned: false,
  },
]

const mockDomainTracks = [
  {
    id: '4',
    title: 'Sprint Planning Expert',
    slug: 'sprint-planning',
    tier: 3,
    domain: 'sprint_planning',
    description: 'Deep expertise in sprint planning.',
    passingScore: 80,
    examDurationMinutes: 60,
    questionsPerExam: 25,
    questionPoolSize: 40,
    prerequisiteMet: true,
    prerequisiteTitle: 'AAVA Practitioner',
    prerequisiteSlug: 'aava-practitioner',
    earned: false,
  },
]

export default function TestCertificationsPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <CertificationCards
        tieredTracks={mockTieredTracks}
        domainTracks={mockDomainTracks}
        authenticated={true}
      />
    </div>
  )
}
