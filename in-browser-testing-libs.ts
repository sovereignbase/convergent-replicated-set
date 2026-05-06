import {
  CRSet,
  type CRSetDelta,
} from '@sovereignbase/convergent-replicated-set'
import { drag, startWatch, stopWatch } from '@sovereignbase/dragonwatch'
import { StationClient } from '@sovereignbase/station-client'

type DemoValue = 'circle' | 'square' | 'triangle' | 'diamond'

type Replica = {
  readonly id: string
  readonly label: string
  readonly set: CRSet<DemoValue>
}

type ShapeSource =
  | {
      readonly kind: 'palette'
    }
  | {
      readonly kind: 'replica'
      readonly replicaId: string
    }

type StationSyncMessage = {
  readonly topic: 'convergent-replicated-set:manual-sync'
  readonly replicaId: string
  readonly delta: CRSetDelta<DemoValue>
}

const values: Array<{
  readonly id: string
  readonly label: string
  readonly value: DemoValue
}> = [
  { id: 'circle', label: 'circle', value: 'circle' },
  { id: 'square', label: 'square', value: 'square' },
  { id: 'triangle', label: 'triangle', value: 'triangle' },
  { id: 'diamond', label: 'diamond', value: 'diamond' },
]

const demo = document.querySelector<HTMLElement>('[data-crset-demo]')
const palette = document.querySelector<HTMLElement>('[data-palette]')
const replicasEl = document.querySelector<HTMLElement>('[data-replicas]')
const gossipButton = document.querySelector<HTMLButtonElement>(
  '[data-action="gossip"]'
)
const syncStatus = document.querySelector<HTMLElement>('[data-sync-status]')

const station = new StationClient<StationSyncMessage>()
const replicas = createReplicas(2)
const pendingStationMessages: Array<StationSyncMessage> = []
const pendingOutgoingMessages: Array<StationSyncMessage> = []
let isFlushingStationMessages = false
let gossiping = false

if (demo && palette && replicasEl && gossipButton) {
  gossipButton.addEventListener('click', () => void gossip())
  for (const replica of replicas) {
    replica.set.addEventListener('delta', (event) => {
      if (isFlushingStationMessages) return
      pendingOutgoingMessages.push({
        topic: 'convergent-replicated-set:manual-sync',
        replicaId: replica.id,
        delta: event.detail,
      })
      updateStatus()
    })
  }
  station.addEventListener('message', (event) => {
    if (!isStationSyncMessage(event.detail)) return
    pendingStationMessages.push(event.detail)
    updateStatus()
  })
  render()
}

function createReplicas(count: number): Array<Replica> {
  return Array.from({ length: count }, (_, index) => ({
    id: `replica-${index + 1}`,
    label: `replica ${index + 1}`,
    set: new CRSet<DemoValue>(),
  }))
}

function render(): void {
  if (!palette || !replicasEl) return
  palette.replaceChildren(
    ...values.map((entry) =>
      createShapeButton(entry.id, entry.label, entry.value, {
        kind: 'palette',
      })
    )
  )
  replicasEl.replaceChildren(...replicas.map(createReplicaCard))
  wireFreeDragging()
  updateStatus()
  document.body.dataset.ready = 'true'
}

function createReplicaCard(replica: Replica): HTMLElement {
  const card = document.createElement('section')
  card.className = 'replica-card'
  card.dataset.replicaId = replica.id
  card.setAttribute('aria-label', replica.label)

  const heading = document.createElement('div')
  heading.className = 'replica-heading'

  const title = document.createElement('h2')
  title.textContent = replica.label

  const count = document.createElement('span')
  count.className = 'replica-count'
  count.textContent = `${replica.set.size} live`

  heading.append(title, count)

  const snapshot = replica.set.toJSON()
  const stats = document.createElement('p')
  stats.className = 'replica-stats'
  stats.textContent = `${snapshot.values.length} values / ${snapshot.tombstones.length} tombstones`

  const members = document.createElement('div')
  members.className = 'replica-members'
  members.setAttribute('aria-label', `${replica.label} live values`)
  renderReplicaMembers(members, replica)

  card.append(heading, stats, members)
  return card
}

