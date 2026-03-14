import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://aava.ai'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/certifications', '/certifications/certificate/'],
        disallow: [
          '/training/',
          '/admin/',
          '/sales/',
          '/knowledge/',
          '/api/',
          '/login',
          '/test-*',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
