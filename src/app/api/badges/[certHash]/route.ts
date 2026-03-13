import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://aava.ai'

/**
 * Map certification tier number to a human-readable name used for badge image paths.
 * Domain certifications (tier with a non-null domain field) use the domain slug instead.
 */
function getTierName(tier: number, domain: string | null): string {
  if (domain) return domain
  switch (tier) {
    case 1: return 'foundations'
    case 2: return 'practitioner'
    case 3: return 'specialist'
    default: return 'foundations'
  }
}

/**
 * GET /api/badges/[certHash]
 *
 * Public endpoint (no authentication required) that returns an Open Badges 3.0
 * compliant JSON-LD credential assertion for a given certificate verification hash.
 *
 * This endpoint must remain permanently available at its URL for LinkedIn credential
 * verification and Open Badges 3.0 machine-readability. Never delete issued
 * certificate records.
 *
 * @see https://www.imsglobal.org/spec/ob/v3p0/ — Open Badges 3.0 specification
 * @see https://www.w3.org/TR/vc-data-model-2.0/ — Verifiable Credentials Data Model
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ certHash: string }> }
) {
  const { certHash } = await params

  if (!certHash || typeof certHash !== 'string') {
    return NextResponse.json(
      { error: 'Invalid certificate hash' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  // Step 1: Look up the certificate by verification_hash, excluding revoked certificates
  const { data: certificate, error: certError } = await supabase
    .from('certificates')
    .select('*')
    .eq('verification_hash', certHash)
    .eq('revoked', false)
    .single()

  if (certError || !certificate) {
    return NextResponse.json(
      { error: 'Certificate not found' },
      { status: 404 }
    )
  }

  // Step 2: Fetch user profile for the certificate holder
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', certificate.user_id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json(
      { error: 'Certificate holder not found' },
      { status: 404 }
    )
  }

  // Step 3: Fetch certification track details
  const { data: track, error: trackError } = await supabase
    .from('certification_tracks')
    .select('title, slug, tier, domain, description, passing_score')
    .eq('id', certificate.track_id)
    .single()

  if (trackError || !track) {
    return NextResponse.json(
      { error: 'Certification track not found' },
      { status: 404 }
    )
  }

  // Step 4: Build the Open Badges 3.0 JSON-LD assertion
  const tierName = getTierName(track.tier, track.domain)

  const jsonLd = {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json',
    ],
    type: ['VerifiableCredential', 'OpenBadgeCredential'],
    id: `${SITE_URL}/api/badges/${certHash}`,
    issuer: {
      id: SITE_URL,
      type: 'Profile',
      name: 'AAVA Product Studio',
      url: SITE_URL,
      email: 'certifications@aava.ai',
    },
    issuanceDate: certificate.issued_at,
    credentialSubject: {
      type: 'AchievementSubject',
      id: `mailto:${profile.email}`,
      achievement: {
        id: `${SITE_URL}/certifications/${track.slug}`,
        type: 'Achievement',
        name: track.title,
        description: track.description ?? '',
        criteria: {
          narrative: `Pass the ${track.title} exam with ${track.passing_score}% or higher.`,
        },
        image: {
          id: `${SITE_URL}/badges/${tierName}.png`,
          type: 'Image',
        },
      },
    },
  }

  // Return with application/ld+json content type and public caching
  return new NextResponse(JSON.stringify(jsonLd), {
    status: 200,
    headers: {
      'Content-Type': 'application/ld+json',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
