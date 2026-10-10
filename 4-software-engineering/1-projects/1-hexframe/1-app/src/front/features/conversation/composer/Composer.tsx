// The message input under the timeline: the user writes to the agent, `@`s a Tile of their System by
// its Title, keyboard first, and sends; the Message goes to the route trimmed and never empty, each
// Tile picked linked by its id. It says beside its button when the Account may not use the Assistant,
// and waits while a Turn runs.
import { useId, useRef } from 'react'

import { m } from '#/paraglide/messages'
import { Textarea } from '#/front/ui/inputs/controls/textarea'
import { errorMessages } from '#/front/ui/inputs/forms/errors'
import { Field } from '#/front/ui/inputs/forms/field'
import { useAppForm } from '#/front/ui/inputs/forms/form'
import { Suggestions, suggestionsField } from '#/front/ui/overlays/Suggestions'

import { type Edited, useMentionState } from '../state/useMentionState'
import type { Mentionable } from './mention'

interface ComposerProps {
  /** A Message the user sent, trimmed and never empty, each Tile it `@`s linked by its id. */
  onSend: (text: string) => void
  /** The Tiles the user may `@`. */
  tiles: ReadonlyArray<Mentionable>
  /** The Account may not use the Assistant: its Messages are kept, and no agent answers them. */
  unavailable: boolean
  /** Nothing can be sent now. */
  busy: boolean
}

export function Composer({ onSend, tiles, unavailable, busy }: ComposerProps) {
  const { state, actions } = useMentionState(tiles)
  const input = useRef<HTMLTextAreaElement>(null)
  const list = useId()
  const form = useAppForm({
    defaultValues: { message: '' },
    onSubmit: ({ value, formApi }) => {
      onSend(actions.sent(value.message.trim()))
      formApi.reset()
    },
  })
  const written = ({ value }: { value: string }) =>
    value.trim() === '' ? m.conversation_message_required() : undefined
  return (
    <form
      noValidate
      className="grid gap-3 border-t p-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (!busy) void form.handleSubmit()
      }}
    >
      <fieldset disabled={busy} className="grid gap-3">
        <form.AppField name="message" validators={{ onSubmit: written }}>
          {(field) => {
            /** The input set to its next value, the caret where it goes. */
            const edit = ({ value, caret }: Edited) => {
              const element = input.current
              if (element !== null) {
                // Set on the element first, so React finds it as it is and leaves the caret be.
                element.value = value
                element.setSelectionRange(caret, caret)
              }
              field.handleChange(value)
              actions.typed(value, caret)
            }
            const { isTouched, errors } = field.state.meta
            return (
              <Suggestions
                id={list}
                label={m.conversation_mention_label()}
                open={state.open}
                suggestions={state.offered.map(({ id, title, trail }) => ({
                  id,
                  label: title,
                  ...(trail.length > 0 && { detail: trail.join(' / ') }),
                }))}
                active={state.active?.id}
                onPick={(id) => {
                  const tile = state.offered.find((offered) => offered.id === id)
                  const edited =
                    tile === undefined ? undefined : actions.pick(field.state.value, tile)
                  if (edited !== undefined) edit(edited)
                }}
                onClose={actions.close}
              >
                <div>
                  <Field
                    label={m.conversation_message_label()}
                    description={m.conversation_mention_hint()}
                    errors={isTouched ? errorMessages(errors) : []}
                  >
                    <Textarea
                      ref={input}
                      name={field.name}
                      value={field.state.value}
                      placeholder={m.conversation_message_placeholder()}
                      {...suggestionsField(list, state.open, state.active?.id)}
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        field.handleChange(event.target.value)
                        actions.typed(event.target.value, event.target.selectionStart)
                      }}
                      onSelect={(event) => {
                        const { value, selectionStart } = event.currentTarget
                        actions.typed(value, selectionStart)
                      }}
                      onKeyDown={(event) => {
                        const { taken, edited } = actions.key(event.key, field.state.value)
                        if (!taken) return
                        event.preventDefault()
                        event.stopPropagation()
                        if (edited !== undefined) edit(edited)
                      }}
                    />
                  </Field>
                </div>
              </Suggestions>
            )
          }}
        </form.AppField>
        <div className="flex items-center justify-end gap-3">
          {unavailable && (
            <p className="mr-auto text-sm text-muted-foreground">
              {m.conversation_assistant_unavailable()}
            </p>
          )}
          <form.AppForm>
            <form.SubmitButton>{m.conversation_send()}</form.SubmitButton>
          </form.AppForm>
        </div>
      </fieldset>
    </form>
  )
}