function createShapeButton(
  id: string,
  label: string,
  value: DemoValue,
  source: ShapeSource
): HTMLElement {
  const tile = document.createElement('button')
  tile.type = 'button'
  tile.className = 'item-tile'
  tile.dataset.tile = 'true'
  tile.dataset.valueId = id
  tile.dataset.value = value
  tile.dataset.source = source.kind
  if (source.kind === 'replica') tile.dataset.replicaId = source.replicaId
  tile.setAttribute('aria-label', label)

  const shape = document.createElement('span')
  shape.className = `shape shape-${value}`
  shape.setAttribute('aria-hidden', 'true')

  tile.append(shape)
  return tile
}

function renderReplicaMembers(container: HTMLElement, replica: Replica): void {
  const tiles = values
    .filter((entry) => replica.set.has(entry.value))
    .map((entry) =>
      createShapeButton(entry.id, entry.label, entry.value, {
        kind: 'replica',
        replicaId: replica.id,
      })
    )

  if (tiles.length > 0) {
    container.replaceChildren(...tiles)
    return
  }

  const empty = document.createElement('p')
  empty.className = 'empty'
  empty.textContent = 'empty'
  container.replaceChildren(empty)
}

function wireFreeDragging(): void {
  for (const tile of document.querySelectorAll<HTMLElement>('[data-tile]')) {
    if (tile.dataset.dragBound === 'true') continue
    tile.dataset.dragBound = 'true'
    tile.addEventListener('pointerdown', (event) => {
      const value = readTileValue(tile)
      if (!value) return
      event.preventDefault()

      const source = readTileSource(tile)
      const watchers = replicaCards()
      detachForDrag(tile, source, value)

      for (const watcher of watchers) startWatch(watcher, tile)

      drag(
        event,
        (_dragged, watcher) => {
          markDropTarget(tile, watcher, source, value)
        },
        (_dragged, watcher) => {
          watcher.classList.remove('is-targeted', 'is-repelling')
        }
      )

      let settled = false
      const stop = () => {
        if (settled) return
        settled = true

        for (const watcher of watchers) stopWatch(watcher, tile)
        const targetReplicaId = dropReplicaFor(tile)?.dataset.replicaId
        tile.remove()
        clearTargeting()
        applyDrop(value, source, targetReplicaId)
        render()
      }

      tile.addEventListener('pointerup', stop, { once: true })
      tile.addEventListener('pointercancel', stop, { once: true })
    })
  }
}

function detachForDrag(
  tile: HTMLElement,
  source: ShapeSource,
  value: DemoValue
): void {
  const rect = tile.getBoundingClientRect()
  const replacement =
    source.kind === 'palette'
      ? createShapeButton(
          tile.dataset.valueId ?? valueId(value),
          tile.getAttribute('aria-label') ?? value,
          value,
          {
            kind: 'palette',
          }
        )
      : createPlaceholder()

  tile.replaceWith(replacement)
  tile.dataset.detached = 'true'
  tile.dataset.x = '0'
  tile.dataset.y = '0'
  tile.style.position = 'fixed'
  tile.style.left = `${rect.left}px`
  tile.style.top = `${rect.top}px`
  tile.style.width = `${rect.width}px`
  tile.style.height = `${rect.height}px`
  tile.style.margin = '0'
  tile.style.transform = ''
  document.body.append(tile)
  if (source.kind === 'palette') wireFreeDragging()
}

function createPlaceholder(): HTMLElement {
  const placeholder = document.createElement('span')
  placeholder.className = 'item-tile item-placeholder'
  placeholder.setAttribute('aria-hidden', 'true')
  return placeholder
}

function markDropTarget(
  tile: HTMLElement,
  watcher: HTMLElement,
  source: ShapeSource,
  value: DemoValue
): void {
  const replicaId = watcher.dataset.replicaId
  watcher.classList.remove('is-targeted', 'is-repelling')

  if (replicaId && acceptsDrop(value, source, replicaId)) {
    watcher.classList.add('is-targeted')
    return
  }

  watcher.classList.add('is-repelling')
  repelFrom(tile, watcher)
}

function acceptsDrop(
  value: DemoValue,
  source: ShapeSource,
  replicaId: string
): boolean {
  if (source.kind === 'replica') return true
  return replicaById(replicaId)?.set.has(value) !== true
}

function applyDrop(
  value: DemoValue,
  source: ShapeSource,
  targetReplicaId: string | undefined
): void {
  const target = targetReplicaId ? replicaById(targetReplicaId) : undefined

  if (source.kind === 'palette') {
    target?.set.add(value)
    return
  }

  const sourceReplica = replicaById(source.replicaId)
  if (!target) {
    sourceReplica?.set.delete(value)
    return
  }

  if (target.id === source.replicaId) return

  target.set.add(value)
  sourceReplica?.set.delete(value)
}

