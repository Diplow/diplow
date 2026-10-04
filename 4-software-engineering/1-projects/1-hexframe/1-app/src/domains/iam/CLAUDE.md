---
title: iam
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/domains/iam
owner: diplo
preview: >-
  IAM, identity and access: who someone is (an Account, known by its email) and
  the proof they are here (a Session, on one device, for a while). Built on
  Better Auth, which sits below it as a repository. Key and Entitlement come
  later.
---
# iam

Identity and access: who someone is, and what they may do. Someone signs up with an email and a password and becomes an **Account**; each time they sign in, on a device, they hold a **Session** there until it expires or they sign out. Everything else in hexframe asks IAM one question first: is this request signed in, and as whom? A page or a server function that only a signed-in Account may reach starts from `signedIn`, which answers the proven Account (by a Session, or by a Key once Keys exist) or fails `SignedOut`, and the client sends that to sign-in and back. Managing Keys and changing the Account itself start from IAM's Session-only check instead, never from a branch in the API layer.

The language, as [[4-software-engineering/1-projects/1-hexframe/STACK|STACK]] first told it:

- **Account**: someone known to hexframe. Its name is not IAM's to decide: the user is their Root tile in Mapping, and the name Better Auth keeps for emails is copied from that Tile's Title, never the other way. Until Mapping does, it is empty.
- **Session**: an Account's proven presence, for a while, on one device.
- **Key**: a credential an Account issues to a program (an MCP client, a script) and can revoke. It carries a name the Account gives it, acts with the Account's full power over its System, and never expires; its secret is shown once, at its creation, and never again. Revoking it removes it. Limiting a Key to one Tile or to reading comes with sharing, and OAuth clients come beside Keys later, without replacing them.
- **Signed in**: a request whose Account is proven, by a Session or by a Key. Working on the System asks only that, never which proof it was. Managing Keys and changing the Account itself (email, password, billing) take a Session, so a leaked Key cannot keep itself alive.
- **Entitlement**: something an Account may do. It is derived, when asked, from what the Account pays for, so it never drifts from Stripe.

Better Auth and its Stripe plugin are repositories below IAM ([[4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/auth/CLAUDE|auth]]); the plugin will own the subscription tables and the Stripe webhook. No domain says "billing". AI usage is what a paid Entitlement buys; the structure itself stays free.

| File | Holds |
|---|---|
| `iam.ts` | `Account`, `Session`, `CurrentSession` (the request's Session, which the API layer's middleware resolves once per request), and the operations: `signUp`, `signIn`, `signOut`, `proven` (the Session a request's cookie proves) and `signedIn` |
| `errors.ts` | IAM's errors, each with its kind: `SignedOut` (Unauthenticated); `CredentialsRejected`, `EmailTaken`, `EmailMalformed` and `PasswordLengthInvalid` (Invalid, each on the field at fault; `CredentialsRejected` on `password`, whichever was wrong: see the Rules); `TooManyAttempts` (Forbidden) |
| `iam.test.ts` | IAM on Better Auth for real, over PGlite: sign-up, sign-in on another device, refusals, too many attempts, sign-out |

## Rules

- **A refusal names its field, never the server's sentence.** Better Auth's refusals become IAM's errors here, each on the form field the user can fix; the message table words them. A wrong password and an unknown email are the same `CredentialsRejected`, on the `password` field in both cases, so sign-in never says which Accounts exist.
- **The Session comes from the request, not the input.** A server function acting for an Account takes it from `signedIn`, never an id the caller sends.
- **Email and password only, for now.** Another way in (a social provider, a magic link) is a decision, and the first to need a callback URL will register it on each host Better Auth answers on ([[4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/auth/CLAUDE|auth]]).
