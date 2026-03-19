'use client'

import { useState } from 'react'
import QuizPlayer from '@/components/training/QuizPlayer'
import QuizResultsComponent from '@/components/training/QuizResults'

type QuestionType = 'multiple_choice' | 'true_false' | 'open_ended'

interface Question {
  id: string
  question_text: string
  question_type: QuestionType
  options: Array<{ text: string }> | null
  max_points: number
  order_index: number
}

interface QuizPageClientProps {
  quizId: string
  quizTitle: string
  questions: Array<{
    id: string
    question_text: string
    question_type: string
    options: unknown
    max_points: number
    order_index: number
  }>
  passingScore: number
  courseSlug: string
  lessonSlug: string
  lessonId: string
  basePath: string
  nextLessonSlug: string | null
}

interface QuizResults {
  attempt: { id: string; score: number; passed: boolean; attempt_number: number }
  responses: Array<{
    questionId: string
    questionText: string
    questionType: string
    userAnswer: string
    isCorrect: boolean
    pointsEarned: number
    maxPoints: number
    correctAnswer: string | null
    llmFeedback: {
      score: number
      feedback: string
      strengths: string[]
      improvements: string[]
    } | null
  }>
  quizTitle: string
  passingScore: number
}

export default function QuizPageClient(props: QuizPageClientProps) {
  const [results, setResults] = useState<QuizResults | null>(null)

  // Cast questions from server to the typed shape expected by QuizPlayer
  const typedQuestions: Question[] = props.questions.map((q) => ({
    id: q.id,
    question_text: q.question_text,
    question_type: q.question_type as QuestionType,
    options: q.options as Array<{ text: string }> | null,
    max_points: q.max_points,
    order_index: q.order_index,
  }))

  if (results) {
    return (
      <QuizResultsComponent
        results={results}
        courseSlug={props.courseSlug}
        lessonSlug={props.lessonSlug}
        lessonId={props.lessonId}
        basePath={props.basePath}
        nextLessonSlug={props.nextLessonSlug}
        onRetake={() => setResults(null)}
      />
    )
  }

  return (
    <QuizPlayer
      quizId={props.quizId}
      quizTitle={props.quizTitle}
      questions={typedQuestions}
      passingScore={props.passingScore}
      courseSlug={props.courseSlug}
      lessonSlug={props.lessonSlug}
      basePath={props.basePath}
      onResults={setResults}
    />
  )
}
