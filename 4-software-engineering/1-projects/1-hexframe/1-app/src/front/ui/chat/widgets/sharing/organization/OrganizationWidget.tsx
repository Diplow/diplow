// An Organization made, in the conversation: the app's own widget, so it carries no voice. Its name,
// which its star is born with, then Create, the user its first admin. Controlled: the name, why it
// was refused and what each action does are its caller's, who says it once it is made.
import { Building2 } from 'lucide-react'

import { m } from '#/paraglide/messages'

import { Widget } from '../../../layouts/Widget'
import { Field } from '../../fields'

interface OrganizationWidgetProps {
  name: string
  onNameChange: (name: string) => void
  /** Why the name was refused, on the field. */
  refused?: string | undefined
  /** On its way: Create waits, a second press making a second Organization. */
  sending?: boolean
  onCreate: () => void
  onLater: () => void
}

/** The Organization widget: its name, then Create. */
export function OrganizationWidget({
  name,
  onNameChange,
  refused,
  sending = false,
  onCreate,
  onLater,
}: OrganizationWidgetProps) {
  return (
    <Widget
      voice="app"
      icon={<Building2 />}
      kicker={m.widget_organization_kicker()}
      title={m.widget_organization_title()}
      subtitle={m.widget_organization_what()}
      actions={[
        {
          label: m.widget_organization_create(),
          look: 'hex',
          submit: true,
          waits: sending,
          onSelect: onCreate,
        },
        { label: m.widget_organization_later(), onSelect: onLater },
      ]}
      onDismiss={onLater}
    >
      <Field
        label={m.widget_organization_name()}
        placeholder={m.widget_organization_name_placeholder()}
        autoComplete="off"
        value={name}
        onChange={onNameChange}
        error={refused}
        takesFocus
      />
    </Widget>
  )
}
