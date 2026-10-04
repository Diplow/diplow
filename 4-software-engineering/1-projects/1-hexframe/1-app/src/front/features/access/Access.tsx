// Signing in and signing up: an email and a password, then back where the user was. One form for both,
// since they differ only in their words and the call they make; a refusal shows on the field at fault.
import { Link } from '@tanstack/react-router'

import { submitWrite } from '#/front/client/channels'
import { continueTo } from '#/front/client/iam/guard'
import { signIn, signUp } from '#/api/iam/iam'
import { m } from '#/paraglide/messages'
import { useAppForm } from '#/front/ui/inputs/forms/form'
import { Card } from '#/front/ui/surfaces/Card'
import { PageHeader } from '#/front/ui/surfaces/PageHeader'

type Mode = 'sign-in' | 'sign-up'

interface Credentials {
  email: string
  password: string
}

/** Each mode's words, the call it makes, its password's autocomplete, and the other mode it links to. */
const modes = {
  'sign-in': {
    title: m.iam_sign_in_title,
    description: m.iam_sign_in_description,
    submit: m.iam_sign_in_submit,
    call: (data: Credentials) => signIn({ data }),
    passwordAutoComplete: 'current-password',
    passwordRule: undefined,
    other: { to: '/sign-up', question: m.iam_to_sign_up, link: m.iam_to_sign_up_link },
  },
  'sign-up': {
    title: m.iam_sign_up_title,
    description: m.iam_sign_up_description,
    submit: m.iam_sign_up_submit,
    call: (data: Credentials) => signUp({ data }),
    passwordAutoComplete: 'new-password',
    passwordRule: m.iam_password_rule,
    other: { to: '/sign-in', question: m.iam_to_sign_in, link: m.iam_to_sign_in_link },
  },
} as const

interface AccessProps {
  mode: Mode
  /** Where to go once signed in, without the language prefix; home when absent. */
  redirect: string | undefined
}

/** The sign-in or sign-up page's content. */
export function Access({ mode, redirect }: AccessProps) {
  const settings = modes[mode]
  const form = useAppForm({
    defaultValues: { email: '', password: '' },
    validators: {
      onSubmitAsync: submitWrite({
        scope: mode === 'sign-in' ? 'signIn' : 'signUp',
        call: settings.call,
        onSaved: (account) => {
          continueTo(redirect, account.id)
        },
      }),
    },
  })
  return (
    <main className="mx-auto grid w-full max-w-md gap-6 px-6 pb-12">
      <PageHeader title={settings.title()} description={settings.description()} />
      <Card>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
        >
          <form.AppField name="email">
            {(field) => <field.TextField label={m.iam_email()} type="email" autoComplete="email" />}
          </form.AppField>
          <form.AppField name="password">
            {(field) => (
              <field.TextField
                label={m.iam_password()}
                description={settings.passwordRule?.()}
                type="password"
                autoComplete={settings.passwordAutoComplete}
              />
            )}
          </form.AppField>
          <div>
            <form.AppForm>
              <form.SubmitButton>{settings.submit()}</form.SubmitButton>
            </form.AppForm>
          </div>
        </form>
      </Card>
      <p className="text-sm text-muted-foreground">
        {settings.other.question()}{' '}
        <Link
          to={settings.other.to}
          search={{ redirect }}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {settings.other.link()}
        </Link>
      </p>
    </main>
  )
}
