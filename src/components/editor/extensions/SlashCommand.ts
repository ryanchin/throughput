import { Extension } from '@tiptap/react'
import { PluginKey, Plugin } from '@tiptap/pm/state'

export interface SlashCommandItem {
  title: string
  description: string
  icon: string
  command: (editor: unknown) => void
}

export const slashCommandPluginKey = new PluginKey('slashCommand')

export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: slashCommandPluginKey,
        state: {
          init() {
            return { active: false, query: '', from: 0 }
          },
          apply(tr, prev) {
            const meta = tr.getMeta(slashCommandPluginKey)
            if (meta) return meta
            if (tr.docChanged) return { active: false, query: '', from: 0 }
            return prev
          },
        },
        props: {
          handleKeyDown(view, event) {
            const state = slashCommandPluginKey.getState(view.state)

            if (event.key === '/' && !state?.active) {
              const { $from } = view.state.selection
              const textBefore = $from.parent.textContent.slice(0, $from.parentOffset)

              // Only trigger at start of empty line or after whitespace
              if (textBefore.trim() === '') {
                // We let the '/' be typed, then the input rule or update handler catches it
                return false
              }
            }

            if (state?.active && event.key === 'Escape') {
              view.dispatch(
                view.state.tr.setMeta(slashCommandPluginKey, {
                  active: false,
                  query: '',
                  from: 0,
                })
              )
              return true
            }

            return false
          },
        },
      }),
    ]
  },
})
