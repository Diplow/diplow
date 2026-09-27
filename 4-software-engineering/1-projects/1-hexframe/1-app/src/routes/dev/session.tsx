// A page only a signed-in Account sees, to try the guard: signed out, a visit lands on sign-in and
// comes back here once signed in. It shows whose Session it is, and signs out.
import { useMutation } from '@tanstack/react-query'
import { createFileRoute, notFound } from '@tanstack/react-router'

import { write } from '#/api/client/calls'
import { signedIn } from '#/api/iam/guard'
import { signOut } from '#/api/iam/iam'
import { m } from '#/paraglide/messages'
import { Button } from '#/ui/inputs/controls/button'
import { Card } from '#/ui/surfaces/Card'
import { PageHeader } from '#/ui/surfaces/PageHeader'

export const Route = createFileRoute('/dev/session')({
  // A dev page, like /dev/ui: production answers 404 (vite.config.ts).
  beforeLoad: (options) => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's notFound() is meant to be thrown; the router catches it
    if (!__DEV_PAGES__) throw notFound()
    return signedIn(options)
  },
  component: SessionPage,
})

function SessionPage() {
  const { session } = Route.useRouteContext()
  const leave = useMutation({
    ...write('signOut', () => signOut({ data: undefined })),
    // Reloaded, the page is guarded again: it sends the now signed-out visit to sign-in.
    onSuccess: () => {
      window.location.reload()
    },
  })
  return (
    <main className="mx-auto grid max-w-xl gap-6 px-6 pb-12">
      <PageHeader title={m.dev_session_title()} description={m.dev_session_description()} />
      <Card
        title={m.dev_session_signed_in_as({ email: session.account.email })}
        action={
          <Button
            variant="outline"
            disabled={leave.isPending}
            onClick={() => {
              leave.mutate()
            }}
          >
            {m.dev_session_sign_out()}
          </Button>
        }
      />
    </main>
  )
}
