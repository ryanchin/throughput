// @ts-nocheck — Tiptap Node generics are not compatible with .call() in tests
import { describe, it, expect } from 'vitest'
import { VideoNode } from '@/components/editor/extensions/VideoNode'

describe('VideoNode extension', () => {
  it('has the correct name', () => {
    expect(VideoNode.name).toBe('video')
  })

  it('is in the block group', () => {
    expect(VideoNode.config.group).toBe('block')
  })

  it('is an atom node', () => {
    expect(VideoNode.config.atom).toBe(true)
  })

  describe('attributes', () => {
    // Extract default attributes from the extension config
    // Use `as never` to avoid Tiptap internal type incompatibilities with `this` context
    const attrs = (VideoNode.config.addAttributes as CallableFunction)?.call(
      VideoNode
    ) as Record<string, { default: unknown }>

    it('has videoId with empty string default', () => {
      expect(attrs.videoId.default).toBe('')
    })

    it('has title with empty string default', () => {
      expect(attrs.title.default).toBe('')
    })

    it('has duration with 0 default', () => {
      expect(attrs.duration.default).toBe(0)
    })

    it('has status with uploading default', () => {
      expect(attrs.status.default).toBe('uploading')
    })

    it('has uploadProgress with 0 default', () => {
      expect(attrs.uploadProgress.default).toBe(0)
    })
  })

  describe('parseHTML', () => {
    it('matches div[data-video] elements', () => {
      const parseRules = (VideoNode.config.parseHTML as CallableFunction)?.call(VideoNode)
      expect(parseRules).toEqual([{ tag: 'div[data-video]' }])
    })
  })

  describe('renderHTML', () => {
    it('renders a div with data-video attribute', () => {
      const renderFn = VideoNode.config.renderHTML
      if (!renderFn) throw new Error('renderHTML not defined')

      const result = (renderFn as CallableFunction).call(VideoNode, {
        HTMLAttributes: { videoId: 'test-123' },
        node: {} as never,
      }) as [string, Record<string, string>]

      // Result should be ['div', mergedAttributes]
      expect(result[0]).toBe('div')
      expect(result[1]).toHaveProperty('data-video', '')
      expect(result[1]).toHaveProperty('videoId', 'test-123')
    })
  })
})
