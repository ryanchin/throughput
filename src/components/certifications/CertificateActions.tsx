'use client'

import { useState } from 'react'

interface CertificateActionsProps {
  certNumber: string
  certTitle: string
  verifyUrl: string
  issueDate: string
}

export function CertificateActions({
  certNumber,
  certTitle,
  verifyUrl,
  issueDate,
}: CertificateActionsProps) {
  const [copied, setCopied] = useState(false)

  const issueDateObj = new Date(issueDate)
  const issueYear = issueDateObj.getFullYear()
  const issueMonth = issueDateObj.getMonth() + 1

  const linkedInUrl = new URL('https://www.linkedin.com/profile/add')
  linkedInUrl.searchParams.set('startTask', 'CERTIFICATION_NAME')
  linkedInUrl.searchParams.set('name', certTitle)
  linkedInUrl.searchParams.set('issueYear', String(issueYear))
  linkedInUrl.searchParams.set('issueMonth', String(issueMonth))
  linkedInUrl.searchParams.set('certUrl', verifyUrl)
  linkedInUrl.searchParams.set('certId', certNumber)

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(verifyUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = verifyUrl
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function handleDownload() {
    window.print()
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-center print:hidden">
      <a
        href={linkedInUrl.toString()}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="linkedin-btn"
        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#0A66C2] text-white font-medium hover:bg-[#004182] transition-colors"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
        Add to LinkedIn
      </a>

      <button
        onClick={handleDownload}
        data-testid="download-btn"
        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-muted border border-border text-foreground font-medium hover:bg-raised transition-colors"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Download PDF
      </button>

      <button
        onClick={handleShare}
        data-testid="share-btn"
        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-muted border border-border text-foreground font-medium hover:bg-raised transition-colors"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        {copied ? 'Copied!' : 'Share Link'}
      </button>
    </div>
  )
}
