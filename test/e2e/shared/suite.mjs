const TEST_TIMEOUT_MS = 10_000

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
const VALUE_DELTA = {
  id: 'delta',
  profile: { name: 'Delta', active: false },
  tags: ['four'],
}
const VALUES = [VALUE_ALPHA, VALUE_BETA, VALUE_GAMMA, VALUE_DELTA]

export async function runCRSetSuite(api, options = {}) {
  const {
    label = 'runtime',
    includeStress = false,
    stressRounds = 12,
    verbose = false,
  } = options
  const results = { label, ok: true, errors: [], tests: [] }
  const { CRSet, CRSetError } = api

  function assert(condition, message) {
    if (!condition) throw new Error(message || 'assertion failed')
  }

  function assertEqual(actual, expected, message) {
    if (!Object.is(actual, expected)) {
      throw new Error(message || `expected ${actual} to equal ${expected}`)
    }
  }

  function normalize(value) {
    if (value === undefined) return { __type: 'undefined' }
    if (typeof value === 'number' && Number.isNaN(value))
      return { __type: 'NaN' }
    if (Array.isArray(value)) return value.map(normalize)
    if (!value || typeof value !== 'object') return value

    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalize(value[key])])
    )
  }

  function stableJson(value) {
    return JSON.stringify(normalize(value))
  }

  function assertJsonEqual(actual, expected, message) {
    const actualJson = stableJson(actual)
    const expectedJson = stableJson(expected)
    if (actualJson !== expectedJson) {
      throw new Error(
        message || `expected ${actualJson} to equal ${expectedJson}`
      )
    }
  }

  function assertSetValues(replica, expected, message) {
    const actualValues = replica.values().map(stableJson).sort()
    const expectedValues = expected.map(stableJson).sort()
    assertJsonEqual(actualValues, expectedValues, message || 'set mismatch')
  }

  function assertCRSetError(error, code, message) {
    assert(error instanceof CRSetError, message || 'expected CRSetError')
    assertEqual(error.name, 'CRSetError')
    assertEqual(error.code, code)
  }

  function createReplica(snapshot) {
    return new CRSet(snapshot)
  }

  function captureEvents(replica) {
    const events = {
      delta: [],
      change: [],
      snapshot: [],
      ack: [],
    }

    replica.addEventListener('delta', (event) => {
      events.delta.push(event.detail)
    })
    replica.addEventListener('change', (event) => {
      events.change.push(event.detail)
    })
    replica.addEventListener('snapshot', (event) => {
      events.snapshot.push(event.detail)
    })
    replica.addEventListener('ack', (event) => {
      events.ack.push(event.detail)
    })

    return events
  }

  function readSnapshot(replica) {
    return replica.toJSON()
  }

  function emitSnapshot(replica) {
    let snapshot

    replica.addEventListener(
      'snapshot',
      (event) => {
        snapshot = event.detail
      },
      { once: true }
    )
    assertEqual(replica.snapshot(), undefined)
    assert(snapshot, 'expected snapshot event detail')

    return snapshot
  }

  function emitAck(replica) {
    let ack = ''

    replica.addEventListener(
      'ack',
      (event) => {
        ack = event.detail
      },
      { once: true }
    )
    assertEqual(replica.acknowledge(), undefined)

    return ack
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

  function projection(replica) {
    return replica.values().map(stableJson).sort()
  }

  function assertProjectionEqual(actual, expected, message) {
    assertJsonEqual(actual, expected, message || 'projection mismatch')
  }

  function random(seed) {
    let state = seed >>> 0
    return () => {
      state = (state + 0x6d2b79f5) >>> 0
      let t = Math.imul(state ^ (state >>> 15), 1 | state)
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  function shuffled(values, seed) {
    const next = values.slice()
    const rand = random(seed)
    for (let index = next.length - 1; index > 0; index--) {
      const other = Math.floor(rand() * (index + 1))
      ;[next[index], next[other]] = [next[other], next[index]]
    }
    return next
  }

  function shuffledIndices(length, seed) {
    return shuffled(
      Array.from({ length }, (_, index) => index),
      seed
    )
  }

  function stressValue(step, replicaIndex) {
    const base = VALUES[(step + replicaIndex) % VALUES.length]
    return {
      id: base.id,
      profile: {
        name: `${base.profile.name}-${step % 7}`,
        active: (step + replicaIndex) % 2 === 0,
      },
      tags: [...base.tags, `step-${step % 5}`, `replica-${replicaIndex}`],
    }
  }

  function hostilePayload(step) {
    return step % 6 === 0
      ? null
      : step % 6 === 1
        ? false
        : step % 6 === 2
          ? []
          : step % 6 === 3
            ? { values: 'bad' }
            : step % 6 === 4
              ? { tombstones: 'bad' }
              : {
                  values: [
                    {
                      uuidv7: 'bad',
                      predecessor: 'bad',
                      value: { key: 'ghost', value: 'ignored' },
                    },
                  ],
                  tombstones: ['bad'],
                }
  }

  function settleReplicaSnapshots(replicas, rounds, seed, options = {}) {
    const { restartEveryRound = 0 } = options

    for (let round = 0; round < rounds; round++) {
      const snapshots = replicas.map((replica) => readSnapshot(replica))
      const deliveries = []

      for (let sourceIndex = 0; sourceIndex < snapshots.length; sourceIndex++) {
        for (
          let targetIndex = 0;
          targetIndex < replicas.length;
          targetIndex++
        ) {
          if (sourceIndex === targetIndex) continue
          deliveries.push({ sourceIndex, targetIndex })
        }
      }

      for (const deliveryIndex of shuffledIndices(
        deliveries.length,
        seed + round
      )) {
        const { sourceIndex, targetIndex } = deliveries[deliveryIndex]
        replicas[targetIndex].merge(snapshots[sourceIndex])
      }

      if (restartEveryRound > 0 && (round + 1) % restartEveryRound === 0) {
        const restartIndex = (seed + round) % replicas.length
        replicas[restartIndex] = createReplica(
          readSnapshot(replicas[restartIndex])
        )
      }
    }
  }

  function runSnapshotScenario(seed, options = {}) {
    const {
      replicaCount = 4,
      steps = 120,
      restartEvery = 0,
      settleRounds = 10,
      settleSeedOffset = 100_000,
    } = options
    const rng = random(seed)
    const replicas = Array.from({ length: replicaCount }, () => createReplica())

    for (let step = 0; step < steps; step++) {
      const actorIndex = Math.floor(rng() * replicas.length)
      const actor = replicas[actorIndex]
      const branch = rng()

      if (branch < 0.42) {
        actor.add(stressValue(step, actorIndex))
      } else if (branch < 0.6) {
        if (actor.size === 0 || rng() < 0.28) actor.clear()
        else actor.delete(stressValue(Math.floor(rng() * (step + 1)), 0))
      } else if (branch < 0.84) {
        const sourceIndex = Math.floor(rng() * replicas.length)
        if (sourceIndex !== actorIndex)
          actor.merge(readSnapshot(replicas[sourceIndex]))
      } else if (branch < 0.93) {
        actor.merge(hostilePayload(step))
      } else {
        const frontiers = replicas.map(emitAck).filter(Boolean)
        if (frontiers.length > 0) {
          for (const replica of replicas) replica.garbageCollect(frontiers)
        }
      }

      if (restartEvery > 0 && (step + 1) % restartEvery === 0) {
        const restartIndex = (seed + step) % replicas.length
        replicas[restartIndex] = createReplica(
          readSnapshot(replicas[restartIndex])
        )
      }
    }

    settleReplicaSnapshots(replicas, settleRounds, seed + settleSeedOffset)
    return replicas
  }

  function allOtherIndices(length, sourceIndex) {
    return Array.from({ length }, (_, index) => index).filter(
      (index) => index !== sourceIndex
    )
  }

  function queuePayload(queue, sourceIndex, payload, targets) {
    const uniqueTargets = [...new Set(targets)].filter(
      (targetIndex) => targetIndex !== sourceIndex
    )
    if (uniqueTargets.length === 0) return
    if (!payload || typeof payload !== 'object' || Array.isArray(payload))
      return
    if ((payload.values?.length ?? 0) + (payload.tombstones?.length ?? 0) < 1)
      return

    queue.push({
      sourceIndex,
      targets: uniqueTargets,
      payload: structuredClone(payload),
    })
  }

  function captureReplicaDeltas(replica, fn) {
    const deltas = []
    const listener = (event) => {
      deltas.push(event.detail)
    }
    replica.addEventListener('delta', listener)
    try {
      fn()
    } finally {
      replica.removeEventListener('delta', listener)
    }
    return deltas
  }

  function deliverOneReplicaMessage(replicas, queue, rand) {
    const messageIndex = Math.floor(rand() * queue.length)
    const message = queue[messageIndex]
    const targetOffset = Math.floor(rand() * message.targets.length)
    const targetIndex = message.targets.splice(targetOffset, 1)[0]
    const replyDeltas = captureReplicaDeltas(replicas[targetIndex], () => {
      replicas[targetIndex].merge(message.payload)
    })

    for (const replyDelta of replyDeltas) {
      queuePayload(
        queue,
        targetIndex,
        replyDelta,
        allOtherIndices(replicas.length, targetIndex)
      )
    }

    if (message.targets.length === 0) queue.splice(messageIndex, 1)
  }

  function drainReplicaQueue(replicas, queue, seed, options = {}) {
    const rand = random(seed)
    let deliveries = 0
    const maxDeliveries =
      options.maxDeliveries ??
      Math.max(2_000, queue.length * Math.max(1, replicas.length) * 8)

    while (queue.length > 0) {
      deliverOneReplicaMessage(replicas, queue, rand)
      deliveries++
      if (deliveries > maxDeliveries) {
        throw new Error(
          `replica gossip queue exceeded ${maxDeliveries} deliveries`
        )
      }
    }
  }

  function runQueuedDeltaScenario(seed, options = {}) {
    const {
      replicaCount = 4,
      steps = 120,
      restartEvery = 0,
      settleRounds = 8,
    } = options
    const rng = random(seed)
    const replicas = Array.from({ length: replicaCount }, () => createReplica())
    const queue = []

    for (let step = 0; step < steps; step++) {
      const actorIndex = Math.floor(rng() * replicas.length)
      const actor = replicas[actorIndex]
      const branch = rng()

      if (branch < 0.4) {
        const deltas = captureReplicaDeltas(actor, () => {
          actor.add(stressValue(step, actorIndex))
        })
        for (const delta of deltas) {
          queuePayload(
            queue,
            actorIndex,
            delta,
            allOtherIndices(replicas.length, actorIndex)
          )
        }
      } else if (branch < 0.58) {
        const deltas = captureReplicaDeltas(actor, () => {
          if (actor.size === 0 || rng() < 0.35) actor.clear()
          else actor.delete(stressValue(Math.floor(rng() * (step + 1)), 0))
        })
        for (const delta of deltas) {
          queuePayload(
            queue,
            actorIndex,
            delta,
            allOtherIndices(replicas.length, actorIndex)
          )
        }
      } else if (branch < 0.84) {
        if (queue.length > 0) {
          const deliveries = 1 + Math.floor(rng() * Math.min(4, queue.length))
          for (let index = 0; index < deliveries && queue.length > 0; index++) {
            deliverOneReplicaMessage(replicas, queue, rng)
          }
        }
      } else if (branch < 0.93) {
        actor.merge(hostilePayload(step))
      } else {
        const frontiers = replicas.map(emitAck).filter(Boolean)
        if (frontiers.length > 0) {
          for (const replica of replicas) replica.garbageCollect(frontiers)
        }
      }

      if (restartEvery > 0 && (step + 1) % restartEvery === 0) {
        const restartIndex = (seed + step) % replicas.length
        replicas[restartIndex] = createReplica(
          readSnapshot(replicas[restartIndex])
        )
      }
    }

    drainReplicaQueue(replicas, queue, seed + 90_000)
    settleReplicaSnapshots(replicas, settleRounds, seed + 120_000)
    return replicas
  }

  async function withTimeout(promise, ms, name) {
    let timer
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`timeout after ${ms}ms${name ? `: ${name}` : ''}`))
      }, ms)
    })
    return Promise.race([promise.finally(() => clearTimeout(timer)), timeout])
  }

  async function runTest(name, fn) {
    try {
      if (verbose) console.log(`${label}: ${name}`)
      await withTimeout(Promise.resolve().then(fn), TEST_TIMEOUT_MS, name)
      results.tests.push({ name, ok: true })
    } catch (error) {
      results.ok = false
      results.tests.push({ name, ok: false })
      results.errors.push({ name, message: String(error) })
    }
  }

  await runTest('exports shape', () => {
    assert(typeof CRSet === 'function', 'CRSet export missing')
    assert(typeof CRSetError === 'function', 'CRSetError export missing')

    const error = new CRSetError('VALUE_NOT_ENCODABLE')
    assertEqual(error.name, 'CRSetError')
    assertEqual(error.code, 'VALUE_NOT_ENCODABLE')
    assertEqual(
      error.message,
      '{@sovereignbase/convergent-replicated-set} VALUE_NOT_ENCODABLE'
    )
  })

  await runTest(
    'constructor collection surface serialization and empty acknowledge are coherent',
    () => {
      const replica = createReplica()
      const events = captureEvents(replica)
      const snapshot = readSnapshot(replica)

      assertEqual(replica.size, 0)
      assertJsonEqual(replica.values(), [])
      assertJsonEqual([...replica], [])
      assertSetValues(replica, [])
      assertJsonEqual(normalizeSnapshot(snapshot), {
        values: [],
        tombstones: [],
      })
      assertJsonEqual(normalizeSnapshot(emitSnapshot(replica)), {
        values: [],
        tombstones: [],
      })
      assertEqual(replica.toString(), JSON.stringify(snapshot))
      assertJsonEqual(
        replica[Symbol.for('nodejs.util.inspect.custom')](),
        snapshot
      )
      assertJsonEqual(replica[Symbol.for('Deno.customInspect')](), snapshot)

      replica.acknowledge()
      assertEqual(events.ack.length, 0)
    }
  )

  await runTest(
    'content-derived membership handles canonical object order and falsy values',
    () => {
      const replica = createReplica()
      const events = captureEvents(replica)
      const left = { b: 1, a: 2 }
      const right = { a: 2, b: 1 }
      const falsy = [false, 0, '', null]

      replica.add(left)
      replica.add(right)
      for (const value of falsy) replica.add(value)
      for (const value of falsy) replica.add(value)
      replica.add(undefined)

      assertEqual(replica.size, falsy.length + 1)
      assertEqual(replica.has(right), true)
      for (const value of falsy) assertEqual(replica.has(value), true)
      assertEqual(replica.has(undefined), true)
      assertEqual(events.delta.length, falsy.length + 1)
      assertEqual(events.change.length, falsy.length + 1)

      replica.delete({ a: 2, b: 1 })
      assertEqual(replica.has(left), false)
      assertEqual(replica.size, falsy.length)
    }
  )

  await runTest('object membership follows current encoded content', () => {
    const replica = createReplica()
    const value = { id: 'mutable', count: 1 }

    replica.add(value)
    value.count = 2

    assertEqual(replica.has(value), false)
    assertEqual(replica.has({ id: 'mutable', count: 1 }), true)
    replica.delete(value)
    assertEqual(replica.size, 1)
    replica.delete({ id: 'mutable', count: 1 })
    assertEqual(replica.size, 0)
  })

  await runTest(
    'reads iterators snapshots and change payloads are detached from live state',
    () => {
      const replica = createReplica()
      const events = captureEvents(replica)
      replica.add(VALUE_ALPHA)
      replica.add(VALUE_BETA)

      const values = replica.values()
      values[0].profile.active = false
      values[0].tags.push('values')
      values[1].tags.push('values')

      const iterated = [...replica]
      iterated[0].profile.active = false
      iterated[0].tags.push('iterator')
      iterated[1].tags.push('iterator')

      replica.forEach((value) => {
        value.profile.active = false
        value.tags.push('forEach')
      })

      const snapshot = emitSnapshot(replica)
      snapshot.values[0].value.value.profile.active = false
      snapshot.values[0].value.value.tags.push('snapshot')
      snapshot.tombstones.push('bad')

      events.change[0][Object.keys(events.change[0])[0]].profile.active = false
      events.change[0][Object.keys(events.change[0])[0]].tags.push('change')

      assertSetValues(replica, [VALUE_ALPHA, VALUE_BETA])
    }
  )

  await runTest(
    'local add duplicate delete missing delete and clear emit the expected channels',
    () => {
      const replica = createReplica()
      const events = captureEvents(replica)

      replica.add(VALUE_ALPHA)
      replica.add(VALUE_ALPHA)
      replica.add(VALUE_BETA)
      replica.delete({ id: 'ghost' })
      replica.delete(VALUE_ALPHA)
      replica.clear()
      replica.clear()

      assertEqual(replica.size, 0)
      assertEqual(events.delta.length, 4)
      assertEqual(events.change.length, 4)
      assertEqual(events.delta[0].values.length, 1)
      assertEqual(events.delta[2].tombstones.length, 1)
      assertEqual(Object.values(events.change[2])[0], undefined)
      assertEqual(Object.values(events.change[3])[0], undefined)
    }
  )

  await runTest('typed errors remain explicit', () => {
    const replica = createReplica()
    const events = captureEvents(replica)

    try {
      replica.add(Symbol('bad'))
      throw new Error('expected encode error')
    } catch (error) {
      if (error instanceof Error && error.message === 'expected encode error') {
        throw error
      }
      assertCRSetError(error, 'VALUE_NOT_ENCODABLE')
    }

    try {
      replica.add(new Proxy({ ok: true }, {}))
      throw new Error('expected clone error')
    } catch (error) {
      if (error instanceof Error && error.message === 'expected clone error') {
        throw error
      }
      assertCRSetError(error, 'VALUE_NOT_CLONEABLE')
    }

    try {
      replica.has(Symbol('bad'))
      throw new Error('expected has encode error')
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'expected has encode error'
      ) {
        throw error
      }
      assertCRSetError(error, 'VALUE_NOT_ENCODABLE')
    }

    assertEqual(replica.size, 0)
    assertEqual(events.delta.length, 0)
    assertEqual(events.change.length, 0)
  })

  await runTest(
    'merge ignores malformed top-level ingress without throwing',
    () => {
      const replica = createReplica()
      replica.add(VALUE_ALPHA)
      const before = normalizeSnapshot(readSnapshot(replica))

      for (const payload of [
        null,
        false,
        0,
        'bad',
        [],
        { values: 'bad' },
        { tombstones: 'bad' },
        { values: [null] },
        {
          values: [
            {
              uuidv7: 'bad',
              predecessor: 'bad',
              value: { key: 'ghost', value: 'ignored' },
            },
          ],
        },
      ]) {
        assertEqual(replica.merge(payload), undefined)
      }

      assertJsonEqual(normalizeSnapshot(readSnapshot(replica)), before)
    }
  )

  await runTest(
    'merge adopts remote adds and duplicate deltas are idempotent',
    () => {
      const source = createReplica()
      const sourceEvents = captureEvents(source)
      source.add(VALUE_ALPHA)

      const target = createReplica()
      const targetEvents = captureEvents(target)
      target.merge(sourceEvents.delta[0])
      target.merge(sourceEvents.delta[0])

      assertSetValues(target, [VALUE_ALPHA])
      assertEqual(targetEvents.change.length, 1)
      assertEqual(targetEvents.delta.length, 0)
    }
  )

  await runTest('delete and re-add converge across snapshot exchange', () => {
    const left = createReplica()
    const right = createReplica()

    left.add(VALUE_ALPHA)
    right.merge(readSnapshot(left))
    right.delete(VALUE_ALPHA)
    left.merge(readSnapshot(right))
    left.add(VALUE_ALPHA)
    right.merge(readSnapshot(left))
    left.merge(readSnapshot(right))

    assertSetValues(left, [VALUE_ALPHA])
    assertSetValues(right, [VALUE_ALPHA])
    assertJsonEqual(
      normalizeSnapshot(readSnapshot(left)),
      normalizeSnapshot(readSnapshot(right))
    )
  })

  await runTest(
    'concurrent same-value adds converge to one visible value',
    () => {
      const left = createReplica()
      const right = createReplica(readSnapshot(left))

      left.add(VALUE_ALPHA)
      right.add({
        tags: ['one', 'two'],
        profile: { active: true, name: 'Alpha' },
        id: 'alpha',
      })
      left.merge(readSnapshot(right))
      right.merge(readSnapshot(left))

      assertEqual(left.size, 1)
      assertEqual(right.size, 1)
      assertSetValues(left, [VALUE_ALPHA])
      assertSetValues(right, [VALUE_ALPHA])
    }
  )

  await runTest(
    'merge emits a reply delta for stale same-content ingress',
    () => {
      const left = createReplica()
      const right = createReplica(readSnapshot(left))

      left.add(VALUE_ALPHA)
      right.add({
        tags: ['one', 'two'],
        profile: { active: true, name: 'Alpha' },
        id: 'alpha',
      })

      const leftSnapshot = readSnapshot(left)
      const rightSnapshot = readSnapshot(right)
      const leftWins =
        leftSnapshot.values[0].uuidv7 > rightSnapshot.values[0].uuidv7
      const winner = leftWins ? left : right
      const loser = leftWins ? right : left
      const loserSnapshot = leftWins ? rightSnapshot : leftSnapshot
      const events = captureEvents(winner)

      winner.merge(loserSnapshot)

      assertEqual(events.change.length, 0)
      assertEqual(events.delta.length, 1)

      loser.merge(events.delta[0])

      assertSetValues(winner, [VALUE_ALPHA])
      assertSetValues(loser, [VALUE_ALPHA])
      assertJsonEqual(
        normalizeSnapshot(readSnapshot(winner)),
        normalizeSnapshot(readSnapshot(loser))
      )
    }
  )

  await runTest(
    'acknowledge and garbageCollect compact tombstones and ignore invalid frontiers',
    () => {
      const replica = createReplica()
      replica.add(VALUE_ALPHA)
      replica.delete(VALUE_ALPHA)
      replica.add(VALUE_ALPHA)
      const before = readSnapshot(replica)

      replica.garbageCollect(false)
      replica.garbageCollect([])
      replica.garbageCollect(['bad'])

      assertJsonEqual(
        normalizeSnapshot(readSnapshot(replica)),
        normalizeSnapshot(before)
      )

      const ack = emitAck(replica)
      assert(ack !== '', 'expected non-empty acknowledgement frontier')

      replica.garbageCollect([ack])
      const after = readSnapshot(replica)
      const current = after.values[0]

      assert(
        after.tombstones.includes(current.predecessor),
        'expected current predecessor to survive gc'
      )
      assert(
        after.tombstones.length < before.tombstones.length,
        'expected tombstone compaction'
      )
    }
  )

  await runTest(
    'listener objects removal and event channels behave consistently',
    () => {
      const replica = createReplica()
      let deltaDetail
      let snapshotCalls = 0
      const deltaListener = {
        handleEvent(event) {
          deltaDetail = event.detail
        },
      }
      const snapshotListener = () => {
        snapshotCalls++
      }

      replica.addEventListener('delta', deltaListener)
      replica.addEventListener('snapshot', snapshotListener)
      replica.add(VALUE_ALPHA)
      replica.snapshot()
      replica.removeEventListener('delta', deltaListener)
      replica.removeEventListener('snapshot', snapshotListener)
      replica.add(VALUE_BETA)
      replica.snapshot()

      assertEqual(deltaDetail.values.length, 1)
      assertEqual(snapshotCalls, 1)
    }
  )

  if (includeStress) {
    await runTest(
      'replicas converge after deterministic shuffled snapshot exchange',
      () => {
        const replicas = runSnapshotScenario(0xc0ffee, {
          replicaCount: 4,
          steps: stressRounds * 20,
          settleRounds: 12,
        })
        const expected = projection(replicas[0])

        for (let index = 1; index < replicas.length; index++) {
          assertProjectionEqual(projection(replicas[index]), expected)
        }
        for (const replica of replicas) {
          const hydrated = createReplica(readSnapshot(replica))
          assertProjectionEqual(projection(hydrated), expected)
        }
      }
    )

    await runTest(
      'replicas converge under queued delta delivery reply deltas and restarts',
      () => {
        const replicas = runQueuedDeltaScenario(0x5eed5eed, {
          replicaCount: 4,
          steps: stressRounds * 24,
          restartEvery: 9,
          settleRounds: 10,
        })
        const expected = projection(replicas[0])

        for (let index = 1; index < replicas.length; index++) {
          assertProjectionEqual(projection(replicas[index]), expected)
        }
        for (const replica of replicas) {
          const hydrated = createReplica(readSnapshot(replica))
          assertProjectionEqual(projection(hydrated), expected)
        }
      }
    )

    await runTest('25 aggressive deterministic convergence scenarios', () => {
      for (let scenario = 0; scenario < 25; scenario++) {
        const replicas =
          scenario % 2 === 0
            ? runSnapshotScenario(50_000 + scenario, {
                replicaCount: 3 + (scenario % 3),
                steps: 24 + (scenario % 5) * 8,
                restartEvery: scenario % 4 === 0 ? 7 : 0,
                settleRounds: 8,
              })
            : runQueuedDeltaScenario(60_000 + scenario, {
                replicaCount: 3 + (scenario % 3),
                steps: 20 + (scenario % 5) * 8,
                restartEvery: scenario % 4 === 1 ? 7 : 0,
                settleRounds: 8,
              })

        const expected = projection(replicas[0])
        for (let index = 1; index < replicas.length; index++) {
          assertProjectionEqual(
            projection(replicas[index]),
            expected,
            `scenario ${scenario} diverged`
          )
        }
        for (const replica of replicas) {
          const hydrated = createReplica(readSnapshot(replica))
          assertProjectionEqual(
            projection(hydrated),
            expected,
            `scenario ${scenario} hydrate mismatch`
          )
        }
      }
    })
  }

  return results
}

export function printResults(results) {
  const passed = results.tests.filter((test) => test.ok).length
  console.log(`${results.label}: ${passed}/${results.tests.length} passed`)
  if (!results.ok) {
    for (const error of results.errors) {
      console.error(`  - ${error.name}: ${error.message}`)
    }
  }
}

export function ensurePassing(results) {
  if (results.ok) return
  throw new Error(
    `${results.label} failed with ${results.errors.length} failing tests`
  )
}
