// An Organization made, in the chat, at the conversation's foot, on ui's Organization widget (HEX-136):
// its name, which its star is born with, then Create, the user its first admin; once made, a toast
// naming it, and the canvas off to its System by its star's link, visited like any other. Whether it
// is open is the URL's, a change under way (`organization`, `../../search/search.ts`), which
// `/organization` opens and `TileWidgets` draws; the name is this widget's own. A blank name, or one
// past a Title's bound, is refused on the field before anything is sent, as Mapping and the server
// function's schema would refuse its star's Title; any other refusal goes to its channel.
import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { contentBounds } from '#/domains/mapping/entities'
import { useCreateOrganization } from '#/front/client/iam/organizations'
import { toast } from '#/front/ui/atoms/Toaster'
import { OrganizationWidget } from '#/front/ui/chat/widgets/sharing/organization/OrganizationWidget'
import { m } from '#/paraglide/messages'

/** The Organization widget, its name typed, then the Organization made and visited. */
export function NewOrganization({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const create = useCreateOrganization()
  const [name, setName] = useState('')
  const [refused, setRefused] = useState<string>()
  return (
    <OrganizationWidget
      name={name}
      onNameChange={(typed) => {
        setName(typed)
        setRefused(undefined)
      }}
      refused={refused}
      sending={create.isPending}
      onCreate={() => {
        const named = name.trim()
        if (named === '' || named.length > contentBounds.title) {
          setRefused(
            named === ''
              ? m.widget_organization_name_missing()
              : m.widget_organization_name_too_long({ most: String(contentBounds.title) }),
          )
          return
        }
        // A refusal has already gone to its channel.
        create.mutateAsync(named).then(
          ({ star }) => {
            toast.success(m.widget_organization_made({ name: named }))
            void router.navigate({ to: '/t/$id', params: { id: star } })
          },
          () => undefined,
        )
      }}
      onLater={onClose}
    />
  )
}
