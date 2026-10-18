---
title: undo
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/domains/assistant/undo
owner: diplo
preview: >-
  What the Assistant applied, kept with what undoes it and undone once: a
  write of a Turn in apply run in the one order it holds in, and an undo,
  which the API layer calls, each taking the Conversation's lock first.
---
# undo

A sub-model of [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/assistant/CLAUDE|Assistant]]: what was applied to the user's System by another than themselves, the Assistant's applied Turn's writes or accepted Proposal's, and a write someone else made there (HEX-132), kept with what undoes it, opaque, and undone once. `undo.ts` runs it, called by the API layer as directly as the service, as Mapping's `landing/` is, over the Applied repository (`src/repositories/database/conversations/applied.ts`) and the service's lock, Turns and Entries (`../assistant.ts`). Its rules are pure and live in `../entities/applied/undo.ts` (`offeredNow`, `undoing`, `undoneEntry`). An accepted Proposal's undo is kept by the service's `acceptProposal`, beside the Decider's other Operations, and a Turn's Undo offered by its `endTurn`, the Turn's end it belongs to (`hexframe-app-assistant/decisions.md#DEC-16`, `#DEC-17`).

| File | Holds |
|---|---|
| `undo.ts` | `writtenBySomeone(accountId, actor, run)`, a write someone else made in the Account's System, in the one order it holds in: the Conversation locked, then `run`, which runs it and answers what undoes it and the change it made (`Written`), then that change recorded by who acted, `undone: false`, what undoes it kept by the Entry's id, nothing recorded for a write that changed nothing. `applyInTurn(accountId, turnId, run)`, a write of a Turn in apply in the one order it holds in: the Conversation locked, what undoes the Turn's writes so far read, its row locked, then the Turn read, `TurnOver` once it ended, `run` never run (`writingTurn`), else `run` given it, which runs the write on the System and answers what undoes them all and the changes it made (`Applying`, Mapping's, in the API layer), kept with the Turn, its changes added to theirs. `writtenInTurnElsewhere({ accountId, turnId, owner }, run)`, a write of a Turn in apply in someone else's System, the one it started in (HEX-134): both Conversations locked, the Account's and the owner's, in the order of their ids (the service's `lockConversations`), then the Turn read, `TurnOver` once it ended, `run` never run, else `run`, which runs the write there as someone else's, told to its owner with its Undo (`writtenBySomeone`, through the API layer's `someone/`); nothing kept with the Turn, whose own System it never changed. `undo(accountId, id)`, what a Turn or an accepted Proposal applied, or someone else's write, by its id, its Entry's for a write, marked undone once `undoing` allows it, its Entry saying so (`undoneEntry`), answering what undoes it for the API layer to run in the same transaction; `NothingToUndo` otherwise |

Tested over PGlite in `../proposals.test.ts`, and with Mapping in `api/assistant/proposal/undo.test.ts` and `api/assistant/someone/someone.test.ts`.

## Rules

- **The Conversation's lock first.** Each takes it before anything else, as a Turn's end takes it to offer the Undo and a draft to keep its write, so a write lands before the offer or finds the Turn over, and two writes of one Turn never both build on what undoes them. A write that takes two, a Turn's in someone else's System, takes them in the order of their Accounts' ids, so two such writes, each in the other's System, never wait on each other.
- **A protocol is one function.** The API layer hands Mapping's step as `run`; it never reads, runs and keeps in three calls of its own, so no caller can run a write without keeping what undoes it, or keep it for a Turn that ended.
- **What undoes a write is opaque here.** Mapping's `Undo`, encoded by the API layer, kept as it came and given back as it was kept.
