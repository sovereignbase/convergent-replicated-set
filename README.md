[![npm version](https://img.shields.io/npm/v/@sovereignbase/convergent-replicated-set)](https://www.npmjs.com/package/@sovereignbase/convergent-replicated-set)
[![CI](https://github.com/sovereignbase/convergent-replicated-set/actions/workflows/ci.yaml/badge.svg?branch=master)](https://github.com/sovereignbase/convergent-replicated-set/actions/workflows/ci.yaml)
[![codecov](https://codecov.io/gh/sovereignbase/convergent-replicated-set/branch/master/graph/badge.svg)](https://codecov.io/gh/sovereignbase/convergent-replicated-set)
[![license](https://img.shields.io/npm/l/@sovereignbase/convergent-replicated-set)](LICENSE)

# convergent-replicated-set

Convergent Replicated Set (CR-Set), a delta CRDT for unordered, duplicate-free collections.

- [Try the demo](https://sovereignbase.dev/convergent-replicated-set/)
- [Check the docs](https://sovereignbase.dev/convergent-replicated-set/docs/)
- [Read the specification](https://sovereignbase.dev/convergent-replicated-set/spec/)

## Compatibility

- Runtimes: Node >= 20, modern browsers, Bun, Deno, Cloudflare Workers, Edge Runtime.
- Module format: ESM + CommonJS.
- Required globals / APIs: `EventTarget`, `CustomEvent`, `structuredClone`.
- TypeScript: bundled types.

## Goals

- Deterministic convergence of the live set projection under asynchronous gossip delivery.
- Content-addressed membership for unordered, duplicate-free values.
- Consistent behavior across Node, browsers, worker, and edge runtimes.
- Garbage collection possibility without breaking live-set convergence.
- Event-driven API.

## Installation

```sh
npm install @sovereignbase/convergent-replicated-set
# or
pnpm add @sovereignbase/convergent-replicated-set
# or
yarn add @sovereignbase/convergent-replicated-set
# or
bun add @sovereignbase/convergent-replicated-set
# or
deno add jsr:@sovereignbase/convergent-replicated-set
# or
vlt install jsr:@sovereignbase/convergent-replicated-set
```

## Usage

### Copy-paste example

```ts
import { CRSet } from '@sovereignbase/convergent-replicated-set'

const alice = new CRSet<string>()
const bob = new CRSet<string>()

alice.addEventListener('delta', (event) => {
  bob.merge(event.detail)
})

alice.add('alpha')
alice.add('beta')
alice.add('alpha')

console.log(alice.size) // 2
console.log(bob.has('alpha')) // true
console.log(bob.values()) // ['alpha', 'beta']
```

### Hydrating from a snapshot

```ts
import {
  CRSet,
  type CRSetSnapshot,
} from '@sovereignbase/convergent-replicated-set'

type Member = {
  id: string
  role: 'admin' | 'member'
}

const source = new CRSet<Member>()
let snapshot!: CRSetSnapshot<Member>

source.addEventListener(
  'snapshot',
  (event) => {
    snapshot = event.detail
  },
  { once: true }
)

source.add({ id: 'alice', role: 'admin' })
source.add({ id: 'bob', role: 'member' })
source.snapshot()

const restored = new CRSet<Member>(snapshot)

console.log(restored.size) // 2
console.log(restored.has({ id: 'alice', role: 'admin' })) // true
```

### Event channels

```ts
import { CRSet } from '@sovereignbase/convergent-replicated-set'

const set = new CRSet<string>()

set.addEventListener('delta', (event) => {
  console.log('delta', event.detail)
})

set.addEventListener('change', (event) => {
  console.log('change', event.detail)
})

set.addEventListener('snapshot', (event) => {
  console.log('snapshot', event.detail)
})

set.addEventListener('ack', (event) => {
  console.log('ack', event.detail)
})

set.add('draft')
set.delete('draft')
set.snapshot()
set.acknowledge()
```

### Iteration and JSON serialization

```ts
import { CRSet } from '@sovereignbase/convergent-replicated-set'

const set = new CRSet<string>()

set.add('red')
set.add('green')
set.add('blue')

const serialized = JSON.stringify(set)
const restored = new CRSet<string>(JSON.parse(serialized))

for (const value of set) {
  console.log(value)
}

set.forEach((value, target) => {
  console.log(value, target.size)
})

console.log(set.values())
console.log(restored.has('green')) // true
```

This example assumes your set values are JSON-compatible. For general
`structuredClone`-compatible values such as `Date`, `Map`, or `BigInt`, persist
snapshots with a structured-clone-capable store or an application-level codec
instead of plain `JSON.stringify` / `JSON.parse`.

`values()`, `for...of`, and `forEach()` return detached copies of visible
values. Mutating those returned values does not mutate the underlying replica
state.

### Acknowledgements and garbage collection

```ts
import { CRSet, type CRSetAck } from '@sovereignbase/convergent-replicated-set'

const alice = new CRSet<string>()
const bob = new CRSet<string>()
const frontiers = new Map<string, CRSetAck>()

alice.addEventListener('delta', (event) => {
  bob.merge(event.detail)
})

bob.addEventListener('delta', (event) => {
  alice.merge(event.detail)
})

alice.addEventListener('ack', (event) => {
  frontiers.set('alice', event.detail)
})

bob.addEventListener('ack', (event) => {
  frontiers.set('bob', event.detail)
})

alice.add('x')
alice.delete('x')

alice.acknowledge()
bob.acknowledge()

alice.garbageCollect([...frontiers.values()])
bob.garbageCollect([...frontiers.values()])
```

## Runtime behavior

### Validation and errors

Public mutations can throw `CRSetError` with stable error codes:

- `VALUE_NOT_ENCODABLE`
- `VALUE_NOT_CLONEABLE`

Ingress stays tolerant through the underlying CR-Map replication layer:

- duplicate identical additions are no-ops
- duplicate delete and merge payloads are idempotent
- stale or dominated incoming state does not break live-set convergence
- dominated incoming state may emit a reply `delta`

### Safety and copying semantics

- Values are identified by the SHA-256 Base64URL digest of their canonical MessagePack encoding.
- Snapshots are serializable full-state payloads with `values` and `tombstones`.
- Deltas are serializable partial snapshot payloads with `values` and `tombstones`.
- `change` is a minimal value-keyed visible patch where deleted values map to `undefined`.
- `toJSON()` returns a detached serializable snapshot.
- `JSON.stringify()` and `toString()` are only reliable when set values are JSON-compatible.
- `values()`, `for...of`, and `forEach()` expose detached copies of visible values rather than mutable references into replica state.
- `add()`, `has()`, `delete()`, `clear()`, `merge()`, `snapshot()`, `acknowledge()`, and `garbageCollect()` all operate on the live set projection.

### Convergence and compaction

- The convergence target is the visible set projection, not identical internal tombstone sets.
- Membership is content-addressed: structurally identical canonical MessagePack values resolve to the same set member.
- `add()` is idempotent when the value's content key is already visible.
- `delete()` removes the visible value identified by the value's current content key.
- Tombstones remain until acknowledgement frontiers make them safe to collect.
- Garbage collection compacts tombstoned history while preserving the converged live projection for replicas that later catch up from delta or snapshot state.

## Tests

```sh
npm run test
```

Current status on Node `v22.14.0` (`win32 x64`): `npm run test` passes.

- Unit: `14/14` CRSet core invariants passed.
- Integration: `17/17` replication and stress invariants passed.
- Module interop: ESM/CJS snapshots and deltas, root exports, and JSON-cloned snapshots passed.
- Coverage: `100%` statements, branches, functions, and lines on built `dist/**/*.js`.
- End-to-end matrix passed: Node ESM/CJS, Bun ESM/CJS, Deno ESM, Cloudflare Workers ESM, Edge Runtime ESM, Chromium, Firefox, WebKit, mobile Chrome, and mobile Safari.

## Benchmarks

```sh
npm run bench
```

Last measured on Node `v22.14.0` (`win32 x64`):

| group   | scenario                         |     n |       ops |        ms | ms/op |    ops/sec |
| ------- | -------------------------------- | ----: | --------: | --------: | ----: | ---------: |
| `class` | `constructor / hydrate snapshot` | 5,000 |       250 | 17,511.69 | 70.05 |      14.28 |
| `class` | `has / primitive value`          | 5,000 |       250 |      2.02 |  0.01 | 123,578.84 |
| `class` | `has / object value`             | 5,000 |       250 |      2.92 |  0.01 |  85,683.93 |
| `class` | `has / falsy value`              | 5,000 |       250 |      1.63 |  0.01 | 152,951.97 |
| `class` | `has / missing value`            | 5,000 |       250 |      2.63 |  0.01 |  95,158.34 |
| `class` | `values()`                       | 5,000 |       250 |  8,841.84 | 35.37 |      28.27 |
| `class` | `iterator`                       | 5,000 | 2,500,000 |  7,869.60 |  0.00 | 317,677.98 |
| `class` | `forEach()`                      | 5,000 | 2,500,000 |  8,213.18 |  0.00 | 304,388.64 |
| `class` | `add / string`                   | 5,000 |       250 |      6.82 |  0.03 |  36,636.48 |
| `class` | `add / object`                   | 5,000 |       250 |     11.62 |  0.05 |  21,521.85 |
| `class` | `add / duplicate object`         | 5,000 |       250 |      2.33 |  0.01 | 107,153.57 |
| `class` | `delete(value)`                  | 5,000 |       250 |      4.69 |  0.02 |  53,342.44 |
| `class` | `clear()`                        | 5,000 |       250 |  1,026.42 |  4.11 |     243.56 |
| `class` | `snapshot`                       | 5,000 |       250 |  7,950.54 | 31.80 |      31.44 |
| `class` | `acknowledge`                    | 5,000 |       250 |    678.65 |  2.71 |     368.38 |
| `class` | `garbage collect`                | 5,000 |       250 |    157.49 |  0.63 |   1,587.36 |
| `class` | `merge ordered deltas`           | 5,000 |       250 |      4.57 |  0.02 |  54,746.52 |
| `class` | `merge direct successor`         | 5,000 |       250 |      4.73 |  0.02 |  52,831.78 |
| `class` | `merge shuffled gossip`          | 5,000 |       250 |      8.87 |  0.04 |  28,172.82 |
| `class` | `merge stale conflict`           | 5,000 |       250 |      5.42 |  0.02 |  46,103.35 |

## License

Apache-2.0
