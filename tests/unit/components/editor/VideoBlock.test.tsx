import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import VideoBlockView from '@/components/editor/VideoBlock'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('VideoBlockView', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('shows loading state initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {})) // never resolves
    render(<VideoBlockView videoId="test-vid-123" />)

    expect(screen.getByTestId('video-loading-test-vid-123')).toBeInTheDocument()
    expect(screen.getByText('Loading video...')).toBeInTheDocument()
  })

  it('renders iframe with signed URL on success', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        iframe: 'https://iframe.cloudflarestream.com/signed-token-abc',
      }),
    })

    render(<VideoBlockView videoId="test-vid-456" />)

    await waitFor(() => {
      expect(screen.getByTestId('video-player-test-vid-456')).toBeInTheDocument()
    })

    const iframe = screen.getByTestId('video-player-iframe') as HTMLIFrameElement
    expect(iframe.src).toBe('https://iframe.cloudflarestream.com/signed-token-abc')
    expect(iframe).toHaveAttribute('allowfullscreen')
  })

  it('shows error state when fetch fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    })

    render(<VideoBlockView videoId="bad-vid" />)

    await waitFor(() => {
      expect(screen.getByTestId('video-error-bad-vid')).toBeInTheDocument()
    })

    expect(screen.getByText('Unable to load video')).toBeInTheDocument()
  })

  it('shows error state on network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    render(<VideoBlockView videoId="net-err" />)

    await waitFor(() => {
      expect(screen.getByTestId('video-error-net-err')).toBeInTheDocument()
    })

    expect(screen.getByText('Unable to load video')).toBeInTheDocument()
  })

  it('displays title when provided', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        iframe: 'https://iframe.cloudflarestream.com/signed-xyz',
      }),
    })

    render(<VideoBlockView videoId="titled-vid" title="Introduction to AAVA" />)

    await waitFor(() => {
      expect(screen.getByTestId('video-player-titled-vid')).toBeInTheDocument()
    })

    expect(screen.getByText('Introduction to AAVA')).toBeInTheDocument()
  })

  it('does not display title section when title is not provided', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        iframe: 'https://iframe.cloudflarestream.com/signed-no-title',
      }),
    })

    render(<VideoBlockView videoId="no-title-vid" />)

    await waitFor(() => {
      expect(screen.getByTestId('video-player-no-title-vid')).toBeInTheDocument()
    })

    // Only the iframe should be in the player container, no title paragraph
    const container = screen.getByTestId('video-player-no-title-vid')
    expect(container.querySelector('.border-t')).toBeNull()
  })

  it('fetches signed URL from the correct endpoint', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ iframe: 'https://iframe.cloudflarestream.com/test' }),
    })

    render(<VideoBlockView videoId="fetch-check-123" />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/video/signed/fetch-check-123')
    })
  })
})
