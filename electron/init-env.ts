import path from 'node:path'
import fs from 'node:fs'

// Increase Bare RPC initialization timeout to 120s (default 30s can time out on macOS while loading 14 native C++ plugins)
if (!process.env.QVAC_RPC_INIT_TIMEOUT_MS) {
  process.env.QVAC_RPC_INIT_TIMEOUT_MS = '120000'
}

// Set up QVAC_WORKER_PATH before any @qvac/sdk modules are initialized.
const workerCandidatePaths = [
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
