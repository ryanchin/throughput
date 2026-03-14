import { Node, mergeAttributes } from '@tiptap/react'

export interface VideoNodeAttrs {
  videoId: string
  title: string
  duration: number
  status: 'uploading' | 'processing' | 'ready' | 'error'
  uploadProgress: number // 0-100
}

export const VideoNode = Node.create({
  name: 'video',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      videoId: { default: '' },
      title: { default: '' },
      duration: { default: 0 },
      status: { default: 'uploading' },
      uploadProgress: { default: 0 },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-video]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-video': '' }, HTMLAttributes)]
  },

  // Simple DOM-based node view (no React needed)
  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('div')
      dom.className =
        'video-block my-4 rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--background-subtle)]'
      dom.setAttribute('data-testid', `video-block-${node.attrs.videoId || 'new'}`)

      function render() {
        dom.innerHTML = ''
        const status = node.attrs.status
        const videoId = node.attrs.videoId
        const progress = node.attrs.uploadProgress

        if (status === 'uploading') {
          // Upload progress bar
          const wrapper = document.createElement('div')
          wrapper.className = 'p-6 text-center'

          const label = document.createElement('p')
          label.className = 'text-sm text-[var(--foreground-muted)] mb-3'
          label.textContent =
            progress > 0 ? `Uploading... ${progress}%` : 'Preparing upload...'
          wrapper.appendChild(label)

          const barBg = document.createElement('div')
          barBg.className = 'h-2 rounded-full bg-[var(--background-muted)] overflow-hidden'
          const barFill = document.createElement('div')
          barFill.className =
            'h-full rounded-full bg-[var(--accent)] transition-all duration-300'
          barFill.style.width = `${progress}%`
          barFill.setAttribute('data-testid', 'upload-progress-bar')
          barBg.appendChild(barFill)
          wrapper.appendChild(barBg)

          dom.appendChild(wrapper)
        } else if (status === 'processing') {
          // Processing state
          const wrapper = document.createElement('div')
          wrapper.className = 'p-6 text-center'
          wrapper.setAttribute('data-testid', 'video-processing')

          const spinner = document.createElement('div')
          spinner.className = 'inline-block animate-spin text-2xl mb-2'
          spinner.textContent = '\u27F3'
          wrapper.appendChild(spinner)

          const label = document.createElement('p')
          label.className = 'text-sm text-[var(--foreground-muted)]'
          label.textContent = 'Processing video...'
          wrapper.appendChild(label)

          dom.appendChild(wrapper)
        } else if (status === 'ready' && videoId) {
          // Ready: show iframe player via Bunny.net Stream
          const libraryId = process.env.NEXT_PUBLIC_BUNNY_STREAM_LIBRARY_ID || ''
          const iframe = document.createElement('iframe')
          iframe.src = `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`
          iframe.setAttribute('data-testid', 'video-player-iframe')
          iframe.width = '100%'
          iframe.height = '360'
          iframe.style.border = 'none'
          iframe.allow =
            'accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture'
          iframe.setAttribute('allowfullscreen', 'true')
          dom.appendChild(iframe)
        } else if (status === 'error') {
          const wrapper = document.createElement('div')
          wrapper.className = 'p-6 text-center'
          const label = document.createElement('p')
          label.className = 'text-sm text-[var(--destructive)]'
          label.textContent = 'Video upload failed. Try again.'
          wrapper.appendChild(label)
          dom.appendChild(wrapper)
        } else {
          // Empty / initial state — show upload dropzone
          const dropzone = document.createElement('div')
          dropzone.className =
            'p-8 text-center border-2 border-dashed border-[var(--border)] rounded-lg m-4 cursor-pointer hover:border-[var(--accent)] transition-colors'
          dropzone.setAttribute('data-testid', 'video-dropzone')

          const icon = document.createElement('div')
          icon.className = 'text-3xl mb-2 text-[var(--foreground-muted)]'
          icon.textContent = '\uD83C\uDFAC'
          dropzone.appendChild(icon)

          const label = document.createElement('p')
          label.className = 'text-sm text-[var(--foreground-muted)]'
          label.textContent = 'Drag and drop a video file or click to browse'
          dropzone.appendChild(label)

          const subtitle = document.createElement('p')
          subtitle.className = 'text-xs text-[var(--foreground-subtle)] mt-1'
          subtitle.textContent = 'MP4, MOV, WebM (max 10 GB)'
          dropzone.appendChild(subtitle)

          // File input (hidden)
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = 'video/*'
          input.className = 'hidden'
          input.setAttribute('data-testid', 'video-file-input')

          dropzone.addEventListener('click', () => input.click())

          // Drag and drop handlers
          dropzone.addEventListener('dragover', (e) => {
            e.preventDefault()
            dropzone.classList.add('border-[var(--accent)]')
          })
          dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('border-[var(--accent)]')
          })
          dropzone.addEventListener('drop', (e) => {
            e.preventDefault()
            dropzone.classList.remove('border-[var(--accent)]')
            const file = e.dataTransfer?.files[0]
            if (file && file.type.startsWith('video/')) {
              handleUpload(file)
            }
          })

          input.addEventListener('change', () => {
            const file = input.files?.[0]
            if (file) handleUpload(file)
          })

          dropzone.appendChild(input)
          dom.appendChild(dropzone)
        }

        // Title input (shown when video exists)
        if (videoId && (status === 'ready' || status === 'processing')) {
          const titleWrapper = document.createElement('div')
          titleWrapper.className = 'px-4 py-2 border-t border-[var(--border)]'

          const titleInput = document.createElement('input')
          titleInput.type = 'text'
          titleInput.value = node.attrs.title || ''
          titleInput.placeholder = 'Video title...'
          titleInput.className =
            'w-full bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] outline-none'
          titleInput.setAttribute('data-testid', 'video-title-input')

          if (editor.isEditable) {
            titleInput.addEventListener('input', (e) => {
              const pos = typeof getPos === 'function' ? getPos() : null
              if (pos !== null && pos !== undefined) {
                editor.view.dispatch(
                  editor.view.state.tr.setNodeMarkup(pos, undefined, {
                    ...node.attrs,
                    title: (e.target as HTMLInputElement).value,
                  })
                )
              }
            })
          } else {
            titleInput.disabled = true
          }

          titleWrapper.appendChild(titleInput)
          dom.appendChild(titleWrapper)
        }
      }

      async function handleUpload(file: File) {
        const pos = typeof getPos === 'function' ? getPos() : null
        if (pos === null || pos === undefined) return

        // Update to uploading state
        editor.view.dispatch(
          editor.view.state.tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            status: 'uploading',
            uploadProgress: 0,
          })
        )

        try {
          // 1. Get upload URL
          const urlRes = await fetch('/api/admin/video/upload-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ maxDurationSeconds: 3600 }),
          })

          if (!urlRes.ok) {
            throw new Error('Failed to get upload URL')
          }

          const { uploadUrl, uid, authKey } = await urlRes.json()

          // 2. Upload via PUT to Bunny.net Stream
          // Use XMLHttpRequest for upload progress tracking
          const xhr = new XMLHttpRequest()

          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 100)
              const currentPos = typeof getPos === 'function' ? getPos() : null
              if (currentPos !== null && currentPos !== undefined) {
                editor.view.dispatch(
                  editor.view.state.tr.setNodeMarkup(currentPos, undefined, {
                    ...node.attrs,
                    videoId: uid,
                    status: 'uploading',
                    uploadProgress: pct,
                  })
                )
              }
            }
          })

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              const currentPos = typeof getPos === 'function' ? getPos() : null
              if (currentPos !== null && currentPos !== undefined) {
                editor.view.dispatch(
                  editor.view.state.tr.setNodeMarkup(currentPos, undefined, {
                    ...node.attrs,
                    videoId: uid,
                    status: 'processing',
                    uploadProgress: 100,
                  })
                )
              }
              // Start polling for ready status
              pollStatus(uid)
            } else {
              const currentPos = typeof getPos === 'function' ? getPos() : null
              if (currentPos !== null && currentPos !== undefined) {
                editor.view.dispatch(
                  editor.view.state.tr.setNodeMarkup(currentPos, undefined, {
                    ...node.attrs,
                    status: 'error',
                  })
                )
              }
            }
          })

          xhr.addEventListener('error', () => {
            const currentPos = typeof getPos === 'function' ? getPos() : null
            if (currentPos !== null && currentPos !== undefined) {
              editor.view.dispatch(
                editor.view.state.tr.setNodeMarkup(currentPos, undefined, {
                  ...node.attrs,
                  status: 'error',
                })
              )
            }
          })

          xhr.open('PUT', uploadUrl)
          xhr.setRequestHeader('AccessKey', authKey)
          xhr.send(file)
        } catch {
          const currentPos = typeof getPos === 'function' ? getPos() : null
          if (currentPos !== null && currentPos !== undefined) {
            editor.view.dispatch(
              editor.view.state.tr.setNodeMarkup(currentPos, undefined, {
                ...node.attrs,
                status: 'error',
              })
            )
          }
        }
      }

      async function pollStatus(uid: string) {
        const maxAttempts = 60 // 5 minutes max
        let attempts = 0

        const interval = setInterval(async () => {
          attempts++
          if (attempts > maxAttempts) {
            clearInterval(interval)
            return
          }

          try {
            const res = await fetch(`/api/admin/video/status/${uid}`)
            if (!res.ok) return

            const data = await res.json()
            if (data.readyToStream) {
              clearInterval(interval)
              const currentPos = typeof getPos === 'function' ? getPos() : null
              if (currentPos !== null && currentPos !== undefined) {
                editor.view.dispatch(
                  editor.view.state.tr.setNodeMarkup(currentPos, undefined, {
                    ...node.attrs,
                    videoId: uid,
                    status: 'ready',
                    duration: data.duration || 0,
                  })
                )
              }
            }
          } catch {
            // Keep polling
          }
        }, 5000) // Poll every 5 seconds
      }

      render()

      return {
        dom,
        update: (updatedNode) => {
          if (updatedNode.type.name !== 'video') return false
          // Re-render when attrs change
          Object.assign(node.attrs, updatedNode.attrs)
          render()
          return true
        },
      }
    }
  },
})
