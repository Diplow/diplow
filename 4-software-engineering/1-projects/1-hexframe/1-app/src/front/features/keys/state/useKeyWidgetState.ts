// Where the key widget is, and what it holds. Whether it is open is the URL's (`keys`); the step it is
// on is the page's: the Keys given, then a new one's name, then its secret, shown once, then the
// receipt Done leaves, which stays once the widget has closed, until it opens again. The secret is in
// this hook's state only, handed over by issuing's answer, which no cache keeps (`useIssueKeySubmit`):
// Done forgets it, and so does leaving, the widget closed any other way.
import { useState } from 'react'

import { type IssuedKey, useIssueKeySubmit } from '#/front/client/iam/keys'

import { mcpCommand } from '../shown/command'

/** The step the widget is on. */
export type KeyStep =
  | { readonly kind: 'list' }
  | { readonly kind: 'issue' }
  | {
      readonly kind: 'shown'
      readonly name: string
      readonly secret: string
      readonly command: string
    }
  | { readonly kind: 'done'; readonly name: string; readonly at: Date }

const list: KeyStep = { kind: 'list' }

/**
 * The step a change of the URL leaves: opening shows the Keys, a receipt making way; closing forgets
 * whatever was under way, a secret included, and keeps a receipt.
 */
export const stepOnOpen = (step: KeyStep, open: boolean): KeyStep =>
  open ? (step.kind === 'done' ? list : step) : step.kind === 'done' ? step : list

/** The key widget's step, a new Key's name and its refusal, and what each action does. */
export function useKeyWidgetState(open: boolean) {
  const [step, setStep] = useState<KeyStep>(list)
  const [name, setName] = useState('')
  const [refused, setRefused] = useState<string>()
  const [sending, setSending] = useState(false)
  // The URL opened or closed the widget since the last render: the step follows, as it renders.
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    setStep(stepOnOpen(step, open))
  }
  const submit = useIssueKeySubmit(({ key, secret }: IssuedKey) => {
    // The origin is read in the browser, where the answer arrives: the command names this hexframe.
    setStep({
      kind: 'shown',
      name: key.name,
      secret,
      command: mcpCommand(window.location.origin, secret),
    })
    setName('')
  })
  return {
    state: { step, name, refused, sending },
    actions: {
      /** A new Key: its name, blank. */
      issue: () => {
        setStep({ kind: 'issue' })
        setName('')
        setRefused(undefined)
      },
      /** Back to the Keys, nothing issued. */
      later: () => {
        setStep(list)
        setRefused(undefined)
      },
      name: (next: string) => {
        setName(next)
        setRefused(undefined)
      },
      /** Issues a Key by the name typed; a refusal of the name shows on its field. */
      send: async () => {
        if (sending) return
        setSending(true)
        const errors = await submit({ value: { name } })
        setSending(false)
        if (errors !== undefined && 'fields' in errors) setRefused(errors.fields.name)
      },
      /** The secret forgotten: the receipt names the Key, and the widget closes. */
      done: () => {
        if (step.kind === 'shown') setStep({ kind: 'done', name: step.name, at: new Date() })
      },
    },
  }
}

export type KeyWidgetState = ReturnType<typeof useKeyWidgetState>
