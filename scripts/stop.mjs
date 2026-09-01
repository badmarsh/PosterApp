import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import treeKill from 'tree-kill'
import { promisify } from 'util'
import os from 'os'

const treeKillAsync = promisify(treeKill)
const PID_FILE = path.resolve('.dev.pid')
const isWin = os.platform() === 'win32'

const args = process.argv.slice(2)
const stopDb = args.includes('--all') || args.includes('--with-db') || args.includes('-a')

console.log('\n==================================================')
console.log('🛑 Stopping PosterApp Dev Services')
console.log('==================================================\n')

// ---------------------------------------------------------------------------
// 1. Read PID file written by dev.mjs and kill tracked processes
// ---------------------------------------------------------------------------
let pidData = null
try {
  pidData = JSON.parse(fs.readFileSync(PID_FILE, 'utf8'))
  console.log(`📋 [1/4] Found PID file: ${JSON.stringify(pidData)}`)
} catch {
  console.log('📋 [1/4] No active .dev.pid file found.')
}

if (pidData) {
  for (const [name, pid] of Object.entries(pidData)) {
    if (!pid || typeof pid !== 'number') continue
    if (pid === process.pid || pid === process.ppid) continue
    try {
      await treeKillAsync(pid, 'SIGTERM')
      console.log(`   ✅ Terminated ${name} (PID ${pid})`)
    } catch {
      // Process already terminated
    }
  }
  try { fs.unlinkSync(PID_FILE) } catch {}
}

// ---------------------------------------------------------------------------
// 2. Kill zombie listeners on Port 3333 (Next.js) & Port 8001 (MinerU)
// ---------------------------------------------------------------------------
console.log('🧹 [2/4] Releasing TCP ports (3333, 8001)...')

function killPort(port) {
  try {
    if (isWin) {
      const lines = execSync(`netstat -ano | findstr :${port}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().split('\n')
      for (const line of lines) {
        const parts = line.trim().split(/\s+/)
        if (parts.length > 4) {
          const pid = parts[parts.length - 1]
          if (pid && pid !== '0' && pid !== String(process.pid)) {
            try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' }) } catch {}
          }
        }
      }
    } else {
      execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' })
    }
  } catch {}
}

killPort(3333)
killPort(8001)
console.log('   ✅ Windows port listeners cleared.')

// ---------------------------------------------------------------------------
// 3. Kill MinerU processes inside WSL
// ---------------------------------------------------------------------------
console.log('🧠 [3/4] Stopping MinerU processes in WSL...')
if (isWin) {
  try {
    execSync('wsl -d Ubuntu -e bash -c "pkill -f mineru-api || true; fuser -k 8001/tcp || true"', { stdio: 'ignore', timeout: 5000 })
    console.log('   ✅ Terminated mineru-api inside WSL.')
  } catch {
    console.log('   ℹ️  WSL not active or already stopped.')
  }
}

// ---------------------------------------------------------------------------
// 4. Handle PostgreSQL Database Container
// ---------------------------------------------------------------------------
console.log('📦 [4/4] Checking PostgreSQL database...')
if (stopDb) {
  try {
    execSync('docker stop posterapp-postgres', { stdio: 'inherit' })
    console.log('   ✅ PostgreSQL container posterapp-postgres stopped.')
  } catch {
    console.log('   ℹ️  PostgreSQL container was not running.')
  }
} else {
  console.log('   💡 PostgreSQL container is kept running for quick restarts.')
  console.log('      (To stop the database too, run: pnpm stop --all or pnpm stop:db)\n')
}

console.log('==================================================')
console.log('✅ PosterApp services stopped successfully!')
console.log('==================================================\n')


