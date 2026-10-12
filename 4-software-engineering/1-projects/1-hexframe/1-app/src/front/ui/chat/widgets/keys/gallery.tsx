// The key widget on /design-system, live on sample Keys: name one and create it, see its secret once,
// be done with it, find the Keys, revoke one. Nothing is issued: the secret is plainly a sample's, and
// what would reach IAM shows in a toast; what IAM would refuse is IAM's own rule, which the route
// reads at IAM's door and hands over, since `ui/` can't.
import { RotateCcw } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { m } from '#/paraglide/messages'

import { Act } from '../../../atoms/controls/act'
import { toast } from '../../../atoms/Toaster'
import { GalleryColumn, GallerySection, GalleryState } from '../../../gallery/frame'
import { said } from '../../samples'
import { KeyWidget, type KeyRow } from './KeyWidget'

/** IAM's rule for a Key's name, read by the route: its limit, and the name it keeps, or none. */
interface NameRule {
  /** The most characters a name holds, as a reader counts them. */
  nameLimit: number
  /** The name IAM would keep, trimmed, or `undefined` for one it would refuse. */
  nameOf: (name: string) => string | undefined
}

export function KeyWidgetGallery(rule: NameRule) {
  return (
    <GallerySection name="KeyWidget">
      <GalleryState label={m.gallery_state_key_live()}>
        <GalleryColumn>
          <LiveKey {...rule} />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_key_refused()}>
        <GalleryColumn>
          <LiveKey {...rule} refused />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_key_shown()}>
        <GalleryColumn>
          <Shown />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_key_list()}>
        <GalleryColumn>
          <ListedKeys />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_key_by_agent()}>
        <GalleryColumn>
          <ListedKeys byAgent />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_widget_phone()}>
        <GalleryColumn phone>
          <Shown />
        </GalleryColumn>
      </GalleryState>
    </GallerySection>
  )
}

/** A secret of the shape IAM issues, plainly a sample's: it opens nothing. */
const sampleSecret = 'hf_a3fEXAMPLE0not0a0key0EXAMPLE0not0a0key0'

/** The command, as the keys feature words it (`features/keys/command.ts`), for hexframe's origin. */
const commandOf = (secret: string) =>
  `claude mcp add --transport http hexframe https://hexframe.ai/mcp --header "Authorization: Bearer ${secret}"`

function Shown() {
  return (
    <KeyWidget
      state="shown"
      name={m.gallery_tile_sample_by()}
      secret={sampleSecret}
      command={commandOf(sampleSecret)}
      onDone={said(m.keys_done())}
    />
  )
}

/** The Account's Keys, their dates worded as the caller would. */
const sampleKeys = (): KeyRow[] => [
  {
    id: 'laptop',
    name: m.gallery_tile_sample_by(),
    start: 'hf_a3f',
    made: m.gallery_key_made_1(),
    used: m.gallery_key_used_1(),
    live: true,
  },
  {
    id: 'obsidian',
    name: m.gallery_key_name_2(),
    start: 'hf_k9q',
    made: m.gallery_key_made_2(),
    used: m.gallery_key_used_2(),
    live: false,
  },
  {
    id: 'backup',
    name: m.gallery_key_name_3(),
    start: 'hf_x1c',
    made: m.gallery_key_made_3(),
    used: m.widget_key_never_used(),
    live: false,
  },
]

function ListedKeys({ byAgent = false }: { byAgent?: boolean }) {
  const [keys, setKeys] = useState(sampleKeys)
  return (
    <KeyWidget
      state="list"
      byAgent={byAgent}
      keys={keys}
      onRevoke={(id) => {
        const gone = keys.find((key) => key.id === id)
        setKeys(keys.filter((key) => key.id !== id))
        if (gone !== undefined) toast.success(m.keys_revoked({ name: gone.name }))
      }}
      onNew={said(m.widget_key_new())}
      onDone={() => {
        setKeys(sampleKeys())
      }}
    />
  )
}

// From the first key to its receipt: a name checked as IAM would, the secret shown once, Done.
function LiveKey({
  nameLimit,
  nameOf,
  refused: refusedAtFirst = false,
}: NameRule & { refused?: boolean }) {
  const [now] = useState(() => new Date())
  const [state, setState] = useState<'issue' | 'shown' | 'done'>('issue')
  const [name, setName] = useState('')
  const [refused, setRefused] = useState<string | undefined>(
    refusedAtFirst ? m.error_iam_key_name_invalid() : undefined,
  )
  const again = () => {
    setState('issue')
    setName('')
    setRefused(undefined)
  }
  let widget: ReactNode
  if (state === 'issue') {
    widget = (
      <KeyWidget
        state="issue"
        name={name}
        nameLimit={nameLimit}
        onNameChange={(next) => {
          setName(next)
          setRefused(undefined)
        }}
        refused={refused}
        onIssue={() => {
          const refusal = nameOf(name) === undefined ? m.error_iam_key_name_invalid() : undefined
          setRefused(refusal)
          if (refusal === undefined) setState('shown')
        }}
        onLater={again}
      />
    )
  } else if (state === 'shown') {
    widget = (
      <KeyWidget
        state="shown"
        name={nameOf(name) ?? name}
        secret={sampleSecret}
        command={commandOf(sampleSecret)}
        onDone={() => {
          setState('done')
        }}
      />
    )
  } else widget = <KeyWidget state="done" name={nameOf(name) ?? name} at={now} />
  return (
    <>
      {widget}
      <Act className="justify-self-start" onClick={again}>
        <RotateCcw className="size-3" />
        {m.gallery_widget_replay()}
      </Act>
    </>
  )
}
