---
title: keys
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/front/features/keys
owner: diplo
preview: >-
  The Account's Keys in the chat, on ui's key widget: the Keys given, each
  revoked after a confirmation; a new one named, then its secret, shown once,
  beside the command that adds hexframe to Claude Code; then its receipt.
  Open while the URL says so, its step the page's.
---
# keys

What home's chat shows of the Account's Keys (HEX-103), on ui's `KeyWidget` ([[4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/chat/widgets/CLAUDE|widgets]]). A Key is IAM's: a credential the Account issues to a program, such as Claude Code, which proves the Account at `/mcp` ([[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/iam/CLAUDE|iam]]). The calls go through `front/client/iam/keys.ts` ([[4-software-engineering/1-projects/1-hexframe/1-app/src/front/CLAUDE|front]]).

- **The Keys**: by name, how each secret starts, the day it was made and when it was last used, lit while used within the hour; each revoked after the `Dialog`.
- **A new Key**: its name, then its secret and the `claude mcp add` command that holds it, each copied from its corner. The command names the hexframe the page was served from, its origin read in the browser when the answer arrives.
- **Done**: the secret forgotten, a receipt naming the Key in its place.

| File | Holds |
|---|---|
| `KeyWidgets.tsx` | `KeyWidgets`, the widget at the conversation's foot, its every step the one `KeyWidget`, so its hand-off moves the focus |
| `search.ts` | `keys`, home's search param, the widget open; `withKeys`. Pure and tested |
| `open.ts` | `useOpenKeys`, `/keys`: the widget opened on home through the router, the rest of its search params kept, the chat brought to the front on a phone; out of home's route, which stood at its 600 lines (`hexframe-app-sharing-organizations/decisions.md#DEC-13`) |

| Folder | Holds |
|---|---|
| `shown/` | What the widget shows of a Key: `rows.ts`, `rowOf`, a Key as its row words it; `command.ts`, `mcpCommand`, the command that adds hexframe's MCP server to Claude Code with a Key. Pure, each tested beside it. The name's limit is IAM's, read at its door (`keyNameBounds`) |
| `state/` | `useKeyWidgetState`, the step, the new Key's name and its refusal, and what each action does; `stepOnOpen`, the step the URL opening or closing the widget leaves. Tested over a stand-in for issuing |

## Rules

- **The secret is shown once and kept nowhere.** It reaches the page in issuing's answer only, through `submitWrite`, a form's submit no cache holds, where every other form's write is a mutation; it lives in the state hook alone, so Done, or the widget closed any other way, forgets it (`hexframe-app-design-system-v1/decisions.md#DEC-42`).
- **A refusal takes its channel**: a name IAM refuses (`KeyNameInvalid`) shows under the field; a revoke of a Key already gone (`KeyNotFound`) in a toast.
- **Whether it is open is the URL's, the step the page's**, held by home so the receipt outlives the widget.
