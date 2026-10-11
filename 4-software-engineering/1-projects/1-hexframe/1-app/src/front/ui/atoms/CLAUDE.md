---
title: atoms
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/atoms
owner: diplo
preview: >-
  The atoms both sides of hexframe's screen share: controls that know nothing
  of hexframe (a button, a field, a form), the menu, the toasts and the
  skeleton. An atom imports nothing above it in ui/, neither a layout nor a
  side.
---
# atoms

The atoms the Chat and the Canvas share: each a control that knows nothing of hexframe. An atom one side alone uses lives in that side's `atoms/` ([[4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/CLAUDE|ui]], "Rules") and comes here once the other side uses it too. An atom imports only other atoms and the files at `ui/`'s root (dependency-cruiser, `no-atoms-importing-up`).

| Path | Holds |
|---|---|
| `controls/` | `Button`, `Input`, `Textarea`, and `ThemeToggle` and `LocaleSwitch`, which sit in every page's header until the one screen moves the theme to the breadcrumb's head and the language to a command |
| `forms/` | `Field` (a label, a control, its description and errors), `useAppForm` (TanStack Form with the fields `TextField`, which takes a `type` (text, email, password) and an `autoComplete`, `TextareaField` and the `SubmitButton`) and `openedOnRefusal`, the options of a form that opens on the refusal its last submit met, each field it names touched with its message, as a refused submit leaves it; `errorMessages`, what a field shows of its errors. Tested |
| `DropdownMenu.tsx` | `DropdownMenu`, a menu of entries, each a label, an icon and what it does, a destructive one in the destructive colour, separated where an entry says `'separator'` |
| `Toaster.tsx` | `Toaster` and `toast`, Sonner with its colours pointed at the theme's tokens |
| `skeleton.tsx` | `Skeleton`, a placeholder in the shape of content still loading |
| `gallery.tsx` | `AtomsGallery`, every atom here in its states, on `/dev/ui` |
