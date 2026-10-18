---
title: sharing
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/domains/mapping/sharing
owner: diplo
preview: >-
  Who reaches a Tile, changed by its System's owner alone, from a Session: a
  Tile's Grant for Everyone set or removed, and who reaches the Tile read,
  each subject with its value and the Tile it comes from, which the Share
  widget lists. No Operation: nothing proposes nor undoes it, and no timeline
  tells of it. And the star someone is shared with, found by its Title or by
  a link, by its card alone.
---
# sharing

How a Tile's Grants change, a concept of [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/mapping/CLAUDE|Mapping]] the API layer calls as directly as the service, whose folder is full, as it calls `landing/`. What a Grant is and how it resolves is `entities/rights/`'s; who may change one, `operations/rights/may.ts`'s `mayShare`: the System's owner, from a Session, never through a Key, a Turn's Key or an agent.

| File | Holds |
|---|---|
| `sharing.ts` | `grant`, a Tile's Grant for Everyone set, `read` or `none`, in place of the one it had, or removed, `inherit`, so its value comes from its parent again (`GrantChange`), on the System the actor acts on, its star locked, in the transaction the API layer opens, through the tiles repository's `Writes.setGrant` and `removeGrant`; `whoReaches`, every subject that reaches a Tile, Everyone first, with its value and the Tile whose Grant gives it (`reachOn`), read by the owner alone so nobody else learns who reads a Tile. Both start from `sharedOn`: a Tile of a System hexframe ships is `ShippedReadOnly` first, as for an Operation, read by Everyone for being shipped, its Grants nobody's; then `mayShare` rules on the System: an id it holds no Tile of, a Reference's included, and a Tile the actor may not read are `TileNotFound`; anyone else, or the owner without a Session, `NotAllowed` |
| `stars.ts` | A star found, for whoever is about to share with someone or name a member (HEX-130): `starsTitled`, the stars whose Title holds a query, Mapping's `StarQuery`, whatever its case, by their cards (`StarCard`), those it starts first, at most `starsFoundAtMost`, the star of the System the actor acts on, their own, left out, through the tiles repository's `starsTitled`: stars alone, never a Tile below one, a private System's found by its card too, since anyone sees a star's card; `starShowing`, the star of the System the actor acts on, by its card (`glimpses`), once `shownTile` found they are shown a Tile of it, one they may read or the star itself, `TileNotFound` otherwise; and `linkedStar`, where a link to a Tile leads the actor, Mapping's `LinkedStar`: its star by its card (`starShowing`), their own star said to be their own, or nowhere for a Tile kept from them as for none, an answer rather than a refusal, so the picker says it under the link |
| `stars.test.ts` | Over PGlite: stars found by a Title whatever its case, those it starts first, by their cards alone, a private System's too, never a Tile below a star, the finder's own left out, a few at most, a query's `%`, `_` and `\` read as themselves; a link to a star leading to its card, to a deep Tile kept from the reader nowhere until Everyone may read it, to an id the System holds none of nowhere; and `linkedStar`'s three answers, a star by its card, the reader's own star their own, nowhere for a Tile kept from them as for none; and the query `starQueryOf` makes of what is typed |
| `sharing.test.ts` | Over PGlite: Everyone set to read on a Tile, then to none below it, then back to inherit, each read back with where it comes from and seen by a stranger; the whole System opened from its star, its Version unmoved; a stranger, a reader and the owner without a Session refused, nothing changed; a shipped Tile, a Reference and an id the System holds none of refused |

## Rules

- **No Operation.** Setting a Grant is neither proposed nor undone, makes no event, so no timeline tells of it, and leaves the System's Version where it was: the owner's own read of the System shows nothing of it, and a visitor, who polls no Version, reads the System again when their tab regains focus.
- **Under the System's lock.** A Grant is written with the System's star locked, as a change is, so a move deciding who it opens a Tile to (`allowed`) reads the Grants as they stand.
- **Existing Systems stay private.** No Grant exists until the owner sets one; nothing here sets one of its own.
- **A star is found by its card, nothing more.** A search reads the Roots alone and selects their id, Title and Preview, so no Body and no Tile below a star leaves the database; a link leads to a star only through `shownTile`, so a Tile kept from the reader says nothing, not even which System holds it.
