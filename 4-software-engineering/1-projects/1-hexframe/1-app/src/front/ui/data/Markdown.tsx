// The seam STACK.md names for a Tile's content: what a Body looks like on a page goes through this one
// file, so the Markdown renderer, when it comes, is the one thing that changes. For now it shows a
// Body that isn't Markdown, a file kept verbatim, as a code block, as Markdown shows a fenced one.
import { cn } from 'cn'

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
