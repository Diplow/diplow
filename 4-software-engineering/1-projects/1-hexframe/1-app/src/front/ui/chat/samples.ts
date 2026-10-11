// The chat's samples on /design-system: a few tiles of a System and what the user, the agent and a Key
// say about them, every string a message in English and French. A sentence names its tiles where its
// language puts them: the message is read with a mark in each tile's place, then cut at the marks.
import { m } from '#/paraglide/messages'

import type { MentionProps } from './text/Mention'
import type { Word, Words } from './text/words'

/** The mark standing for the nth piece woven into a sentence: a character of Unicode's private use. */
const mark = (index: number) => String.fromCharCode(0xe000 + index)

/** A sentence read with `mark(n)` in place of the nth piece, cut at the marks and woven with them. */
function woven(sentence: string, pieces: readonly Word[]): Words {
  return sentence
    .split(/([-])/)
    .filter((part) => part !== '')
    .map((part) => {
      const index = part.charCodeAt(0) - 0xe000
      return part.length === 1 && index >= 0 ? (pieces[index] ?? part) : part
    })
}

const tile = (
  title: string,
  more: Omit<MentionProps, 'title'> = {},
): { readonly tile: MentionProps } => ({
  tile: { title, ...more },
})

/** The sample tiles, by what they are; a click on one says so in a toast where it is drawn. */
export function sampleTiles(onCenter: (title: string) => void) {
  const live = (title: string) =>
    tile(title, {
      onCenter: () => {
        onCenter(title)
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
    question: said(m.gallery_sample_chat_question, { engineering }),
    request: said(m.gallery_sample_chat_request, { old: oldSite }),
    answer: said(m.gallery_sample_chat_answer, { tooling, projects, site }),
    answerMore: said(m.gallery_sample_chat_answer_more, { projects }),
  }
}

/** A sentence about the sample tiles, woven: `said(m.x, { engineering })` reads `{engineering}`. */
export function said<Names extends string>(
  sentence: (inputs: Record<Names, string>) => string,
  pieces: Record<Names, Word>,
): Words {
  const names = Object.keys(pieces) as Names[]
  const inputs = Object.fromEntries(names.map((name, index) => [name, mark(index)]))
  return woven(
    sentence(inputs as Record<Names, string>),
    names.map((name) => pieces[name]),
  )
}

/** A moment, some minutes before now. */
export const minutesAgo = (now: Date, minutes: number) => new Date(now.getTime() - minutes * 60_000)
