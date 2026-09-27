import { cn } from 'cn'
import type { ReactNode } from 'react'

interface CardProps {
  title?: ReactNode
  description?: ReactNode
  /** Sits at the header's end: a button, a menu. */
  action?: ReactNode
  footer?: ReactNode
  children?: ReactNode
  className?: string
}

// `null` and `false` render nothing, so a slot holding one stays out, wrapper and spacing included.
const present = (slot: ReactNode) => slot !== undefined && slot !== null && slot !== false

/** A bordered surface grouping one thing's content, with an optional header and footer. */
export function Card({ title, description, action, footer, children, className }: CardProps) {
  const hasHeader = present(title) || present(description) || present(action)
  return (
    <section
      data-slot="card"
      className={cn(
        'flex flex-col gap-6 rounded-xl border bg-card py-6 text-card-foreground shadow-sm',
        className,
      )}
    >
      {hasHeader && (
        <header className="flex items-start gap-4 px-6">
          <div className="grid flex-1 gap-1.5">
            {present(title) && <h3 className="leading-none font-semibold">{title}</h3>}
            {present(description) && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {action}
        </header>
      )}
      {present(children) && <div className="px-6">{children}</div>}
      {present(footer) && <footer className="flex items-center gap-2 px-6">{footer}</footer>}
    </section>
  )
}
