---
title: decisions, hexframe v0 Design system
parent: 4-software-engineering/1-projects/1-hexframe/.run/registers/hexframe-v0-design-system
owner: diplo
preview: >-
  The choices the autonomous run made while building hexframe v0's design
  system, where a ticket left room: how ui/ components take their content,
  which library backs the Drawer, and a darker-theme token fix.
---
# Decisions

### DEC-1 Components take their content as props, not as parts to assemble

HEX-11, [#9](https://github.com/Diplow/diplow/pull/9). `Card`, `DropdownMenu`, `ConfirmDialog` and `DataTable` take `title`, `entries` or `columns` rather than exporting shadcn's `CardHeader`, `DropdownMenuItem` and the rest. The list is closed, and a feature that can't recombine the parts can't drift from them either. `DataTable`'s `DataColumn` also keeps TanStack Table's types out of every feature, which the import-boundary lint needs.

### DEC-2 Drawer is a Radix Dialog sliding from the right, and controlled only

HEX-11, [#9](https://github.com/Diplow/diplow/pull/9). shadcn's Drawer is built on vaul, which would be one more dependency, and it's barely maintained. A Radix Dialog does the job and keeps every overlay on Radix. `open` and `onOpenChange` are required because STACK.md puts an open drawer in the route's search params.

### DEC-3 Dark `--destructive` raised to shadcn's current value

HEX-11, [#9](https://github.com/Diplow/diplow/pull/9). At `oklch(0.396 0.141 25.723)`, field errors and destructive menu entries were barely readable on the dark background. `oklch(0.704 0.191 22.216)` is what shadcn ships today. The destructive button already dims it with `dark:bg-destructive/60`.
