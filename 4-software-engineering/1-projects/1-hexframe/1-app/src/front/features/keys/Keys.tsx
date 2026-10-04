// The Keys page's content: name and issue a Key, see its secret once beside the command that adds
// hexframe to Claude Code, list the Account's Keys and revoke one after a confirmation. The secret
// lives in this component's state only, so leaving the screen forgets it.
import { Copy, KeyRound } from 'lucide-react'
import { useMemo, useState } from 'react'

import { ReadBoundary } from '#/front/client/ReadBoundary'
import {
  useIssueKeySubmit,
  useKeys,
  useRevokeKey,
  type AccountKey,
  type IssuedKey,
} from '#/front/client/iam/keys'
import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'
import { DataTable, type DataColumn } from '#/front/ui/data/DataTable'
import { toast } from '#/front/ui/feedback/Toaster'
import { EmptyState } from '#/front/ui/feedback/states'
import { Button } from '#/front/ui/inputs/controls/button'
import { useAppForm } from '#/front/ui/inputs/forms/form'
import { ConfirmDialog } from '#/front/ui/overlays/ConfirmDialog'
import { Card } from '#/front/ui/surfaces/Card'
import { PageHeader } from '#/front/ui/surfaces/PageHeader'

import { mcpCommand } from './command'

/** A Key just issued, as the screen shows it: its name, its secret and the command holding it. */
interface Shown {
  name: string
  secret: string
  command: string
}

/** The Keys page's content. */
export function Keys() {
  const [shown, setShown] = useState<Shown | undefined>(undefined)
  return (
    <main className="mx-auto grid w-full max-w-3xl gap-6 px-6 pb-12">
      <PageHeader title={m.keys_title()} description={m.keys_description()} />
      {shown === undefined ? (
        <IssueForm
          // The origin is read in the browser, where the answer arrives: the command names this hexframe.
          onIssued={({ key, secret }: IssuedKey) => {
            setShown({
              name: key.name,
              secret,
              command: mcpCommand(window.location.origin, secret),
            })
          }}
        />
      ) : (
        <IssuedSecret
          shown={shown}
          onDone={() => {
            setShown(undefined)
          }}
        />
      )}
      <ReadBoundary>
        <KeyList />
      </ReadBoundary>
    </main>
  )
}

/** A Key's name, then Issue. What a name must be is IAM's to say, on the field. */
function IssueForm({ onIssued }: { onIssued: (issued: IssuedKey) => void }) {
  const submit = useIssueKeySubmit(onIssued)
  const form = useAppForm({ defaultValues: { name: '' }, validators: { onSubmitAsync: submit } })
  return (
    <Card title={m.keys_issue_title()} description={m.keys_issue_description()}>
      <form
        noValidate
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        <form.AppField name="name">
          {(field) => (
            <field.TextField
              label={m.keys_field_name()}
              description={m.keys_field_name_description()}
              autoComplete="off"
            />
          )}
        </form.AppField>
        <div>
          <form.AppForm>
            <form.SubmitButton>{m.keys_issue()}</form.SubmitButton>
          </form.AppForm>
        </div>
      </form>
    </Card>
  )
}

/** The secret of the Key just issued, shown this once, and the command that puts it to use. */
function IssuedSecret({ shown, onDone }: { shown: Shown; onDone: () => void }) {
  return (
    <Card
      title={m.keys_issued_title({ name: shown.name })}
      description={m.keys_issued_description()}
      footer={<Button onClick={onDone}>{m.keys_done()}</Button>}
    >
      <div className="grid gap-4">
        <Copyable label={m.keys_secret()} value={shown.secret} />
        <Copyable label={m.keys_command()} value={shown.command} />
      </div>
    </Card>
  )
}

/** A value to copy: its label, the value in full, and a button that puts it on the clipboard. */
function Copyable({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-start gap-2">
        <code className="min-w-0 flex-1 rounded-md border bg-muted px-3 py-2 font-mono text-sm break-all">
          {value}
        </code>
        <Button
          variant="outline"
          size="sm"
          aria-label={m.keys_copy_named({ what: label })}
          onClick={() => {
            copy(value)
          }}
        >
          <Copy />
          {m.keys_copy()}
        </Button>
      </div>
    </div>
  )
}

function copy(value: string) {
  navigator.clipboard.writeText(value).then(
    () => toast.success(m.keys_copied()),
    () => toast.error(m.keys_copy_failed()),
  )
}

/** The Account's Keys, sortable by name and dates, each with its revoke. */
function KeyList() {
  const { data: keys } = useKeys()
  // The page's language does not change without a full load, so the columns are built once.
  const columns = useMemo(keyColumns, [])
  return (
    <DataTable
      caption={m.keys_list_caption()}
      columns={columns}
      rows={keys}
      rowId={(key) => key.id}
      empty={
        <EmptyState
          icon={<KeyRound />}
          title={m.keys_empty_title()}
          description={m.keys_empty_description()}
        />
      }
    />
  )
}

function keyColumns(): DataColumn<AccountKey>[] {
  const date = new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium', timeStyle: 'short' })
  return [
    {
      id: 'name',
      header: m.keys_column_name(),
      cell: (key) => key.name,
      sortValue: (key) => key.name,
    },
    {
      id: 'start',
      header: m.keys_column_start(),
      cell: (key) => <code className="font-mono">{key.start}…</code>,
    },
    {
      id: 'created',
      header: m.keys_column_created(),
      cell: (key) => date.format(key.createdAt),
      sortValue: (key) => key.createdAt.getTime(),
    },
    {
      id: 'lastUsed',
      header: m.keys_column_last_used(),
      cell: (key) => (key.lastUsedAt === null ? m.keys_never_used() : date.format(key.lastUsedAt)),
      sortValue: (key) => key.lastUsedAt?.getTime() ?? 0,
    },
    {
      id: 'revoke',
      header: m.keys_column_revoke(),
      cell: (key) => <RevokeKey id={key.id} name={key.name} />,
      align: 'end',
    },
  ]
}

/** Revokes one Key, once the user confirms. */
function RevokeKey({ id, name }: { id: string; name: string }) {
  const revoke = useRevokeKey()
  return (
    <ConfirmDialog
      trigger={
        <Button
          variant="outline"
          size="sm"
          disabled={revoke.isPending}
          aria-label={m.keys_revoke_named({ name })}
        >
          {m.keys_revoke()}
        </Button>
      }
      title={m.keys_revoke_title({ name })}
      description={m.keys_revoke_description({ name })}
      confirmLabel={m.keys_revoke()}
      destructive
      onConfirm={() => {
        // The Keys are read again before the revoke settles, and the row, this component with it, is
        // gone by then: `mutate`'s own callbacks would not run. The promise still settles. A refusal
        // has already gone to its channel, the toast.
        revoke.mutateAsync({ id }).then(
          () => toast.success(m.keys_revoked({ name })),
          () => undefined,
        )
      }}
    />
  )
}
