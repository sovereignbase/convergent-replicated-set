import { CRSet } from '@sovereignbase/convergent-replicated-set'
import { drag, startWatch, stopWatch } from '@sovereignbase/dragonwatch'

type DemoValue = 'circle' | 'square' | 'triangle' | 'diamond'

type Replica = {
  readonly id: string
  readonly label: string
  readonly set: CRSet<DemoValue>
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

const replicas = createReplicas(2)
let gossiping = false

if (demo && palette && replicasEl && gossipButton) {
  gossipButton.addEventListener('click', () => void gossip())
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
      createShapeButton(entry.id, entry.label, entry.value)
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

  card.append(heading, stats)
  return card
}

function createShapeButton(
  id: string,
  label: string,
  value: DemoValue
): HTMLElement {
  const tile = document.createElement('button')
  tile.type = 'button'
  tile.className = 'item-tile'
  tile.dataset.tile = 'true'
  tile.dataset.valueId = id
  tile.dataset.value = value
  tile.setAttribute('aria-label', label)

  const shape = document.createElement('span')
  shape.className = `shape shape-${value}`
  shape.setAttribute('aria-hidden', 'true')

  tile.append(shape)
  return tile
}

function wireFreeDragging(): void {
  for (const tile of document.querySelectorAll<HTMLElement>('[data-tile]')) {
    if (tile.dataset.dragBound === 'true') continue
    tile.dataset.dragBound = 'true'
    tile.addEventListener('pointerdown', (event) => {
      const value = readTileValue(tile)
      if (!value) return
      detachFromPalette(tile, value)
      const watchers = replicaCards()
      const blockedReplicas = duplicateReplicasFor(tile, value)
      for (const watcher of watchers) startWatch(watcher, tile)

      drag(
        event,
        (_dragged, watcher) => {
          const replicaId = watcher.dataset.replicaId
          if (replicaId && blockedReplicas.has(replicaId)) {
            watcher.classList.add('is-repelling')
            repelFrom(tile, watcher)
          } else {
            watcher.classList.add('is-targeted')
          }
          syncShapeMembership(tile, blockedReplicas)
        },
        (_dragged, watcher) => {
          watcher.classList.remove('is-targeted', 'is-repelling')
          syncShapeMembership(tile, blockedReplicas)
        },
        () => syncShapeMembership(tile, blockedReplicas)
      )

      const stop = () => {
        for (const watcher of watchers) stopWatch(watcher, tile)
        clearTargeting()
        syncShapeMembership(tile, blockedReplicas)
      }

      tile.addEventListener('pointerup', stop, { once: true })
      tile.addEventListener('pointercancel', stop, { once: true })
    })
  }
}

function detachFromPalette(tile: HTMLElement, value: DemoValue): void {
  if (!palette?.contains(tile)) return

  const rect = tile.getBoundingClientRect()
  const replacement = createShapeButton(
    tile.dataset.valueId ?? valueId(value),
    tile.getAttribute('aria-label') ?? value,
    value
  )

  tile.replaceWith(replacement)
  tile.dataset.detached = 'true'
  tile.style.position = 'fixed'
  tile.style.left = `${rect.left}px`
  tile.style.top = `${rect.top}px`
  tile.style.width = `${rect.width}px`
  tile.style.height = `${rect.height}px`
  tile.style.margin = '0'
  tile.style.transform = ''
  document.body.append(tile)
  wireFreeDragging()
}

function syncShapeMembership(
  tile: HTMLElement,
  blockedReplicas = new Set<string>()
): void {
  const value = readTileValue(tile)
  if (!value) return

  for (const replica of replicas) {
    const card = replicaCard(replica.id)
    if (!card) continue

    const inside = intersects(tile, card)
    const blocked = blockedReplicas.has(replica.id)
    if (!blocked) {
      if (inside) replica.set.add(value)
      else replica.set.delete(value)
    }

    card.classList.toggle('has-overlap', inside && !blocked)
    card.classList.toggle('is-repelling', inside && blocked)
    updateReplicaCard(replica)
  }

  updateStatus()
}

function duplicateReplicasFor(
  tile: HTMLElement,
  value: DemoValue
): Set<string> {
  const blocked = new Set<string>()
  for (const replica of replicas) {
    const card = replicaCard(replica.id)
    if (card && replica.set.has(value) && !intersects(tile, card)) {
      blocked.add(replica.id)
    }
  }
  return blocked
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

  gossiping = false
  gossipButton?.toggleAttribute('disabled', false)
  updateStatus()
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
  const count = card?.querySelector<HTMLElement>('.replica-count')
  const stats = card?.querySelector<HTMLElement>('.replica-stats')
  const snapshot = replica.set.toJSON()
  if (count) count.textContent = `${replica.set.size} live`
  if (stats) {
    stats.textContent = `${snapshot.values.length} values / ${snapshot.tombstones.length} tombstones`
  }
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

function readTileValue(tile: HTMLElement): DemoValue | undefined {
  const value = tile.dataset.value
  return isDemoValue(value) ? value : undefined
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

function isDemoValue(value: string | undefined): value is DemoValue {
  return (
    value === 'circle' ||
    value === 'square' ||
    value === 'triangle' ||
    value === 'diamond'
  )
}
