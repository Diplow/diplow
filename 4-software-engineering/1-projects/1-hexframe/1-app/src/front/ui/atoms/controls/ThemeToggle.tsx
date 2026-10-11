import { Moon, Sun } from 'lucide-react'

import { m } from '#/paraglide/messages'
import { useThemeState } from '#/front/ui/theme'

import { Button } from './button'

export function ThemeToggle() {
  const { state, actions } = useThemeState()
  const label = state.theme === 'dark' ? m.theme_toggle_to_light() : m.theme_toggle_to_dark()
  return (
    <Button variant="ghost" size="icon" onClick={actions.toggle} aria-label={label} title={label}>
      {state.theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  )
}
