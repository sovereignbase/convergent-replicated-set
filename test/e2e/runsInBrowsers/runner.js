import * as api from '/runsInBrowsers/browser-dist.js'
import { printResults, runCRSetSuite } from '../shared/suite.mjs'

const results = await runCRSetSuite(api, { label: 'browser esm' })
printResults(results)
window.__CRSET_RESULTS__ = results
const status = document.getElementById('status')
if (status)
  status.textContent = results.ok ? 'ok' : 'failed: ' + results.errors.length