function repelFrom(tile: HTMLElement, card: HTMLElement): void {
  const tileRect = tile.getBoundingClientRect()
  const cardRect = card.getBoundingClientRect()
  const pushes = [
    { x: cardRect.left - tileRect.right - 8, y: 0 },
    { x: cardRect.right - tileRect.left + 8, y: 0 },
    { x: 0, y: cardRect.top - tileRect.bottom - 8 },
    { x: 0, y: cardRect.bottom - tileRect.top + 8 },
  ]
  const push = pushes.reduce((closest, candidate) =>
    Math.abs(candidate.x) + Math.abs(candidate.y) <
    Math.abs(closest.x) + Math.abs(closest.y)
      ? candidate
      : closest
  )
  const x = Number(tile.dataset.x ?? 0) + push.x
  const y = Number(tile.dataset.y ?? 0) + push.y
  const from = tile.style.transform || 'none'
  const to = `translate(${x}px, ${y}px)`

  tile.dataset.x = String(x)
  tile.dataset.y = String(y)
  tile.classList.add('is-repelling')
  tile.style.transform = to
  void tile.animate([{ transform: from }, { transform: to }], {
    duration: 140,
    easing: 'ease-out',
  })
  window.setTimeout(() => tile.classList.remove('is-repelling'), 180)
}

async function gossip(): Promise<void> {
  if (gossiping) return
  gossiping = true
  gossipButton?.toggleAttribute('disabled', true)

  flushStationMessages()

  const snapshots = replicas.map((replica) => ({
    source: replica,
    snapshot: replica.set.toJSON(),
  }))
  const deliveries = snapshots.flatMap(({ source, snapshot }) =>
    replicas
      .filter((target) => target.id !== source.id)
      .map((target) => ({ source, snapshot, target }))
  )

  await Promise.all(
    deliveries.map(async (delivery, index) => {
      await animatePacket(delivery.source.id, delivery.target.id, index)
      delivery.target.set.merge(delivery.snapshot)
      updateReplicaCard(delivery.target)
    })
  )

  relayStationDeltas()

  gossiping = false
  gossipButton?.toggleAttribute('disabled', false)
  updateStatus()
}

function flushStationMessages(): void {
  isFlushingStationMessages = true
  try {
    for (const message of pendingStationMessages.splice(0)) {
      replicaById(message.replicaId)?.set.merge(message.delta)
    }
  } finally {
    isFlushingStationMessages = false
  }

  for (const replica of replicas) updateReplicaCard(replica)
}

function relayStationDeltas(): void {
  for (const message of pendingOutgoingMessages.splice(0)) {
    station.relay(message)
  }
}

function animatePacket(
  sourceId: string,
  targetId: string,
  index: number
): Promise<void> {
  const source = replicaCard(sourceId)
  const target = replicaCard(targetId)
  if (!source || !target) return Promise.resolve()

  const sourceRect = source.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const packet = document.createElement('span')
  packet.className = 'gossip-packet'
  packet.textContent = 'delta'
  packet.style.left = `${sourceRect.left + sourceRect.width / 2}px`
  packet.style.top = `${sourceRect.top + sourceRect.height / 2}px`
  document.body.append(packet)

  const dx =
    targetRect.left +
    targetRect.width / 2 -
    sourceRect.left -
    sourceRect.width / 2
  const dy =
    targetRect.top +
    targetRect.height / 2 -
    sourceRect.top -
    sourceRect.height / 2
  const delay = (index % Math.max(1, replicas.length - 1)) * 70

  return new Promise((resolve) => {
    window.setTimeout(() => {
      packet.style.transform = `translate(${dx}px, ${dy}px)`
      packet.style.opacity = '0'
    }, delay)
    window.setTimeout(() => {
      packet.remove()
      resolve()
    }, delay + 520)
  })
}

