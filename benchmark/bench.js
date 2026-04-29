import { CRSet } from '../dist/index.js'

const SET_SIZE = 5_000
const OPS = 250
const SEED_REVISIONS = 2

const BENCHMARKS = [
  {
    group: 'class',
    name: 'constructor / hydrate snapshot',
    n: SET_SIZE,
    ops: OPS,
  },
  { group: 'class', name: 'has / primitive value', n: SET_SIZE, ops: OPS },
  { group: 'class', name: 'has / object value', n: SET_SIZE, ops: OPS },
  { group: 'class', name: 'has / falsy value', n: SET_SIZE, ops: OPS },
  { group: 'class', name: 'has / missing value', n: SET_SIZE, ops: OPS },
  { group: 'class', name: 'values()', n: SET_SIZE, ops: OPS },
  { group: 'class', name: 'iterator', n: SET_SIZE, ops: OPS },
  { group: 'class', name: 'forEach()', n: SET_SIZE, ops: OPS },
  { group: 'class', name: 'add / string', n: SET_SIZE, ops: OPS },
  { group: 'class', name: 'add / object', n: SET_SIZE, ops: OPS },
  { group: 'class', name: 'add / duplicate object', n: SET_SIZE, ops: OPS },
  { group: 'class', name: 'delete(value)', n: SET_SIZE, ops: OPS },
  { group: 'class', name: 'clear()', n: SET_SIZE, ops: OPS },
  { group: 'class', name: 'snapshot', n: SET_SIZE, ops: OPS },
  { group: 'class', name: 'acknowledge', n: SET_SIZE, ops: OPS },
  { group: 'class', name: 'garbage collect', n: SET_SIZE, ops: OPS },
  { group: 'class', name: 'merge ordered deltas', n: SET_SIZE, ops: OPS },
  { group: 'class', name: 'merge direct successor', n: SET_SIZE, ops: OPS },
  { group: 'class', name: 'merge shuffled gossip', n: SET_SIZE, ops: OPS },
  { group: 'class', name: 'merge stale conflict', n: SET_SIZE, ops: OPS },
]

function random(seed) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
}

function shuffledIndices(length, seed) {
  const indices = Array.from({ length }, (_, index) => index)
  const rand = random(seed)
  for (let index = indices.length - 1; index > 0; index--) {
    const nextIndex = Math.floor(rand() * (index + 1))
    ;[indices[index], indices[nextIndex]] = [indices[nextIndex], indices[index]]
  }
  return indices
}

function stringValue(index, prefix = 'value') {
  return `${prefix}:${index}`
}

function objectValue(index, prefix = 'value') {
  return {
    memberId: `member:${index}`,
    displayName: `Member ${index}`,
    email: `${prefix}-${index}@example.com`,
    tags: index % 2 === 0 ? ['friend', 'vip'] : ['coworker'],
    active: index % 2 === 0,
  }
}

function mixedValue(index, prefix = 'value') {
  return index % 2 === 0
    ? stringValue(index, prefix)
    : objectValue(index, prefix)
}

function createSeededSet(size, revisions = SEED_REVISIONS) {
  const set = new CRSet()
  for (let revision = 0; revision < revisions; revision++) {
    for (let index = 0; index < size; index++) {
      set.add(mixedValue(index + revision * size, `seed-${revision}`))
    }
  }
  return set
}

function createSnapshot(size) {
  return createSeededSet(size).toJSON()
}

function readClassDelta(replica, action) {
  let delta
  const listener = (event) => {
    delta = event.detail
  }
  replica.addEventListener('delta', listener)
  try {
    action()
  } finally {
    replica.removeEventListener('delta', listener)
  }
  return delta
}

function readClassSnapshot(replica) {
  let snapshot
  const listener = (event) => {
    snapshot = event.detail
  }
  replica.addEventListener('snapshot', listener)
  try {
    replica.snapshot()
  } finally {
    replica.removeEventListener('snapshot', listener)
  }
  return snapshot
}

function readClassAck(replica) {
  let ack
  const listener = (event) => {
    ack = event.detail
  }
  replica.addEventListener('ack', listener)
  try {
    replica.acknowledge()
  } finally {
    replica.removeEventListener('ack', listener)
  }
  return ack
}

function collectOrderedClassDeltas(source, amount, offset) {
  const deltas = []
  for (let index = 0; index < amount; index++) {
    const delta = readClassDelta(source, () => {
      source.add(mixedValue(offset + index, 'delta'))
    })
    if (!delta) throw new Error(`ordered class delta failed at ${index}`)
    deltas.push(delta)
  }
  return deltas
}

