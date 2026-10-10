---
title: decisions, hexframe app Assistant
parent: 4-software-engineering/1-projects/1-hexframe/.run/registers/hexframe-app-assistant
owner: diplo
preview: >-
  The choices the autonomous run made while putting the Assistant beside the
  canvas, where a ticket left room: how api/, front/routes/ and the
  conversation feature regrouped to make room for it under the rule of 6,
  and why a pending System write is read once per state of its mutation.
---
# Decisions

### DEC-1 Three folders regroup before the Assistant lands: `api/report/`, `routes/(access)/`, and conversation's `timeline/` and `entry/`

HEX-74, [#84](https://github.com/Diplow/diplow/pull/84). Three folders the Assistant adds to were full (MR-8): `api/` held six folders, `front/routes/` six files, `front/features/conversation/` six files. Each regroup is a move, no behavior changes.

- **`api/report/`** holds `errors/` and `observability/`, each its own subfolder, observability keeping its `CLAUDE.md`. They are the two folders of `api/` that belong to no domain and no door: what the layer tells of a call, to the user (a failure's wire form, its channel, its message) and to us (what is logged, what reaches Sentry and PostHog). `report` names that. `dev/` stays at the root, as DEC-11 of `hexframe-app-mcp-server/decisions.md` left it: it holds server functions, where `report/` holds none. `api/` now holds five folders, a place left for `assistant/`. Imports through `#/api/report/…`; dependency-cruiser and knip name neither folder.
- **`front/routes/(access)/`** holds `sign-in.tsx` and `sign-up.tsx`, a pathless group: TanStack Router leaves a `(name)` folder out of the path, so the URLs stay `/sign-in` and `/sign-up`, and `/fr/sign-in` and `/fr/sign-up` through the router's locale rewrite. The route ids become `/(access)/sign-in` and `/(access)/sign-up`; every link goes `to` the path, which did not change. `routes/` now holds four files and three folders, a place left for `assistant/`.
- **`front/features/conversation/`** splits by what each file holds: `timeline/`, the timeline's model and its test, pure; `entry/`, the Entry's views, `Entry.tsx` and `TileCard.tsx`. `Conversation.tsx`, the feature's face, and `fixtures.ts`, what `/dev/system` lays out, stay at the root, which now holds two files and two folders, room for the composer, the Proposal and the Turn views.

### DEC-2 A pending System write is read once per state of its mutation

HEX-74, [#84](https://github.com/Diplow/diplow/pull/84). The unit gate's `test` already failed on `project/assistant` before any move, one run in two, and in every run of the gates on this branch: two of `useRefusalState.test.ts`'s cases took about 2 s each alone and passed their 5 s timeout under a full run's load. A CPU profile showed renders feeding each other. `useSystem`'s `useMutationState` selected `pendingOf`, which decoded each pending write's Operation again at every MutationCache notification. A decoded Operation is a new object `replaceEqualDeep` cannot compare, so every notification rendered the page again, and each render's `useMutation` effects called `setOptions`, which notified again. `pendingOf` now keeps what it read in a `WeakMap` keyed by the mutation's state, which TanStack Query replaces at each change, so a write is read again only when it changed. The cases now take about 160 ms. No behavior changes: the same values, read once. Raising the test's timeout was the other way, refused because it hides the render loop instead of ending it.
