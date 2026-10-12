// The composer on /design-system, in each of its states, every one live: type in any of them. The
// demo (`demo.ts`) stands in for the state hook a real page has, on a fixture System; what is sent,
// run or stopped shows in a toast, and a language picked goes to it, as on a real page.
import { cn } from 'cn'
import { useState } from 'react'

import { m } from '#/paraglide/messages'
import { assertIsLocale, localizeHref } from '#/paraglide/runtime'

import { toast } from '../../atoms/Toaster'
import { GallerySection, GalleryState } from '../../gallery/frame'
import { anchorOf } from '../../gallery/pieces'
import { Composer } from './Composer'
import { typingAt, useComposerDemo } from './demo'

export function ComposerGallery() {
  return (
    <GallerySection name="Composer">
      <GalleryState label={m.gallery_state_empty()}>
        <Specimen />
      </GalleryState>
      <GalleryState label={m.gallery_state_composer_writing()}>
        <Specimen initial={m.gallery_composer_sample_writing()} listed={false} />
      </GalleryState>
      <GalleryState label={m.gallery_state_composer_commands()}>
        <Specimen initial="/" />
      </GalleryState>
      <GalleryState label={m.gallery_state_composer_commands_typed()}>
        <Specimen initial="/la" />
      </GalleryState>
      <GalleryState label={m.gallery_state_composer_no_command()}>
        <Specimen initial="/xyz" />
      </GalleryState>
      <GalleryState label={m.gallery_state_composer_tiles()}>
        <Specimen initial="@pro" />
      </GalleryState>
      <GalleryState label={m.gallery_state_composer_command_tile()}>
        <Specimen initial={`/${m.composer_command_edit()} @fe`} />
      </GalleryState>
      <GalleryState label={m.gallery_state_composer_language()}>
        <Specimen initial={`/${m.composer_command_language()} `} />
      </GalleryState>
      <GalleryState label={m.gallery_state_composer_sending()}>
        <Specimen initial={m.gallery_composer_sample_writing()} listed={false} sending />
      </GalleryState>
      <GalleryState label={m.gallery_state_composer_running()}>
        <Specimen initial={m.gallery_composer_sample_next()} listed={false} running />
      </GalleryState>
      <GalleryState label={m.gallery_state_composer_waiting()}>
        <Specimen waiting />
      </GalleryState>
      <GalleryState label={m.gallery_state_composer_unavailable()}>
        <Specimen unavailable />
      </GalleryState>
      <GalleryState label={m.gallery_state_composer_phone()}>
        <Phone />
      </GalleryState>
    </GallerySection>
  )
}

interface SpecimenProps {
  /** What the field holds at first, the caret at its end. */
  initial?: string
  /** Whether what the caret stands in lists at first. */
  listed?: boolean
  sending?: boolean
  running?: boolean
  waiting?: boolean
  unavailable?: boolean
  className?: string
}

/** The column a specimen stands in, the conversation's width. */
const column = 'flex w-[26rem] max-w-full flex-col justify-end'

function Specimen({
  initial = '',
  listed = true,
  sending: sendingAtFirst = false,
  running: runningAtFirst = false,
  waiting = false,
  unavailable = false,
  className,
}: SpecimenProps) {
  const { value, clear, composer } = useComposerDemo({
    initial,
    listed,
    onLanguage: (language) => {
      const here = `${window.location.pathname}${window.location.search}#${anchorOf('Composer')}`
      window.location.assign(localizeHref(here, { locale: assertIsLocale(language) }))
    },
  })
  const [sending, setSending] = useState(sendingAtFirst)
  const [running, setRunning] = useState<{ stopping: boolean } | undefined>(
    runningAtFirst ? { stopping: false } : undefined,
  )
  // A specimen that lists at first is tall enough for its list to rise into.
  const [tall] = useState(listed && typingAt(initial, initial.length) !== undefined)
  return (
    <div className={cn(column, tall && 'h-104', className)}>
      <Composer
        {...composer}
        onSend={() => {
          const sent = value.trim()
          setSending(true)
          // The demo's server takes a Message in a second.
          setTimeout(() => {
            toast(m.gallery_composer_sent({ message: sent }))
            setSending(false)
            clear()
          }, 1000)
        }}
        sending={sending}
        running={
          running === undefined
            ? undefined
            : {
                stopping: running.stopping,
                stop: () => {
                  setRunning({ stopping: true })
                  setTimeout(() => {
                    setRunning(undefined)
                    toast(m.gallery_composer_stopped())
                  }, 800)
                },
              }
        }
        waiting={waiting}
        unavailable={unavailable}
      />
    </div>
  )
}

/** On a phone: the composer over the keyboard, listing the commands within a thumb's reach. */
function Phone() {
  return (
    <div className="grid w-[22.5rem] max-w-full grid-rows-[1fr_auto] border border-input bg-background">
      <Specimen initial="/" className="h-120 w-full" />
      <div
        aria-hidden
        className="grid h-56 place-items-center bg-muted text-xs font-light text-muted-foreground"
      >
        {m.gallery_composer_keyboard()}
      </div>
    </div>
  )
}
