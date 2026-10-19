// Mapping on the client: one TanStack Query hook per read and per write, and the export, over its
// server functions (src/api/mapping/mapping.ts). The System is one query, read whole and flat, whose
// tree the client builds; what the page shows is that System with every write still pending folded
// over it (./overlay/overlay.ts). Every write to it is a mutation keyed by its Operation's name, whose
// variables are that Operation's fields; the Tile forms' included. The writes run one after another,
// in order, each first decided on the System the client holds, a refusal foreseen there sent nowhere,
// and each reads the System again once it settles, failed or not, since a refusal (a slot taken
// meanwhile, a Tile gone) says the page is behind. A Tile form's submit sends its write and answers
// at once; a refused write to the System comes back through `useSystemRefusals`.
// Failures go to their channels (../channels.ts): a hook's caller handles none.
import {
  type Mutation,
  type QueryClient,
  useIsMutating,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { Schema } from 'effect'
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react'

import type { Failure, Outcome } from '#/api/report/errors/failure'
import {
  type Seen,
  type ShippedRoot,
  type System,
  type SystemTile,
  systemOf,
  tileAt,
} from '#/domains/mapping/entities'
import { madeAt, type Operation, type OperationName } from '#/domains/mapping/operations'
import { type Download, downloaded } from '#/api/mapping/files/download'
import { type Given, type LeftOut, type Prepared, prepared } from './import/upload'
import {
  importing,
  landingOf,
  underwayOf,
  type Underway,
  operationOf,
  overlaid,
  type Pending,
  refusalOf,
} from './overlay/overlay'
import type { ImportPlace } from '#/api/mapping/places'
import {
  ImportUpload,
  type NewReference,
  type NewTile,
  type ReferenceSlot,
  type TileDelete,
  type TileEdit,
  type TileMove,
  type TileExport,
  type TileSwap,
  createReference,
  createTile,
  deleteReference,
  deleteTile,
  editTile,
  exportTile,
  importTiles,
  moveTile,
  publicSystem,
  shipped,
  swapTiles,
  system,
  TileVisit,
  visit,
} from '#/api/mapping/mapping'

import { getLocale, type Locale } from '#/paraglide/runtime'

import { Foreseen, asCallFailed, read, settle, write, writing, type WriteCall } from '../calls'
import { type FormErrors, settleSubmit, shownOnForm, unshown } from '../channels'

/** The System's read, by the server function's name: every mode of its query key starts with it. */
const systemScope = 'system'

/** The queue every write to the System waits its turn in, so they reach the server in order. */
const systemQueue = 'system'
/** What an import is given: the files, and where they land. */
interface ImportVariables {
  given: Given | Promise<Given>
  place: ImportPlace
}

/**
 * The System's read, whose cache holds the System as the server last answered it, flat. Never read
 * again on focus, every Body with it: the page polls its Version then, and reads it again only once
 * it moved (`./follow.ts`).
 */
export const systemRead = {
  ...read({
    scope: systemScope,
    key: [],
    call: () => system({ data: { language: getLocale() } }),
  }),
  refetchOnWindowFocus: false,
}

/**
 * The read of another's System, by its star, as the Account may see it (HEX-127), a query of its own
 * beside the Account's. Its Version is how what the Account sees there stands, no count of changes,
 * which would tell of the Tiles kept from it (Mapping's `sightVersion`): the page polls it as it
 * polls its own (`../assistant/follow.ts`) and reads the System again once it is another, and, as
 * the Account's, once a write to a System settles (HEX-132). A Tile hexframe ships among it, the
 * Hexframe Organization's Help and tutorial or a pin of one, comes in the page's language (HEX-139).
 */
export const visitRead = (star: string) => ({
  ...read({
    scope: systemScope,
    key: [star],
    call: () => system({ data: { system: star, language: getLocale() } }),
  }),
  refetchOnWindowFocus: false,
})

/**
 * The System the client holds that an Operation changes: the one holding the Tile it is made at
 * (Mapping's `madeAt`), the Account's own or one it visits, as the server names it; none when the
 * client holds neither. What a write is foreseen on, and a refused one read back by.
 */
function heldFor(client: QueryClient, operation: Operation): Seen | undefined {
  const at = madeAt(operation)
  const held = client.getQueriesData<Seen>({ queryKey: [systemScope] })
  return held.find(([, seen]) => seen !== undefined && tileAt(seen, at) !== undefined)?.[1]
}

/**
 * Where a link to a Tile leads the Account (`/t/<id>`, HEX-127): the star of the System holding it,
 * none for its own; undefined for a Tile it may not read, as for one that doesn't exist, and for a
 * link naming no Tile, which is not sent. Any other failure is thrown, for the route to show.
 */
export async function leadsTo(tile: string): Promise<{ readonly system?: string } | undefined> {
  if (!Schema.is(TileVisit)({ tile })) return undefined
  try {
    return await settle('visit', visit({ data: { tile } }))
  } catch (error) {
    if (asCallFailed(error, 'visit').failure.kind === 'NotFound') return undefined
    throw error
  }
}

/**
 * The System holding a Tile Everyone may read, as anyone holding its link sees it, signed in or not
 * (HEX-129): what `/t/<id>` draws signed out, read once by the route, as `leadsTo` is, since nothing
 * the page does changes it. Undefined for a Tile Everyone may not read, as for one that doesn't exist,
 * and for a link naming no Tile, which is not sent. Any other failure is thrown, for the route to show.
 */
export async function publicSystemOf(tile: string): Promise<Seen | undefined> {
  if (!Schema.is(TileVisit)({ tile })) return undefined
  try {
    return await settle('publicSystem', publicSystem({ data: { tile, language: getLocale() } }))
  } catch (error) {
    if (asCallFailed(error, 'publicSystem').failure.kind === 'NotFound') return undefined
    throw error
  }
}

/**
 * Reads the System again once a write settles, even while no page shows it, so the next write in the
 * queue is decided on a System that holds this one.
 */
const readAgain = (client: QueryClient) =>
  client.invalidateQueries({ queryKey: [systemScope], refetchType: 'all' })

/** Whether a mutation is a write to the System, an import's included: one of its queue. */
const inSystemQueue = (mutation: Mutation) => mutation.options.scope?.id === systemQueue

/**
 * Each pending write read once per state of its mutation, so `useMutationState` finds the same
 * values while nothing changed: an Operation decoded again is a new object it cannot compare, and
 * every page holding a System write would render again at each notification of the MutationCache.
 */
const pendingByState = new WeakMap<Mutation['state'], Pending>()

/**
 * A pending write to the System, as the overlay folds it: its turn, and the Operation it sends, read
 * back from its key and variables by Mapping's schema, or where an import lands, by its own.
 */
function pendingOf(mutation: Mutation): Pending {
  const known = pendingByState.get(mutation.state)
  if (known !== undefined) return known
  const name = mutation.options.mutationKey?.[0]
  const pending = {
    turn: mutation.mutationId,
    operation: operationOf(name, mutation.state.variables),
    landing: landingOf(name, mutation.state.variables),
  }
  pendingByState.set(mutation.state, pending)
  return pending
}

/** The System as the page shows it, and the gaps in what the Account may read of it. */
export interface SystemShown {
  /** Flat, the server's with every pending write folded over it, which Mapping's `decide` rules on. */
  readonly system: System
  /** Its tree, from its star. */
  readonly root: SystemTile
  /** What the writes on their way change. */
  readonly underway: Underway
  /** The Tiles it may read below Tiles kept from it, by id: none on its own System. */
  readonly gaps: Seen['gaps']
  /** The Account's rights on each Tile it is shown, by id, as the server read them: every one on its own. */
  readonly rights: Seen['rights']
  /** The Tiles of other Systems its References point at that the Account may read, by id. */
  readonly pinned: Seen['pinned']
  /** Whether the Account stands for its owner: its own, or an Organization's it is an admin of. */
  readonly asOwner: Seen['asOwner']
}

/**
 * The Account's System as the page shows it, or, by its star, another's as the Account may see it:
 * the server's, with every write to it still pending
 * folded over it in order, flat, which Mapping's `decide` rules on, and its tree, its Root, the user,
 * with everything below it, the gaps and the Account's rights on each Tile; a write to another
 * System folding over none, since `decide` finds none of its Tiles there. A write that settles stops being
 * pending once the System read again has
 * landed, so nothing flickers between its answer and the read. Undefined until the first read lands.
 * Shown inside a ReadBoundary, where its failure appears; signed out, it sends the user to sign in.
 * With `throwing: false`, for what shows beside the canvas, the chat: the same Query, read once,
 * whose failure throws nothing there and leaves it undefined, the canvas's boundary showing it. Not
 * a `frame` read, which would be a Query of its own and read the System twice.
 */
export function useSystem({ throwing = true, star }: { throwing?: boolean; star?: string } = {}): {
  data: SystemShown | undefined
} {
  const query = star === undefined ? systemRead : visitRead(star)
  const { data } = useQuery(throwing ? query : { ...query, throwOnError: false })
  const writes = useMutationState({
    filters: { status: 'pending', predicate: inSystemQueue },
    select: pendingOf,
  })
  return {
    data: useMemo(() => {
      if (data === undefined) return undefined
      // A write lands in the System holding its Tile: each folds over the one it names, and changes
      // nothing in any other, `decide` finding none of its Tiles there; an import, the Account's own.
      const pending = star === undefined ? writes : writes.filter(({ operation }) => operation)
      const shown = overlaid(data, pending)
      return {
        system: shown,
        root: systemOf(shown, data.pinned),
        underway: underwayOf(pending, data.root.id),
        gaps: data.gaps,
        rights: data.rights,
        pinned: data.pinned,
        asOwner: data.asOwner,
      }
    }, [data, writes, star]),
  }
}

/** Whether a write to the System, an import's included, is still waiting for its answer. */
export const useSystemWriting = () => useIsMutating({ predicate: inSystemQueue }) > 0

/** A write to the System refused, by the server or foreseen by the client. */
export interface Refused {
  /** Its turn, as the MutationCache numbers the writes in the order they were made. */
  readonly turn: number
  /** The Operation it sent, its variables read back by Mapping's schema. */
  readonly operation: Operation
  /** What its form shows of the refusal: on the fields it names, or on the form. */
  readonly shown: FormErrors
  /**
   * The System as the cache holds it by then, flat, the server's, the read after the refusal landed:
   * where the Tiles the Operation names stand. Undefined if no read of it has landed.
   */
  readonly system: System | undefined
}

const nothing = () => undefined

/** What a page does with a refused write: answers whether it shows it, its form reopened. */
type Take = (refused: Refused) => boolean

/** The pages taking refused writes back, each by its latest `take`, per QueryClient. */
const takersOf = new WeakMap<QueryClient, Set<{ readonly current: Take }>>()

/**
 * A QueryClient's takers of refused System writes, and the one MutationCache listener that hands
 * each write of the System's queue to them the moment it turns `error`, once the System read again
 * after it has landed, its channel already carried out. The takers registered then decide: if none
 * shows a form's refusal, which its channel shows on the form's fields, it goes to a toast instead
 * (`unshown`), so none is lost. An import, which is no Operation, is no refusal here: its widget
 * shows its own. Made with the client's first System write or page, and kept as long as the client.
 */
function listenForRefusals(client: QueryClient) {
  const known = takersOf.get(client)
  if (known !== undefined) return known
  const takers = new Set<{ readonly current: Take }>()
  takersOf.set(client, takers)
  client.getMutationCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'error') return
    const { mutationId: turn, options, state } = event.mutation
    if (options.scope?.id !== systemQueue) return
    const name: unknown = options.mutationKey?.[0]
    const operation = operationOf(name, state.variables)
    if (operation === undefined) return
    const failed = asCallFailed(event.action.error, String(name))
    const refused = {
      turn,
      operation,
      shown: shownOnForm(failed),
      system: heldFor(client, operation) ?? client.getQueryData(systemRead.queryKey),
    }
    const shown = [...takers].map((take) => take.current(refused)).includes(true)
    if (!shown) unshown(failed, options.meta?.call ?? 'write')
  })
  return takers
}

