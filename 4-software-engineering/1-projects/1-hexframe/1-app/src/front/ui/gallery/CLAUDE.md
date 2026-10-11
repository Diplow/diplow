---
title: gallery
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/gallery
owner: diplo
preview: >-
  /design-system's frame, outside the tiers: a section per tier and per piece,
  each piece's note, "made of" read from its files' imports and "used in" read
  back, then every token read from styles.css under what it is for. How a
  piece gets its section.
---
# gallery

This folder is the frame of `/design-system` ("The page", below): every folder's `gallery.tsx` draws its pieces in it, and it imports none of them, nor any tier, so dependency-cruiser's tiers leave it out and any tier's gallery may import it.

| File | Holds |
|---|---|
| `frame.tsx` | `GalleryTier`, a tier's section, its title and what it holds, shown once a piece fills it, which tells its pieces the tier they are drawn under; `GallerySection`, a piece's, with its note, "made of" and "used in" as links within the page, which throws when drawn under another tier than the catalogue's; `GalleryState`, one labelled specimen |
| `pieces.ts` | The catalogue, every piece the page shows, in the page's order: its name, its tier, the files it is drawn in (from `src/front/`), what it is made of and its note, a message; `usedIn`, read back from "made of"; `filled`, whether a tier has a piece |
| `pieces.test.ts` | Each piece's files exist, its "made of" is what they import of the other pieces, through the files that are no piece of their own, pieces sharing a file sharing its imports between them, and the catalogue runs tier by tier, top-down |
| `stylesheet.ts` | Every token read from `styles.css`: `colorTokens`, the colours of `@theme inline`, each foreground folded into its token; `valueTokens`, the fonts, the sizes, the radius scale, the easings and the animations beside them, and the durations the base layer declares |
| `Tokens.tsx` | The page's tokens, each under the note that says what it is for (`colourNotes`, `valueNotes`), then phone and touch, and the light. The notes moved in from `3-design-system/TOKENS.md`, and win over it until HEX-112 retires that folder |
| `tokens.test.ts` | Every colour has a value in both themes and a line in `@theme inline`, and every token one note, no more |

## The page

`/design-system` (`src/front/routes/design-system.tsx`) shows the design system to anyone, in production too, read top-down: a short statement of the direction, then a section per tier, the crossings, the Chat, the Canvas, the layouts and the atoms the sides share, the seams, each side's components before its layouts and its atoms, then every token. A tier no piece fills yet stays hidden: the crossings, until the first is built. Each piece says what it is for, what it is made of and where it is used, as links within the page, then shows its states. Every string is a message, in English and in French; a note says what a piece is for and why, and an open question stays in its ticket or its pull request.

A piece gets its section in three steps:

1. **An entry in `pieces.ts`**, in its tier's place: its name, its tier, the files it is drawn in and its note, a message. Its "made of" is what those files import of the other pieces, through the files that are no piece of their own; `pieces.test.ts` reads it from the imports and fails until the entry says the same. Pieces drawn in one file (`layouts/states.tsx`) share its imports: each names those it draws, and together they name them all. "Used in" is read back from it.
2. **A `GallerySection` named after it**, in its folder's `gallery.tsx`, one `GalleryState` per state, on samples that are messages. A feature's piece has its own `gallery.tsx` (`features/conversation/`, `features/breadcrumb/`), and so do the client's channels (`client/gallery.tsx`), since `ui/` imports neither.
3. **The route shows that gallery under its tier**, in the catalogue's order. The route holds the canvas's view in its search params and hands it to the specimens that show it, so a fixture view is a link and a Message's link in the Conversation centers it. The canvas's own specimen sits in the route, since `canvas/` holds its six files already. `GallerySection` throws when drawn under another tier than the catalogue's.

The canvas and the Conversation run on fixtures (`canvas/fixtures.ts`, `features/conversation/fixtures.ts`), the user's own words, not translated. The chat's pieces run on samples that are messages (`chat/samples.ts`), so they read in the page's language. The channels show on domains' refusals and an `Unexpected`, with no call made.
