// Who belongs to an Organization, in the conversation: the app's own widget, so it carries no voice.
// Each member by their star's title, the reader marked as themselves, and what they are there, an
// admin or a member; for an admin, each member's role set and each taken out, and someone added,
// from the widget's actions; each row running on to the curve at its height. Controlled: the rows
// are worded by the caller, who says what each change does, as IAM decides it, and who finds
// someone.
import { cn } from 'cn'
import { UserMinus, UserPlus, Users } from 'lucide-react'
import { useId } from 'react'

import { m } from '#/paraglide/messages'

import { runsToCurve, toCurve } from '../../../../layouts/screen/state/useAlongCurve'
import { Widget } from '../../../layouts/Widget'

/** What someone is in an Organization: an admin, who manages it, or a member. */
export type MemberRole = 'admin' | 'member'

const roles: readonly MemberRole[] = ['admin', 'member']

/** How each role reads. */
const roleSaid: Record<MemberRole, () => string> = {
  admin: m.widget_members_admin,
  member: m.widget_members_member,
}

/** A member, as their row shows them, every word already its caller's. */
export interface MemberRow {
  readonly key: string
  /** Who: their star's title. */
  readonly who: string
  readonly role: MemberRole
  /** The reader themselves. */
  readonly you: boolean
}

interface MembersWidgetProps {
  /** The Organization, by its name. */
  title: string
  members: readonly MemberRow[]
  /** The reader is an admin: each role is set and each member taken out here, someone added. */
  manages: boolean
  /** A change on its way: the others wait. */
  sending?: boolean
  onRole: (key: string, role: MemberRole) => void
  onRemove: (key: string) => void
  /** Opens what finds someone to add. */
  onAdd: () => void
  onDone: () => void
}

/** The Members widget: who belongs to the Organization, and, for its admins, its changes. */
export function MembersWidget({
  title,
  members,
  manages,
  sending = false,
  onRole,
  onRemove,
  onAdd,
  onDone,
}: MembersWidgetProps) {
  return (
    <Widget
      voice="app"
      icon={<Users />}
      kicker={m.widget_members_kicker()}
      title={title}
      subtitle={manages ? m.widget_members_what_admin() : m.widget_members_what()}
      actions={[
        ...(manages
          ? [{ label: m.widget_members_add(), icon: <UserPlus />, onSelect: onAdd }]
          : []),
        { label: m.widget_members_done(), onSelect: onDone },
      ]}
      onDismiss={onDone}
    >
      <ul className="grid">
        {members.map((row) => (
          <li
            key={row.key}
            ref={toCurve}
            className={cn(runsToCurve, 'grid gap-1.5 border-t border-border py-2.5 last:border-b')}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-sm text-foreground">
                {row.you ? m.widget_members_you({ who: row.who }) : row.who}
              </p>
              <p className="font-mono text-[0.6875rem] leading-normal text-muted-foreground">
                {roleSaid[row.role]()}
              </p>
            </div>
            {manages && (
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <Roles
                  legend={m.widget_members_role_for({ who: row.who })}
                  chosen={row.role}
                  sending={sending}
                  onChoose={(role) => {
                    onRole(row.key, role)
                  }}
                />
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => {
                    onRemove(row.key)
                  }}
                  className="inline-flex items-center gap-1.5 px-1 py-1 text-xs text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-(--voice) disabled:opacity-50 pointer-coarse:py-2.5 [&_svg]:size-3.5"
                >
                  <UserMinus aria-hidden />
                  {row.you ? m.widget_members_leave() : m.widget_members_remove()}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Widget>
  )
}

/** A member's role, admin or member, as a radio group the arrows go round. */
function Roles({
  legend,
  chosen,
  sending,
  onChoose,
}: {
  legend: string
  chosen: MemberRole
  sending: boolean
  onChoose: (role: MemberRole) => void
}) {
  const name = useId()
  return (
    <fieldset className="flex flex-wrap gap-1.5" aria-busy={sending}>
      <legend className="sr-only">{legend}</legend>
      {roles.map((role) => (
        <label
          key={role}
          className={cn(
            'cursor-pointer border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground has-focus-visible:outline-1 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--voice) pointer-coarse:py-2.5',
            chosen === role && 'border-(--voice) bg-foreground/7 text-foreground',
          )}
        >
          <input
            type="radio"
            name={name}
            value={role}
            checked={chosen === role}
            onChange={() => {
              // On its way, a second change waits for the first.
              if (!sending) onChoose(role)
            }}
            className="sr-only"
          />
          {roleSaid[role]()}
        </label>
      ))}
    </fieldset>
  )
}
