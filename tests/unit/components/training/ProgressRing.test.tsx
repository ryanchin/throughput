import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import ProgressRing from '@/components/training/ProgressRing'

describe('ProgressRing', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders SVG with correct aria attributes', () => {
    render(<ProgressRing completed={3} total={5} />)
    const ring = screen.getByTestId('progress-ring')
    expect(ring).toHaveAttribute('role', 'progressbar')
    expect(ring).toHaveAttribute('aria-valuenow', '3')
    expect(ring).toHaveAttribute('aria-valuemin', '0')
    expect(ring).toHaveAttribute('aria-valuemax', '5')
    expect(ring).toHaveAttribute(
      'aria-label',
      '3 of 5 complete (60%)'
    )
  })

  it('shows "0/5" when completed=0', () => {
    render(<ProgressRing completed={0} total={5} />)
    expect(screen.getByText('0/5')).toBeInTheDocument()
  })

  it('shows "3/5" when completed=3', () => {
    render(<ProgressRing completed={3} total={5} />)
    expect(screen.getByText('3/5')).toBeInTheDocument()
  })

  it('shows "5/5" when completed=5', () => {
    render(<ProgressRing completed={5} total={5} />)
    expect(screen.getByText('5/5')).toBeInTheDocument()
  })

  it('uses accent color for partial progress', () => {
    const { container } = render(<ProgressRing completed={3} total={5} />)
    const circles = container.querySelectorAll('circle')
    // Second circle is the progress arc
    const progressCircle = circles[1]
    expect(progressCircle).toHaveAttribute('stroke', 'var(--accent)')
  })

  it('uses success color for 100% progress', () => {
    const { container } = render(<ProgressRing completed={5} total={5} />)
    const circles = container.querySelectorAll('circle')
    const progressCircle = circles[1]
    expect(progressCircle).toHaveAttribute('stroke', 'var(--success)')
  })

  it('has data-testid="progress-ring"', () => {
    render(<ProgressRing completed={0} total={0} />)
    expect(screen.getByTestId('progress-ring')).toBeInTheDocument()
  })

  it('handles 0/0 gracefully (shows 0%)', () => {
    render(<ProgressRing completed={0} total={0} />)
    const ring = screen.getByTestId('progress-ring')
    expect(ring).toHaveAttribute('aria-label', '0 of 0 complete (0%)')
    expect(screen.getByText('0/0')).toBeInTheDocument()
  })
})
