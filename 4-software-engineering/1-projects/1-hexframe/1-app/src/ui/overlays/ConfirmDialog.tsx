import { AlertDialog } from 'radix-ui'
import type { ReactElement, ReactNode } from 'react'

import { m } from '#/paraglide/messages'

import { Button } from '../inputs/controls/button'

interface ConfirmDialogProps {
  /** The control that asks for confirmation, a Button most often. */
  trigger: ReactElement
  title: ReactNode
  description: ReactNode
  confirmLabel: string
  onConfirm: () => void
  /** The action cannot be undone: the confirm button says so in the destructive colour. */
  destructive?: boolean
}

/** Asks before an action runs; the user confirms or cancels, and nothing else on the page responds meanwhile. */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive = false,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-foreground/40 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg">
          <div className="grid gap-2 text-center sm:text-left">
            <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
            <AlertDialog.Description className="text-sm text-muted-foreground">
              {description}
            </AlertDialog.Description>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="outline">{m.ui_cancel()}</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant={destructive ? 'destructive' : 'default'} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
