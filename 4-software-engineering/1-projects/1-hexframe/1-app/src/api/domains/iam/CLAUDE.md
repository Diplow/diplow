---
title: iam
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/api/domains/iam
owner: diplo
preview: >-
  IAM's side of the API layer: the server functions that sign up, in and out
  and read the Session, and the guard a page only a signed-in Account sees,
  with the ?redirect= that carries where the user was to sign-in and back.
---
# iam

Where the client meets [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/iam/CLAUDE|IAM]]. Like every server function, these compose the domain and run through `run`; the middleware has already put the request's Session on the context.

| File | Holds |
|---|---|
| `iam.ts` | `signUp`, `signIn`, `signOut` and `session`, the server functions. Their schemas bound the strings; what an email or a password must be is IAM's to say, on the field |
| `guard.ts` | `signedIn`, a route's `beforeLoad` for a page only a signed-in Account sees; `readSignInSearch`, sign-in's and sign-up's `validateSearch`; `continueTo`, the way back once signed in |
| `guard.test.ts` | The guard's redirect, and every `redirect` that must not leave the site |

## Rules

- **A guarded page guards itself before it renders**, on the server too: `beforeLoad: signedIn`. The server function behind it still starts with IAM's `signedIn`; the page's guard is for the user, not for security.
- **`redirect` is a path on this site, without its language prefix.** The guard and the client's Unauthenticated channel (`../../client/channels.ts`) write it that way; sign-in drops anything else, and `continueTo` checks it again against the page's origin before it goes there.
