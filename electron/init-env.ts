import path from 'node:path'
import fs from 'node:fs'
import Module from 'node:module'

// Increase Bare RPC initialization timeout to 120s (default 30s can time out on macOS while loading 14 native C++ plugins)
if (!process.env.QVAC_RPC_INIT_TIMEOUT_MS) {
  process.env.QVAC_RPC_INIT_TIMEOUT_MS = '120000'
}

const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath

// Register unpacked node_modules in Node's module resolution path so packaged apps
// resolve `.prisma/client/default` and `@prisma/client` from `app.asar.unpacked/node_modules`.
if (resourcesPath) {
  const unpackedNodeModules = path.resolve(resourcesPath, 'app.asar.unpacked/node_modules')
  if (fs.existsSync(unpackedNodeModules)) {
    const existingNodePath = process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter) : []
    if (!existingNodePath.includes(unpackedNodeModules)) {
      process.env.NODE_PATH = [unpackedNodeModules, ...existingNodePath].join(path.delimiter)
      const mod = Module as typeof Module & { _initPaths?: () => void }
      if (typeof mod._initPaths === 'function') {
        mod._initPaths()
      }
    }
  }
}

// Set up QVAC_WORKER_PATH before any @qvac/sdk modules are initialized.
const workerCandidatePaths = [
  ...(resourcesPath
    ? [
        path.resolve(
          resourcesPath,
          'app.asar.unpacked/node_modules/@qvac/sdk/dist/src/worker/index.js'
        ),
        path.resolve(resourcesPath, 'node_modules/@qvac/sdk/dist/src/worker/index.js'),
      ]
    : []),
  path.resolve(process.cwd(), 'node_modules/@qvac/sdk/dist/src/worker/index.js'),
]

for (const p of workerCandidatePaths) {
  if (fs.existsSync(p)) {
    try {
      process.env.QVAC_WORKER_PATH = fs.realpathSync(p)
    } catch {
      process.env.QVAC_WORKER_PATH = p
    }
    break
  }
}
