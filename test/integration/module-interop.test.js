import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import * as esmApi from '../../dist/index.js'

const require = createRequire(import.meta.url)
const cjsApi = require('../../dist/index.cjs')

const VALUE_ALPHA = {
  id: 'alpha',
  profile: { name: 'Alpha', active: true },
  tags: ['one', 'two'],
}
const VALUE_BETA = {
  id: 'beta',
  profile: { name: 'Beta', active: false },
  tags: ['two'],
}
const VALUE_GAMMA = {
  id: 'gamma',
  profile: { name: 'Gamma', active: true },
  tags: [],
}

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, normalize(value[key])])
  )
}

function projection(replica) {
  return replica
    .values()
    .map((value) => JSON.stringify(normalize(value)))
    .sort()
}

function normalizeSnapshot(snapshot) {
  return {
    values: [...snapshot.values]
      .map((entry) => ({
        uuidv7: entry.uuidv7,
        key: entry.value.key,
        value: normalize(entry.value.value),
        predecessor: entry.predecessor,
      }))
      .sort(
        (left, right) =>
          left.key.localeCompare(right.key) ||
          left.uuidv7.localeCompare(right.uuidv7)
      ),
    tombstones: [...snapshot.tombstones].sort(),
  }
}

test('esm and cjs builds interoperate via snapshots and deltas in both directions', () => {
  const esm = new esmApi.CRSet()
  const cjs = new cjsApi.CRSet()
  const esmDeltas = []
  const cjsDeltas = []

  esm.addEventListener('delta', (event) => {
    esmDeltas.push(structuredClone(event.detail))
  })
  cjs.addEventListener('delta', (event) => {
    cjsDeltas.push(structuredClone(event.detail))
  })

  esm.add(VALUE_ALPHA)
  cjs.merge(esmDeltas[0])
  cjs.add(VALUE_BETA)
  esm.merge(cjsDeltas[0])
  esm.delete(VALUE_ALPHA)
  cjs.merge(esmDeltas[1])
  cjs.add(VALUE_GAMMA)
  esm.merge(cjs.toJSON())

  assert.equal(esm.size, cjs.size)
  assert.deepEqual(projection(esm), projection(cjs))
  assert.deepEqual(
    normalizeSnapshot(esm.toJSON()),
    normalizeSnapshot(cjs.toJSON())
  )
})

test('public root export exposes CRSet and CRSetError', async () => {
  const mod = await import('../../dist/index.js')

  assert.equal(typeof mod.CRSet, 'function')
  assert.equal(typeof mod.CRSetError, 'function')
})

test('json cloned snapshots roundtrip across builds', () => {
  const esm = new esmApi.CRSet()
  esm.add(VALUE_ALPHA)
  esm.add(VALUE_BETA)

  const cjs = new cjsApi.CRSet(structuredClone(esm.toJSON()))

  assert.equal(cjs.size, 2)
  assert.deepEqual(projection(cjs), projection(esm))
  assert.deepEqual(
    normalizeSnapshot(cjs.toJSON()),
    normalizeSnapshot(esm.toJSON())
  )
})