/**
 * Hands `take` each write to the System refused while the component is mounted (`listenForRefusals`); `take`
 * answers whether the page shows it. React registers it once, through `useSyncExternalStore`, which
 * never re-renders here: the snapshot is always the same.
 */
export function useSystemRefusals(take: Take) {
  const client = useQueryClient()
  // The latest `take`, which reads the page as it is now; the registration stays the same.
  const latest = useRef(take)
  latest.current = take
  const subscribe = useCallback(() => {
    const takers = listenForRefusals(client)
    takers.add(latest)
    return () => {
      takers.delete(latest)
    }
  }, [client])
  useSyncExternalStore(subscribe, nothing, nothing)
}

/**
 * Calls `react` the moment a write to the System is made, an import's included, while the component
 * is mounted, before the write is sent: what the Conversation's navigation sender sends the user's
 * navigation before. With `settled`, the moment it settled instead, landed or refused, once the read
 * after it has landed: what the page's poll reads the Conversation again after, since the write
 * recorded an Entry there. React subscribes once, through `useSyncExternalStore`, which never
 * re-renders here: the snapshot is always the same.
 */
export function useEachSystemWrite(react: () => void, moment: 'made' | 'settled' = 'made') {
  const client = useQueryClient()
  // The latest `react`; the subscription stays the same.
  const latest = useRef(react)
  latest.current = react
  const subscribe = useCallback(
    () =>
      client.getMutationCache().subscribe((event) => {
        if (event.mutation?.options.scope?.id !== systemQueue) return
        const now =
          moment === 'made'
            ? event.type === 'added'
            : event.type === 'updated' &&
              (event.action.type === 'success' || event.action.type === 'error')
        if (now) latest.current()
      }),
    [client, moment],
  )
  useSyncExternalStore(subscribe, nothing, nothing)
}

