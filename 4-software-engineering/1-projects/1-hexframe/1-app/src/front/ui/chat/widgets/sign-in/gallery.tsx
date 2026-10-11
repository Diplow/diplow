// The sign-in widget on /design-system, at a chat's foot, live: type, switch between signing in and
// signing up, try. Nothing reaches IAM: a try works a moment, then is refused as IAM would refuse it,
// or signs in, said in a toast. Its place on the signed-out screen is the Screen's specimen.
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { m } from '#/paraglide/messages'

import { toast } from '../../../atoms/Toaster'
import { GallerySection, GalleryState } from '../../../gallery/frame'
import { lengthOf } from '../count'
import { SignInWidget, type Access } from './SignInWidget'

export function SignInWidgetGallery() {
  return (
    <GallerySection name="SignInWidget">
      <GalleryState label={m.gallery_state_sign_in_live()}>
        <Foot>
          <LiveSignIn />
        </Foot>
      </GalleryState>
      <GalleryState label={m.gallery_state_sign_up()}>
        <Foot>
          <LiveSignIn access="sign-up" />
        </Foot>
      </GalleryState>
      <GalleryState label={m.gallery_state_sign_in_refused()}>
        <Foot>
          <LiveSignIn
            email="ulysse@example.com"
            refused={{ password: m.error_iam_credentials_rejected() }}
          />
        </Foot>
      </GalleryState>
      <GalleryState label={m.gallery_state_sign_in_sending()}>
        <Foot>
          <SignInWidget
            access="sign-in"
            onAccessChange={() => undefined}
            email="ulysse@example.com"
            onEmailChange={() => undefined}
            password="correct horse"
            onPasswordChange={() => undefined}
            sending
            onSubmit={() => undefined}
          />
        </Foot>
      </GalleryState>
      <GalleryState label={m.gallery_state_widget_phone()}>
        <Foot phone>
          <LiveSignIn />
        </Foot>
      </GalleryState>
    </GallerySection>
  )
}

/** A chat's foot, the conversation's width or a phone's: the widget sits at its bottom. */
function Foot({ phone = false, children }: { phone?: boolean; children: ReactNode }) {
  return (
    <div className={phone ? 'w-[23.4375rem] max-w-full' : 'w-[37.5rem] max-w-full'}>{children}</div>
  )
}

type Refused = { email?: string; password?: string; form?: string } | undefined

/** What IAM would refuse before signing anyone in: a malformed email, a password out of bounds. */
function refusalOf(access: Access, email: string, password: string): Refused {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return { email: m.error_iam_email_malformed() }
  }
  const length = lengthOf(password)
  if (access === 'sign-up' && (length < 8 || length > 128)) {
    return { password: m.error_iam_password_length() }
  }
  return length === 0 ? { password: m.error_iam_credentials_rejected() } : undefined
}

function LiveSignIn({
  access: first = 'sign-in',
  email: firstEmail = '',
  refused: firstRefusal,
}: {
  access?: Access
  email?: string
  refused?: Refused
}) {
  const [access, setAccess] = useState(first)
  const [email, setEmail] = useState(firstEmail)
  const [password, setPassword] = useState('')
  const [refused, setRefused] = useState(firstRefusal)
  const [sending, setSending] = useState(false)
  // The try in flight, dropped should the page leave.
  const trying = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(
    () => () => {
      clearTimeout(trying.current)
    },
    [],
  )
  return (
    <SignInWidget
      access={access}
      onAccessChange={(next) => {
        setAccess(next)
        setRefused(undefined)
      }}
      email={email}
      onEmailChange={(next) => {
        setEmail(next)
        setRefused({ ...refused, email: undefined })
      }}
      password={password}
      onPasswordChange={(next) => {
        setPassword(next)
        setRefused({ ...refused, password: undefined })
      }}
      refused={refused}
      sending={sending}
      onSubmit={() => {
        setSending(true)
        trying.current = setTimeout(() => {
          setSending(false)
          const refusal = refusalOf(access, email, password)
          setRefused(refusal)
          if (refusal === undefined) toast(m.gallery_sign_in_welcome({ email: email.trim() }))
        }, 900)
      }}
    />
  )
}
