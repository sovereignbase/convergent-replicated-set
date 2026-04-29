import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import * as crMap from '@sovereignbase/convergent-replicated-map'
import * as msgpack from '@msgpack/msgpack'
import * as sha2 from '@noble/hashes/sha2.js'
import * as bytecodec from '@sovereignbase/bytecodec'
import { EdgeRuntime } from 'edge-runtime'
import { ensurePassing, printResults, runCRSetSuite } from '../shared/suite.mjs'

const root = process.cwd()
const esmDistPath = resolve(root, 'dist', 'index.js')

function toDestructure(specifiers, globalName) {
  const members = specifiers
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [left, right] = part.split(/\s+as\s+/)
      return right ? `${left.trim()}: ${right.trim()}` : left.trim()
    })
    .join(', ')

  return `const { ${members} } = ${globalName};\n`
}

function replaceNamedImports(bundleCode, packageName, globalName) {
  const pattern = new RegExp(
    `import\\s*\\{([^}]*)\\}\\s*from\\s*["']${packageName.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    )}["'];\\s*`,
    'g'
  )

  return bundleCode.replace(pattern, (_, specifiers) =>
    toDestructure(specifiers, globalName)
  )
}

function toExecutableEdgeEsm(bundleCode) {
  const withoutImports = replaceNamedImports(
    replaceNamedImports(
      replaceNamedImports(
        replaceNamedImports(
          bundleCode,
          '@sovereignbase/convergent-replicated-map',
          'globalThis.__CRSET_MAP'
        ),
        '@msgpack/msgpack',
        'globalThis.__CRSET_MSGPACK'
      ),
      '@noble/hashes/sha2.js',
      'globalThis.__CRSET_SHA2'
    ),
    '@sovereignbase/bytecodec',
    'globalThis.__CRSET_BYTECODEC'
  )

  const exportMatch = withoutImports.match(
    /export\s*\{\s*([\s\S]*?)\s*\};\s*(\/\/# sourceMappingURL=.*)?\s*$/
  )
  if (!exportMatch)
    throw new Error('edge-runtime esm harness could not find bundle exports')

  const exportEntries = exportMatch[1]
    .split(',')
    .map((specifier) => specifier.trim())
    .filter(Boolean)
    .map((specifier) => {
      const [localName, exportedName] = specifier.split(/\s+as\s+/)
      return exportedName
        ? `${JSON.stringify(exportedName)}: ${localName}`
        : localName
    })
    .join(',\n  ')

  const sourceMapComment = exportMatch[2] ? `${exportMatch[2]}\n` : ''
  return (
    withoutImports.slice(0, exportMatch.index) +
    `globalThis.__CRSET_EXPORTS__ = {\n  ${exportEntries}\n};\n` +
    sourceMapComment
  )
}

const runtime = new EdgeRuntime()
runtime.context.__CRSET_MAP = crMap
runtime.context.__CRSET_MSGPACK = msgpack
runtime.context.__CRSET_SHA2 = sha2
runtime.context.__CRSET_BYTECODEC = bytecodec
runtime.evaluate(`
  if (typeof globalThis.CustomEvent === 'undefined') {
    globalThis.CustomEvent = class CustomEvent extends Event {
      constructor(type, init = {}) {
        super(type, init)
        this.detail = init.detail ?? null
      }
    }
  }
`)

const moduleCode = await readFile(esmDistPath, 'utf8')
runtime.evaluate(toExecutableEdgeEsm(moduleCode))

const results = await runCRSetSuite(runtime.context.__CRSET_EXPORTS__, {
  label: 'edge-runtime esm',
  runtimeGlobals: runtime.context,
})
printResults(results)
ensurePassing(results)
