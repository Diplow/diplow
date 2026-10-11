// The channels on /design-system: what a failure shows, in each place the channel table sends it, on
// domains' refusals and an Unexpected. No call is made: the boundary, the toast and the form show them
// as they would show a call's.
import { Unexpected } from '#/api/report/errors/failure'
import { messageFor } from '#/api/report/errors/messages'
import { SessionRequired } from '#/domains/iam/errors'
import { TileChanged, TileNotFound, TitleMissing } from '#/domains/mapping/errors'
import { m } from '#/paraglide/messages'
import { Button } from '#/front/ui/atoms/controls/button'
import { openedOnRefusal, useAppForm } from '#/front/ui/atoms/forms/form'
import { toast } from '#/front/ui/atoms/Toaster'
import { GallerySection, GalleryState } from '#/front/ui/gallery/frame'

import { CallFailed } from './calls'
import { shownOnForm } from './channels'
import { ReadFailure } from './ReadBoundary'

const requestId = 'req_01J9Z8X7W6V5'

const retry = () => {
  toast(m.gallery_sample_retrying())
}

export function ChannelsGallery() {
  const reads = [
    { label: m.gallery_channels_read_failed(), scope: 'system', failure: new Unexpected() },
    { label: m.gallery_channels_read_missing(), scope: 'system', failure: new TileNotFound() },
    // The Keys, read with a Key where only a Session may.
    { label: m.gallery_channels_read_refused(), scope: 'keys', failure: new SessionRequired() },
  ]
  return (
    <GallerySection name="channels">
      {reads.map(({ label, scope, failure }) => (
        <GalleryState key={label} label={label}>
          <div className="w-80">
            <ReadFailure error={new CallFailed(failure, scope, requestId)} onRetry={retry} />
          </div>
        </GalleryState>
      ))}
      <GalleryState label={m.gallery_channels_write()}>
        <Button
          variant="outline"
          onClick={() => {
            toast.error(messageFor(new TileChanged(), 'editTile'))
          }}
        >
          {m.gallery_channels_write_show()}
        </Button>
      </GalleryState>
      <GalleryState label={m.gallery_channels_submit()}>
        <RefusedForm />
      </GalleryState>
    </GallerySection>
  )
}

/** A Tile's form reopened on a refused submit, as a refusal of its title leaves it. */
function RefusedForm() {
  const shown = shownOnForm(
    new CallFailed(new TitleMissing({ fields: ['title'] }), 'createTile', requestId),
  )
  const form = useAppForm({
    defaultValues: { title: '' },
    ...openedOnRefusal('fields' in shown ? shown.fields : undefined),
  })
  return (
    <form
      noValidate
      className="grid w-80 max-w-full gap-4"
      onSubmit={(event) => {
        event.preventDefault()
      }}
    >
      <form.AppField name="title">
        {(field) => <field.TextField label={m.gallery_form_title()} />}
      </form.AppField>
    </form>
  )
}
