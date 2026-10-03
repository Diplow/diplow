import { XIcon } from 'lucide-react'
import { Dialog } from 'radix-ui'
import type { ReactNode } from 'react'

import { m } from '#/paraglide/messages'

interface DrawerProps {
  /** Controlled: whether a drawer is open is something a link carries, so it lives in the route's search params. */
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  /** Actions pinned at the bottom: save, cancel. */
  footer?: ReactNode
}

/** A panel sliding in from the right, over the page, for a task that keeps the page as context. */
export function Drawer({ open, onOpenChange, title, description, children, footer }: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          // Without a description, Radix warns unless told there is none.
          {...(description === undefined && { 'aria-describedby': undefined })}
          className="fixed inset-y-0 right-0 z-50 flex h-full w-3/4 flex-col gap-4 border-l bg-background shadow-lg transition ease-in-out data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:duration-500 data-[state=open]:slide-in-from-right sm:max-w-sm"
        >
          <header className="grid gap-1.5 p-4 pr-12">
            <Dialog.Title className="font-semibold text-foreground">{title}</Dialog.Title>
            {description !== undefined && (
              <Dialog.Description className="text-sm text-muted-foreground">
                {description}
              </Dialog.Description>
            )}
          </header>
          <div className="flex-1 overflow-y-auto px-4">{children}</div>
          {footer !== undefined && (
            <footer className="mt-auto flex justify-end gap-2 p-4">{footer}</footer>
          )}
          <Dialog.Close className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden [&_svg]:size-4">
            <XIcon />
            <span className="sr-only">{m.ui_close()}</span>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
