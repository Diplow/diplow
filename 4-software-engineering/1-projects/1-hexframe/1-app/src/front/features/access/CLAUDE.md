---
title: access
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/front/features/access
owner: diplo
preview: >-
  Home signed out, in the chat: the agent's two lines, and the sign-in widget
  in the composer's place, signing in or up with an email and a password,
  whose refusals show on their fields, then back where the user was.
---
# access

What home's chat shows signed out (HEX-103): Help is on the canvas, and the chat says so in the agent's voice, then asks who you are where you would write. The sign-in widget is ui's (`SignInWidget`, [[4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/chat/widgets/CLAUDE|widgets]]); this feature gives it IAM's calls and the way back, `redirect`, read by `readSignInSearch` in `front/client/iam/guard.ts` ([[4-software-engineering/1-projects/1-hexframe/1-app/src/front/CLAUDE|front]]).

| File | Holds |
|---|---|
| `SignedOut.tsx` | `SignedOutLines`, the agent's two lines, and `SignInFoot`, the sign-in widget over `state/useSignInState.ts` |
| `search.ts` | `access`, home's search param for signing up, signing in when absent, so an old link to `/sign-up` opens on it; `accessOf` and `withAccess`; `wayBack`, where signing in goes back to, `redirect` or home with its open widgets. Pure and tested |

| Folder | Holds |
|---|---|
| `state/` | `useSignInState`, the email and the password typed, the refusal on each, gone as that field changes, and the submit, the client's `accessSubmit` (`front/client/iam/access.ts`), one try for two quick presses; `refusedOf`, a submit's refusals on the widget's fields. Tested over stand-ins for IAM's server functions |

## Rules

- **The widget handles no error itself.** IAM names the field at fault, the message table words it, `accessSubmit` hands it to the state hook; a refusal on no field goes to its channel, the toast (`hexframe-app-design-system-v1/decisions.md#DEC-42`).
- **Once signed in, the way back is a full load** (`continueTo`), so the next page renders with its Session: to `redirect`, or to the screen as it stood, its open widgets kept (`#DEC-41`).
- **A password is kept out of every cache**: the submit is `submitWrite`'s, never a mutation.
