// Sign-in, where a signed-out visit to a guarded page, or a call that met Unauthenticated, lands:
// `?redirect=` carries where the user was, and signing in goes back there.
import { createFileRoute } from '@tanstack/react-router'

import { readSignInSearch } from '#/front/client/iam/guard'
import { Access } from '#/front/features/access/Access'

export const Route = createFileRoute('/sign-in')({
  validateSearch: readSignInSearch,
  component: SignIn,
})

function SignIn() {
  return <Access mode="sign-in" redirect={Route.useSearch().redirect} />
}
