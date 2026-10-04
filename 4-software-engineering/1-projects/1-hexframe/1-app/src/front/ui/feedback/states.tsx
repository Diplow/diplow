// What a place shows instead of its content: nothing yet, a failure, or a no.
import { cn } from 'cn'
import { Lock, RotateCw, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

import { m } from '#/paraglide/messages'

import { Button } from '../inputs/controls/button'

interface NoticeProps {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  role?: 'alert'
  tone?: 'muted' | 'destructive'
}

function Notice({ icon, title, description, action, role, tone = 'muted' }: NoticeProps) {
  return (
    <div
      role={role}
      className="flex flex-col items-center gap-4 rounded-lg border border-dashed p-8 text-center"
    >
      {icon !== undefined && (
        <div
          className={cn(
            'flex size-12 items-center justify-center rounded-full [&_svg]:size-6',
            tone === 'destructive'
              ? 'bg-destructive/10 text-destructive'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {icon}
        </div>
      )}
      <div className="grid max-w-sm gap-1.5">
        <h3 className="font-semibold">{title}</h3>
        {description !== undefined && (
          <div className="text-sm text-muted-foreground">{description}</div>
        )}
      </div>
      {action}
    </div>
  )
}

interface EmptyStateProps {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  /** The first thing to do: create the first one. */
  action?: ReactNode
}

/** A place with nothing in it yet: what would be here, and how to add the first. */
export function EmptyState(props: EmptyStateProps) {
  return <Notice {...props} />
}

interface ErrorStateProps {
  /** From the message table; a generic sentence otherwise. Never the server's own. */
  message?: string
  /** Shown so a report can be traced to its Sentry event. */
  requestId?: string
  onRetry?: () => void
}

/** A read that failed, in the nearest boundary: what happened, a retry, and the request id. */
export function ErrorState({ message, requestId, onRetry }: ErrorStateProps) {
  return (
    <Notice
      role="alert"
      tone="destructive"
      icon={<TriangleAlert />}
      title={m.ui_error_title()}
      description={
        <>
          <p>{message ?? m.ui_error_body()}</p>
          {requestId !== undefined && (
            <p className="mt-2 font-mono text-xs">{m.ui_error_request_id({ id: requestId })}</p>
          )}
        </>
      }
      action={
        onRetry && (
          <Button variant="outline" onClick={onRetry}>
            <RotateCw />
            {m.ui_retry()}
          </Button>
        )
      }
    />
  )
}

/** A read the user may not make: the page worked, and the answer is no. */
export function Forbidden({ message }: { message?: string }) {
  return (
    <Notice
      icon={<Lock />}
      title={m.ui_forbidden_title()}
      description={message ?? m.ui_forbidden_body()}
    />
  )
}
