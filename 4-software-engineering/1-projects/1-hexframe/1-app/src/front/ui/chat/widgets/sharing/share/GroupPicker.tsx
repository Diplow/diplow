// A group picked, in the conversation: the app's own widget, so it carries no voice. The groups of the
// Organizations the user belongs to, each Organization by its name, its members first, then each of
// its own groups, each a button running on to the curve at its height; one the tile is shared with
// already is said so and offered no pick. A pick hands it to whoever opened the widget, which shares
// a tile with it (HEX-137). A building block, not a flow of its own. Controlled: the groups, their
// words and what a pick does are its caller's.
import { cn } from 'cn'
import { UsersRound } from 'lucide-react'

import { m } from '#/paraglide/messages'

import { runsToCurve, toCurve } from '../../../../layouts/screen/state/useAlongCurve'
import { HexMark } from '../../../atoms/hex'
import { Widget } from '../../../layouts/Widget'

/** A group as the picker offers it, every word its caller's. */
interface GroupShown {
  readonly key: string
  readonly name: string
  /** The tile is shared with it already: said so, and not offered. */
  readonly named?: boolean
}

/** An Organization the user belongs to, by its name, and the groups it offers. */
export interface GroupsOf {
  readonly key: string
  readonly name: string
  readonly groups: readonly GroupShown[]
}

interface GroupPickerProps {
  /** What a group is picked for, its caller's question: "Share Tooling with which group?" */
  title: string
  organizations: readonly GroupsOf[]
  /** A group picked, by its Organization's key and its own. */
  onPick: (organization: string, group: string) => void
  onCancel: () => void
}

/** The group picker: the groups of the user's Organizations, each picked to share a tile with. */
export function GroupPicker({ title, organizations, onPick, onCancel }: GroupPickerProps) {
  return (
    <Widget
      voice="app"
      icon={<UsersRound />}
      kicker={m.widget_group_picker_kicker()}
      title={title}
      subtitle={
        organizations.length === 0 ? m.widget_group_picker_none() : m.widget_group_picker_what()
      }
      actions={[{ label: m.widget_group_picker_cancel(), onSelect: onCancel }]}
      onDismiss={onCancel}
    >
      {organizations.map((organization) => (
        <section key={organization.key} className="mt-2 first:mt-0">
          <h3
            ref={toCurve}
            className={cn(
              runsToCurve,
              'pb-1 font-mono text-[0.6875rem] leading-normal text-muted-foreground',
            )}
          >
            {organization.name}
          </h3>
          <ul className="grid">
            {organization.groups.map((group) => (
              <li
                key={group.key}
                ref={toCurve}
                className={cn(runsToCurve, 'border-t border-border last:border-b')}
              >
                <button
                  type="button"
                  disabled={group.named === true}
                  onClick={() => {
                    onPick(organization.key, group.key)
                  }}
                  className="group/group grid w-full cursor-pointer grid-cols-[0.875rem_1fr] gap-3 py-2.5 text-left outline-none focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-(--voice) disabled:cursor-default pointer-coarse:py-3.5"
                >
                  <HexMark className="mt-1 size-3.5 fill-foreground/9 stroke-input group-hover/group:stroke-foreground group-disabled/group:stroke-input" />
                  <span className="grid gap-0.5">
                    <span className="text-[0.9375rem] leading-tight text-foreground decoration-input underline-offset-[3px] group-hover/group:underline group-disabled/group:text-muted-foreground group-disabled/group:no-underline">
                      {group.name}
                    </span>
                    {group.named === true && (
                      <span className="text-[0.78125rem] leading-normal font-light text-muted-foreground">
                        {m.widget_group_picker_named()}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Widget>
  )
}
