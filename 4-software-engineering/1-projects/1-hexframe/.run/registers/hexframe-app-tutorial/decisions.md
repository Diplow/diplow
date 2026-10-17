---
title: decisions, hexframe app Tutorial
parent: 4-software-engineering/1-projects/1-hexframe/.run/registers/hexframe-app-tutorial
owner: diplo
preview: >-
  The choices the autonomous run made while building the tutorial, where a
  ticket left room: how Help's code became the code of the Systems hexframe
  ships, each by its Root, the refusal Help and the tutorial share, and what
  home's tutorial param means.
---
# Decisions

### DEC-1 Help's code becomes the shipped Systems', each by its Root: the repository, Mapping's concept folder and the build's check

HEX-117. The ticket asked that Help and the tutorial share what they share once, "a shipped System, by its root", so every piece that was Help's alone now takes a Root and is named for what it serves: `repositories/shipped/` (was `help/`), `domains/mapping/shipped/` (was `help/`), whose `shippedOf`, `flatShipped`, `findInShipped` and `shippedSystem` replace their Help-only twins, and `scripts/check-shipped.ts` (was `check-help.ts`), which checks every folder in `shippedFolders`. A Root's id is its folder's name, `help` and `tutorial`, so Help's ids and reads are what they were, and a change naming either is decided on that System, owned by none, which `decide` refuses as it refused Help. The API keeps a server function per System, `help` and the new `tutorial`, over one program that takes the Root, since a function taking the Root would need the list of Roots in `api/mapping/mapping.ts`, which the client imports. The MCP's reads take Help's ids only, as before: nothing in the project asks an agent to read the tutorial. STACK.md, frozen for this run, still names "Mapping's Help" in its `<concept>/` row, a line for the phase close.

### DEC-2 `HelpReadOnly` becomes `ShippedReadOnly`, one refusal for Help and the tutorial

HEX-117. The ticket left two ways open, an error of the tutorial's own or Help's renamed for both. `decide` refuses every change to a System no Account owns from the System alone, never from its ids, and the tutorial is such a System, so one refusal keeps that rule in one line, where an error of its own would have needed the System to say which one it is, or a second check by id before `decide`. `ShippedReadOnly` (Forbidden) replaces `HelpReadOnly` everywhere: `decide`'s types, the service, the message table and its sentence in both languages, and the MCP's write tools, whose snapshot changed by that sentence alone. Nothing stored the old tag.

### DEC-3 Home's `tutorial` param names the Tile the tutorial is on; `features/help/` becomes `features/shipped/`

HEX-117. `?tutorial=<id>|true` takes the schema of Help's param. With no widget to open, the id says where the tutorial stands: the canvas centers that Tile when the URL names no center, and the param follows the Tile centered, as the help widget's page follows Help's canvas. Signed in, the tutorial takes the canvas, read-only (`looking`), and Help's widget open takes it back; signed out, home shows Help and ignores the param, since there is no root of the user's to come back to. A Tile the chat names and `/help` give the canvas back with a view of their own, so no Tile of the tutorial stays in the System's view; the corner's way back is HEX-119's, and nothing else on the screen leaves the tutorial yet. `features/` held six folders, so the help feature became the shipped Systems', `features/shipped/`, rather than a seventh folder beside it, and its six files leave the tutorial's steps a regrouping to make.
