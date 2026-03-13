import { describe, it, expect } from 'vitest'
import { parseCourseResponse } from '@/lib/generate/parser'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validCourseJson(overrides: Record<string, unknown> = {}): string {
  const base = {
    title: 'Intro to PM',
    description: 'A comprehensive course on product management fundamentals.',
    learning_objectives: [
      'Understand the PM lifecycle',
      'Write effective user stories',
    ],
    lessons: [
      {
        title: 'What is Product Management?',
        summary: 'An overview of the PM discipline.',
        key_topics: ['PM role', 'Stakeholders'],
        content_outline: '## Overview\n\nProduct management is...',
        quiz: {
          questions: [
            {
              type: 'multiple_choice',
              question_text: 'What does PM stand for?',
              options: [
                { text: 'Product Management', is_correct: true },
                { text: 'Project Monitoring', is_correct: false },
              ],
            },
          ],
        },
      },
    ],
    ...overrides,
  }
  return JSON.stringify(base)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseCourseResponse', () => {
  it('parses a valid complete JSON response', () => {
    const result = parseCourseResponse(validCourseJson())

    expect(result.title).toBe('Intro to PM')
    expect(result.description).toBe(
      'A comprehensive course on product management fundamentals.'
    )
    expect(result.learning_objectives).toHaveLength(2)
    expect(result.lessons).toHaveLength(1)
    expect(result.lessons[0].title).toBe('What is Product Management?')
    expect(result.lessons[0].quiz?.questions).toHaveLength(1)
    expect(result.lessons[0].quiz?.questions[0].type).toBe('multiple_choice')
  })

  it('strips markdown code fences and parses JSON inside', () => {
    const fenced = '```json\n' + validCourseJson() + '\n```'
    const result = parseCourseResponse(fenced)

    expect(result.title).toBe('Intro to PM')
    expect(result.lessons).toHaveLength(1)
  })

  it('throws when title is missing', () => {
    const json = JSON.stringify({
      description: 'desc',
      learning_objectives: ['obj'],
      lessons: [
        {
          title: 'L1',
          summary: 's',
          key_topics: ['t'],
          content_outline: 'c',
        },
      ],
    })

    expect(() => parseCourseResponse(json)).toThrow(
      /LLM response failed validation/
    )
  })

  it('throws when lessons array is empty', () => {
    const json = validCourseJson({ lessons: [] })

    expect(() => parseCourseResponse(json)).toThrow(
      /Course must have at least one lesson/
    )
  })

  it('throws when a multiple choice question has fewer than 2 options', () => {
    const json = validCourseJson({
      lessons: [
        {
          title: 'L1',
          summary: 's',
          key_topics: ['t'],
          content_outline: 'c',
          quiz: {
            questions: [
              {
                type: 'multiple_choice',
                question_text: 'Q?',
                options: [{ text: 'Only one', is_correct: true }],
              },
            ],
          },
        },
      ],
    })

    expect(() => parseCourseResponse(json)).toThrow(
      /at least 2 options/
    )
  })

  it('parses MC question with no correct option set (Zod does not enforce exactly one correct)', () => {
    const json = validCourseJson({
      lessons: [
        {
          title: 'L1',
          summary: 's',
          key_topics: ['t'],
          content_outline: 'c',
          quiz: {
            questions: [
              {
                type: 'multiple_choice',
                question_text: 'Q?',
                options: [
                  { text: 'A', is_correct: false },
                  { text: 'B', is_correct: false },
                ],
              },
            ],
          },
        },
      ],
    })

    const result = parseCourseResponse(json)
    const opts = result.lessons[0].quiz?.questions[0].options ?? []
    expect(opts.every((o) => o.is_correct === false)).toBe(true)
  })

  it('auto-generates options for true_false question without options', () => {
    const json = validCourseJson({
      lessons: [
        {
          title: 'L1',
          summary: 's',
          key_topics: ['t'],
          content_outline: 'c',
          quiz: {
            questions: [
              {
                type: 'true_false',
                question_text: 'The sky is blue.',
              },
            ],
          },
        },
      ],
    })

    const result = parseCourseResponse(json)
    const q = result.lessons[0].quiz?.questions[0]
    expect(q?.options).toHaveLength(2)
    expect(q?.options?.[0]).toEqual({ text: 'True', is_correct: true })
    expect(q?.options?.[1]).toEqual({ text: 'False', is_correct: false })
  })

  it('parses open_ended question with rubric', () => {
    const json = validCourseJson({
      lessons: [
        {
          title: 'L1',
          summary: 's',
          key_topics: ['t'],
          content_outline: 'c',
          quiz: {
            questions: [
              {
                type: 'open_ended',
                question_text: 'Explain PM.',
                rubric: 'Should mention stakeholder alignment.',
              },
            ],
          },
        },
      ],
    })

    const result = parseCourseResponse(json)
    const q = result.lessons[0].quiz?.questions[0]
    expect(q?.type).toBe('open_ended')
    expect(q?.rubric).toBe('Should mention stakeholder alignment.')
  })

  it('strips extra/unknown fields from the response', () => {
    const raw = JSON.parse(validCourseJson())
    raw.bonus_field = 'should be stripped'
    raw.lessons[0].extra = 'also stripped'

    const result = parseCourseResponse(JSON.stringify(raw))

    expect(result).not.toHaveProperty('bonus_field')
    expect(result.lessons[0]).not.toHaveProperty('extra')
  })

  it('throws a descriptive error for completely invalid JSON', () => {
    expect(() => parseCourseResponse('this is not json at all')).toThrow(
      /Failed to parse LLM response as JSON/
    )
  })

  it('throws for empty string input', () => {
    expect(() => parseCourseResponse('')).toThrow()
  })
})
