// The frame of /dev/ui: one section per component, one labelled specimen per state.
import type { ReactNode } from 'react'

export function GallerySection({ name, children }: { name: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-t pt-6">
      <h2 className="font-mono text-lg font-semibold">{name}</h2>
      <div className="flex flex-wrap items-start gap-8">{children}</div>
    </section>
  )
}

export function GalleryState({ label, children }: { label: string; children: ReactNode }) {
  return (
    <figure className="grid max-w-full gap-2">
      <figcaption className="text-xs text-muted-foreground">{label}</figcaption>
      {children}
    </figure>
  )
}