function updateReplicaCard(replica: Replica): void {
  const card = replicaCard(replica.id)
  if (!card) return

  const count = card?.querySelector<HTMLElement>('.replica-count')
  const stats = card?.querySelector<HTMLElement>('.replica-stats')
  const members = card?.querySelector<HTMLElement>('.replica-members')
  const snapshot = replica.set.toJSON()
  if (count) count.textContent = `${replica.set.size} live`
  if (stats) {
    stats.textContent = `${snapshot.values.length} values / ${snapshot.tombstones.length} tombstones`
  }
  if (members) renderReplicaMembers(members, replica)
  wireFreeDragging()
}

function updateStatus(): void {
  if (!demo) return
  const projections = replicas.map((replica) => projection(replica.set))
  const [first] = projections
  const converged = first
    ? projections.every((candidate) => sameMembers(candidate, first))
    : true
  const unionSize = new Set(
    replicas.flatMap((replica) => replica.set.values().map(valueId))
  ).size
  demo.dataset.converged = String(converged)
  demo.dataset.visible = String(unionSize)
  demo.dataset.pendingSync = String(pendingStationMessages.length)
  if (syncStatus) {
    syncStatus.textContent = `${pendingStationMessages.length} tab deltas pending`
  }
}

function clearTargeting(): void {
  for (const target of document.querySelectorAll<HTMLElement>(
    '.is-targeted, .is-repelling, .has-overlap'
  )) {
    target.classList.remove('is-targeted', 'is-repelling', 'has-overlap')
  }
}

function replicaCards(): Array<HTMLElement> {
  return Array.from(
    document.querySelectorAll<HTMLElement>('.replica-card[data-replica-id]')
  )
}

function replicaCard(id: string): HTMLElement | undefined {
  return (
    document.querySelector<HTMLElement>(
      `.replica-card[data-replica-id="${id}"]`
    ) ?? undefined
  )
}

function replicaById(id: string): Replica | undefined {
  return replicas.find((replica) => replica.id === id)
}

function dropReplicaFor(tile: HTMLElement): HTMLElement | undefined {
  return replicaCards()
    .map((card) => ({
      card,
      area: overlapArea(tile, card),
    }))
    .filter((entry) => entry.area > 0)
    .sort((left, right) => right.area - left.area)[0]?.card
}

function intersects(left: HTMLElement, right: HTMLElement): boolean {
  const leftRect = left.getBoundingClientRect()
  const rightRect = right.getBoundingClientRect()
  return !(
    leftRect.right < rightRect.left ||
    leftRect.left > rightRect.right ||
    leftRect.bottom < rightRect.top ||
    leftRect.top > rightRect.bottom
  )
}

function overlapArea(left: HTMLElement, right: HTMLElement): number {
  const leftRect = left.getBoundingClientRect()
  const rightRect = right.getBoundingClientRect()
  const width = Math.max(
    0,
    Math.min(leftRect.right, rightRect.right) -
      Math.max(leftRect.left, rightRect.left)
  )
  const height = Math.max(
    0,
    Math.min(leftRect.bottom, rightRect.bottom) -
      Math.max(leftRect.top, rightRect.top)
  )
  return width * height
}

function readTileValue(tile: HTMLElement): DemoValue | undefined {
  const value = tile.dataset.value
  return isDemoValue(value) ? value : undefined
}

function readTileSource(tile: HTMLElement): ShapeSource {
  if (tile.dataset.source === 'replica' && tile.dataset.replicaId) {
    return {
      kind: 'replica',
      replicaId: tile.dataset.replicaId,
    }
  }
  return {
    kind: 'palette',
  }
}

function projection(set: CRSet<DemoValue>): Set<string> {
  return new Set(set.values().map(valueId))
}

function valueId(value: DemoValue): string {
  return value
}

function sameMembers(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) return false
  for (const value of left) if (!right.has(value)) return false
  return true
}

function isStationSyncMessage(value: unknown): value is StationSyncMessage {
  return (
    isRecord(value) &&
    value.topic === 'convergent-replicated-set:manual-sync' &&
    typeof value.replicaId === 'string' &&
    isStationDelta(value.delta)
  )
}

function isStationDelta(value: unknown): value is CRSetDelta<DemoValue> {
  if (!isRecord(value)) return false
  if (value.values !== undefined && !Array.isArray(value.values)) return false
  if (value.tombstones !== undefined && !Array.isArray(value.tombstones)) {
    return false
  }
  return value.values !== undefined || value.tombstones !== undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isDemoValue(value: string | undefined): value is DemoValue {
  return (
    value === 'circle' ||
    value === 'square' ||
    value === 'triangle' ||
    value === 'diamond'
  )
}
