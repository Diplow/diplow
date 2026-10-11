// Signed out, the chat asks who you are where you would write: the sign-in widget takes the
// Composer's place at the chat's foot, on the same zone, warm for you. The question in the agent's
// mono, then an email and a password on their underlines, the one solid act, and the way to the other
// of signing in and signing up. A refusal shows on the field at fault, or under the act when it names
// none. Controlled: what is typed, which of the two it is and what the act does are its caller's.
import { cn } from 'cn'
import { useId } from 'react'

import { m } from '#/paraglide/messages'

import { Act } from '../../../atoms/controls/act'
import { zone } from '../../layouts/zone'
import { Field } from '../fields'

export type Access = 'sign-in' | 'sign-up'

interface SignInWidgetProps {
  access: Access
  onAccessChange: (access: Access) => void
  email: string
  onEmailChange: (email: string) => void
  password: string
  onPasswordChange: (password: string) => void
  /** Why the last try was refused: on the field it names, or the form's. */
  refused?: { email?: string; password?: string; form?: string } | undefined
  /** On its way: the act waits, keeping the focus it has. */
  sending?: boolean
  onSubmit: () => void
  className?: string
}

/** Each of the two: its words, its password's autocomplete, and the way to the other. */
const accesses = {
  'sign-in': {
    title: m.iam_sign_in_title,
    subtitle: m.widget_sign_in_subtitle,
    submit: m.iam_sign_in_submit,
    password: 'current-password',
    rule: undefined,
    other: { question: m.iam_to_sign_up, link: m.iam_to_sign_up_link, access: 'sign-up' },
  },
  'sign-up': {
    title: m.iam_sign_up_title,
    subtitle: m.iam_sign_up_description,
    submit: m.iam_sign_up_submit,
    password: 'new-password',
    rule: m.iam_password_rule,
    other: { question: m.iam_to_sign_in, link: m.iam_to_sign_in_link, access: 'sign-in' },
  },
} as const

/** The chat's foot, signed out: who you are, then your System. */
export function SignInWidget({
  access,
  onAccessChange,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  refused,
  sending = false,
  onSubmit,
  className,
}: SignInWidgetProps) {
  const words = accesses[access]
  const titleId = useId()
  return (
    <form
      noValidate
      aria-labelledby={titleId}
      aria-busy={sending}
      onSubmit={(event) => {
        event.preventDefault()
        if (!sending) onSubmit()
      }}
      className={cn(
        zone,
        'grid gap-4 px-4 pt-5 pb-6 [--voice:var(--human)] motion-safe:before:animate-draw @wide:pr-[calc(1.5rem+var(--screen-foot-inset,0px))] @wide:pl-9',
        className,
      )}
    >
      <div className="grid gap-px">
        <p className="font-agent text-[0.71875rem] leading-normal text-agent">
          {m.widget_sign_in_kicker()}
        </p>
        <h2 id={titleId} className="font-human text-[1.3125rem] leading-tight text-foreground">
          {words.title()}
        </h2>
        <p className="mt-[3px] text-[0.84375rem] leading-normal font-light text-muted-foreground">
          {words.subtitle()}
        </p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-x-6 gap-y-3.5">
        <Field
          label={m.iam_email()}
          type="email"
          autoComplete="email"
          value={email}
          onChange={onEmailChange}
          error={refused?.email}
        />
        <Field
          label={m.iam_password()}
          type="password"
          autoComplete={words.password}
          hint={words.rule?.()}
          value={password}
          onChange={onPasswordChange}
          error={refused?.password}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Act
          type="submit"
          look="hex"
          tone="voice"
          aria-disabled={sending || undefined}
          className="aria-disabled:cursor-default aria-disabled:opacity-35"
        >
          {words.submit()}
        </Act>
        <span className="flex flex-wrap items-center gap-x-2 text-[0.8125rem] font-light text-muted-foreground">
          {words.other.question()}
          <Act
            onClick={() => {
              onAccessChange(words.other.access)
            }}
          >
            {words.other.link()}
          </Act>
        </span>
      </div>
      <p aria-live="polite" className="-mt-2 text-xs text-destructive empty:hidden">
        {refused?.form}
      </p>
    </form>
  )
}
