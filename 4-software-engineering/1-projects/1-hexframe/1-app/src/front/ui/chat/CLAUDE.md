---
title: chat
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/chat
owner: diplo
preview: >-
  The Chat's side of the design system, where the user and the agent act on
  the Conversation: its components, and the atoms and layouts only it uses:
  the widget's frame, and Suggestions over the composer's field. Never imports
  the Canvas.
---
# chat

The Chat, the side of hexframe's screen that shows the Conversation, where the user and the agent act ([[4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/CLAUDE|ui]], "hexframe's screen, in words"). Its components come as the proposals for the chat land (HEX-98, HEX-99, HEX-100); until then the Conversation is drawn by `features/conversation/` from the shared pieces, and the pieces only the chat uses live here. The Chat never imports the Canvas (dependency-cruiser, `no-side-importing-the-other`): a piece both use moves to `ui/atoms/` or `ui/layouts/`.

| Path | Holds |
|---|---|
| `layouts/` | `Widget.tsx`, `Widget`, the frame of everything the conversation asks of the user or shows beyond words, a zone tinted by its `voice` (the agent's, the human's, the app's): its hex and line icon, a kicker, a title, a subtitle, a body, its actions (`Act`, the first in the voice), and its tools on hover or focus, settings (`Menu`), fold (Radix's Collapsible) and dismiss. Its `state`: `waiting`, `working` (the hex breathes, light runs over the lines to come, `aria-busy`), `done` (one line, its receipt, with an undo), `failed` (the voice turns destructive). Folded or open is the user's. It comes in drawing its line, unfolding and raising its parts in turn, simply there under reduced motion. Below `sm` its hex shrinks; under a finger its tools fold into the one menu. `gallery.tsx`, `ChatLayoutsGallery`, on `/design-system` |
| `atoms/` | `Suggestions.tsx`, `Suggestions`, a list over the field it suggests for, which keeps the focus and the keys, a click in the field never closing it (`field.ts`, `inField`, tested), the field named a combobox controlling it by `suggestionsField`, the active suggestion kept in view, a click picking one; the composer's `@` search shows the Tiles in it. `gallery.tsx`, `ChatAtomsGallery`, on `/design-system` |
