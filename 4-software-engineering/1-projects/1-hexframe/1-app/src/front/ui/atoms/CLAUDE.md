---
title: atoms
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/atoms
owner: diplo
preview: >-
  The atoms no single side owns: those both sides of hexframe's screen share,
  controls that know nothing of hexframe (a button, a field, a form), the
  toasts and the skeleton, the menu and the actions the frames share, and
  those no side uses yet, the header's toggles. An atom imports nothing above
  it in ui/, neither a layout nor a side.
---
# atoms

The atoms no single side owns, each a control that knows nothing of hexframe: those the Chat and the Canvas share, and those no side uses yet (`ThemeToggle` and `LocaleSwitch`, the header's), which stay where they fit until a side takes them. An atom one side alone uses lives in that side's `atoms/` ([[4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/CLAUDE|ui]], "Rules") and comes here once the other side uses it too. An atom imports only other atoms, the seams, the files at `ui/`'s root and, in its `gallery.tsx`, the page's frame in `gallery/` (dependency-cruiser, `no-atoms-importing-up`).

| Path | Holds |
|---|---|
| `controls/` | `Button`; `Act`, an action as a word led by a small hex, `quiet`, in the voice of the surface it sits on, which `voiceOf` gives a surface (the agent's, the human's, the app's, or `destructive`), or `destructive`, with its `Shortcut`, or the one solid act a dialog asks for, cut as a long hex (`look="hex"`), 44px tall under a finger; `Input`, `Textarea`, and `ThemeToggle` and `LocaleSwitch`, which sit in every page's header until the one screen moves the theme to the breadcrumb's head and the language to a command |
| `forms/` | `Field` (a label, a control, its description and errors), `useAppForm` (TanStack Form with the fields `TextField`, which takes a `type` (text, email, password) and an `autoComplete`, `TextareaField` and the `SubmitButton`) and `openedOnRefusal`, the options of a form that opens on the refusal its last submit met, each field it names touched with its message, as a refused submit leaves it; `errorMessages`, what a field shows of its errors. Tested |
| `Menu.tsx` | `Menu`, every action on one thing on Radix: behind a control (`opensOn="click"`, a widget's settings) or where the thing is (`opensOn="context"`: a right click, a long press, ⇧F10 or the menu key, at the thing's center from the keyboard). A header naming what it acts on, entries each with an icon and a `Shortcut` shown at its end and run when typed with the menu open, `agent` in violet or `destructive`, settings on or off, separated where an entry says `'separator'`. Under a finger its lines are 44px and its header shows the description a hover card would. It replaced `DropdownMenu`, which nothing used |
| `keys.tsx` | `Shortcut`, a key with Shift or the command key, what `Menu` and `Act` show and a screen reader hears (`ariaShortcut`, `aria-keyshortcuts`), `pressed`, whether a key press is it, and `Keys`, a shortcut drawn key by key. No piece of its own. Tested |
| `Toaster.tsx` | `Toaster` and `toast`, Sonner with its colours pointed at the theme's tokens |
| `skeleton.tsx` | `Skeleton`, a placeholder in the shape of content still loading |
| `gallery.tsx` | `AtomsGallery`, every atom here in its states, on `/design-system` |
