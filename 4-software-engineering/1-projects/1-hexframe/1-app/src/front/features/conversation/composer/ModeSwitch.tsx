// The Conversation's Mode, beside the composer's button: ask, where the assistant proposes its
// changes and the user accepts or discards them, or apply, where it changes the System as it goes.
// The switch says which is on, and a line beside it what that means; the next Turn takes it.
import type { Mode } from '#/domains/assistant/entities'
import { m } from '#/paraglide/messages'
import { Button } from '#/front/ui/inputs/controls/button'

/** The Mode the Conversation is in, and how to switch it. */
export interface ModeChoice {
  mode: Mode
  choose: (mode: Mode) => void
}

/** Each Mode, as the switch names it and the line beside it explains it. */
const modes: ReadonlyArray<{ mode: Mode; label: () => string; hint: () => string }> = [
  { mode: 'ask', label: m.conversation_mode_ask, hint: m.conversation_mode_ask_hint },
  { mode: 'apply', label: m.conversation_mode_apply, hint: m.conversation_mode_apply_hint },
]

export function ModeSwitch({ mode, choose }: ModeChoice) {
  const current = modes.find((each) => each.mode === mode)
  return (
    <div className="mr-auto flex min-w-0 items-center gap-2">
      <div
        role="group"
        aria-label={m.conversation_mode_label()}
        className="flex shrink-0 items-center gap-0.5 rounded-md border p-0.5"
      >
        {modes.map((each) => (
          <Button
            key={each.mode}
            type="button"
            size="xs"
            variant={each.mode === mode ? 'secondary' : 'ghost'}
            aria-pressed={each.mode === mode}
            onClick={() => {
              if (each.mode !== mode) choose(each.mode)
            }}
          >
            {each.label()}
          </Button>
        ))}
      </div>
      <p className="min-w-0 text-xs text-muted-foreground">{current?.hint()}</p>
    </div>
  )
}