/**
 * A System hexframe ships, Help or the tutorial, by its Root, whole, in the page's language, Bodies
 * included, read as the System is. Anyone reads it, so it never sends the user to sign in. With
 * `throwing: false`, for the canvas's corner beside it, the same Query, whose failure throws nothing
 * there and leaves it undefined, the canvas's boundary showing it; with `enabled: false`, the same
 * Query read by nobody but the canvas, so a corner reads a System only while the canvas shows it.
 */
export function useShipped(
  root: ShippedRoot,
  language: Locale,
  { throwing = true, enabled = true }: { throwing?: boolean; enabled?: boolean } = {},
) {
  const query = {
    ...read({
      scope: 'shipped',
      key: [root, language],
      call: () => shipped({ data: { root, language } }),
    }),
    enabled,
  }
  return useQuery(throwing ? query : { ...query, throwOnError: false })
}

/**
 * The System holding a Tile Everyone may read, as anyone sees it (`publicSystem`), in a language:
 * the Hexframe Organization's, from its star's card, for a Tile of Help, which home draws from that
 * star, so its corner names every ancestor. Signed in or not, as `useShipped` reads, with the same
 * `throwing: false` for a reader beside the canvas, and `enabled: false` for one that reads none.
 */
export function usePublicSystem(
  tile: string,
  language: Locale,
  { throwing = true, enabled = true }: { throwing?: boolean; enabled?: boolean } = {},
) {
  const query = {
    ...read({
      scope: 'publicSystem',
      key: [tile, language],
      call: () => publicSystem({ data: { tile, language } }),
    }),
    enabled,
  }
  return useQuery(throwing ? query : { ...query, throwOnError: false })
}

