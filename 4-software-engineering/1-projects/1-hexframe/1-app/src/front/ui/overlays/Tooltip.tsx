import { Tooltip as Tip } from 'radix-ui'
import type { ReactElement, ReactNode } from 'react'

interface TooltipProps {
  content: ReactNode
  /** The element it describes; it must take a ref and focus, as a Button does. */
  children: ReactElement
  side?: 'top' | 'right' | 'bottom' | 'left'
}

/** A short label shown on hover and on focus, for a control whose icon says too little. */
export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  return (
    <Tip.Provider delayDuration={0}>
      <Tip.Root>
        <Tip.Trigger asChild>{children}</Tip.Trigger>
        <Tip.Portal>
          <Tip.Content
            side={side}
            sideOffset={4}
            className="z-50 w-fit origin-(--radix-tooltip-content-transform-origin) animate-in rounded-md bg-foreground px-3 py-1.5 text-xs text-balance text-background fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
          >
            {content}
            <Tip.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground" />
          </Tip.Content>
        </Tip.Portal>
      </Tip.Root>
    </Tip.Provider>
  )
}
