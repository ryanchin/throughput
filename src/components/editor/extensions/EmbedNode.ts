import { Node, mergeAttributes } from '@tiptap/react'

export interface EmbedNodeAttrs {
  src: string
  title: string
  height: number
  embedType: string
}

export const EmbedNode = Node.create({
  name: 'embed',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: { default: '' },
      title: { default: 'Embedded content' },
      height: { default: 400 },
      embedType: { default: 'generic' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-embed]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-embed': '' }, HTMLAttributes)]
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div')
      dom.className = 'embed-wrapper my-4 rounded-xl border border-[var(--border)] overflow-hidden'

      if (node.attrs.src) {
        const iframe = document.createElement('iframe')
        iframe.src = node.attrs.src
        iframe.title = node.attrs.title
        iframe.width = '100%'
        iframe.height = String(node.attrs.height)
        iframe.style.border = 'none'
        iframe.style.borderRadius = '12px'
        iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation')
        iframe.setAttribute('referrerpolicy', 'no-referrer')
        iframe.setAttribute('loading', 'lazy')
        dom.appendChild(iframe)

        // Show type badge
        const badge = document.createElement('div')
        badge.className = 'text-xs px-2 py-1 text-[var(--foreground-muted)]'
        badge.textContent = node.attrs.title
        dom.appendChild(badge)
      }

      return { dom }
    }
  },
})
