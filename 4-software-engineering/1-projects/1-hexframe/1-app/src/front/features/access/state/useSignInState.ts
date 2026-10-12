// What the sign-in widget holds: the email and the password typed, what IAM refused of them, on the
// field it names, and whether the try is on its way. A field's refusal goes as the user changes it.
// The submit is the client's (`accessSubmit`), kept out of every cache since it carries a password: a
// refusal IAM names a field for shows there, any other goes to its channel, the toast. Signed in, the page leaves
// for where the user was, with a full load (`continueTo`), so it renders with its Session.
import { useRef, useState } from 'react'

import type { FormErrors } from '#/front/client/channels'
import { accessSubmit, type Credentials } from '#/front/client/iam/access'
import { continueTo } from '#/front/client/iam/guard'
import type { Access } from '#/front/ui/chat/widgets/sign-in/SignInWidget'

/** What the widget shows of a refusal, on the field it names. */
export type Refused = Partial<Record<keyof Credentials, string>>

/**
 * The refusals a submit leaves on the widget's fields: those it names, the email's and the password's.
 * A refusal that names none went to its channel already, the toast, so the widget shows nothing of it.
 */
export function refusedOf(errors: FormErrors | undefined): Refused | undefined {
  if (errors === undefined || !('fields' in errors)) return undefined
  const { email, password } = errors.fields
  if (email === undefined && password === undefined) return undefined
  return {
    ...(email !== undefined && { email }),
    ...(password !== undefined && { password }),
  }
}

/** The refusals left once `field` changed. */
const without = (refused: Refused | undefined, field: keyof Credentials): Refused | undefined => {
  if (refused?.[field] === undefined) return refused
  const left = Object.entries(refused).filter(([named]) => named !== field)
  return left.length === 0 ? undefined : Object.fromEntries(left)
}

/** The sign-in widget's words and its submit; signed in, the way back to `redirect`. */
export function useSignInState(redirect: string | undefined) {
  const [credentials, setCredentials] = useState<Credentials>({ email: '', password: '' })
  const [refused, setRefused] = useState<Refused>()
  const [sending, setSending] = useState(false)
  // Read at the moment of a press, not from the render before it: two quick presses send one try.
  const onItsWay = useRef(false)
  const change = (field: keyof Credentials) => (value: string) => {
    setCredentials((before) => ({ ...before, [field]: value }))
    setRefused((before) => without(before, field))
  }
  return {
    state: { ...credentials, refused, sending },
    actions: {
      email: change('email'),
      password: change('password'),
      /** Signs in or up with what was typed; a second press while it is on its way does nothing. */
      submit: async (access: Access) => {
        if (onItsWay.current) return
        onItsWay.current = true
        setSending(true)
        const errors = await accessSubmit(access, (account) => {
          continueTo(redirect, account.id)
        })({ value: credentials })
        // Signed in, the page is leaving: the act waits until it has gone.
        if (errors === undefined) return
        onItsWay.current = false
        setRefused(refusedOf(errors))
        setSending(false)
      },
      /** The other of the two: what was refused no longer stands. */
      switched: () => {
        setRefused(undefined)
      },
    },
  }
}
