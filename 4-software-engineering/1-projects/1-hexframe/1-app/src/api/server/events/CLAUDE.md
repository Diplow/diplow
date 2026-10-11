---
title: events
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/api/server/events
owner: diplo
preview: >-
  /assistant/events, the Turn's events, the second door of a Turn's sandbox:
  where its launcher posts each line its agent writes, opened by the Turn's Key
  alone, proven before the body is read; each line handed to Assistant, which
  decodes it by a schema and follows it. And the tests of a whole Turn on the
  fakes, its doors served over HTTP on this machine.
---
# events

The door a Turn's sandbox tells the app what its agent says through, so its answer is saved with the tab closed. The Turn's launcher posts each line of Claude Code's `stream-json` here as it comes, one request a line, then its own `hexframe_exit` once the agent exited ([[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/assistant/agent/CLAUDE|agent]]). The door's rule, shared with the model proxy, is in [[4-software-engineering/1-projects/1-hexframe/1-app/src/api/CLAUDE|api]] ("The sandbox's two doors"); the route, `front/routes/assistant/events.ts`, hands the request over whole.

| File | Holds |
|---|---|
| `events.ts` | `serveTurnEvent(request)`: the Turn's Key proven from the header alone (`bearerOnly`, `provenKey`, IAM's `turnOnly`), a request no running Turn proves answered 401 before its body is read, one whose Key could not be checked 500; then a line past a megabyte 413, its body read no further than that, or not at all when its length says so (`bodyOf`), and one cut off on the way 400; then the line handed to `turnEvent` (`../../assistant/programs.ts`), which takes the Account and the Turn from the Key, never from the line: 400 for a line no schema reads as an event, 204 once followed. `methodNotAllowed`, 405 for anything but POST |
| `testing.ts` | `doorsServed`, `/mcp`, the model proxy and this door served over HTTP on a port of this machine, as a deployment serves them, so a Turn's launcher and the fake agent reach them from the sandbox on this machine; `signedUpAt`, an Account signed up in a browser of its own whose requests reach the app at that origin, collecting what they hand to `waitUntil`; `turnStarted`, a Message sent and the Turn answering it started, its Key issued, as `sendMessage` starts one (`api/assistant/programs.ts`'s `messageAndTurn`, its Entitlement and its Tile checked), its agent left unstarted, for the tests that drive a Turn with its Key in hand, here, in `../proxy/` and in `api/assistant/` |
| `events.test.ts` | The door over PGlite, fed lines recorded as Claude Code writes them: no Key, a bad one, an Account's and an ended Turn's refused with the body unread; the agent's text kept as its Message, its step shown by the poll then dropped; its result ending the Turn and revoking its Key; a malformed line and one past the longest refused, the Turn going on; a line naming another Conversation, Turn or session followed on the Key's own; a Turn ended by its sandbox or its ceiling told in the timeline, its Key revoked |
| `turn.test.ts` | A Turn on the fakes end to end, its Account in apply (one in ask is `api/assistant/proposal/turn.test.ts`'s): a Message sent from home starts it, the fake agent in the sandbox on this machine writing a Tile through `/mcp`, labeled "Assistant", and answering, followed to its end, its prompt and settings holding no secret, its Key revoked; a Stop interrupting a slow one, the timeline saying so, and one landing before its agent started, which is stopped once it does; a lost Turn ended by its time once the next starts; one whose agent could not start ended by its sandbox; a Message opening with a link to a Tile far from the center, its Turn started in that Tile's folder, recorded there, the fake agent saying so, its prompt giving every Tile the Message links its path, a deleted one said gone; and the refusals: none at a linked Tile its System does not hold, no Turn for an Account without the Assistant, its Message kept; none at a Tile its System does not hold, nor from a Key, nor once the month's allowance is spent, nothing posted |

## Rules

- **The Turn's Key, before anything else**, as at the proxy: nothing of the request is read before its Key proved a running Turn, and an Account's Key proves nothing here.
- **The Account and the Turn come from the Key**, never from the line: a line naming another is followed on the Key's own.
- **The door answers a status, nothing more.** The launcher reads none; a refused line is lost, as a lost event is, and the Turn's end does not depend on it: a lost Turn ends by its time once the next one starts.
