// How an agent outside hexframe reaches the user's System, in the conversation: the app's own widget,
// so it carries no voice. A name, then the Key shown once, inking in from a blur beside the command
// that uses it, ready to paste, and one ember line saying it won't be shown again; then the Keys
// already given, each with its start, its dates and a light while in use, and its revoke, asked
// first. Done, or leaving, forgets the secret: the widget leaves a receipt that names the Key, never
// the secret. Opened by the agent, it shows the Keys but issues none: that takes the user's session.
// Controlled: the name, the Keys and what each action does are its caller's.
import { cn } from 'cn'
import { Check, Copy, Eye, KeyRound, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { m } from '#/paraglide/messages'

import { toast } from '../../../atoms/Toaster'
import { Dialog } from '../../../layouts/Dialog'
import { UntilDecided } from '../../entries/Receipt'
import { Widget } from '../../layouts/Widget'
import { weave } from '../../text/words'
import { Field } from '../fields'

/** One of the Account's Keys, as its row shows it, its dates already worded by its caller. */
export interface KeyRow {
  readonly id: string
  readonly name: string
  /** How its secret starts: `hf_` and three more. */
  readonly start: string
  readonly made: string
  /** When it was last used, or that it never was. */
  readonly used: string
  /** Used within the hour. */
  readonly live: boolean
}

interface Issuing {
  state: 'issue'
  name: string
  onNameChange: (name: string) => void
  /**
   * The most characters a name holds: IAM's, read by the caller. The count is a reader's, IAM's UTF-16
   * units until HEX-115 counts as a reader does.
   */
  nameLimit: number
  /** Why the name was refused, on the field. */
  refused?: string | undefined
  /** On its way to IAM. */
  sending?: boolean
  onIssue: () => void
  onLater: () => void
}

interface Shown {
  state: 'shown'
  name: string
  /** The secret, shown this once. */
  secret: string
  /** The command that adds hexframe to Claude Code, the secret inside it. */
  command: string
  /** Forgets the secret: the widget leaves its receipt. */
  onDone: () => void
}

interface Listed {
  state: 'list'
  keys: readonly KeyRow[]
  onRevoke: (id: string) => void
  onNew: () => void
  onDone: () => void
  /** Opened by the agent: it shows the Keys and issues none. */
  byAgent?: boolean
}

interface Issued {
  state: 'done'
  name: string
  at: Date
}

type KeyWidgetProps = Issuing | Shown | Listed | Issued

/**
 * The key widget: issuing a Key, its secret shown once, the Keys given, or once done its receipt, which
 * names the Key and never its secret, the focus handed to it.
 */
export function KeyWidget(props: KeyWidgetProps) {
  return (
    <UntilDecided
      receipt={
        props.state === 'done'
          ? {
              words: weave(m.widget_key_issued, { name: { name: props.name } }),
              at: props.at,
              tone: 'app',
            }
          : undefined
      }
    >
      {props.state === 'issue' && <Issue {...props} />}
      {props.state === 'shown' && <Secret {...props} />}
      {props.state === 'list' && <Keys {...props} />}
    </UntilDecided>
  )
}

function Issue({
  name,
  onNameChange,
  nameLimit,
  refused,
  sending = false,
  onIssue,
  onLater,
}: Issuing) {
  return (
    <Widget
      voice="app"
      icon={<KeyRound />}
      kicker={m.widget_key_kicker()}
      title={m.widget_key_connect()}
      subtitle={m.widget_key_what()}
      actions={[
        // On its way, it waits: a second press would issue a second Key.
        {
          label: m.widget_key_create(),
          look: 'hex',
          submit: true,
          waits: sending,
          onSelect: onIssue,
        },
        { label: m.widget_key_later(), onSelect: onLater },
      ]}
      onDismiss={onLater}
    >
      <Field
        label={m.widget_key_name()}
        placeholder={m.widget_key_name_placeholder()}
        autoComplete="off"
        limit={nameLimit}
        value={name}
        onChange={onNameChange}
        error={refused}
      />
    </Widget>
  )
}

function Secret({ name, secret, command, onDone }: Shown) {
  return (
    <Widget
      voice="app"
      icon={<KeyRound />}
      kicker={m.widget_key_shown_kicker()}
      title={name}
      actions={[
        {
          label: m.widget_key_copy_command(),
          // The action keeps its word, and its focus: the toast says it is copied.
          onSelect: () => {
            copy(command, () => toast.success(m.keys_copied()))
          },
        },
        { label: m.keys_done(), onSelect: onDone },
      ]}
    >
      <div className="grid gap-1.5">
        <Caption>{m.keys_secret()}</Caption>
        <Copyable value={secret} label={m.keys_secret()} inking />
        <Caption aside={m.widget_key_claude_code()}>{m.widget_key_in_terminal()}</Caption>
        <Copyable value={command} label={m.keys_command()} quiet />
        <p className="mt-2 flex items-center gap-2 text-[0.78125rem] leading-snug font-light text-warning">
          <Eye className="size-3.5 shrink-0" aria-hidden />
          {m.widget_key_once()}
        </p>
      </div>
    </Widget>
  )
}

function Caption({ aside, children }: { aside?: string; children: string }) {
  return (
    <span className="mt-2 flex items-baseline justify-between text-[0.71875rem] text-muted-foreground first:mt-0">
      <span>{children}</span>
      {aside !== undefined && <span>{aside}</span>}
    </span>
  )
}

/** Puts a value on the clipboard; a refusal says to copy it by hand. */
function copy(value: string, onCopied?: () => void) {
  navigator.clipboard.writeText(value).then(
    () => {
      onCopied?.()
    },
    () => toast.error(m.keys_copy_failed()),
  )
}

/** A value to copy, in full on a faint ground, its copy at its corner turning to a check. */
function Copyable({
  value,
  label,
  inking = false,
  quiet = false,
}: {
  value: string
  label: string
  /** Inks in from a blur, the first time it shows. */
  inking?: boolean
  quiet?: boolean
}) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="relative bg-foreground/5 py-2.5 pr-11 pl-3 font-mono">
      <code
        className={cn(
          'block text-[0.8125rem] leading-[1.55] break-all text-foreground',
          quiet && 'text-xs break-normal text-muted-foreground [overflow-wrap:anywhere]',
          inking && 'motion-safe:animate-ink',
        )}
      >
        {value}
      </code>
      <button
        type="button"
        aria-label={copied ? m.keys_copied() : m.keys_copy_named({ what: label })}
        onClick={() => {
          copy(value, () => {
            setCopied(true)
            setTimeout(() => {
              setCopied(false)
            }, 1600)
          })
        }}
        className={cn(
          'absolute top-1.5 right-1.5 grid size-[1.625rem] cursor-pointer place-items-center text-muted-foreground transition-colors outline-none hover:bg-foreground/7 hover:text-foreground focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-(--voice) pointer-coarse:size-11 [&_svg]:size-[0.9375rem]',
          copied && 'text-success hover:text-success',
        )}
      >
        {copied ? <Check /> : <Copy />}
      </button>
    </div>
  )
}

