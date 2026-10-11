import { cn } from 'cn'
import { AlertDialog } from 'radix-ui'
import { useId, useState, type ReactNode } from 'react'

import { m } from '#/paraglide/messages'

import { Act, voiceOf } from '../atoms/controls/act'

interface DialogProps {
  /** Controlled: a dialog opens from a widget's action or a menu's entry, not from a trigger of its own. */
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `destructive` for what is lost, `neutral` otherwise: its line, its kicker and its act say so. */
  tone?: 'destructive' | 'neutral'
  /** The act, in a word or two: "delete", "unsaved edit". */
  kicker: string
  /** The act asked as a question about the thing itself: "Delete Site?". */
  title: string
  /** One paragraph of consequence, counted. */
  children: ReactNode
  /** What it touches, drawn: the tiles that go, lit in the destructive colour, and a line counting them. */
  touches?: { picture: ReactNode; text: ReactNode }
  /** A name to type before the act is allowed, for what is hardest to undo: a branch of more than one level. */
  typeToConfirm?: string
  /** The quiet way out; `Cancel` unless the act wants another word ("Keep editing"). */
  cancelLabel?: string
  /** The act, named with its count: "Delete 3 tiles". */
  confirmLabel: string
  onConfirm: () => void
}

/**
 * The one thing that stops you, kept for what can't be undone or loses work. Wide, it opens over the
 * conversation's column, so the canvas stays in view and shows what the act touches; on a phone, where
 * the chat fills the screen, it rises from the bottom as a sheet, the act within the thumb's reach.
 */
export function Dialog({
  open,
  onOpenChange,
  tone = 'destructive',
  kicker,
  title,
  children,
  touches,
  typeToConfirm,
  cancelLabel = m.ui_cancel(),
  confirmLabel,
  onConfirm,
}: DialogProps) {
  const [typed, setTyped] = useState('')
  // A name typed belongs to one opening: once closed, by Radix or by the caller, it goes.
  if (!open && typed !== '') setTyped('')
  const fieldId = useId()
  const confirmed = typeToConfirm === undefined || typed.trim() === typeToConfirm
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay
          // A click on the dim behind leaves, but not once a name is typed: that would lose it.
          onClick={() => {
            if (typed === '') onOpenChange(false)
          }}
          className="fixed inset-0 z-50 bg-background/62 backdrop-blur-[5px] backdrop-saturate-[.85] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none"
        />
        <AlertDialog.Content
          // Escape leaves as the dim does: not once a name is typed.
          onEscapeKeyDown={(event) => {
            if (typed !== '') event.preventDefault()
          }}
          onOpenAutoFocus={(event) => {
            // Focus starts on the way out, Radix's default, or on the name to type when there is one.
            if (typeToConfirm === undefined) return
            event.preventDefault()
            document.getElementById(fieldId)?.focus()
          }}
          className={cn(
            voiceOf(tone === 'destructive' ? 'destructive' : 'app'),
            // A risen surface, square, a line on top in its voice that draws itself as it opens.
            'risen fixed z-50 grid px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] outline-none [--rim:linear-gradient(90deg,var(--voice),color-mix(in_oklab,var(--voice)_10%,transparent))] before:origin-left motion-safe:before:animate-draw',
            // A phone: a sheet from the bottom, the screen's width.
            'inset-x-0 bottom-0 data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-4 data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none',
            // Wide: over the conversation's column, from its left edge, a little below the top.
            'sm:inset-x-auto sm:bottom-auto sm:left-9 sm:top-[22vh] sm:w-[28rem] sm:px-[1.875rem] sm:pt-[1.625rem] sm:pb-6 sm:data-[state=open]:slide-in-from-bottom-2',
          )}
        >
          <span
            className={cn(
              'font-mono text-[0.71875rem]',
              tone === 'destructive' ? 'text-(--voice)' : 'text-faint',
            )}
          >
            {kicker}
          </span>
          <AlertDialog.Title className="mt-1.5 mb-2.5 font-human text-2xl leading-tight font-normal text-foreground">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description asChild>
            <div className="text-sm leading-relaxed font-light text-muted-foreground [&_b]:font-normal [&_b]:text-foreground">
              {children}
            </div>
          </AlertDialog.Description>
          {touches !== undefined && (
            <div className="mt-4 mb-1.5 flex items-center gap-3.5 border-y py-3">
              <span className="shrink-0" aria-hidden="true">
                {touches.picture}
              </span>
              <span className="text-[0.8125rem] font-light text-muted-foreground [&_b]:font-normal [&_b]:text-foreground">
                {touches.text}
              </span>
            </div>
          )}
          {typeToConfirm !== undefined && (
            <TypeToConfirm id={fieldId} name={typeToConfirm} value={typed} onChange={setTyped} />
          )}
          <div className="mt-6 flex items-center gap-6">
            <AlertDialog.Cancel asChild>
              <Act>{cancelLabel}</Act>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Act
                look="hex"
                tone={tone === 'destructive' ? 'destructive' : 'quiet'}
                disabled={!confirmed}
                onClick={onConfirm}
                className="ml-auto"
              >
                {confirmLabel}
              </Act>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

interface TypeToConfirmProps {
  id: string
  name: string
  value: string
  onChange: (value: string) => void
}

/**
 * The name to type: one underline, warming to the dialog's voice while you are in it. Enter does
 * nothing here: the act runs from its button only.
 */
function TypeToConfirm({ id, name, value, onChange }: TypeToConfirmProps) {
  return (
    <div className="mt-4 grid gap-1">
      <label htmlFor={id} className="text-[0.71875rem] text-faint">
        {m.ui_type_to_confirm({ name })}
      </label>
      <span className="relative after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:scale-x-0 after:bg-(--voice) after:transition-transform after:duration-400 after:ease-glide after:content-[''] focus-within:after:scale-x-100">
        <input
          id={id}
          value={value}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            onChange(event.target.value)
          }}
          className="w-full border-b border-input bg-transparent pt-1.5 pb-[7px] text-sm font-light text-foreground outline-none pointer-coarse:min-h-11"
        />
      </span>
    </div>
  )
}
