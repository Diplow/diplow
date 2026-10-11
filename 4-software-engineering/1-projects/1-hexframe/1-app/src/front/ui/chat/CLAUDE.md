---
title: chat
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/chat
owner: diplo
preview: >-
  The Chat's side of the design system, where the user and the agent act on
  the Conversation: its components, and the atoms and layouts only it uses.
  For now one atom, Suggestions, over the composer's field. Never imports the
  Canvas.
---
# chat

The Chat, the side of hexframe's screen that shows the Conversation, where the user and the agent act ([[4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/CLAUDE|ui]], "hexframe's screen, in words"). Its components come as the proposals for the chat land (HEX-98, HEX-99, HEX-100); until then the Conversation is drawn by `features/conversation/` from the shared pieces, and the one piece only the chat uses lives here. The Chat never imports the Canvas (dependency-cruiser, `no-side-importing-the-other`): a piece both use moves to `ui/atoms/` or `ui/layouts/`.

| Path | Holds |
|---|---|
| `atoms/` | `Suggestions.tsx`, `Suggestions`, a list over the field it suggests for, which keeps the focus and the keys, a click in the field never closing it (`field.ts`, `inField`, tested), the field named a combobox controlling it by `suggestionsField`, the active suggestion kept in view, a click picking one; the composer's `@` search shows the Tiles in it. `gallery.tsx`, `ChatAtomsGallery`, on `/design-system` |
