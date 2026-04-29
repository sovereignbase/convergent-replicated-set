import * as api from '../../../dist/index.js'
import { ensurePassing, printResults, runCRSetSuite } from '../shared/suite.mjs'

const results = await runCRSetSuite(api, { label: 'deno esm' })
printResults(results)
ensurePassing(results)
