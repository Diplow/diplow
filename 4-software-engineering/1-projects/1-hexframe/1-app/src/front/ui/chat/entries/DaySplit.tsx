// Where a day begins in the conversation: its name, small and faint in mono, then a hairline that fades
// toward the curve. A line, never a box, as every separator is.
export function DaySplit({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-3 font-mono text-[0.65625rem] text-faint after:h-px after:flex-1 after:bg-linear-to-r after:from-border after:to-transparent">
      {label}
    </p>
  )
}
