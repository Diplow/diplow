// Sign-up, linked from sign-in: it keeps `?redirect=`, so a new Account goes back where the user was.
import { createFileRoute } from '@tanstack/react-router'

import { readSignInSearch } from '#/front/client/iam/guard'
import { Access } from '#/front/features/access/Access'

export const Route = createFileRoute('/(access)/sign-up')({
  validateSearch: readSignInSearch,
  component: SignUp,
})

function SignUp() {
  return <Access mode="sign-up" redirect={Route.useSearch().redirect} />
}
