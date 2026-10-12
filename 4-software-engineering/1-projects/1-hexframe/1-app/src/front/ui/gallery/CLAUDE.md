---
title: gallery
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/gallery
owner: diplo
preview: >-
  /design-system's frame, outside the tiers: a section per tier and per piece,
  each piece's note, "made of" read from its files' imports, or a crossing's
  two ends, and "used in" read back, then every token read from styles.css
  under what it is for. How a piece gets its section.
---
# gallery

This folder is the frame of `/design-system` ("The page", below): every folder's `gallery.tsx` draws its pieces in it, and it imports none of them, nor any tier, so dependency-cruiser's tiers leave it out and any tier's gallery may import it.

| File | Holds |
|---|---|
| `frame.tsx` | `GalleryTier`, a tier's section, its title and what it holds, shown once a piece fills it, which tells its pieces the tier they are drawn under; `GallerySection`, a piece's, with its note, "made of", or a crossing's two ends, "in the chat" and "on the canvas", and "used in" as links within the page, which throws when drawn under another tier than the catalogue's; `GalleryGroup`, a row's heading inside a piece's section; `GalleryState`, one labelled specimen; `GalleryColumn`, the conversation's column a chat specimen stands in, or a phone's; `useSteps`, the clock a timed specimen plays by, a tile's states or a crossing's Turn, each play from its first step, drawn at once |
| `pieces.ts` | The catalogue, every piece the page shows, in the page's order: first the crossings, each with no file of its own but an end on each side, the pieces it joins in the chat and on the canvas (HEX-108); then each piece, its name, its tier, the files it is drawn in (from `src/front/`), what it is made of and its note, a message; `usedIn`, read back from "made of" and from the crossings' ends |
| `pieces.test.ts` | Each piece's files exist, its "made of" is what they import of the other pieces, through the files that are no piece of their own, pieces sharing a file sharing its imports between them, and the catalogue runs tier by tier, top-down, every tier filled; each crossing joins a piece of the Chat and a piece of the Canvas, none at the other side's end, and names at each end pieces its side's crossings draw, there or inside a piece drawn there |
| `stylesheet.ts` | Every token read from `styles.css`: `colorTokens`, the colours of `@theme inline`, each foreground folded into its token; `valueTokens`, the fonts, the sizes, the radius scale, the easings and the animations beside them, and the durations the base layer declares |
| `Tokens.tsx` | The page's tokens, each under the note that says what it is for (`colourNotes`, `valueNotes`), then phone and touch, and the light. The notes moved in from `3-design-system/TOKENS.md`, and win over it until HEX-112 retires that folder |
| `tokens.test.ts` | Every colour has a value in both themes and a line in `@theme inline`, every token one note, no more, and every colour text is set in reads at 4.5:1 at least on the ground and on a card, in both themes |

## The page

`/design-system` (`src/front/routes/design-system.tsx`) shows the design system to anyone, in production too, read top-down: a short statement of the direction, then a section per tier, the crossings, the Chat, the Canvas, the layouts and the atoms the sides share, the seams, each side's components before its layouts and its atoms, then every token. Every tier holds a piece, which `pieces.test.ts` holds it to. The crossings come first (HEX-108): each where one side answers the other, drawn with both ends side by side, the chat's on the left as the screen has it, its labels wrapping rather than pushing the canvas's end below; `ui/crossings.tsx` joins the two ends, each its side's (`chat/crossings.tsx`, `canvas/crossings.tsx`), and the route hands it what `ui/` can't reach, Mapping's limit on a Preview, how the timeline tells a navigation and where Assistant says a Turn works. Each piece says what it is for, what it is made of and where it is used, as links within the page, then shows its states. Every string is a message, in English and in French; a note says what a piece is for and why, and an open question stays in its ticket or its pull request.

A piece gets its section in three steps:

1. **An entry in `pieces.ts`**, in its tier's place: its name, its tier, the files it is drawn in and its note, a message. Its "made of" is what those files import of the other pieces, through the files that are no piece of their own; `pieces.test.ts` reads it from the imports and fails until the entry says the same. Pieces drawn in one file (`layouts/states.tsx`) share its imports: each names those it draws, and together they name them all. "Used in" is read back from it. A crossing's entry has no files but its two ends, the pieces it joins on each side, which `pieces.test.ts` holds to a piece of the Chat and a piece of the Canvas.
2. **A `GallerySection` named after it**, in its folder's `gallery.tsx`, one `GalleryState` per state, on samples that are messages. A feature's piece has its own `gallery.tsx` (`features/conversation/`, `features/breadcrumb/`), and so do the client's channels (`client/gallery.tsx`), since `ui/` imports neither.
3. **The route shows that gallery under its tier**, in the catalogue's order. The route holds the canvas's view in its search params and hands it to the specimens that show it, so a fixture view is a link and a Message's link in the Conversation centers it. The canvas's own specimen sits in the route, since `canvas/` holds its six files already, and so do the `Screen`'s, which show the breadcrumb and Help, which `ui/` can't import, each holding its own view and side in front: signed in on the fixture System, signed out on Help itself, read as home reads it signed out, the `Composer` at the chat's foot signed in, the `SignInWidget` signed out, the conversation's lines the Chat's `Message`s. A file beside the route would need a name the router skips, and a name starting with `-` is one transcrypt encrypts (`.gitattributes`). `GallerySection` throws when drawn under another tier than the catalogue's.

The canvas and the Conversation run on fixtures (`canvas/fixtures.ts`, `features/conversation/fixtures.ts`), the user's own words, not translated. The chat's pieces run on samples that are messages (`chat/samples.ts`), so they read in the page's language. The help widget's section reads Help itself, as the signed-out `Screen` does, in the route, which hands it to `HelpWidgetGallery`; the tile widget's samples are the chat's sample tiles, their words messages too (`chat/widgets/tile/fixtures.ts`). The channels show on domains' refusals and an `Unexpected`, with no call made.
