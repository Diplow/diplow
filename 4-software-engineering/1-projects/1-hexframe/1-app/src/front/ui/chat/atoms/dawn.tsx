// A line of the chat rising with a new account's dawn, at its beat. The dawn plays from the corner
// down, one beat every `--stagger-dawn`: the corner's path, the root's light, the pseudo's receipt,
// the composer, then the agent's invitation to a first command; the chat's two are written here
// (HEX-118). The line rises within its own line, which clips it while it rises, since the
// conversation sits on the screen's foot until the composer has risen, and a line held below its
// place would reach past the foot, scrolling the conversation and lighting the curve's star; once
// it has risen nothing clips it, so the keyboard's outline shows whole. Under reduced motion it is
// simply there.
import { cn } from 'cn'
import { type ReactNode, useState } from 'react'

/** The chat's beats of the dawn: the pseudo's receipt third, the agent's invitation fifth. */
const beats = {
  receipt: 'motion-safe:animate-dawn [animation-delay:calc(var(--stagger-dawn)*2)]!',
  invitation: 'motion-safe:animate-dawn [animation-delay:calc(var(--stagger-dawn)*4)]!',
} as const

/** What rises at its beat of the dawn, within its own line until it has. */
export function Dawn({ beat, children }: { beat: keyof typeof beats; children: ReactNode }) {
  const [risen, setRisen] = useState(false)
  return (
    <div className={cn(!risen && 'motion-safe:overflow-y-clip')}>
      <div
        className={beats[beat]}
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget) setRisen(true)
        }}
      >
        {children}
      </div>
    </div>
  )
}
