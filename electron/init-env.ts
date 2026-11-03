import path from 'node:path'
import fs from 'node:fs'
import Module, { createRequire } from 'node:module'

// Increase Bare RPC initialization timeout to 120s (default 30s can time out on macOS while loading 14 native C++ plugins)
if (!process.env.QVAC_RPC_INIT_TIMEOUT_MS) {
  process.env.QVAC_RPC_INIT_TIMEOUT_MS = '120000'
}

const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath

// Register packaged node_modules in Node's module resolution path so packaged apps
// resolve `.prisma/client/default`, `@prisma/client`, and `@qvac/sdk` cleanly.
if (resourcesPath) {
  const candidateNodeModules = [
    path.resolve(resourcesPath, 'app/node_modules'),
    path.resolve(resourcesPath, 'app.asar.unpacked/node_modules'),
  ]
  const existingNodePath = process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter) : []
  let updated = false

  for (const dir of candidateNodeModules) {
    if (fs.existsSync(dir) && !existingNodePath.includes(dir)) {
      existingNodePath.unshift(dir)
      updated = true
    }
  }

  if (updated) {
    process.env.NODE_PATH = existingNodePath.join(path.delimiter)
    const mod = Module as typeof Module & { _initPaths?: () => void }
    if (typeof mod._initPaths === 'function') {
      mod._initPaths()
    }
  }
}

// Ensure bare-runtime-<platform>-<arch> binary path never points inside an .asar file
// (which causes child_process.spawn to fail with `Error: spawn ENOTDIR`) and has +x permissions.
try {
  const require = createRequire(import.meta.url)
  const targetPkg = `bare-runtime-${process.platform}-${process.arch}`
  const bareTarget = require(targetPkg) as { bare?: string }
  if (bareTarget && typeof bareTarget.bare === 'string') {
    if (bareTarget.bare.includes('.asar/') || bareTarget.bare.includes('.asar\\')) {
      const unpackedBin = bareTarget.bare.replace(/\.asar([/\\])/g, '.asar.unpacked$1')
      if (fs.existsSync(unpackedBin)) {
        bareTarget.bare = unpackedBin
      }
    }
    try {
      fs.chmodSync(bareTarget.bare, 0o755)
    } catch {
      // ignore
    }
  }
} catch {
  // ignore if target package is not installed on current platform
}

// Set up QVAC_WORKER_PATH before any @qvac/sdk modules are initialized.
const workerCandidatePaths = [
  ...(resourcesPath
    ? [
        path.resolve(
          resourcesPath,
          'app/node_modules/@qvac/sdk/dist/src/worker/index.js'
        ),
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
