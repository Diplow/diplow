// The Account's Keys on the client, over IAM's server functions (src/api/iam/iam.ts): the Keys, read as
// one query; issuing one, as a form's submit; revoking one. Every write reads the Keys again once it
// settles, failed or not. A Key's secret is in issuing's answer only: it goes to the caller, and no
// cache keeps it, since a form's submit is no mutation.
// Failures go to their channels (../channels.ts): a hook's caller handles none.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { type KeyId, type KeyName, issueKey, keys, revokeKey } from '#/api/iam/iam'

import { read, write } from '../calls'
import { submitWrite } from '../channels'

/** The Keys' read, by the server function's name: every mode of its query key starts with it. */
const keysScope = 'keys'

/** The Account's Keys, the newest first, never their secrets. Signed out, it sends the user to sign in. */
export const useKeys = () =>
  useQuery(read({ scope: keysScope, key: [], call: () => keys({ data: undefined }) }))

/** A Key as its Account sees it among its others: its name, its first characters, its dates. */
export type AccountKey = NonNullable<ReturnType<typeof useKeys>['data']>[number]

/** What issuing a Key answers: the Key, and its secret, shown this once. */
export type IssuedKey = Extract<Awaited<ReturnType<typeof issueKey>>, { ok: true }>['value']

/** Revokes one of the Account's Keys, then reads the Keys again. */
export const useRevokeKey = () => {
  const client = useQueryClient()
  return useMutation({
    ...write('revokeKey', (data: typeof KeyId.Type) => revokeKey({ data })),
    onSettled: () => client.invalidateQueries({ queryKey: [keysScope] }),
  })
}

/**
 * Submits the form that issues a Key, as the form's `validators.onSubmitAsync`: a refusal of its name
 * shows on the field, the Keys are read again once it settles, and `onIssued` receives the Key with its
 * secret, which is nowhere else.
 */
export const useIssueKeySubmit = (onIssued: (issued: IssuedKey) => void) => {
  const client = useQueryClient()
  return submitWrite({
    scope: 'issueKey',
    call: (data: typeof KeyName.Type) =>
      issueKey({ data }).finally(() => {
        void client.invalidateQueries({ queryKey: [keysScope] })
      }),
    onSaved: onIssued,
  })
}
