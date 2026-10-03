---
title: iam
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/api/iam
owner: diplo
preview: >-
  IAM's side of the API layer: the server functions that sign up, in and out
  and read the Session. The guard a page only a signed-in Account sees, and
  the ?redirect= that carries where the user was, are the front's.
---
# iam

Where the client meets [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/iam/CLAUDE|IAM]]. Like every server function, these compose the domain and run through `run`; the middleware has already put the request's Session on the context.

| File | Holds |
|---|---|
| `iam.ts` | `signUp`, `signIn`, `signOut` and `session`, the server functions. Their schemas bound the strings; what an email or a password must be is IAM's to say, on the field |

The client's side, the guard of a page only a signed-in Account sees and the way back from sign-in, is `front/client/iam/guard.ts`: [[4-software-engineering/1-projects/1-hexframe/1-app/src/front/CLAUDE|front]].

## Rules

- **A guarded page's server functions guard themselves.** Each starts with IAM's `signedIn`; the page's `beforeLoad` is for the user, not for security.
