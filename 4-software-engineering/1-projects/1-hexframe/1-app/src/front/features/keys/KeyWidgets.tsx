// The Account's Keys in the chat, at the conversation's foot, on ui's key widget: the Keys given, each
// revoked after the dialog; a new one named, then its secret, shown once, beside the command that adds
// hexframe to Claude Code; Done forgets it and leaves a receipt naming the Key, never its secret.
// Whether it is open is the URL's, the step the page's (`state/useKeyWidgetState.ts`), which home
// holds so the receipt outlives the widget.
import { useKeys, useRevokeKey } from '#/front/client/iam/keys'
import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'
import { toast } from '#/front/ui/atoms/Toaster'
import { KeyWidget } from '#/front/ui/chat/widgets/keys/KeyWidget'

import { nameLimit } from './shown/name'
import { rowOf } from './shown/rows'
import type { KeyWidgetState } from './state/useKeyWidgetState'

interface KeyWidgetsProps {
  /** Open, as the URL says. */
  open: boolean
  /** Closes it: the URL lets it go. */
  onClose: () => void
  keys: KeyWidgetState
}

/**
 * The key widget, open or, once Done, its receipt; nothing else. Every step is the one `KeyWidget`, so
 * React keeps it from step to step and its hand-off moves the focus: to the name as it comes, to the
 * secret's copy, then to the receipt.
 */
export function KeyWidgets({ open, onClose, keys: { state, actions } }: KeyWidgetsProps) {
  const { data } = useKeys()
  const revoke = useRevokeKey()
  const { step } = state
  if (step.kind === 'done') return <KeyWidget state="done" name={step.name} at={step.at} />
  if (!open) return null
  switch (step.kind) {
    case 'list': {
      if (data === undefined) return null
      const now = new Date()
      const locale = getLocale()
      return (
        <KeyWidget
          state="list"
          keys={data.map((key) => rowOf(key, now, locale))}
          onRevoke={(id) => {
            const name = data.find((key) => key.id === id)?.name ?? ''
            // A refusal has already gone to its channel, the toast.
            revoke.mutateAsync({ id }).then(
              () => toast.success(m.keys_revoked({ name })),
              () => undefined,
            )
          }}
          onNew={actions.issue}
          onDone={onClose}
        />
      )
    }
    case 'issue':
      return (
        <KeyWidget
          state="issue"
          name={state.name}
          onNameChange={actions.name}
          nameLimit={nameLimit}
          refused={state.refused}
          sending={state.sending}
          onIssue={() => {
            void actions.send()
          }}
          onLater={actions.later}
        />
      )
    case 'shown':
      return (
        <KeyWidget
          state="shown"
          name={step.name}
          secret={step.secret}
          command={step.command}
          onDone={() => {
            actions.done()
            onClose()
          }}
        />
      )
  }
}