function collectMixedClassDeltas(source, amount, offset) {
  const deltas = []
  const rand = random(0xc0ffee)

  for (let index = 0; index < amount; index++) {
    let delta

    if (index % 9 === 0 && source.size > 0) {
      delta = readClassDelta(source, () => {
        source.clear()
      })
    } else if (index % 4 === 0 && source.size > 0) {
      const values = source.values()
      const value = values[Math.floor(rand() * values.length)]
      delta = readClassDelta(source, () => {
        source.delete(value)
      })
    } else {
      delta = readClassDelta(source, () => {
        source.add(
          mixedValue(
            offset + Math.floor(rand() * Math.max(1, SET_SIZE)) + index,
            'mixed'
          )
        )
      })
    }

    if (!delta) {
      delta = readClassDelta(source, () => {
        source.add(mixedValue(offset + index, 'fallback'))
      })
    }
    if (!delta) throw new Error(`mixed class delta failed at ${index}`)
    deltas.push(delta)
  }

  return deltas
}

function createStaleConflictSnapshots() {
  const left = new CRSet()
  const right = new CRSet(readClassSnapshot(left))
  const value = objectValue(1, 'stale')

  left.add(value)
  right.add({ ...value, tags: [...value.tags] })

  const leftSnapshot = readClassSnapshot(left)
  const rightSnapshot = readClassSnapshot(right)
  const leftWins =
    leftSnapshot.values[0].uuidv7 > rightSnapshot.values[0].uuidv7

  return leftWins
    ? { targetSnapshot: leftSnapshot, incomingSnapshot: rightSnapshot }
    : { targetSnapshot: rightSnapshot, incomingSnapshot: leftSnapshot }
}

function time(fn) {
  const start = process.hrtime.bigint()
  const ops = fn()
  const end = process.hrtime.bigint()
  return { ms: Number(end - start) / 1_000_000, ops }
}

