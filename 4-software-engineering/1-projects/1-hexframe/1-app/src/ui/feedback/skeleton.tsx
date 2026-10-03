import type { ComponentProps } from 'react'
import { cn } from 'cn'

/** A placeholder in the shape of content still loading; size it with `className`. */
function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('animate-pulse rounded-md bg-accent', className)}
      {...props}
    />
  )
}

export { Skeleton }
