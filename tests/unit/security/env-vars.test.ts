import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Ensures no sensitive environment variable keys are prefixed with NEXT_PUBLIC_.
 * These keys must only be available server-side.
 */
const SENSITIVE_PREFIXES = [
  'OPENROUTER_API_KEY',
  'BUNNY_STREAM_API_KEY',
  'BUNNY_STREAM_TOKEN_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
]

describe('Environment variable security', () => {
  it('no sensitive env vars use NEXT_PUBLIC_ prefix in .env files', () => {
    const projectRoot = path.resolve(__dirname, '../../..')
    const envFiles = ['.env', '.env.local', '.env.local.example', '.env.production']

    for (const envFile of envFiles) {
      const filePath = path.join(projectRoot, envFile)
      if (!fs.existsSync(filePath)) continue

      const content = fs.readFileSync(filePath, 'utf-8')
      const lines = content.split('\n')

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('#') || !trimmed.includes('=')) continue

        const key = trimmed.split('=')[0].trim()

        for (const sensitive of SENSITIVE_PREFIXES) {
          expect(key).not.toBe(`NEXT_PUBLIC_${sensitive}`)
          // Also check if the key starts with NEXT_PUBLIC_ and contains the sensitive name
          if (key.startsWith('NEXT_PUBLIC_')) {
            expect(key).not.toContain(sensitive)
          }
        }
      }
    }
  })

  it('no sensitive env vars referenced with NEXT_PUBLIC_ prefix in source code', () => {
    const projectRoot = path.resolve(__dirname, '../../..')
    const srcDir = path.join(projectRoot, 'src')

    function scanDir(dir: string): string[] {
      const violations: string[] = []
      const entries = fs.readdirSync(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.next') {
          violations.push(...scanDir(fullPath))
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          const content = fs.readFileSync(fullPath, 'utf-8')
          for (const sensitive of SENSITIVE_PREFIXES) {
            if (content.includes(`NEXT_PUBLIC_${sensitive}`)) {
              violations.push(`${fullPath}: references NEXT_PUBLIC_${sensitive}`)
            }
          }
        }
      }
      return violations
    }

    const violations = scanDir(srcDir)
    expect(violations).toEqual([])
  })
})
