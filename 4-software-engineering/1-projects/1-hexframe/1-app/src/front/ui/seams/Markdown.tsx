// The seam STACK.md names for a Tile's content: what a Body looks like on a page goes through this one
// file, so the Markdown renderer, TanStack Markdown, is the one thing that changes should it go. A Body
// that is Markdown is rendered (`Markdown`); one that isn't, a file kept verbatim, shows as a code
// block, as Markdown shows a fenced one (`CodeBlock`).
import { Markdown as Rendered } from '@tanstack/markdown/react'
import { cn } from 'cn'

/**
 * How rendered Markdown reads: the human's words in their serif, light, each block spaced as a page
 * spaces it, code in the interface's monospace, links underlined, never a colour of their own.
 */
const prose = [
  'font-human text-base leading-[1.6] font-light text-foreground',
  '[&_h1]:mt-8 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-normal',
  '[&_h2]:mt-7 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-normal',
  '[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-normal',
  '[&_p]:my-3 [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6',
  '[&_a]:underline [&_a]:underline-offset-4 [&_strong]:font-normal [&_strong]:text-foreground',
  '[&_blockquote]:my-4 [&_blockquote]:border-l [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground',
  '[&_code]:font-mono [&_code]:text-[0.85em] [&_hr]:my-6 [&_hr]:border-border',
  '[&_pre]:my-4 [&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-4 [&_pre]:text-xs',
  '[&_table]:my-4 [&_td]:py-1 [&_td]:pr-4 [&_th]:py-1 [&_th]:pr-4 [&_th]:text-left [&_th]:font-normal [&_img]:max-w-full',
].join(' ')

interface MarkdownProps {
  /** The Markdown, a Body. */
  text: string
  className?: string
}

/**
 * Markdown rendered as a page reads it. Its HTML is shown as text and a link that would run code is
 * dropped, the renderer's defaults, kept: a Body is anyone's words, someone else's on a System visited.
 */
export function Markdown({ text, className }: MarkdownProps) {
  return (
    <div className={cn(prose, className)}>
      <Rendered>{text}</Rendered>
    </div>
  )
}

interface CodeBlockProps {
  /** The text, shown as written: no line is wrapped nor any character read as markup. */
  code: string
  /** What the code is, for a screen reader: a file's name. */
  label: string
  className?: string
}

/**
 * Text shown as written, in a monospaced box that scrolls rather than wraps, and that the keyboard
 * reaches to scroll it.
 */
export function CodeBlock({ code, label, className }: CodeBlockProps) {
  return (
    <pre
      aria-label={label}
      // A box that scrolls takes the focus, so the keyboard can scroll it too.
      tabIndex={0}
      className={cn(
        'max-h-96 overflow-auto rounded-md border bg-muted p-4 font-mono text-xs leading-relaxed text-foreground',
        className,
      )}
    >
      <code>{code}</code>
    </pre>
  )
}
