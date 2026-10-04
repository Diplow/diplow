---
title: decisions, hexframe app MCP server
parent: 4-software-engineering/1-projects/1-hexframe/.run/registers/hexframe-app-mcp-server
owner: diplo
preview: >-
  The choices the autonomous run made while building hexframe's MCP server,
  where a ticket left room: how a request's two proofs reach a program, what
  takes a Session, which of the api-key plugin's options it uses and which it
  leaves, the apikey table's key to its user, and the Key server functions
  that wait for their page.
---
# Decisions

### DEC-1 A Session and a Key reach a program through two slots, and a server function's Key slot is always empty

HEX-43. The ticket had one `proven` answer from a Session or a Key. Since it was written, `api/CLAUDE.md` and IAM's `CLAUDE.md` settled that a Key opens `/mcp` only and that the two proofs keep two types. So `proven` still answers the Session a cookie proves, and `keyProven` answers the Key an `Authorization: Bearer` header proves. Each has its own slot on the request: `CurrentSession` and `CurrentKey` in IAM, `session` and `key` on `StartContext`. The server function middleware never reads the header and fills the Key slot with `noKey`, so a Key sent to a server function proves nothing. `/mcp` (HEX-47) will fill the Key slot and leave the Session slot empty. `signedIn` takes either proof and answers `{ account, by }`, so Mapping's programs run unchanged for a Key.

### DEC-2 Every Key operation takes a Session, listing included, and so does the `session` server function

HEX-43. `sessionOnly` answers the Session, `SessionRequired` (Forbidden) when only a Key proves the request, and `SignedOut` when nothing does. `issueKey`, `keys` and `revokeKey` all start from it. The ticket named issuing and revoking. Listing is managing Keys too, and a leaked Key has no use for its siblings' names. The `session` server function, which a guarded page reads, runs `sessionOnly`, since it answers a Session and a server function never holds a Key.

### DEC-3 The api-key plugin runs without `deferUpdates` and without `customAPIKeyGetter`

HEX-43. The ticket asked for both. In `@better-auth/api-key` 1.7.7, with database storage, `deferUpdates` does not defer the last use: `claimUsageInDatabase` writes `lastRequest` before `verifyApiKey` answers whatever the option says. The option only moves the expired-key sweep to `runInBackground`, and that needs `advanced.backgroundTasks.handler`, which the app doesn't set. `customAPIKeyGetter` is read only by the session hook that `enableSessionForAPIKeys` turns on, and that option stays off. So the auth repository reads the `Authorization: Bearer` header itself (`bearerOf`) and hands the secret to `verifyApiKey`. Setting either option would configure nothing.

### DEC-4 The `apikey` table has a key to `user`, and its hash column is unique

HEX-43. The plugin's schema gives `reference_id` no foreign key. Here it references `user.id` with `ON DELETE CASCADE`: once deleting an Account exists, its Keys go with it, and none is left to prove an Account that no longer exists. That would make Mapping add a Root for it. The hash in `key` gets a unique index rather than the plugin's plain one, since a hash identifies one Key.

### DEC-5 The three Key server functions carry knip's `@public` tag until the Keys page calls them

HEX-43. `issueKey`, `keys` and `revokeKey` in `api/iam/iam.ts` have no caller in the app until the Keys page (HEX-44), so knip reports them as unused exports and `check` fails. Each carries `@public` with that reason in its doc comment. The tag skips one export and leaves knip's settings as they were. HEX-44 removes the three tags once the page imports the functions.
