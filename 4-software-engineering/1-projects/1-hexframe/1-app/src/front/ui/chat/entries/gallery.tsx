// What happens in the chat between the two voices, on /design-system: the events by who acted, a run
// of reads folded, the live step, a Turn's end; a day as the chat reads it; a Proposal waiting, then
// decided, and the receipt it leaves with its Undo. Their times are the reader's own, so the page
// draws each specimen in the browser only.
import { ClientOnly } from '@tanstack/react-router'
import { Move, SquarePlus } from 'lucide-react'
import { type ReactNode, useState } from 'react'

import { m } from '#/paraglide/messages'

import { Button } from '../../atoms/controls/button'
import { Skeleton } from '../../atoms/skeleton'
import { toast } from '../../atoms/Toaster'
import { GallerySection, GalleryState } from '../../gallery/frame'
import { minutesAgo, said, sampleTiles, sampleWords } from '../samples'
import { Message } from '../text/Message'
import { Thinking } from '../text/Thinking'
import { DaySplit } from './DaySplit'
import { Events, type Folded, type Happened } from './Events'
import { type Change, Proposal } from './Proposal'
import { Receipt } from './Receipt'

const centered = (title: string) => {
  toast(m.gallery_sample_chat_centered({ title }))
}

const column = 'grid w-[32rem] max-w-full gap-5'

export function ChatEntriesGallery() {
  // Only the browser draws a specimen (`Specimen`), so this moment is the reader's.
  const [now] = useState(() => new Date())
  const {
    words,
    navigation,
    keyEdit,
    operations,
    reads,
    live,
    failed,
    ends,
    proposal,
    applied,
    at,
  } = samplesAt(now)
  return (
    <>
      <GallerySection name="Events">
        <Specimen label={m.gallery_state_chat_operations()}>
          <Events lines={operations} />
        </Specimen>
        <Specimen label={m.gallery_state_chat_navigation()}>
          <Events lines={[navigation]} />
        </Specimen>
        <Specimen label={m.gallery_state_chat_reads()}>
          <Events lines={[reads]} />
        </Specimen>
        <Specimen label={m.gallery_state_chat_live_step()}>
          <Events lines={[live, failed]} />
        </Specimen>
        <Specimen label={m.gallery_state_chat_turn_ends()}>
          <Events lines={ends} />
        </Specimen>
      </GallerySection>
      <GallerySection name="DaySplit">
        <Specimen label={m.gallery_state_chat_day()}>
          <DaySplit label={m.gallery_sample_chat_today()} />
          <Events lines={[keyEdit, navigation]} />
          <Message voice="human" words={words.question} />
          <Thinking state="done" seconds={9} text={m.gallery_sample_chat_thinking()} />
          <Events lines={[reads]} />
          <Message voice="agent" words={words.answer} />
          <Events lines={[live]} />
          <Message voice="human" words={words.request} />
        </Specimen>
      </GallerySection>
      <GallerySection name="Proposal">
        <Specimen label={m.gallery_state_chat_proposal_waiting()} wide>
          <Deciding proposal={proposal} />
        </Specimen>
        <Specimen label={m.gallery_state_chat_proposal_pending()} wide>
          <Proposal {...proposal} fate="open" pending />
        </Specimen>
        <Specimen label={m.gallery_state_chat_proposal_accepted()}>
          <Proposal {...proposal} fate="accepted" />
        </Specimen>
        <Specimen label={m.gallery_state_chat_proposal_discarded()}>
          <Proposal {...proposal} fate="discarded" />
        </Specimen>
      </GallerySection>
      <GallerySection name="Receipt">
        <Specimen label={m.gallery_state_chat_receipt_undo()}>
          <Receipt
            words={applied}
            at={at(0)}
            onUndo={() => toast(m.gallery_sample_chat_undone())}
          />
        </Specimen>
        <Specimen label={m.gallery_state_chat_receipt_pending()}>
          <Receipt words={applied} at={at(0)} onUndo={() => undefined} pending />
        </Specimen>
        <Specimen label={m.gallery_state_chat_receipt_undone()}>
          <Receipt words={applied} at={at(0)} undone />
        </Specimen>
      </GallerySection>
    </>
  )
}

