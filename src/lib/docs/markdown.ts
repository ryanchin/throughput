import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import rehypePrettyCode from 'rehype-pretty-code'

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypePrettyCode, {
    theme: 'github-dark-dimmed',
    keepBackground: true,
  })
  .use(rehypeStringify)

/**
 * Convert markdown string to HTML string using remark/rehype pipeline.
 */
export async function markdownToHtml(markdown: string): Promise<string> {
  const result = await processor.process(markdown)
  return String(result)
}
