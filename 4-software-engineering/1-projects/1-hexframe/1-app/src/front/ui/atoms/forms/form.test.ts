// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { openedOnRefusal, useAppForm } from './form'

// A form opened on the refusal its last submit met: the message under the field it names, as a
// refused submit leaves it, until the field changes.
afterEach(cleanup)

function Opened({ fields }: { fields: Record<string, string> | undefined }) {
  const form = useAppForm({ defaultValues: { title: '', body: '' }, ...openedOnRefusal(fields) })
  return createElement(
    'div',
    null,
    createElement(form.AppField, {
      name: 'title',
      children: (field) => createElement(field.TextField, { label: 'Title' }),
    }),
    createElement(form.AppField, {
      name: 'body',
      children: (field) => createElement(field.TextareaField, { label: 'Body' }),
    }),
  )
}

describe('openedOnRefusal', () => {
  it('opens with the message under the field the refusal names, and no other', () => {
    render(createElement(Opened, { fields: { title: 'Give this tile a title.' } }))
    expect(screen.getByText('Give this tile a title.')).toBeDefined()
    expect(screen.getByLabelText('Title').getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByLabelText('Body').getAttribute('aria-invalid')).toBeNull()
  })

  it('clears the message once the field changes', () => {
    render(createElement(Opened, { fields: { title: 'Give this tile a title.' } }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Work' } })
    expect(screen.queryByText('Give this tile a title.')).toBeNull()
  })

  it('opens as any form without a refusal', () => {
    render(createElement(Opened, { fields: undefined }))
    expect(screen.queryByText('Give this tile a title.')).toBeNull()
  })
})
