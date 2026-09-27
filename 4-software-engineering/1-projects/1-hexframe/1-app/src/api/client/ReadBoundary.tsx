// The nearest boundary of a read: where its failure shows when the channel table says the page, not a
// toast. A route or a feature wraps what it reads in one; a retry resets the failed queries.
import { QueryErrorResetBoundary } from '@tanstack/react-query'
import { CatchBoundary } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { ErrorState, Forbidden } from '#/ui/feedback/states'

import { channelFor } from '../errors/channel'
import { messageFor } from '../errors/messages'
import { asCallFailed } from './calls'

/** Shows its children, or in their place the failure of a read made inside them. */
export function ReadBoundary({ children }: { children: ReactNode }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset: resetQueries }) => (
        <CatchBoundary
          getResetKey={() => 'read'}
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

// Anything else thrown while rendering is a bug, and shows as Unexpected.
function ReadFailure({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { failure, scope, requestId } = asCallFailed(error, 'render')
  const message = messageFor(failure, scope)
  if (channelFor('read', failure.kind) === 'forbidden') return <Forbidden message={message} />
  return <ErrorState message={message} requestId={requestId} onRetry={onRetry} />
}
