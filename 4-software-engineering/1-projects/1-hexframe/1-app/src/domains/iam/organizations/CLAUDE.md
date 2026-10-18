---
title: organizations
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/domains/iam/organizations
owner: diplo
preview: >-
  IAM's Organizations: who belongs to one, each Account an admin or a member,
  read on every request for Mapping, created and managed from a Session alone,
  an admin who joined of their own accord always kept. Its Members Group is
  its own id.
---
# organizations

A concept of IAM's (HEX-136, `hexframe-app-sharing-organizations/decisions.md#DEC-13`): an Organization owns a System of its own, and IAM says who belongs to it. The API layer calls it as directly as the service.

| File | Holds |
|---|---|
| `organizations.ts` | `belonging`, the Organizations an Account is an admin of and the Groups it is in, read on every request, never kept; `membersGroupOf`, an Organization's Members Group's id, its own; `isOrganization`; `createOrganization`, `members`, `addMember`, `setRole` and `removeMember`, each from `sessionOnly` |
| `organizations.test.ts` | Over PGlite with Better Auth's Accounts, every rule below |

## Rules

- **Who belongs where is read, never kept.** `belonging` is asked on every request and every MCP call of a Turn, so a removal or a demotion holds from the next one.
- **The Members Group's id is the Organization's own.** It needs no row and can never be deleted. Mapping names a Group by the star whose owner has its id, so an Organization's Members read as "its members" in the Share widget; a Group of HEX-137's own will have an id of its own and be named by IAM.
- **An Organization keeps an admin who joined it of their own accord.** Its maker joined; someone an admin added did not, as no one is asked before being added. The last admin who joined can neither be made a member nor taken out, themselves included (`LastAdmin`). An admin who never joined may always be taken out, leaving included, so nobody can be left holding an Organization they never chose.
- **Every change is an admin's, under the Organization's row's lock.** A member is `AdminRequired`, anyone else `OrganizationNotFound`, as an id no Organization has, so a stranger learns nothing of its members.
