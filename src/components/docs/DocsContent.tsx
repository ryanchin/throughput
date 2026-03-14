interface DocsContentProps {
  html: string
}

export function DocsContent({ html }: DocsContentProps) {
  return (
    <article
      className="docs-content prose-docs mx-auto max-w-3xl"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
