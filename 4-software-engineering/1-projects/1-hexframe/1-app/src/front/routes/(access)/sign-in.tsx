// An old link to sign-in lands on the screen, which signed out signs in at the chat's foot, then goes
// back to `?redirect=`, where the user was.
import { createFileRoute, redirect } from '@tanstack/react-router'

import { readSignInSearch } from '#/front/client/iam/guard'

export const Route = createFileRoute('/(access)/sign-in')({
  validateSearch: readSignInSearch,
  beforeLoad: ({ search }) => {
    redirect({ to: '/', search, replace: true, throw: true })
  },
})
