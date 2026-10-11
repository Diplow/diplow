// The sign-in widget on /design-system, at a chat's foot, live: type, switch between signing in and
// signing up, try. Nothing reaches IAM: a try works a moment, then is refused as IAM would refuse it
// (`../demo.ts`), or signs in, said in a toast. Its place on the signed-out screen is the Screen's.
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { m } from '#/paraglide/messages'

import { toast } from '../../../atoms/Toaster'
import { GallerySection, GalleryState } from '../../../gallery/frame'
import { accessRefusalOf } from '../demo'
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
            email={m.gallery_sign_in_sample_email()}
            refused={{ password: m.error_iam_credentials_rejected() }}
          />
        </Foot>
      </GalleryState>
      <GalleryState label={m.gallery_state_sign_in_sending()}>
        <Foot>
          <SignInWidget
            access="sign-in"
            onAccessChange={() => undefined}
            email={m.gallery_sign_in_sample_email()}
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

interface Refused {
  email?: string
  password?: string
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
  const [refused, setRefused] = useState<Refused | undefined>(firstRefusal)
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
        setRefused(refused?.password === undefined ? undefined : { password: refused.password })
      }}
      password={password}
      onPasswordChange={(next) => {
        setPassword(next)
        setRefused(refused?.email === undefined ? undefined : { email: refused.email })
      }}
      refused={refused}
      sending={sending}
      onSubmit={() => {
        setSending(true)
        trying.current = setTimeout(() => {
          setSending(false)
          const refusal = accessRefusalOf(access, email, password)
          setRefused(refusal)
          if (refusal === undefined) toast(m.gallery_sign_in_welcome({ email: email.trim() }))
        }, 900)
      }}
    />
  )
}
