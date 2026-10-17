// A fold: what it hides, said in one line in the quiet ink, a chevron turning as it opens, the first
// ink under the pointer. Light, not a box, so it never reads as a form's button; a finger gets a target
// of 44px. The thinking once done and a run of reads fold so, and a receipt's changes.
import { cn } from 'cn'
import { ChevronRight } from 'lucide-react'
import { type ReactNode, useId, useState } from 'react'

interface FoldProps {
  /** The one line that says what it hides. */
  label: ReactNode
  /** Its type, `font-mono text-xs`; its ink is the quiet one, the first under the pointer. */
  className?: string
  /** Where what it hides goes once open, in a line that wraps: `basis-full`, below it. */
  panelClassName?: string
  /** What it hides until opened. */
  children: ReactNode
}

/** One line that opens on a click what it hides below it, and folds it back. */
export function Fold({ label, className, panelClassName, children }: FoldProps) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        className={cn(
          'flex items-center gap-2 text-faint outline-offset-2 transition-colors hover:text-foreground focus-visible:outline pointer-coarse:min-h-11',
          className,
        )}
        onClick={() => {
          setOpen(!open)
        }}
      >
        {label}
        <ChevronRight
          aria-hidden
          className={cn(
            'size-3 transition-transform duration-300 ease-glide motion-reduce:transition-none',
            open && 'rotate-90',
          )}
        />
      </button>
      <div id={id} hidden={!open} className={panelClassName}>
        {children}
      </div>
    </>
  )
}
