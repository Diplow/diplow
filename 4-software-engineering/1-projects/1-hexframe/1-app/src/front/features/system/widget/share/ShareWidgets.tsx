// Who may see a Tile of the Account's own System, in the chat, at the conversation's foot, on ui's
// share widget, opened by the Tile's menu's Share, its owner's alone: everyone who reaches it, each
// with its value and where it comes from, Everyone set to read, to none, or back to inherit, and the
// link it is visited by, copied. Whether it is open, and on which Tile, is the URL's, a change under
// way as a form is (`share`, `../../search/search.ts`), which `TileWidgets` draws. Setting a Grant is
// no Operation: the System's queue, its overlay and the timeline know nothing of it.
import { type System, tileAt } from '#/domains/mapping/entities'
import { useSetGrant, useWhoReaches } from '#/front/client/mapping/sharing'
import { toast } from '#/front/ui/atoms/Toaster'
import { ShareWidget } from '#/front/ui/chat/widgets/share/ShareWidget'
import { m } from '#/paraglide/messages'

import { visitLinkOf } from '../../visit/visit'
import { shareRowsOf } from './rows'

interface ShareWidgetsProps {
  /** The Account's own System, as the page shows it. */
  system: System
  /** The Tile it is open on, as the URL says, one the System holds. */
  tile: string
  /** Closes it: the URL lets it go. */
  onClose: () => void
}

/** Copies the link, saying so; without a secure context there is no clipboard, which fails alike. */
function copy(text: string) {
  void Promise.resolve(text)
    .then((copied) => navigator.clipboard.writeText(copied))
    .then(
      () => toast(m.system_copied()),
      () => toast.error(m.system_copy_failed()),
    )
}

/**
 * The share widget on a Tile of the Account's own System, once who reaches it is read. While
 * Everyone's choice is on its way, the widget shows it and waits.
 */
export function ShareWidgets({ system, tile, onClose }: ShareWidgetsProps) {
  const { data: reached } = useWhoReaches(tile)
  const setGrant = useSetGrant()
  if (reached === undefined) return null
  const found = tileAt(system, tile)
  if (found === undefined) return null
  const { everyone, others } = shareRowsOf(reached, {
    tile,
    star: system.root.id,
    titleOf: (id) => tileAt(system, id)?.title,
  })
  const sending = setGrant.isPending
  const link = visitLinkOf(tile, location.href)
  return (
    <ShareWidget
      title={found.title === '' ? m.tile_word_root() : found.title}
      everyone={{ ...everyone, choice: sending ? setGrant.variables.value : everyone.choice }}
      others={others}
      sending={sending}
      onChoose={(value) => {
        setGrant.mutate({ tile, subject: { _tag: 'Everyone' }, value })
      }}
      link={link}
      onCopyLink={() => {
        copy(link)
      }}
      onDone={onClose}
    />
  )
}
