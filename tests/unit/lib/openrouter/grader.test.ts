import { describe, it, expect } from 'vitest'
import { parseGradeResponse } from '@/lib/openrouter/grader'

describe('parseGradeResponse', () => {
  it('parses valid JSON with all fields correctly', () => {
    const raw = JSON.stringify({
      score: 8,
      feedback: 'Good answer covering key concepts.',
      strengths: ['Clear explanation', 'Good examples'],
      improvements: ['Could add more detail'],
    })
    const result = parseGradeResponse(raw, 10)
    expect(result).toEqual({
      score: 8,
      feedback: 'Good answer covering key concepts.',
      strengths: ['Clear explanation', 'Good examples'],
      improvements: ['Could add more detail'],
    })
  })

  it('clamps score to maxPoints if LLM returns too high', () => {
    const raw = JSON.stringify({
      score: 25,
      feedback: 'Excellent.',
      strengths: [],
      improvements: [],
    })
    const result = parseGradeResponse(raw, 10)
    expect(result.score).toBe(10)
  })

  it('clamps score to 0 if LLM returns negative', () => {
    const raw = JSON.stringify({
      score: -5,
      feedback: 'Poor response.',
      strengths: [],
      improvements: [],
    })
    const result = parseGradeResponse(raw, 10)
    expect(result.score).toBe(0)
  })

  it('rounds score to integer', () => {
    const raw = JSON.stringify({
      score: 7.6,
      feedback: 'Decent.',
      strengths: [],
      improvements: [],
    })
    const result = parseGradeResponse(raw, 10)
    expect(result.score).toBe(8)
  })

  it('returns defaults for invalid JSON (unparseable string)', () => {
    const result = parseGradeResponse('this is not json at all', 10)
    expect(result.score).toBe(0)
    expect(result.feedback).toContain('Unable to grade')
    expect(result.strengths).toEqual([])
    expect(result.improvements).toEqual([])
  })

  it('returns defaults for empty string', () => {
    const result = parseGradeResponse('', 10)
    expect(result.score).toBe(0)
    expect(result.feedback).toContain('Unable to grade')
    expect(result.strengths).toEqual([])
    expect(result.improvements).toEqual([])
  })

  it('returns score 0 when JSON is missing score field', () => {
    const raw = JSON.stringify({
      feedback: 'Some feedback.',
      strengths: ['Good'],
      improvements: ['Better'],
    })
    const result = parseGradeResponse(raw, 10)
    expect(result.score).toBe(0)
  })

  it('returns empty arrays when strengths/improvements are missing', () => {
    const raw = JSON.stringify({
      score: 5,
      feedback: 'Okay.',
    })
    const result = parseGradeResponse(raw, 10)
    expect(result.strengths).toEqual([])
    expect(result.improvements).toEqual([])
  })

  it('filters non-string entries from strengths array', () => {
    const raw = JSON.stringify({
      score: 7,
      feedback: 'Good.',
      strengths: ['Valid', 123, null, 'Also valid', true],
      improvements: ['Fix this'],
    })
    const result = parseGradeResponse(raw, 10)
    expect(result.strengths).toEqual(['Valid', 'Also valid'])
  })

  it('returns default feedback when feedback is empty string', () => {
    const raw = JSON.stringify({
      score: 5,
      feedback: '',
      strengths: [],
      improvements: [],
    })
    const result = parseGradeResponse(raw, 10)
    expect(result.feedback).toBe('Unable to generate detailed feedback.')
  })

  it('handles null values gracefully', () => {
    const raw = JSON.stringify({
      score: null,
      feedback: null,
      strengths: null,
      improvements: null,
    })
    const result = parseGradeResponse(raw, 10)
    expect(result.score).toBe(0)
    expect(result.feedback).toBe('Unable to generate detailed feedback.')
    expect(result.strengths).toEqual([])
    expect(result.improvements).toEqual([])
  })
})
