// Who may see a Tile of the Account's own System, in the chat, at the conversation's foot, on ui's
// share widget, opened by the Tile's menu's Share, its owner's alone: everyone who reaches it, each
// with its value and where it comes from, Everyone set to read, to none, or back to inherit, someone
// added through the star picker, by their star, a group of an Organization the user belongs to
// through the group picker (HEX-137), and set to any value or back to inherit, a group gone cleared,
// and the link it is visited by, copied. Whether it is open, and on which Tile, is the URL's, a
// change under way as a form is (`share`, `../../search/search.ts`), which `TileWidgets` draws;
// which picker shows in its place, and what is typed there, is this widget's own. Setting a Grant is
// no Operation: the System's queue, its overlay and the owner's timeline know nothing of it.
import { useState } from 'react'

import { type System, tileAt } from '#/domains/mapping/entities'
import { useGroupsToShareWith } from '#/front/client/iam/organizations'
import { useSetGrant, useStarsFor, useWhoReaches } from '#/front/client/mapping/sharing'
import { GroupPicker } from '#/front/ui/chat/widgets/sharing/share/GroupPicker'
import { ShareWidget } from '#/front/ui/chat/widgets/sharing/share/ShareWidget'
import { StarPicker } from '#/front/ui/chat/widgets/sharing/star-picker/StarPicker'
import { m } from '#/paraglide/messages'

import { copy } from '../../copy'
import { visitLinkOf } from '../../visit/visit'
import { groupPicked, groupsOffered } from './groups'
import { changeOf, named, shareRowsOf, withSent } from './rows'

interface ShareWidgetsProps {
  /** The Account's own System, as the page shows it. */
  system: System
  /** The Tile it is open on, as the URL says, one the System holds, by its id and its Title. */
  tile: { readonly id: string; readonly title: string }
  /** Closes it: the URL lets it go. */
  onClose: () => void
}

/**
 * The share widget on a Tile of the Account's own System, once who reaches it is read, or a picker in
 * its place while someone or a group is being added: the star or the group picked is set to read on
 * the Tile, then the widget comes back, with them among its rows, to be set to any value there; one
 * among them already is set to nothing new. While a choice is on its way, its row shows it and every
 * choice waits.
 */
export function ShareWidgets({ system, tile: { id: tile, title }, onClose }: ShareWidgetsProps) {
  const { data: reached } = useWhoReaches(tile)
  const { data: shareable = [] } = useGroupsToShareWith()
  const setGrant = useSetGrant()
  const [picking, setPicking] = useState<'star' | 'group'>()
  const [typed, setTyped] = useState('')
  const found = useStarsFor(typed, location.href)
  if (reached === undefined) return null
  const shown = title === '' ? m.tile_word_root() : title
  const rows = shareRowsOf(reached, {
    tile,
    star: system.root.id,
    titleOf: (id) => tileAt(system, id)?.title,
  })
  const back = () => {
    setPicking(undefined)
    setTyped('')
  }
  if (picking === 'group') {
    return (
      <GroupPicker
        title={m.widget_share_with_which_group({ title: shown })}
        organizations={groupsOffered(shareable, rows)}
        onPick={(organization, group) => {
          const change = groupPicked(shareable, tile, { organization, group })
          if (change !== undefined) setGrant.mutate(change)
          back()
        }}
        onCancel={back}
      />
    )
  }
  if (picking === 'star') {
    return (
      <StarPicker
        title={m.widget_share_with_whom({ title: shown })}
        typed={typed}
        onType={setTyped}
        found={found}
        onPick={(star) => {
          if (!named(rows, star.id)) {
            setGrant.mutate({ tile, subject: { _tag: 'Account', star: star.id }, value: 'read' })
          }
          back()
        }}
        onCancel={back}
        takesFocus
      />
    )
  }
  const sent = setGrant.isPending ? setGrant.variables : undefined
  const { everyone, others } = withSent(rows, sent)
  const link = visitLinkOf(tile, location.href)
  return (
    <ShareWidget
      title={shown}
      everyone={everyone}
      others={others}
      sending={sent !== undefined}
      onChoose={(key, value) => {
        const change = changeOf(rows, tile, key, value)
        if (change !== undefined) setGrant.mutate(change)
      }}
      onAdd={() => {
        setPicking('star')
      }}
      onAddGroup={
        shareable.length === 0
          ? undefined
          : () => {
              setPicking('group')
            }
      }
      link={link}
      onCopyLink={() => {
        copy(link)
      }}
      onDone={onClose}
    />
  )
}
