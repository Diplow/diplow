// An old link to the Help page lands on the screen: Help on the canvas in the view it named, its
// widget open in the chat on the Body that was open, or on Help's Root.
import { createFileRoute, redirect } from '@tanstack/react-router'

import { fromHelpPage } from '#/front/features/shipped/search'

export const Route = createFileRoute('/help')({
  // Read again from the URL: the search `beforeLoad` gets keeps the raw params, `open` among them.
  beforeLoad: ({ location }) => {
    redirect({ to: '/', search: fromHelpPage(location.search), replace: true, throw: true })
  },
})