/**
 * A write to the System, scoped by the Operation it runs and queued behind the writes made before it.
 * Its turn come, it is decided on the System the client holds, which by then holds every write made
 * before it: a refusal foreseen there goes to its channel and nothing is sent. Settled, the System is
 * read again, and the write stays pending until that read has landed.
 */
function useSystemWrite<I, A, E extends Failure>(
  scope: OperationName,
  call: (input: I) => Promise<Outcome<A, E>>,
  as: WriteCall = 'write',
) {
  const client = useQueryClient()
  return useMutation({
    ...writing(scope, { as, queue: systemQueue }),
    mutationFn: (input: I) => {
      // Its refusal reaches a page, or a toast, whether or not a page is open by then.
      listenForRefusals(client)
      const operation = operationOf(scope, input)
      const held = operation === undefined ? undefined : heldFor(client, operation)
      const refusal =
        held === undefined || operation === undefined ? undefined : refusalOf(held, operation)
      if (refusal !== undefined) return Promise.reject(new Foreseen(refusal, scope))
      return settle(scope, call(input))
    },
    onSettled: () => readAgain(client),
  })
}

/**
 * Adds a Tile in a free slot: a Branch, a Leaf, or a Tile of its parent's Context. A form's write, so
 * a refusal of what the Tile says shows on the field at fault (`useCreateTileSubmit`).
 */