/** The samples the entries are drawn on, their times counted back from now. */
function samplesAt(now: Date) {
  const tiles = sampleTiles(centered)
  const words = sampleWords(tiles)
  const { engineering, projects, tooling, site, designSystem, shared, toolingDraft, oldSite } =
    tiles
  const at = (minutes: number) => minutesAgo(now, minutes)
  const keyName = { name: m.gallery_sample_chat_key_name() }
  const keyEdit: Happened = {
    who: 'key',
    words: said(m.gallery_sample_chat_key_edited, { key: keyName, projects }),
    at: at(7),
  }
  const operations: Happened[] = [
    {
      who: 'you',
      words: said(m.gallery_sample_chat_you_created, { tooling, engineering }),
      at: at(9),
    },
    {
      who: 'agent',
      words: said(m.gallery_sample_chat_agent_moved, { site, shared }),
      tool: 'move_tile',
      at: at(8),
    },
    keyEdit,
    { who: 'key', words: said(m.gallery_sample_chat_revoked_deleted, { old: oldSite }), at: at(6) },
  ]
  const navigation: Happened = {
    who: 'you',
    words: said(m.gallery_sample_chat_you_centered, { engineering }),
    detail: m.gallery_sample_chat_moves({ count: 4 }),
    at: at(5),
  }
  const reads: Folded = {
    summary: m.gallery_sample_chat_reads({ count: 9, seconds: 2 }),
    events: [
      {
        who: 'agent',
        words: said(m.gallery_sample_chat_read, { engineering }),
        tool: 'get_tile',
        at: at(4),
      },
      {
        who: 'agent',
        words: [m.gallery_sample_chat_read_children({ count: 6 })],
        tool: 'list_children',
        at: at(4),
      },
      {
        who: 'agent',
        words: said(m.gallery_sample_chat_searched, { projects }),
        tool: 'search',
        at: at(4),
      },
    ],
  }
  const live: Happened = {
    who: 'agent',
    words: said(m.gallery_sample_chat_drafting, { tooling: toolingDraft }),
    tool: 'update_tile',
    at: at(1),
    state: 'running',
  }
  const failed: Happened = {
    who: 'agent',
    words: said(m.gallery_sample_chat_write_failed, { tooling }),
    tool: 'update_tile',
    at: at(1),
    state: 'failed',
  }
  const ends: Happened[] = [
    { who: 'you', words: [m.gallery_sample_chat_turn_stopped()], at: at(3) },
    { who: 'app', words: [m.gallery_sample_chat_turn_ceiling()], at: at(2) },
    { who: 'app', words: [m.gallery_sample_chat_turn_time()], at: at(1) },
    { who: 'app', words: [m.gallery_sample_chat_turn_sandbox()], at: at(0), state: 'failed' },
  ]
  const changes: Change[] = [
    { icon: SquarePlus, words: said(m.gallery_sample_chat_create, { shared, projects }) },
    { icon: Move, words: said(m.gallery_sample_chat_move, { site, shared }) },
    { icon: Move, words: said(m.gallery_sample_chat_move, { site: designSystem, shared }) },
  ]
  const proposal = {
    title: m.gallery_sample_chat_proposal_title(),
    summary: m.gallery_sample_chat_proposal_summary(),
    changes,
    at: at(0),
    onAccept: () => toast(m.gallery_sample_chat_accepted()),
    onDiscard: () => toast(m.gallery_sample_chat_discarded()),
    onUndo: () => toast(m.gallery_sample_chat_undone()),
  }
  const applied = [m.gallery_sample_chat_applied({ count: 3 })]
  return {
    words,
    navigation,
    keyEdit,
    operations,
    reads,
    live,
    failed,
    ends,
    proposal,
    applied,
    at,
  }
}

function Specimen({
  label,
  wide = false,
  children,
}: {
  label: string
  wide?: boolean
  children: ReactNode
}) {
  return (
    <GalleryState label={label}>
      <div className={wide ? 'grid w-[40rem] max-w-full gap-5' : column}>
        <ClientOnly fallback={<Skeleton className="h-24 w-full" />}>{children}</ClientOnly>
      </div>
    </GalleryState>
  )
}

type Sample = Omit<Parameters<typeof Proposal>[0], 'fate' | 'undone'>

/** A Proposal the page decides for itself: accepted, discarded or undone here, then offered again. */
function Deciding({ proposal }: { proposal: Sample }) {
  const [fate, setFate] = useState<'open' | 'accepted' | 'discarded'>('open')
  const [undone, setUndone] = useState(false)
  return (
    <>
      <Proposal
        {...proposal}
        fate={fate}
        undone={undone}
        onAccept={() => {
          setFate('accepted')
        }}
        onDiscard={() => {
          setFate('discarded')
        }}
        onUndo={() => {
          setUndone(true)
        }}
      />
      {fate !== 'open' && (
        <Button
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={() => {
            setFate('open')
            setUndone(false)
          }}
        >
          {m.gallery_sample_chat_propose_again()}
        </Button>
      )}
    </>
  )
}
