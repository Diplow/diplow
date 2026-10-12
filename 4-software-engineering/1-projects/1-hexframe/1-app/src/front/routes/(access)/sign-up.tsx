// An old link to sign-up lands on the screen, the sign-in widget on signing up, keeping `?redirect=`.
import { createFileRoute, redirect } from '@tanstack/react-router'

import { withAccess } from '#/front/features/access/search'
import { readSignInSearch } from '#/front/client/iam/guard'

export const Route = createFileRoute('/(access)/sign-up')({
  // Read from the URL alone: the search `beforeLoad` gets keeps every raw param.
  beforeLoad: ({ location }) => {
    redirect({
      to: '/',
      search: { ...readSignInSearch(location.search), ...withAccess('sign-up') },
      replace: true,
      throw: true,
    })
  },
})
