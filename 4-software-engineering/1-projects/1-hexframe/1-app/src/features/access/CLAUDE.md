---
title: access
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/features/access
owner: diplo
preview: >-
  The sign-in and sign-up pages' content: one form for both, an email and a
  password, whose refusals show on their fields, then back where the user was.
---
# access

What `/sign-in` and `/sign-up` show. The two differ only in their words, the server function they call, the password's autocomplete, and the password rule sign-up shows under its field (between 8 and 128 characters, which IAM enforces), so `Access` takes a `mode` and a table holds each mode's settings. The routes pass it `redirect`, read by `readSignInSearch` in [[4-software-engineering/1-projects/1-hexframe/1-app/src/api/domains/iam/CLAUDE|api/domains/iam]].

| File | Holds |
|---|---|
| `Access.tsx` | `Access`, the page header, the form (`useAppForm` with `submitWrite`, so an Invalid refusal lands on its field and anything else goes to its channel) and the link to the other mode, carrying `redirect` |

## Rules

- **The form handles no error itself.** IAM names the field at fault, the message table words it, `submitWrite` puts it there.
- **Once signed in, the way back is a full load** (`continueTo`), so the next page renders on the server with its Session.
