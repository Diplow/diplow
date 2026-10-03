// Every error channel, provoked: a read, a read that frames every page, a write and a form's submit,
// each ending with the outcome a button asks for, through the server function helper.
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { read, write } from '#/api/client/calls'
import { submitWrite } from '#/api/client/channels'
import { ReadBoundary } from '#/api/client/ReadBoundary'
import { outcomes, type ProvokedOutcome } from '#/api/dev/failures'
import { provokeRead, provokeWrite, submitDevTitle } from '#/api/dev/provoke'
import { m } from '#/paraglide/messages'
import { Skeleton } from '#/ui/feedback/skeleton'
import { toast } from '#/ui/feedback/Toaster'
import { Button } from '#/ui/inputs/controls/button'
import { useAppForm } from '#/ui/inputs/forms/form'
import { Card } from '#/ui/surfaces/Card'
import { PageHeader } from '#/ui/surfaces/PageHeader'

export const Route = createFileRoute('/dev/errors')({
  component: ErrorsPage,
})

function ErrorsPage() {
  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-6 pb-12">
      <PageHeader title={m.dev_errors_title()} description={m.dev_errors_description()} />
      <Reads />
      <FrameReads />
      <Writes />
      <TitleForm />
    </main>
  )
}

/** One button per outcome: a success, then a failure of each kind. */
function OutcomeButtons({ onPick }: { onPick: (outcome: ProvokedOutcome) => void }) {
  return (
    <div role="group" aria-label={m.dev_errors_outcomes()} className="flex flex-wrap gap-2">
      {outcomes.map((outcome) =>
        outcome === 'Success' ? (
          <Button
            key={outcome}
            onClick={() => {
              onPick(outcome)
            }}
          >
            {m.dev_errors_success()}
          </Button>
        ) : (
          // A kind is the code's name for it, in every language.
          <Button
            key={outcome}
            variant="outline"
            className="font-mono"
            onClick={() => {
              onPick(outcome)
            }}
          >
            {outcome}
          </Button>
        ),
      )}
    </div>
  )
}

const provokedRead = (outcome: ProvokedOutcome, frame = false) =>
  read({
    scope: frame ? 'provokeFrameRead' : 'provokeRead',
    key: [outcome],
    call: () => provokeRead({ data: { outcome } }),
    frame,
  })

function Reads() {
  const [outcome, setOutcome] = useState<ProvokedOutcome>()
  return (
    <Card title={m.dev_errors_read_title()} description={m.dev_errors_read_description()}>
      <div className="grid gap-4">
        <OutcomeButtons onPick={setOutcome} />
        {outcome !== undefined && (
          // A new outcome is a new boundary, so the last one's failure does not stay on screen.
          <ReadBoundary key={outcome}>
            <ReadResult outcome={outcome} />
          </ReadBoundary>
        )}
      </div>
    </Card>
  )
}

function ReadResult({ outcome }: { outcome: ProvokedOutcome }) {
  const { data } = useQuery(provokedRead(outcome))
  if (data === undefined) return <Skeleton className="h-6 w-64" />
  return <p className="text-sm">{m.dev_errors_read_done({ id: data.requestId })}</p>
}

function FrameReads() {
  const [outcome, setOutcome] = useState<ProvokedOutcome>()
  return (
    <Card title={m.dev_errors_frame_title()} description={m.dev_errors_frame_description()}>
      <div className="grid gap-4">
        <OutcomeButtons onPick={setOutcome} />
        {outcome !== undefined && <FrameResult key={outcome} outcome={outcome} />}
      </div>
    </Card>
  )
}

function FrameResult({ outcome }: { outcome: ProvokedOutcome }) {
  const { data } = useQuery(provokedRead(outcome, true))
  if (data === undefined) return null
  return <p className="text-sm">{m.dev_errors_read_done({ id: data.requestId })}</p>
}

function Writes() {
  const provoke = useMutation({
    ...write('provokeWrite', (outcome: ProvokedOutcome) => provokeWrite({ data: { outcome } })),
    onSuccess: ({ requestId }) => toast.success(m.dev_errors_write_done({ id: requestId })),
  })
  return (
    <Card title={m.dev_errors_write_title()} description={m.dev_errors_write_description()}>
      <OutcomeButtons
        onPick={(outcome) => {
          provoke.mutate(outcome)
        }}
      />
    </Card>
  )
}

function TitleForm() {
  const form = useAppForm({
    defaultValues: { title: '' },
    validators: {
      onSubmitAsync: submitWrite({
        scope: 'submitDevTitle',
        call: (value: { title: string }) => submitDevTitle({ data: value }),
        onSaved: ({ title }) => toast.success(m.dev_errors_form_saved({ title })),
      }),
    },
  })
  return (
    <Card title={m.dev_errors_form_title()} description={m.dev_errors_form_description()}>
      <form
        noValidate
        className="grid w-96 max-w-full gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        <form.AppField name="title">
          {(field) => <field.TextField label={m.dev_errors_form_label()} />}
        </form.AppField>
        <div>
          <form.AppForm>
            <form.SubmitButton>{m.dev_errors_form_submit()}</form.SubmitButton>
          </form.AppForm>
        </div>
      </form>
    </Card>
  )
}
