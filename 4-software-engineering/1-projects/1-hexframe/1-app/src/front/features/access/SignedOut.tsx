// Home signed out, in the chat: two lines in the agent's voice, what the canvas shows and what
// signing in brings, and at the chat's foot, in the composer's place, the sign-in widget, which signs
// in or up, then goes back where the user was.
import { m } from '#/paraglide/messages'
import { Message } from '#/front/ui/chat/text/Message'
import { type Access, SignInWidget } from '#/front/ui/chat/widgets/sign-in/SignInWidget'

import { useSignInState } from './state/useSignInState'

/** What the agent says to a visitor: Help is on the canvas, and signing in brings their own System. */
export function SignedOutLines() {
  return (
    <ol className="flex flex-col gap-[1.375rem]">
      <li>
        <Message voice="agent" words={[m.signed_out_help()]} />
      </li>
      <li>
        <Message voice="agent" words={[m.signed_out_sign_in()]} continued />
      </li>
    </ol>
  )
}

interface SignInFootProps {
  /** Signing in or signing up, the URL's. */
  access: Access
  onAccessChange: (access: Access) => void
  /** Where to go once signed in, without the language prefix; home when absent. */
  redirect: string | undefined
}

/** The chat's foot signed out: the sign-in widget, over IAM. */
export function SignInFoot({ access, onAccessChange, redirect }: SignInFootProps) {
  const { state, actions } = useSignInState(redirect)
  return (
    <SignInWidget
      access={access}
      onAccessChange={(next) => {
        actions.switched()
        onAccessChange(next)
      }}
      email={state.email}
      onEmailChange={actions.email}
      password={state.password}
      onPasswordChange={actions.password}
      refused={state.refused}
      sending={state.sending}
      onSubmit={() => {
        void actions.submit(access)
      }}
    />
  )
}
