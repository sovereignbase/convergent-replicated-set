import test from 'node:test'
import * as api from '../../dist/index.js'
import {
  ensurePassing,
  printResults,
  runCRSetSuite,
} from '../e2e/shared/suite.mjs'

test('unit: CRSet core invariants', async () => {
  const results = await runCRSetSuite(api, {
    label: 'unit',
    includeStress: false,
    stressRounds: 4,
  })
  printResults(results)
  ensurePassing(results)
})