export const useCreateTile = () =>
  useSystemWrite('createTile', (data: typeof NewTile.Type) => createTile({ data }), 'submit')

/**
 * Changes any of a Tile's Title, Preview and Body. A form's write, so a refusal of what the Tile says
 * shows on the field at fault (`useEditTileSubmit`).
 */
export const useEditTile = () =>
  useSystemWrite('editTile', (data: typeof TileEdit.Type) => editTile({ data }), 'submit')

/** Moves a Tile, and everything below it, to a free slot. */
export const useMoveTile = () =>
  useSystemWrite('moveTile', (data: typeof TileMove.Type) => moveTile({ data }))

/** Two Tiles trade places, each with everything below it. */
export const useSwapTiles = () =>
  useSystemWrite('swapTiles', (data: typeof TileSwap.Type) => swapTiles({ data }))

/** Deletes a Tile and everything below it; References to them stay, broken. */
export const useDeleteTile = () =>
  useSystemWrite('deleteTile', (data: typeof TileDelete.Type) => deleteTile({ data }))

/** Puts a Reference to a Tile in a free Context slot. */
export const useCreateReference = () =>
  useSystemWrite('createReference', (data: typeof NewReference.Type) => createReference({ data }))

/** Empties a Context slot holding a Reference. */
export const useDeleteReference = () =>
  useSystemWrite('deleteReference', (data: typeof ReferenceSlot.Type) => deleteReference({ data }))

/**
 * Exports a Tile and everything below it, the whole System from the Root: the browser saves
 * `<slug>.zip`. Nothing changes, so the System is not read again; a refusal goes to a write's
 * channel, a toast.
 */
export const useExportTile = () =>
  useMutation({
    ...write('exportTile', async (data: typeof TileExport.Type) =>
      downloaded(await exportTile({ data })),
    ),
    onSuccess: save,
  })

/** Has the browser save a file, as a click on a link to it would. */
function save({ name, blob }: Download) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  // Some browsers read the file from its URL a while after the click: the URL outlives it by a minute.
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 60_000)
}

/** Where an import lands: a free slot under a Tile, or the Root of an empty System. */
export type { ImportPlace }

