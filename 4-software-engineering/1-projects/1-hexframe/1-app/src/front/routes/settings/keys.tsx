// An old link to the Keys page lands on the screen, the key widget open in the chat; signed out, it
// stays open once signed in.
import { createFileRoute, redirect } from '@tanstack/react-router'

import { withKeys } from '#/front/features/keys/search'

export const Route = createFileRoute('/settings/keys')({
  beforeLoad: () => {
    redirect({ to: '/', search: withKeys(true), replace: true, throw: true })
  },
})
