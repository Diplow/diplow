// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { signIn, signUp } from '#/api/iam/iam'
import { encodeFailure, type Failure, type Outcome } from '#/api/report/errors/failure'
import { CredentialsRejected, EmailTaken, TooManyAttempts } from '#/domains/iam/errors'
import { continueTo } from '#/front/client/iam/guard'

import { refusedOf, useSignInState } from './useSignInState'

// The sign-in widget's words and submit, over stand-ins for IAM's server functions: a refusal on the
// field IAM names, gone once that field changes; another refusal on no field; signed in, back where
// the user was.
vi.mock('#/api/iam/iam', () => ({ signIn: vi.fn(), signUp: vi.fn() }))
vi.mock('#/front/client/iam/guard', () => ({ continueTo: vi.fn() }))
vi.mock('#/front/ui/atoms/Toaster', () => ({ toast: { error: vi.fn() } }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const refusing = (failure: Failure): Outcome<never, Failure> => ({
  ok: false,
  failure: encodeFailure(failure),
  requestId: 'req-1',
})

const account = { id: 'a-1', email: 'ada@example.com' }

function render(redirect?: string) {
  const { result } = renderHook(() => useSignInState(redirect))
  const typed = () => {
    act(() => {
      result.current.actions.email('ada@example.com')
      result.current.actions.password('correct horse')
    })
  }
  const submit = async (access: 'sign-in' | 'sign-up' = 'sign-in') => {
    await act(() => result.current.actions.submit(access))
  }
  return { result, typed, submit }
}

describe('the sign-in widget on home', () => {
  it('signs in with what was typed, then goes back where the user was', async () => {
    vi.mocked(signIn).mockResolvedValue({ ok: true, value: account, requestId: 'r' } as never)
    const { result, typed, submit } = render('/?keys=true')
    typed()
    await submit()
    expect(signIn).toHaveBeenCalledExactlyOnceWith({
      data: { email: 'ada@example.com', password: 'correct horse' },
    })
    expect(continueTo).toHaveBeenCalledExactlyOnceWith('/?keys=true', 'a-1')
    // The page is leaving: the act keeps waiting.
    expect(result.current.state.sending).toBe(true)
  })

  it('signs up through sign-up', async () => {
    vi.mocked(signUp).mockResolvedValue({ ok: true, value: account, requestId: 'r' } as never)
    const { typed, submit } = render()
    typed()
    await submit('sign-up')
    expect(signUp).toHaveBeenCalledOnce()
    expect(signIn).not.toHaveBeenCalled()
    expect(continueTo).toHaveBeenCalledExactlyOnceWith(undefined, 'a-1')
  })

  it('shows a refusal on the field IAM names, until that field changes', async () => {
    vi.mocked(signUp).mockResolvedValue(refusing(new EmailTaken({ fields: ['email'] })) as never)
    const { result, typed, submit } = render()
    typed()
    await submit('sign-up')
    expect(result.current.state.refused?.email).toEqual(expect.any(String))
    expect(result.current.state.sending).toBe(false)
    act(() => {
      result.current.actions.password('another one')
    })
    expect(result.current.state.refused?.email).toEqual(expect.any(String))
    act(() => {
      result.current.actions.email('ada@example.org')
    })
    expect(result.current.state.refused).toBeUndefined()
    expect(continueTo).not.toHaveBeenCalled()
  })

  it('lets a refusal go once the other of the two is chosen', async () => {
    vi.mocked(signIn).mockResolvedValue(
      refusing(new CredentialsRejected({ fields: ['password'] })) as never,
    )
    const { result, typed, submit } = render()
    typed()
    await submit()
    expect(result.current.state.refused?.password).toEqual(expect.any(String))
    act(() => {
      result.current.actions.switched()
    })
    expect(result.current.state.refused).toBeUndefined()
  })

  it('shows on no field a refusal that names none, its channel the toast', async () => {
    vi.mocked(signIn).mockResolvedValue(refusing(new TooManyAttempts()) as never)
    const { result, typed, submit } = render()
    typed()
    await submit()
    expect(result.current.state.refused).toBeUndefined()
    expect(result.current.state.sending).toBe(false)
  })
})

describe("a submit's refusals on the widget's fields", () => {
  it('are the email and the password it names', () => {
    expect(refusedOf({ fields: { password: 'No.' } })).toEqual({ password: 'No.' })
    expect(refusedOf({ fields: { email: 'Taken.', name: 'x' } })).toEqual({ email: 'Taken.' })
  })

  it('are none for a refusal on the form, or a field the widget lacks', () => {
    expect(refusedOf({ form: 'Wait.' })).toBeUndefined()
    expect(refusedOf({ fields: { name: 'x' } })).toBeUndefined()
    expect(refusedOf(undefined)).toBeUndefined()
  })
})
