// An old link to the Help page lands on the screen: Help on the canvas in the view it named, its
// widget open in the chat on the Body that was open, or on Help's Root.
import { createFileRoute, redirect } from '@tanstack/react-router'

import { fromHelpPage } from '#/front/features/help/search'

export const Route = createFileRoute('/help')({
  validateSearch: fromHelpPage,
  beforeLoad: ({ search }) => {
    redirect({ to: '/', search, replace: true, throw: true })
  },
})
