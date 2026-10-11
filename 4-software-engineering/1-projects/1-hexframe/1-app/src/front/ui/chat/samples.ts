// The chat's samples on /design-system: a few tiles of a System and what the user, the agent and a Key
// say about them, every string a message in English and French, each tile woven in where its
// language puts it (`weave`). A click on a tile says in a toast that the canvas would center on it.
import { m } from '#/paraglide/messages'

import { toast } from '../atoms/Toaster'
import type { MentionProps } from './text/Mention'
import { weave } from './text/words'

const tile = (
  title: string,
  more: Omit<MentionProps, 'title'> = {},
): { readonly tile: MentionProps } => ({
  tile: { title, ...more },
})

/** The sample tiles, by what they are: on home a click centers the canvas; here a toast says so. */
export function sampleTiles() {
  const live = (title: string) =>
    tile(title, {
      onCenter: () => {
        toast(m.gallery_sample_chat_centered({ title }))
      },
    })
  return {
    engineering: live(m.gallery_sample_chat_engineering()),
    projects: live(m.gallery_sample_chat_projects()),
    tooling: live(m.gallery_sample_chat_tooling()),
    site: live(m.gallery_sample_chat_site()),
    designSystem: live(m.gallery_sample_chat_design_system()),
    shared: tile(m.gallery_sample_chat_shared(), { standing: 'draft' }),
    toolingDraft: tile(m.gallery_sample_chat_tooling(), { standing: 'draft' }),
    oldSite: tile(m.gallery_sample_chat_old_site(), { standing: 'gone' }),
  }
}

type Tiles = ReturnType<typeof sampleTiles>

/** What the user and the agent say about them. */
export function sampleWords(tiles: Tiles) {
  const { engineering, projects, tooling, site, oldSite } = tiles
  return {
    question: weave(m.gallery_sample_chat_question, { engineering }),
    request: weave(m.gallery_sample_chat_request, { old: oldSite }),
    answer: weave(m.gallery_sample_chat_answer, { tooling, projects, site }),
    answerMore: weave(m.gallery_sample_chat_answer_more, { projects }),
  }
}

/** A moment, some minutes before now. */
export const minutesAgo = (now: Date, minutes: number) => new Date(now.getTime() - minutes * 60_000)