/** What an import landed, as the server answers: the Tile it landed as, what it wrote and skipped. */
type ImportReport = Extract<Awaited<ReturnType<typeof importTiles>>, { ok: true }>['value']

/**
 * What an import came to: landed, with the server's report; or refused, by the browser before it sent
 * anything or by the server, every fault on its path, nothing written. Either way, what the browser
 * left out before sending.
 */
export type Imported =
  | {
      readonly _tag: 'Landed'
      readonly report: ImportReport
      readonly leftOut: ReadonlyArray<LeftOut>
    }
  | Extract<Prepared, { _tag: 'Refused' }>

/**
 * Imports what the user gave into a place of the System: the browser prunes and zips it, or refuses
 * it before sending (`./upload.ts`), then the server lands it, all of it or nothing.
 * The import is the form of its files, so its refusal, `ImportRefused`, is its answer, shown where the
 * import was given; any other failure goes to a write's channel, a toast. It waits its turn behind
 * the System's other writes, and the System is read again once it settles.
 */
export const useImportTiles = () => {
  const client = useQueryClient()
  return useMutation({
    ...writing(importing, { queue: systemQueue }),
    mutationFn: async ({ given, place }: ImportVariables): Promise<Imported> => {
      const ready = await prepared(await given)
      if (ready._tag === 'Refused') return ready
      const { upload, as, leftOut } = ready
      const form = Schema.encodeSync(ImportUpload)({ upload, as, place })
      const submitted = await settleSubmit(importing, importTiles({ data: form }))
      if (submitted.ok) return { _tag: 'Landed', report: submitted.value, leftOut }
      return { _tag: 'Refused', faults: submitted.failure.faults, leftOut }
    },
    onSettled: () => readAgain(client),
  })
}

/** The fields a Tile's form edits, which an edit compares one by one. */
const contentFields = ['title', 'preview', 'body'] as const

/** What a Tile's form edits: its Title, Preview and Body, one per field above. */
export type TileContent = Pick<SystemTile, (typeof contentFields)[number]>

/**
 * A Tile form's submit: sends what the form holds as a write, queued behind the others, and answers at
 * once with the id of the Tile written, so the form closes as if the write had landed and its receipt
 * can name the Tile. Its refusal comes back through `useSystemRefusals`, its channel carried out: a
 * toast, or nothing, for the reopened form to show.
 */
export type TileSubmit = (content: TileContent) => string

/**
 * Submits a new Tile's form through `useCreateTile`: the Tile goes in this free slot, a Child or a Tile
 * of the Context, under an id the client chooses for each submit, so the page draws it before the
 * answer comes.
 */
export const useCreateTileSubmit = (
  where: Pick<typeof NewTile.Type, 'parent' | 'slot'>,
): TileSubmit => {
  const { mutate } = useCreateTile()
  return (content) => {
    const id = crypto.randomUUID()
    mutate({ id, ...where, ...content })
    return id
  }
}

/**
 * Submits a Tile's form through `useEditTile`: only the fields that changed since the form opened are
 * sent, so the Body of an untitled Root can be written before its name, with the Version of the Tile
 * the form opened on, kept while the form lives: a change landing meanwhile, from another tab or an
 * agent, refuses the save rather than being overwritten by it.
 */
export const useEditTileSubmit = (
  tile: TileContent & Pick<SystemTile, 'id' | 'version'>,
): TileSubmit => {
  const { mutate } = useEditTile()
  const [opened] = useState(tile)
  return (content) => {
    mutate({ id: opened.id, version: opened.version, ...changed(opened, content) })
    return opened.id
  }
}

/** The fields of `after` that differ from `before`. */
function changed(before: TileContent, after: TileContent): Partial<TileContent> {
  return Object.fromEntries(
    contentFields.flatMap((field) =>
      before[field] === after[field] ? [] : [[field, after[field]]],
    ),
  )
}
