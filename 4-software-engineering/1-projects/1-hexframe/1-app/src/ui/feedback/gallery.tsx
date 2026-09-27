import { FilePlus, Plus } from 'lucide-react'

import { m } from '#/paraglide/messages'

import { GallerySection, GalleryState } from '../gallery'
import { Button } from '../inputs/controls/button'
import { Skeleton } from './skeleton'
import { EmptyState, ErrorState, Forbidden } from './states'
import { toast } from './Toaster'

const retry = () => {
  toast(m.dev_ui_sample_retrying())
}

const showLoading = () => {
  const id = toast.loading(m.dev_ui_toast_loading_message())
  setTimeout(() => toast.success(m.dev_ui_toast_success_message(), { id }), 1500)
}

export function FeedbackGallery() {
  const toasts = [
    { label: m.dev_ui_toast_plain(), show: () => toast(m.dev_ui_toast_plain_message()) },
    {
      label: m.dev_ui_toast_success(),
      show: () => toast.success(m.dev_ui_toast_success_message()),
    },
    { label: m.dev_ui_toast_info(), show: () => toast.info(m.dev_ui_toast_info_message()) },
    {
      label: m.dev_ui_toast_warning(),
      show: () => toast.warning(m.dev_ui_toast_warning_message()),
    },
    { label: m.dev_ui_toast_error(), show: () => toast.error(m.dev_ui_toast_error_message()) },
    // A loading toast stays until it is settled; the demo settles it as a save would.
    { label: m.dev_ui_toast_loading(), show: showLoading },
  ]
  return (
    <>
      <GallerySection name="Toaster">
        <GalleryState label={m.dev_ui_state_click_to_show()}>
          <div className="flex flex-wrap gap-2">
            {toasts.map(({ label, show }) => (
              <Button key={label} variant="outline" onClick={show}>
                {label}
              </Button>
            ))}
          </div>
        </GalleryState>
      </GallerySection>
      <GallerySection name="Skeleton">
        <GalleryState label={m.dev_ui_state_loading()}>
          <div className="flex w-72 items-center gap-4">
            <Skeleton className="size-12 rounded-full" />
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        </GalleryState>
      </GallerySection>
      <GallerySection name="EmptyState">
        <GalleryState label={m.dev_ui_state_with_action()}>
          <div className="w-80">
            <EmptyState
              icon={<FilePlus />}
              title={m.dev_ui_empty_title()}
              description={m.dev_ui_empty_description()}
              action={
                <Button size="sm">
                  <Plus />
                  {m.dev_ui_sample_new_tile()}
                </Button>
              }
            />
          </div>
        </GalleryState>
        <GalleryState label={m.dev_ui_state_title_only()}>
          <div className="w-80">
            <EmptyState title={m.dev_ui_empty_title()} />
          </div>
        </GalleryState>
      </GallerySection>
      <GallerySection name="ErrorState">
        <GalleryState label={m.dev_ui_state_with_retry()}>
          <div className="w-80">
            <ErrorState requestId="req_01J9Z8X7W6V5" onRetry={retry} />
          </div>
        </GalleryState>
        <GalleryState label={m.dev_ui_state_with_message()}>
          <div className="w-80">
            <ErrorState message={m.dev_ui_sample_error_message()} />
          </div>
        </GalleryState>
      </GallerySection>
      <GallerySection name="Forbidden">
        <GalleryState label={m.dev_ui_state_default()}>
          <div className="w-80">
            <Forbidden />
          </div>
        </GalleryState>
        <GalleryState label={m.dev_ui_state_with_message()}>
          <div className="w-80">
            <Forbidden message={m.dev_ui_sample_forbidden_message()} />
          </div>
        </GalleryState>
      </GallerySection>
    </>
  )
}
