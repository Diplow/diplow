// The key widget on /design-system, live on fixture Keys: name one and create it, see its secret
// once, be done with it, find it among the Keys, revoke one. Nothing is issued: the secret is a
// fixture's, and what would reach IAM shows in a toast.
import { RotateCcw } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { m } from '#/paraglide/messages'

import { Act } from '../../../atoms/controls/act'
import { toast } from '../../../atoms/Toaster'
import { GallerySection, GalleryState } from '../../../gallery/frame'
import { lengthOf } from '../count'
import { KeyWidget, type KeyRow } from './KeyWidget'

export function KeyWidgetGallery() {
  return (
    <GallerySection name="KeyWidget">
      <GalleryState label={m.gallery_state_key_live()}>
        <Column>
          <LiveKey />
        </Column>
      </GalleryState>
      <GalleryState label={m.gallery_state_key_refused()}>
        <Column>
          <KeyWidget
            state="issue"
            name=""
            onNameChange={said(m.widget_key_name())}
            refused={m.error_iam_key_name_invalid()}
            onIssue={said(m.widget_key_create())}
            onLater={said(m.widget_key_later())}
          />
        </Column>
      </GalleryState>
      <GalleryState label={m.gallery_state_key_shown()}>
        <Column>
          <KeyWidget
            state="shown"
            name={fixtureName}
            secret={fixtureSecret}
            command={commandOf(fixtureSecret)}
            onDone={said(m.keys_done())}
          />
        </Column>
      </GalleryState>
      <GalleryState label={m.gallery_state_key_list()}>
        <Column>
          <ListedKeys />
        </Column>
      </GalleryState>
      <GalleryState label={m.gallery_state_key_by_agent()}>
        <Column>
          <KeyWidget
            state="list"
            byAgent
            keys={fixtureKeys()}
            onRevoke={said(m.keys_revoke())}
            onNew={said(m.widget_key_new())}
            onDone={said(m.keys_done())}
          />
        </Column>
      </GalleryState>
      <GalleryState label={m.gallery_state_widget_phone()}>
        <Column phone>
          <KeyWidget
            state="shown"
            name={fixtureName}
            secret={fixtureSecret}
            command={commandOf(fixtureSecret)}
            onDone={said(m.keys_done())}
          />
        </Column>
      </GalleryState>
    </GallerySection>
  )
}

const said = (what: string) => () => {
  toast(what)
}

function Column({ phone = false, children }: { phone?: boolean; children: ReactNode }) {
  return (
    <div
      className={
        phone ? 'grid w-[23.4375rem] max-w-full gap-4' : 'grid w-[37.5rem] max-w-full gap-4'
      }
    >
      {children}
    </div>
  )
}

const fixtureName = 'Claude Code, laptop'

/** A secret of the shape IAM issues, plainly a fixture's: it opens nothing. */
const fixtureSecret = 'hf_a3fEXAMPLE0not0a0key0EXAMPLE0not0a0key0'

/** The command, as the keys feature words it (`features/keys/command.ts`), for this page's origin. */
const commandOf = (secret: string) =>
  `claude mcp add --transport http hexframe https://hexframe.ai/mcp --header "Authorization: Bearer ${secret}"`

/** The Account's Keys, their dates worded as the caller would. */
const fixtureKeys = (): KeyRow[] => [
  {
    id: 'laptop',
    name: fixtureName,
    start: 'hf_a3f',
    made: m.gallery_key_made_1(),
    used: m.gallery_key_used_1(),
    live: true,
  },
  {
    id: 'obsidian',
    name: 'Obsidian, desktop',
    start: 'hf_k9q',
    made: m.gallery_key_made_2(),
    used: m.gallery_key_used_2(),
    live: false,
  },
  {
    id: 'backup',
    name: 'Backup script',
    start: 'hf_x1c',
    made: m.gallery_key_made_3(),
    used: m.widget_key_never_used(),
    live: false,
  },
]

function ListedKeys() {
  const [keys, setKeys] = useState(fixtureKeys)
  return (
    <KeyWidget
      state="list"
      keys={keys}
      onRevoke={(id) => {
        const gone = keys.find((key) => key.id === id)
        setKeys(keys.filter((key) => key.id !== id))
        if (gone !== undefined) toast.success(m.keys_revoked({ name: gone.name }))
      }}
      onNew={said(m.widget_key_new())}
      onDone={() => {
        setKeys(fixtureKeys())
      }}
    />
  )
}

// From the first key to its receipt: a name checked as IAM would, the secret shown once, Done, then
// the Keys with the new one first.
function LiveKey() {
  const [state, setState] = useState<'issue' | 'shown' | 'done'>('issue')
  const [name, setName] = useState('')
  const [refused, setRefused] = useState<string | undefined>(undefined)
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
        onNameChange={(next) => {
          setName(next)
          setRefused(undefined)
        }}
        refused={refused}
        onIssue={() => {
          const length = lengthOf(name.trim())
          if (length === 0 || length > 32) setRefused(m.error_iam_key_name_invalid())
          else setState('shown')
        }}
        onLater={again}
      />
    )
  } else if (state === 'shown') {
    widget = (
      <KeyWidget
        state="shown"
        name={name.trim()}
        secret={fixtureSecret}
        command={commandOf(fixtureSecret)}
        onDone={() => {
          setState('done')
        }}
      />
    )
  } else widget = <KeyWidget state="done" name={name.trim()} at="14:09" />
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
