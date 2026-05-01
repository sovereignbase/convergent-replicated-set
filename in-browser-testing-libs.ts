import { CRSet } from '@sovereignbase/convergent-replicated-set'
import { DragTarget } from '@sovereignbase/dragonwatch'

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
  { id: 'circle-copy', label: 'circle duplicate', value: 'circle' },
]

const demo = document.querySelector<HTMLElement>('[data-crset-demo]')
const palette = document.querySelector<HTMLElement>('[data-palette]')
const replicasEl = document.querySelector<HTMLElement>('[data-replicas]')
const removeTarget = document.querySelector<HTMLElement>('[data-remove-target]')
const statusEl = document.querySelector<HTMLElement>('[data-status]')
const gossipButton = document.querySelector<HTMLButtonElement>(
  '[data-action="gossip"]'
)

let replicas = createReplicas(2)
let gossiping = false

if (demo && palette && replicasEl && removeTarget && statusEl && gossipButton) {
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
  if (!palette || !replicasEl || !removeTarget || !statusEl) return
  palette.replaceChildren(
    ...values.map((entry) => createTile(entry, 'palette'))
  )
  replicasEl.replaceChildren(...replicas.map(createReplicaCard))
  wireDragTargets()
  updateStatus()
}

function createReplicaCard(replica: Replica): HTMLElement {
  const card = document.createElement('section')
  card.className = 'replica-card'
  card.dataset.replicaId = replica.id
  card.dataset.dropTarget = 'replica'
  card.setAttribute('aria-label', replica.label)

  const heading = document.createElement('div')
  heading.className = 'replica-heading'

  const title = document.createElement('h2')
  title.textContent = replica.label

  const count = document.createElement('span')
  count.className = 'replica-count'
  count.textContent = `${replica.set.size} live`

  heading.append(title, count)

  const items = document.createElement('div')
  items.className = 'replica-items'

  const liveValues = replica.set.values().sort(compareValues)
  if (liveValues.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'empty'
    empty.textContent = 'empty'
    items.append(empty)
  } else {
    items.append(
      ...liveValues.map((value) =>
        createTile(
          {
            id: valueId(value),
            label: value,
            value,
          },
          replica.id
        )
      )
    )
  }

  const snapshot = replica.set.toJSON()
  const stats = document.createElement('p')
  stats.className = 'replica-stats'
  stats.textContent = `${snapshot.values.length} values / ${snapshot.tombstones.length} tombstones`

  card.append(heading, items, stats)
  return card
}

function createTile(
  entry: {
    readonly id: string
    readonly label: string
    readonly value: DemoValue
  },
  source: string
): HTMLElement {
  const tile = document.createElement('button')
  tile.type = 'button'
  tile.className = 'item-tile'
  tile.dataset.tile = 'true'
  tile.dataset.valueId = entry.id
  tile.dataset.source = source
  tile.dataset.value = entry.value
  tile.setAttribute('aria-label', entry.label)

  const shape = document.createElement('span')
  shape.className = `shape shape-${entry.value}`
  shape.setAttribute('aria-hidden', 'true')

  tile.append(shape)
  return tile
}

function wireDragTargets(): void {
  if (!replicasEl || !removeTarget) return
  const targets = [
    ...replicasEl.querySelectorAll<HTMLElement>('[data-drop-target="replica"]'),
    removeTarget,
  ]

  for (const tile of document.querySelectorAll<HTMLElement>('[data-tile]')) {
    const dragTarget = new DragTarget(tile, targets, 'replace', 180)

    dragTarget.addEventListener('intersecting', ({ detail }) => {
      detail.withEl.classList.add('is-targeted')
    })

    dragTarget.addEventListener('notintersecting', ({ detail }) => {
      detail.withEl.classList.remove('is-targeted')
    })

    dragTarget.addEventListener('settle', () => render())
    dragTarget.addEventListener('swap', ({ detail }) => {
      detail.withEl.classList.remove('is-targeted')
      commitDrop(tile, detail.withEl)
    })
  }
}

function commitDrop(tile: HTMLElement, target: HTMLElement): void {
  const value = readTileValue(tile)
  if (!value) {
    render()
    return
  }

  const source = tile.dataset.source ?? ''
  const replicaId = target.dataset.replicaId

  if (target.dataset.dropTarget === 'remove') {
    const replica = replicas.find((candidate) => candidate.id === source)
    if (replica) {
      replica.set.delete(value)
    }
    render()
    return
  }

  const replica = replicas.find((candidate) => candidate.id === replicaId)
  if (replica) {
    replica.set.add(value)
  }
  render()
}

async function gossip(): Promise<void> {
  if (gossiping) return
  gossiping = true
  gossipButton?.toggleAttribute('disabled', true)
  setStatus('gossiping snapshots between replicas')

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
    })
  )

  gossiping = false
  gossipButton?.toggleAttribute('disabled', false)
  render()
}

function animatePacket(
  sourceId: string,
  targetId: string,
  index: number
): Promise<void> {
  const source = document.querySelector<HTMLElement>(
    `[data-replica-id="${sourceId}"]`
  )
  const target = document.querySelector<HTMLElement>(
    `[data-replica-id="${targetId}"]`
  )
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

function updateStatus(): void {
  if (!demo) return
  const projections = replicas.map((replica) => projection(replica.set))
  const [first = ''] = projections
  const converged = projections.every((projection) => projection === first)
  const unionSize = new Set(
    replicas.flatMap((replica) => replica.set.values().map(valueId))
  ).size
  const duplicateVisible = replicas.some(
    (replica) => replica.set.size < replica.set.toJSON().values.length
  )

  demo.dataset.converged = String(converged)
  setStatus(
    converged
      ? `converged: ${unionSize} unique visible shapes`
      : `diverged: ${unionSize} unique shapes across ${replicas.length} replicas`
  )

  const dedup = document.querySelector<HTMLElement>('[data-dedup]')
  if (dedup) {
    dedup.textContent = duplicateVisible
      ? 'same content has one visible member'
      : 'duplicate drops stay no-op'
  }
}

function setStatus(message: string): void {
  if (statusEl) statusEl.textContent = message
}

function readTileValue(tile: HTMLElement): DemoValue | undefined {
  const value = tile.dataset.value
  return isDemoValue(value) ? value : undefined
}

function projection(set: CRSet<DemoValue>): string {
  return set.values().map(valueId).sort().join('|')
}

function valueId(value: DemoValue): string {
  return value
}

function compareValues(left: DemoValue, right: DemoValue): number {
  return valueId(left).localeCompare(valueId(right))
}

function isDemoValue(value: string | undefined): value is DemoValue {
  return (
    value === 'circle' ||
    value === 'square' ||
    value === 'triangle' ||
    value === 'diamond'
  )
}