function Keys({ keys, onRevoke, onNew, onDone, byAgent = false }: Listed) {
  // The Key asked about stays while the dialog closes, so its name never blanks on the way out.
  const [revoking, setRevoking] = useState<KeyRow | undefined>(undefined)
  const [asking, setAsking] = useState(false)
  return (
    <>
      <Widget
        voice="app"
        icon={<KeyRound />}
        kicker={m.widget_key_kicker()}
        title={m.keys_list_caption()}
        subtitle={
          byAgent ? m.widget_key_by_agent() : m.widget_key_count({ count: String(keys.length) })
        }
        actions={[
          ...(byAgent ? [] : [{ label: m.widget_key_new(), onSelect: onNew }]),
          { label: m.keys_done(), onSelect: onDone },
        ]}
        onDismiss={onDone}
      >
        <ul className="grid">
          {keys.map((key) => (
            <li
              key={key.id}
              className="group/key grid grid-cols-[1fr_auto] items-center border-t border-border py-2.5 last:border-b"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm text-foreground">
                  {key.name}
                  {key.live && (
                    <span
                      role="img"
                      aria-label={m.widget_key_live()}
                      title={m.widget_key_live()}
                      className="size-1.5 rounded-full bg-success shadow-[0_0_8px_var(--success)]"
                    />
                  )}
                </p>
                <p className="mt-px font-mono text-[0.6875rem] leading-normal text-muted-foreground">
                  {m.widget_key_row({ start: key.start, made: key.made, used: key.used })}
                </p>
              </div>
              {!byAgent && (
                <button
                  type="button"
                  aria-label={m.keys_revoke_named({ name: key.name })}
                  onClick={() => {
                    setRevoking(key)
                    setAsking(true)
                  }}
                  className="grid size-[1.625rem] cursor-pointer place-items-center text-muted-foreground opacity-0 transition-opacity duration-200 outline-none group-hover/key:opacity-100 group-focus-within/key:opacity-100 hover:text-destructive focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-destructive pointer-coarse:size-11 pointer-coarse:opacity-100 [&_svg]:size-[0.9375rem]"
                >
                  <Trash2 />
                </button>
              )}
            </li>
          ))}
        </ul>
      </Widget>
      <Dialog
        open={asking}
        onOpenChange={setAsking}
        kicker={m.widget_key_revoke_kicker()}
        title={m.keys_revoke_title({ name: revoking?.name ?? '' })}
        confirmLabel={m.keys_revoke()}
        onConfirm={() => {
          if (revoking !== undefined) onRevoke(revoking.id)
          setAsking(false)
        }}
      >
        {m.keys_revoke_description({ name: revoking?.name ?? '' })}
      </Dialog>
    </>
  )
}