function runBenchmark(definition) {
  switch (`${definition.group}:${definition.name}`) {
    case 'class:constructor / hydrate snapshot': {
      const snapshot = createSnapshot(definition.n)
      return time(() => {
        for (let index = 0; index < definition.ops; index++) {
          new CRSet(snapshot)
        }
        return definition.ops
      })
    }
    case 'class:has / primitive value': {
      const replica = createSeededSet(definition.n)
      const value = stringValue(0, 'seed-0')
      return time(() => {
        for (let index = 0; index < definition.ops; index++) replica.has(value)
        return definition.ops
      })
    }
    case 'class:has / object value': {
      const replica = createSeededSet(definition.n)
      const value = objectValue(1, 'seed-0')
      return time(() => {
        for (let index = 0; index < definition.ops; index++) replica.has(value)
        return definition.ops
      })
    }
    case 'class:has / falsy value': {
      const replica = new CRSet()
      replica.add(false)
      return time(() => {
        for (let index = 0; index < definition.ops; index++) {
          replica.has(false)
        }
        return definition.ops
      })
    }
    case 'class:has / missing value': {
      const replica = createSeededSet(definition.n)
      const value = objectValue(definition.n * 4, 'missing')
      return time(() => {
        for (let index = 0; index < definition.ops; index++) replica.has(value)
        return definition.ops
      })
    }
    case 'class:values()': {
      const replica = createSeededSet(definition.n)
      return time(() => {
        for (let index = 0; index < definition.ops; index++) replica.values()
        return definition.ops
      })
    }
    case 'class:iterator': {
      const replica = createSeededSet(definition.n)
      return time(() => {
        let count = 0
        for (let index = 0; index < definition.ops; index++) {
          for (const value of replica) {
            if (value !== undefined) count++
          }
        }
        return count
      })
    }
    case 'class:forEach()': {
      const replica = createSeededSet(definition.n)
      return time(() => {
        let count = 0
        for (let index = 0; index < definition.ops; index++) {
          replica.forEach(() => {
            count++
          })
        }
        return count
      })
    }
    case 'class:add / string': {
      const replica = new CRSet(createSnapshot(definition.n))
      return time(() => {
        for (let index = 0; index < definition.ops; index++) {
          replica.add(stringValue(definition.n + index, 'bench'))
        }
        return definition.ops
      })
    }
    case 'class:add / object': {
      const replica = new CRSet(createSnapshot(definition.n))
      return time(() => {
        for (let index = 0; index < definition.ops; index++) {
          replica.add(objectValue(definition.n + index, 'bench'))
        }
        return definition.ops
      })
    }
    case 'class:add / duplicate object': {
      const replica = new CRSet()
      const value = objectValue(1, 'duplicate')
      replica.add(value)
      return time(() => {
        for (let index = 0; index < definition.ops; index++) {
          replica.add({ ...value, tags: [...value.tags] })
        }
        return definition.ops
      })
    }
    case 'class:delete(value)': {
      const snapshot = createSnapshot(definition.n)
      const value = stringValue(0, 'seed-0')
      const replicas = Array.from(
        { length: definition.ops },
        () => new CRSet(snapshot)
      )
      return time(() => {
        for (const replica of replicas) replica.delete(value)
        return replicas.length
      })
    }
    case 'class:clear()': {
      const snapshot = createSnapshot(definition.n)
      const replicas = Array.from(
        { length: definition.ops },
        () => new CRSet(snapshot)
      )
      return time(() => {
        for (const replica of replicas) replica.clear()
        return replicas.length
      })
    }
    case 'class:snapshot': {
      const replica = createSeededSet(definition.n)
      return time(() => {
        for (let index = 0; index < definition.ops; index++) {
          readClassSnapshot(replica)
        }
        return definition.ops
      })
    }
    case 'class:acknowledge': {
      const replica = createSeededSet(definition.n)
      return time(() => {
        for (let index = 0; index < definition.ops; index++) {
          readClassAck(replica)
        }
        return definition.ops
      })
    }
    case 'class:garbage collect': {
      const snapshot = createSnapshot(definition.n)
      const frontiers = Array.from({ length: 3 }, () =>
        readClassAck(new CRSet(snapshot))
      )
      const replicas = Array.from(
        { length: definition.ops },
        () => new CRSet(snapshot)
      )
      return time(() => {
        for (const replica of replicas) replica.garbageCollect(frontiers)
        return replicas.length
      })
    }
    case 'class:merge ordered deltas': {
      const source = new CRSet(createSnapshot(definition.n))
      const target = new CRSet(createSnapshot(definition.n))
      const deltas = collectOrderedClassDeltas(
        source,
        definition.ops,
        definition.n
      )
      return time(() => {
        for (const delta of deltas) target.merge(delta)
        return deltas.length
      })
    }
    case 'class:merge direct successor': {
      const baseSnapshot = readClassSnapshot(new CRSet())
      const source = new CRSet(baseSnapshot)
      const successor = readClassDelta(source, () => {
        source.add(objectValue(1, 'successor'))
      })
      if (!successor) throw new Error('direct successor class delta missing')
      const replicas = Array.from(
        { length: definition.ops },
        () => new CRSet(baseSnapshot)
      )
      return time(() => {
        for (const replica of replicas) replica.merge(successor)
        return replicas.length
      })
    }
    case 'class:merge shuffled gossip': {
      const source = new CRSet(createSnapshot(definition.n))
      const target = new CRSet(createSnapshot(definition.n))
      const deltas = collectMixedClassDeltas(
        source,
        definition.ops,
        definition.n
      )
      const order = shuffledIndices(deltas.length, 0xbeef)
      return time(() => {
        for (const index of order) target.merge(deltas[index])
        return order.length
      })
    }
    case 'class:merge stale conflict': {
      const { targetSnapshot, incomingSnapshot } =
        createStaleConflictSnapshots()
      const replicas = Array.from(
        { length: definition.ops },
        () => new CRSet(targetSnapshot)
      )
      return time(() => {
        for (const replica of replicas) replica.merge(incomingSnapshot)
        return replicas.length
      })
    }
    default:
      throw new Error(
        `unknown benchmark: ${definition.group}:${definition.name}`
      )
  }
}

function formatNumber(number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(
    number
  )
}

function pad(value, width) {
  return String(value).padEnd(width, ' ')
}

function printTable(rows) {
  const columns = [
    ['group', (row) => row.group],
    ['scenario', (row) => row.name],
    ['n', (row) => formatNumber(row.n)],
    ['ops', (row) => formatNumber(row.ops)],
    ['ms', (row) => formatNumber(row.ms)],
    ['ms/op', (row) => formatNumber(row.msPerOp)],
    ['ops/sec', (row) => formatNumber(row.opsPerSecond)],
  ]
  const widths = columns.map(([header, getter]) =>
    Math.max(header.length, ...rows.map((row) => getter(row).length))
  )
  console.log(
    columns.map(([header], index) => pad(header, widths[index])).join('  ')
  )
  console.log(widths.map((width) => '-'.repeat(width)).join('  '))
  for (const row of rows) {
    console.log(
      columns
        .map(([, getter], index) => pad(getter(row), widths[index]))
        .join('  ')
    )
  }
}

const rows = BENCHMARKS.map((definition) => {
  const result = runBenchmark(definition)
  return {
    ...definition,
    ops: result.ops,
    ms: result.ms,
    msPerOp: result.ms / result.ops,
    opsPerSecond: result.ops / (result.ms / 1_000),
  }
})

console.log('CRSet benchmark')
console.log(
  `node=${process.version} platform=${process.platform} arch=${process.arch}`
)
console.log('')
printTable(rows)
