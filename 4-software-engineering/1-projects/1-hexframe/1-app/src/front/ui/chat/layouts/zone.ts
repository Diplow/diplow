// The chat's one surface, drawn once: the Composer, the widgets and the sign-in widget at the chat's
// foot all sit on it, a solid fill tinted toward the curve by their voice, one fine line on top.

/**
 * A zone of the conversation: a solid fill, tinted toward the curve by the voice its caller sets
 * (`[--voice:…]`, or `voiceOf`), one fine line on top. Never a box: the line is the separator.
 */
export const zone =
  "relative bg-card bg-linear-to-r from-transparent from-15% to-(--voice)/9 before:absolute before:inset-x-0 before:top-0 before:h-px before:origin-left before:bg-linear-to-r before:from-transparent before:via-input before:via-45% before:to-input before:content-['']"

/**
 * The padding of what sits at the chat's foot, the Composer and the sign-in widget: wide, clear of the
 * curve by the inset the screen's foot hands it (`--screen-foot-inset`), so no caller pads it again.
 */
export const footPadding = 'px-4 @wide:pr-[calc(1.5rem+var(--screen-foot-inset,0px))] @wide:pl-9'
