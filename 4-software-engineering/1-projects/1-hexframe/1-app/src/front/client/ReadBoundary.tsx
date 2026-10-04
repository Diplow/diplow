// The nearest boundary of a read: where its failure shows when the channel table says the page, not a
// toast. A route or a feature wraps what it reads in one; a retry resets the failed queries.
import { QueryErrorResetBoundary } from '@tanstack/react-query'
import { CatchBoundary, useLocation } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { ErrorState, Forbidden } from '#/front/ui/feedback/states'
import { channelFor } from '#/api/errors/channel'
import { messageFor } from '#/api/errors/messages'

import { asCallFailed } from './calls'
import { caught } from './channels'

/**
 * Shows its children, or in their place the failure of a read made inside them, or the bug one of them
 * threw, which it reports. A new location, the path or the search params, clears the failure, as a
 * retry does.
 */
export function ReadBoundary({ children }: { children: ReactNode }) {
  const href = useLocation({ select: (location) => location.href })
  return (
    <QueryErrorResetBoundary>
      {({ reset: resetQueries }) => (
        <CatchBoundary
          getResetKey={() => href}
          onCatch={caught}
          errorComponent={({ error, reset }) => (
            <ReadFailure
              error={error}
              onRetry={() => {
                resetQueries()
                reset()
              }}
            />
          )}
        >
          {children}
        </CatchBoundary>
      )}
    </QueryErrorResetBoundary>
  )
}

// Anything else thrown while rendering is a bug, reported as it is caught, and shows as Unexpected.
function ReadFailure({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { failure, scope, requestId } = asCallFailed(error, 'render')
  const message = messageFor(failure, scope)
  if (channelFor('read', failure.kind) === 'forbidden') return <Forbidden message={message} />
  return <ErrorState message={message} requestId={requestId} onRetry={onRetry} />
}
