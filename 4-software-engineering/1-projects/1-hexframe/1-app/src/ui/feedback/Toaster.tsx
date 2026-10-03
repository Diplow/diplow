import { CircleCheck, Info, LoaderCircle, OctagonX, TriangleAlert } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Toaster as Sonner, toast } from 'sonner'

import { useThemeState } from '#/ui/theme'

// Sonner's own colours are literals; its variables are pointed at the theme's tokens instead.
const tokens = {
  '--normal-bg': 'var(--popover)',
  '--normal-text': 'var(--popover-foreground)',
  '--normal-border': 'var(--border)',
  '--border-radius': 'var(--radius)',
} as CSSProperties

/** Where toasts appear: mounted once, in the document shell. */
export function Toaster() {
  const { state } = useThemeState()
  return (
    <Sonner
      theme={state.theme}
      style={tokens}
      icons={{
        success: <CircleCheck className="size-4 text-success" />,
        info: <Info className="size-4 text-info" />,
        warning: <TriangleAlert className="size-4 text-warning" />,
        error: <OctagonX className="size-4 text-destructive" />,
        loading: <LoaderCircle className="size-4 animate-spin" />,
      }}
    />
  )
}

/**
 * Shows a toast: `toast(message)`, or `toast.success`, `.info`, `.warning`, `.error`. A write that fails is
 * one toast, and the error channel raises it, never a feature.
 */
export { toast }
