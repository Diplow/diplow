// The Account's Keys: issue one for a program such as Claude Code, see its secret once, revoke one.
// Signed out, the guard sends the visit to sign-in, then back here.
import { createFileRoute } from '@tanstack/react-router'

import { signedInOnly } from '#/front/client/iam/guard'
import { Keys } from '#/front/features/keys/Keys'

export const Route = createFileRoute('/settings/keys')({
  beforeLoad: signedInOnly,
  component: Keys,
})
