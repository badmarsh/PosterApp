import { spawn, execSync } from 'child_process'
import os from 'os'
import fs from 'fs'
import path from 'path'
import treeKill from 'tree-kill'
import net from 'net'

const isWin = os.platform() === 'win32'
const PID_FILE = path.resolve('.dev.pid')

process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} --max-old-space-size=8192`.trim()

console.log('\n==================================================')
console.log('🚀 Starting PosterApp Dev Orchestrator')
console.log('==================================================\n')

// ---------------------------------------------------------------------------
// Helper: Check TCP port connection
// ---------------------------------------------------------------------------
function checkTcpPort(host, port, timeoutMs = 1000) {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    let resolved = false

    socket.setTimeout(timeoutMs)
    socket.once('connect', () => {
      resolved = true
      socket.destroy()
      resolve(true)
    })
    socket.once('timeout', () => {
      if (!resolved) {
        resolved = true
        socket.destroy()
        resolve(false)
      }
    })
    socket.once('error', () => {
      if (!resolved) {
        resolved = true
        socket.destroy()
        resolve(false)
      }
    })
    socket.connect(port, host)
  })
}

// ---------------------------------------------------------------------------
// Helper: Kill processes bound to a port
// ---------------------------------------------------------------------------
function killPort(port) {
  try {
    if (isWin) {
      const lines = execSync(`netstat -ano | findstr :${port}`).toString().split('\n')
      for (const line of lines) {
        const parts = line.trim().split(/\s+/)
        if (parts.length > 4) {
          const pid = parts[parts.length - 1]
          if (pid && pid !== '0') {
            try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' }) } catch {}
          }
        }
      }
    } else {
      execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' })
    }
  } catch {}
}

// ---------------------------------------------------------------------------
// 1. PostgreSQL via Docker (pgvector image required for vector extension)
// ---------------------------------------------------------------------------
console.log('📦 [1/3] Checking PostgreSQL + pgvector...')
let isDbReady = false
try {
  const isPostgresPortOpen = await checkTcpPort('127.0.0.1', 5432, 1000)
  if (isPostgresPortOpen) {
    console.log('   ✅ PostgreSQL database is accepting connections on port 5432.')
    isDbReady = true
  } else {
    const runningContainers = execSync('docker ps --format "{{.Names}}"', { stdio: ['ignore', 'pipe', 'ignore'] }).toString()
    if (runningContainers.includes('posterapp-postgres')) {
      console.log('   ✅ Container posterapp-postgres is running.')
      isDbReady = true
    } else {
      const allContainers = execSync('docker ps -a --format "{{.Names}}"', { stdio: ['ignore', 'pipe', 'ignore'] }).toString()
      if (allContainers.includes('posterapp-postgres')) {
        console.log('   📦 Starting existing posterapp-postgres container...')
        execSync('docker start posterapp-postgres', { stdio: 'inherit' })
        isDbReady = true
      } else {
        console.log('   📦 Creating posterapp-postgres (pgvector/pgvector:pg16)...')
        execSync(
          'docker run -d --name posterapp-postgres ' +
          '-e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=posterapp ' +
          '-p 5432:5432 pgvector/pgvector:pg16',
          { stdio: 'inherit' }
        )
        isDbReady = true
      }
    }
  }
} catch (err) {
  console.warn('   ⚠️  Could not check/start Docker. Ensure PostgreSQL is running on port 5432.')
}

// ---------------------------------------------------------------------------
// 2. MinerU Document Parser (WSL2 / Local Python)
// ---------------------------------------------------------------------------
console.log('🧠 [2/3] Checking MinerU document parsing service...')
let mineruProcess = null
let isMinerURunning = false
let discoveredMinerUUrl = null

function getMinerUCandidates() {
  const list = ['http://127.0.0.1:8001', 'http://localhost:8001']
  try {
    const ifaces = os.networkInterfaces()
    for (const name of Object.keys(ifaces)) {
      for (const iface of ifaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal && iface.address) {
          list.push(`http://${iface.address}:8001`)
        }
      }
    }
  } catch {}
  return Array.from(new Set(list))
}

for (const candidate of getMinerUCandidates()) {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 1200)
    const res = await fetch(`${candidate}/docs`, { signal: ctrl.signal })
    clearTimeout(t)
    if (res.ok || res.status === 200 || res.status === 404) {
      isMinerURunning = true
      discoveredMinerUUrl = candidate
      break
    }
  } catch {}
}

if (isMinerURunning) {
  console.log(`   ✅ MinerU is already running and reachable at ${discoveredMinerUUrl}.`)
} else {
  console.log('   🧠 Starting MinerU sidecar in WSL...')
  const mineruCmd = isWin
    ? ['wsl', '-d', 'Ubuntu', '-e', 'bash', '-c', 'cd ~/mineru && source .venv/bin/activate && mineru-api --host 0.0.0.0 --port 8001']
    : ['bash', '-c', 'cd ~/mineru && source .venv/bin/activate && mineru-api --port 8001']

  mineruProcess = spawn(mineruCmd[0], mineruCmd.slice(1), { stdio: 'pipe' })
  mineruProcess.stdout.on('data', (d) => process.stdout.write(`\x1b[35m[MinerU]\x1b[0m ${d}`))
  mineruProcess.stderr.on('data', (d) => process.stderr.write(`\x1b[35m[MinerU]\x1b[0m ${d}`))
}

// ---------------------------------------------------------------------------
// 3. Next.js server + Yjs WebSocket (Port 3333)
// ---------------------------------------------------------------------------
console.log('🌐 [3/3] Preparing Next.js & Yjs Server on port 3333...')
killPort(3333)

console.log('🚀 Launching server.ts on http://localhost:3333 ...\n')
const nextProcess = spawn('npx', ['tsx', '--env-file=.env.local', 'server.ts'], {
  stdio: 'pipe',
  env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=8192' },
  shell: isWin
})
nextProcess.stdout.on('data', (d) => process.stdout.write(`\x1b[36m[Next]\x1b[0m ${d}`))
nextProcess.stderr.on('data', (d) => process.stderr.write(`\x1b[36m[Next]\x1b[0m ${d}`))

// ---------------------------------------------------------------------------
// Save PIDs for stop.mjs
// ---------------------------------------------------------------------------
const pidData = {
  orchestratorPid: process.pid,
  nextPid: nextProcess.pid ?? null,
  mineruWslPid: mineruProcess?.pid ?? null,
  startedAt: new Date().toISOString(),
}
nextProcess.on('spawn', () => {
  pidData.nextPid = nextProcess.pid
  fs.writeFileSync(PID_FILE, JSON.stringify(pidData, null, 2), 'utf8')
})

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
let shuttingDown = false

function killWSLMinerU() {
  try {
    execSync('wsl -d Ubuntu -e bash -c "pkill -f mineru-api || true; fuser -k 8001/tcp || true"', { stdio: 'ignore', timeout: 5000 })
    console.log('🧹 Cleaned up MinerU inside WSL.')
  } catch {}
}

function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  console.log('\n🛑 Shutting down PosterApp Dev Orchestrator...')

  if (nextProcess?.pid) {
    try {
      treeKill(nextProcess.pid, 'SIGTERM', () => {})
    } catch {}
  }
  if (mineruProcess?.pid) {
    try {
      treeKill(mineruProcess.pid, 'SIGTERM', () => {})
    } catch {}
  }
  if (isWin) killWSLMinerU()
  killPort(3333)

  try { fs.unlinkSync(PID_FILE) } catch {}
  setTimeout(() => process.exit(code), 1500)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
process.on('exit', () => shutdown(0))

