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

HEX-117, [#133](https://github.com/Diplow/diplow/pull/133). The ticket asked that Help and the tutorial share what they share once, "a shipped System, by its root", so every piece that was Help's alone now takes a Root and is named for what it serves: `repositories/shipped/` (was `help/`), `domains/mapping/shipped/` (was `help/`), whose `shippedOf`, `flatShipped`, `findInShipped` and `shippedSystem` replace their Help-only twins, and `scripts/check-shipped.ts` (was `check-help.ts`). Mapping says which Systems it ships: its door names their Roots, `shippedRoots` in `entities/system.ts`, a Root's id its folder's name, and the bundle must hold a folder per Root, which the typecheck holds; the build's check walks the folder of each. So Help's ids and reads are what they were, and a change naming either System is decided on it, owned by none, which `decide` refuses as it refused Help. With the Roots in the door, which the client may import, the API has one server function by Root, `shipped`, where `help` was, and the client one hook, `useShipped(root, language)`, so a third System would be a Root and a folder. The first draft had the bundle's folder list decide the Roots, and a server function and a hand-typed name per System on the client; cubic's first local round on #133 found both. The MCP's reads take Help's ids only, as before: nothing in the project asks an agent to read the tutorial. STACK.md and cubic's domain-design brief, both frozen for this run, still name Mapping's concept folder after Help (STACK.md's `<concept>/` row, `.cubic/domain-design.md`'s "Mapping's `help/`"), two lines for the phase close.

### DEC-2 `HelpReadOnly` becomes `ShippedReadOnly`, one refusal for Help and the tutorial

HEX-117, [#133](https://github.com/Diplow/diplow/pull/133). The ticket left two ways open, an error of the tutorial's own or Help's renamed for both. `decide` refuses every change to a System no Account owns from the System alone, never from its ids, and the tutorial is such a System, so one refusal keeps that rule in one line, where an error of its own would have needed the System to say which one it is, or a second check by id before `decide`. `ShippedReadOnly` (Forbidden) replaces `HelpReadOnly` everywhere: `decide`'s types, the service, the message table and its sentence in both languages, and the MCP's write tools, whose snapshot changed by that sentence alone. Nothing stored the old tag.

### DEC-3 Home's `tutorial` param names the Tile the tutorial is on; `features/help/` becomes `features/shipped/`

HEX-117, [#133](https://github.com/Diplow/diplow/pull/133). `?tutorial=<id>|true` takes the schema of Help's param. With no widget to open, the id says where the tutorial stands, and it alone: the canvas centers that Tile, its Root for `true`, a move on the tutorial's canvas writes the Tile centered there, and the view's `center` stays the System's, empty meanwhile. The first draft let the URL's `center` win over the param and the param follow it, two fields naming one place, which cubic's first local round found. Signed in, the tutorial takes the canvas, read-only (`looking`), and Help's widget open takes it back, which the feature decides and tests (`shippedOnCanvas`); the corner reads the tutorial only while it is there, so home does not download it on every visit. Signed out, home shows Help and ignores the param, since there is no root of the user's to come back to. A Tile the chat names and `/help` give the canvas back with a view of their own, so no Tile of the tutorial stays in the System's view; the corner's way back is HEX-119's, and nothing else on the screen leaves the tutorial yet. `features/` held six folders, so the help feature became the shipped Systems', `features/shipped/`, rather than a seventh folder beside it, and its six files leave the tutorial's steps a regrouping to make.
