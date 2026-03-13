/**
 * Question with difficulty level for sampling.
 */
export interface SamplableQuestion {
  id: string
  difficulty: 'easy' | 'medium' | 'hard'
}

/**
 * Select questions using stratified sampling across difficulty levels.
 *
 * Maintains the same proportion of easy/medium/hard questions as the pool.
 * Uses Fisher-Yates shuffle within each stratum for randomness.
 *
 * If the pool has fewer questions than requested, returns all questions (shuffled).
 *
 * @param pool - All available questions
 * @param count - Number of questions to select
 * @returns Array of selected question IDs
 */
export function stratifiedSample(pool: SamplableQuestion[], count: number): string[] {
  if (pool.length <= count) {
    return shuffle(pool).map(q => q.id)
  }

  // Group by difficulty
  const strata = new Map<string, SamplableQuestion[]>()
  for (const q of pool) {
    const group = strata.get(q.difficulty) ?? []
    group.push(q)
    strata.set(q.difficulty, group)
  }

  const selected: string[] = []
  let remaining = count

  // Calculate proportional allocation per stratum
  const allocations = new Map<string, number>()
  for (const [difficulty, questions] of strata) {
    const proportion = questions.length / pool.length
    const allocation = Math.floor(proportion * count)
    allocations.set(difficulty, allocation)
    remaining -= allocation
  }

  // Distribute remaining slots to largest strata first
  const sortedStrata = [...strata.entries()].sort((a, b) => b[1].length - a[1].length)
  for (const [difficulty] of sortedStrata) {
    if (remaining <= 0) break
    allocations.set(difficulty, (allocations.get(difficulty) ?? 0) + 1)
    remaining--
  }

  // Sample from each stratum
  for (const [difficulty, questions] of strata) {
    const allocation = allocations.get(difficulty) ?? 0
    const shuffled = shuffle(questions)
    for (let i = 0; i < Math.min(allocation, shuffled.length); i++) {
      selected.push(shuffled[i].id)
    }
  }

  return selected
}

/**
 * Fisher-Yates shuffle (returns new array, does not mutate input).
 */
function shuffle<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
