// Where a day begins in the conversation: its name, small and faint in mono, then a hairline that fades
// toward the curve, running on to it at its height. A line, never a box, as every separator is.
import { cn } from 'cn'

import { runsToCurve, toCurve } from '../../layouts/screen/state/useAlongCurve'

export function DaySplit({ label }: { label: string }) {
  return (
    <p
      ref={toCurve}
      className={cn(
        runsToCurve,
        'flex items-center gap-3 font-mono text-[0.65625rem] text-faint after:h-px after:flex-1 after:bg-linear-to-r after:from-border after:to-transparent',
      )}
    >
      {label}
    </p>
  )
}
