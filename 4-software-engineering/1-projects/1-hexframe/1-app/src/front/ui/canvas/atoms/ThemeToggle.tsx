// The theme: a half-lit disc, 21px inside a 31px target, 44px under a finger, which turns half a turn
// as the light changes, since a change of theme is a change of light, not a flip. With reduced motion
// it lands at once.
import { m } from '#/paraglide/messages'
import { useThemeState } from '#/front/ui/theme'

export function ThemeToggle() {
  const { state, actions } = useThemeState()
  const label = state.theme === 'dark' ? m.theme_toggle_to_light() : m.theme_toggle_to_dark()
  return (
    <button
      type="button"
      onClick={actions.toggle}
      aria-label={label}
      title={label}
      className="grid size-[31px] cursor-pointer place-items-center rounded-full text-faint outline-none hover:text-muted-foreground focus-visible:outline-1 focus-visible:outline-offset-3 focus-visible:outline-human pointer-coarse:size-11"
    >
      <svg viewBox="-10.5 -10.5 21 21" aria-hidden className="size-[21px] overflow-visible">
        <circle r={10} fill="none" stroke="currentColor" vectorEffect="non-scaling-stroke" />
        <path
          d="M0 -10A10 10 0 0 1 0 10Z"
          fill="currentColor"
          className="transition-transform duration-(--duration-turn) ease-glide motion-reduce:transition-none dark:rotate-180"
        />
      </svg>
    </button>
  )
}
