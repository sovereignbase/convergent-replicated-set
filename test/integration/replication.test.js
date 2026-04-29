import test from 'node:test'
import * as api from '../../dist/index.js'
import {
  ensurePassing,
  printResults,
  runCRSetSuite,
} from '../e2e/shared/suite.mjs'

test('integration: CRSet replication and stress invariants', async () => {
  const results = await runCRSetSuite(api, {
    label: 'integration',
    includeStress: true,
    stressRounds: 10,
  })
  printResults(results)
  ensurePassing(results)
})
