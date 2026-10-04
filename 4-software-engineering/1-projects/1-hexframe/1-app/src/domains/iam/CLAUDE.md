---
title: iam
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/domains/iam
owner: diplo
preview: >-
  IAM, identity and access: who someone is (an Account, known by its email) and
  the two proofs a request gives of it: a Session, on one device, for a while,
  or a Key, issued to a program. Built on Better Auth and its api-key plugin,
  which sit below it as a repository. Entitlement comes later.
---
# iam

Identity and access: who someone is, and what they may do. Someone signs up with an email and a password and becomes an **Account**; each time they sign in, on a device, they hold a **Session** there until it expires or they sign out. Everything else in hexframe asks IAM one question first: is this request signed in, and as whom? A page or a server function that only a signed-in Account may reach starts from `signedIn`, which answers the proven Account or fails `SignedOut`: a server function's from the Session its cookie proves, an MCP call's from its Key, `/mcp` being the one door a Key opens ([[4-software-engineering/1-projects/1-hexframe/1-app/src/api/CLAUDE|api]]). The client sends a `SignedOut` to sign-in and back. Managing Keys and changing the Account itself start from IAM's Session-only check instead, never from a branch in the API layer.

The language, as [[4-software-engineering/1-projects/1-hexframe/STACK|STACK]] first told it:

- **Account**: someone known to hexframe. Its name is not IAM's to decide: the user is their Root tile in Mapping, and the name Better Auth keeps for emails is copied from that Tile's Title, never the other way. Until Mapping does, it is empty.
- **Session**: an Account's proven presence, for a while, on one device.
- **Key**: a credential an Account issues to a program (an MCP client, a script) and can revoke. It carries a name the Account gives it, acts with the Account's full power over its System, and never expires; its secret is shown once, at its creation, and never again. Revoking it removes it. Limiting a Key to one Tile or to reading comes with sharing, and OAuth clients come beside Keys later, without replacing them.
- **Signed in**: a request whose Account is proven, by a Session or by a Key. Working on the System asks only that, never which proof it was. Managing Keys and changing the Account itself (email, password, billing) take a Session, so a leaked Key cannot keep itself alive.
- **Entitlement**: something an Account may do. It is derived, when asked, from what the Account pays for, so it never drifts from Stripe.

Better Auth and its Stripe plugin are repositories below IAM ([[4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/auth/CLAUDE|auth]]); the plugin will own the subscription tables and the Stripe webhook. No domain says "billing". AI usage is what a paid Entitlement buys; the structure itself stays free.

| File | Holds |
|---|---|
| `iam.ts` | `Account`, `Session`, `Key`, `IssuedKey` (a Key with its secret, the one time it is shown), `KeyProof` (whose Key proved a request, and which), `SignedIn` (the proven Account, and `by` which proof); `CurrentSession` and `CurrentKey`, the request's two proofs, each resolved once per request by its door; and the operations: `signUp`, `signIn`, `signOut`, `proven` (the Session a request's cookie proves), `keyProven` (the Key its `Authorization: Bearer` header proves), `signedIn`, `sessionOnly` (the Session-only check), `issueKey`, `keys` and `revokeKey` |
| `errors.ts` | IAM's errors, each with its kind: `SignedOut` (Unauthenticated); `CredentialsRejected`, `EmailTaken`, `EmailMalformed`, `PasswordLengthInvalid` and `KeyNameInvalid` (Invalid, each on the field at fault; `CredentialsRejected` on `password`, whichever was wrong: see the Rules); `TooManyAttempts` and `SessionRequired` (Forbidden); `KeyNotFound` (NotFound) |
| `iam.test.ts` | IAM on Better Auth for real, over PGlite: sign-up, sign-in on another device, refusals, too many attempts, sign-out; then `signedIn` and `sessionOnly` on each proof |
| `keys.test.ts` | An Account's Keys on Better Auth for real, over PGlite: issued with their secret once, listed without it, a Key proving its Account and its use recorded, a wrong secret or a revoked Key proving nothing, another Account's Key out of reach, a Key refused for managing Keys, a name refused |

## Rules

- **A refusal names its field, never the server's sentence.** Better Auth's refusals become IAM's errors here, each on the form field the user can fix; the message table words them. A wrong password and an unknown email are the same `CredentialsRejected`, on the `password` field in both cases, so sign-in never says which Accounts exist.
- **The Account comes from the request, not the input.** A server function acting for an Account takes it from `signedIn` (or `sessionOnly`), never an id the caller sends.
- **Two proofs, two slots.** `CurrentSession` holds what a cookie proves, `CurrentKey` what a Bearer header proves; a server function's `CurrentKey` is always none, `/mcp`'s `CurrentSession` too. `signedIn` takes either; `sessionOnly` takes the Session and answers a Key alone with `SessionRequired`, so `issueKey`, `keys` and `revokeKey` start from it, and so will any change to the Account itself.
- **A Key's secret is shown once.** `issueKey` answers it; Better Auth keeps only its hash, and `keys` lists a Key by its name, its first characters (`start`, `hf_` and three more), its creation and its last use.
- **Email and password only, for now.** Another way in (a social provider, a magic link) is a decision, and the first to need a callback URL will register it on each host Better Auth answers on ([[4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/auth/CLAUDE|auth]]).
