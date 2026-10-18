// Copying to the clipboard from home's System, saying so in a toast: a Tile's menu's Copy lines and
// the share widget's Copy link.
import { toast } from '#/front/ui/atoms/Toaster'
import { m } from '#/paraglide/messages'

/** Copies `text`, saying so; without a secure context there is no clipboard, which fails alike. */
export function copy(text: string) {
  // Over plain HTTP there is no clipboard at all: that fails as a refused copy does.
  void Promise.resolve(text)
    .then((copied) => navigator.clipboard.writeText(copied))
    .then(
      () => toast(m.system_copied()),
      () => toast.error(m.system_copy_failed()),
    )
}
