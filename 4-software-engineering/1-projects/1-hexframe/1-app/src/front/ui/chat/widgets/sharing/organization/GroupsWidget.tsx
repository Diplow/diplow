// An Organization's Groups, in the conversation: the app's own widget, so it carries no voice. Its
// Members first, which holds everyone, then each Group of its own by its name and who is in it, each
// row running on to the curve at its height; for an admin, a Group opened to be changed, and a new one
// made, from the widget's actions. And one Group as an admin changes it (`GroupWidget`): its name,
// renamed, and each of the Organization's members put in or taken out, or a new Group named. Controlled:
// the rows and the members are worded by the caller, who says what each change does, as IAM decides
// it.
import { cn } from 'cn'
import { Pencil, Plus, Trash2, UsersRound } from 'lucide-react'
import type { ReactNode } from 'react'

import { m } from '#/paraglide/messages'

import { runsToCurve, toCurve } from '../../../../layouts/screen/state/useAlongCurve'
import { Widget } from '../../../layouts/Widget'
import { Field } from '../../fields'

/** A Group, as its row shows it, every word already its caller's. */
export interface GroupRow {
  readonly key: string
  readonly name: string
  /** Who is in it, in words: "Ana Lima, Bob Martin", or nobody yet. */
  readonly who: string
}

interface GroupsWidgetProps {
  /** The Organization, by its name. */
  title: string
  /** Its Members, in words: everyone in it. */
  everyone: string
  groups: readonly GroupRow[]
  /** The reader is an admin: each Group is opened to be changed here, and a new one made. */
  manages: boolean
  onOpen: (key: string) => void
  onNew: () => void
  onDone: () => void
}

/** The Groups widget: an Organization's Groups and who is in each, and, for its admins, its changes. */
export function GroupsWidget({
  title,
  everyone,
  groups,
  manages,
  onOpen,
  onNew,
  onDone,
}: GroupsWidgetProps) {
  return (
    <Widget
      voice="app"
      icon={<UsersRound />}
      kicker={m.widget_groups_kicker()}
      title={title}
      subtitle={manages ? m.widget_groups_what_admin() : m.widget_groups_what()}
      actions={[
        ...(manages ? [{ label: m.widget_groups_new(), icon: <Plus />, onSelect: onNew }] : []),
        { label: m.widget_groups_done(), onSelect: onDone },
      ]}
      onDismiss={onDone}
    >
      <ul className="grid">
        <Row name={m.widget_groups_members()} who={everyone} />
        {groups.map((row) => (
          <Row key={row.key} name={row.name} who={row.who}>
            {manages && (
              <button
                type="button"
                onClick={() => {
                  onOpen(row.key)
                }}
                className="inline-flex items-center gap-1.5 justify-self-start px-1 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-(--voice) pointer-coarse:py-2.5 [&_svg]:size-3.5"
              >
                <Pencil aria-hidden />
                {m.widget_groups_change({ name: row.name })}
              </button>
            )}
          </Row>
        ))}
      </ul>
    </Widget>
  )
}

/** A Group: its name, then who is in it. */
function Row({ name, who, children }: { name: string; who: string; children?: ReactNode }) {
  return (
    <li
      ref={toCurve}
      className={cn(runsToCurve, 'grid gap-1.5 border-t border-border py-2.5 last:border-b')}
    >
      <p className="text-sm text-foreground">{name}</p>
      <p className="text-[0.71875rem] leading-snug text-muted-foreground">{who}</p>
      {children}
    </li>
  )
}

/** One of the Organization's members, as a Group's change offers them, every word its caller's. */
export interface GroupMemberRow {
  readonly key: string
  readonly who: string
  /** In the Group. */
  readonly in: boolean
}

interface GroupWidgetProps {
  /** The Organization, by its name. */
  title: string
  name: string
  onNameChange: (name: string) => void
  /** Why the name was refused, on the field. */
  refused?: string | undefined
  /** The most characters a name holds, counted as a reader counts them. */
  nameLimit: number
  /**
   * The Organization's members, each in the Group or not, for a Group made already; none for a new
   * one, whose members come once it is made.
   */
  members?: readonly GroupMemberRow[] | undefined
  /** A change on its way: the others wait. */
  sending?: boolean
  /** Makes the new Group, or renames this one. */
  onSave: () => void
  onToggle: (key: string, placed: boolean) => void
  /** Deletes the Group, for one made already. */
  onDelete?: (() => void) | undefined
  onBack: () => void
}

/** One Group, as an admin makes or changes it: its name, then who is in it. */
export function GroupWidget({
  title,
  name,
  onNameChange,
  refused,
  nameLimit,
  members,
  sending = false,
  onSave,
  onToggle,
  onDelete,
  onBack,
}: GroupWidgetProps) {
  const made = members !== undefined
  return (
    <Widget
      voice="app"
      icon={<UsersRound />}
      kicker={m.widget_groups_kicker()}
      title={title}
      subtitle={made ? m.widget_group_what() : m.widget_group_new_what()}
      actions={[
        {
          label: made ? m.widget_group_rename() : m.widget_group_create(),
          look: 'hex',
          submit: true,
          waits: sending,
          onSelect: onSave,
        },
        ...(onDelete === undefined
          ? []
          : [
              {
                label: m.widget_group_delete(),
                icon: <Trash2 />,
                destructive: true,
                onSelect: onDelete,
              },
            ]),
        { label: m.widget_group_back(), onSelect: onBack },
      ]}
      onDismiss={onBack}
    >
      <Field
        label={m.widget_group_name()}
        placeholder={m.widget_group_name_placeholder()}
        autoComplete="off"
        value={name}
        onChange={onNameChange}
        error={refused}
        limit={nameLimit}
        onEnter={onSave}
        takesFocus
      />
      {made && (
        <fieldset className="mt-3 grid gap-1.5" aria-busy={sending}>
          <legend className="mb-1.5 text-[0.71875rem] leading-snug text-muted-foreground">
            {m.widget_group_who({ name })}
          </legend>
          <div ref={toCurve} className={cn(runsToCurve, 'flex flex-wrap gap-1.5')}>
            {members.map((member) => (
              <label
                key={member.key}
                className={cn(
                  'cursor-pointer border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground has-focus-visible:outline-1 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--voice) pointer-coarse:py-2.5',
                  member.in && 'border-(--voice) bg-foreground/7 text-foreground',
                )}
              >
                <input
                  type="checkbox"
                  checked={member.in}
                  onChange={() => {
                    // On its way, a second change waits for the first.
                    if (!sending) onToggle(member.key, !member.in)
                  }}
                  className="sr-only"
                />
                {member.who}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </Widget>
  )
}
