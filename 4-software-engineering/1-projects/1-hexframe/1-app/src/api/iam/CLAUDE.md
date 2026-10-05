---
title: iam
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/api/iam
owner: diplo
preview: >-
  IAM's side of the API layer: the server functions that sign up, in and out,
  read the Session, and issue, list and revoke the Account's Keys. The guard a page only a signed-in Account sees, and
  the ?redirect= that carries where the user was, are the front's.
---
# iam

Where the client meets [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/iam/CLAUDE|IAM]]. Like every server function, these compose the domain and run through `run`; the middleware has already put the request's Session on the context.

| File | Holds |
|---|---|
| `iam.ts` | `signUp`, `signIn`, `signOut` and `session`, the server functions, and `issueKey`, `keys` and `revokeKey`, the Account's Keys. Their schemas bound the strings; what an email, a password or a Key's name must be is IAM's to say, on the field. A Key's id is letters and digits, as Better Auth makes them |
| `iam.test.ts` | The programs through `run`, on the runtime's Better Auth over PGlite, one browser per device: signed out, sign-up and the Session its cookie proves, sign-in and sign-out on another device, every refusal as it crosses the wire; a Key issued, listed and revoked, `SessionRequired` for a request a Key proves; the schemas' bounds |

The client's side, the guard of a page only a signed-in Account sees and the way back from sign-in, is `front/client/iam/guard.ts`: [[4-software-engineering/1-projects/1-hexframe/1-app/src/front/CLAUDE|front]].

## Rules

- **A guarded page's server functions guard themselves.** Each starts with IAM's `signedIn`, or `sessionOnly` for the Session and the Keys; the page's `beforeLoad` is for the user, not for security.
- **A Key's secret crosses the wire once**, in `issueKey`'s answer. `keys` never carries it.
