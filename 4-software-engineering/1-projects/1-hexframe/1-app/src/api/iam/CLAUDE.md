---
title: iam
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/api/iam
owner: diplo
preview: >-
  IAM's side of the API layer: the server functions that sign up and in,
  read the Session, issue, list and revoke the Account's Keys, and make an
  Organization with its System and manage its members. Home's read of the Session, and
  the ?redirect= that carries where the user was, are the front's.
---
# iam

Where the client meets [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/iam/CLAUDE|IAM]]. Like every server function, these compose the domain and run through `run`; the middleware has already put the request's Session on the context.

| File | Holds |
|---|---|
| `iam.ts` | `signUp`, `signIn`, `signOut`, which the composer's `/logout` runs, and `session`, the server functions, and `issueKey`, `keys` and `revokeKey`, the Account's Keys. Their schemas bound the strings; what an email, a password or a Key's name must be is IAM's to say, on the field. A Key's id is letters and digits, as Better Auth makes them |
| `organizations/` | Organizations (HEX-136). `organizations.ts`, the server functions and their schemas: `createOrganization`, its name bounded as a Title is, answering its star; `roleIn`, the Account's role in the Organization a star names, none for any other star, which offers the star's Members widget; `members`, each by their star's card, their role and whether it is the reader, for its members; `addMember`, `setMemberRole` and `removeMember`, each naming the Organization and the member by their stars, never an id of IAM's. `programs.ts`, the programs: each starts from IAM's `sessionOnly`, finds the Organization a star names (Mapping's `ownerOf`, then IAM's `isOrganization`, `OrganizationNotFound` otherwise, a member and a stranger alike) and the Account a member's star names, then IAM decides, in one transaction; a creation makes the Organization in IAM and its star in Mapping (`starNamed`) in one. `organizations.test.ts`, through `run` over PGlite, Accounts signed up there: made with its star, its admin owning its System and sharing it, its writes told in no Conversation of its own, a stranger shown its card alone, a member reading and writing what a Grant to its Members, named by its star, lets them, an admin demoted or a member removed holding from the next request, the members listed by their stars, the last admin kept, a Key refused |
| `iam.test.ts` | The programs through `run`, on the runtime's Better Auth over PGlite, one browser per device: signed out, sign-up and the Session its cookie proves, sign-in and sign-out on another device, every refusal as it crosses the wire; a Key issued, listed and revoked, `SessionRequired` for a request a Key proves; the schemas' bounds |

The client's side, home's read of the Session, which shows a signed-out visit the screen signed out, and the way back once signed in, is `front/client/iam/guard.ts`: [[4-software-engineering/1-projects/1-hexframe/1-app/src/front/CLAUDE|front]].

## Rules

- **A guarded page's server functions guard themselves.** Each starts with IAM's `signedIn`, or `sessionOnly` for the Session and the Keys; the page's `beforeLoad` is for the user, not for security.
- **A Key's secret crosses the wire once**, in `issueKey`'s answer. `keys` never carries it.
