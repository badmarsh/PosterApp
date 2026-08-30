import { spawn, execSync } from 'child_process'
import os from 'os'
import treeKill from 'tree-kill'

const isWin = os.platform() === 'win32'

console.log('🚀 Starting Dev Orchestrator...')

// 1. Check if Postgres container is running (if Docker is available)
try {
  const runningContainers = execSync('docker ps --format "{{.Names}}"').toString()
  if (runningContainers.includes('posterapp-postgres')) {
    console.log('✅ PostgreSQL container already running.')
  } else {
    const allContainers = execSync('docker ps -a --format "{{.Names}}"').toString()
    if (allContainers.includes('posterapp-postgres')) {
      console.log('📦 Starting posterapp-postgres container...')
      execSync('docker start posterapp-postgres', { stdio: 'inherit' })
    } else {
      console.log('📦 Creating and starting posterapp-postgres container...')
      execSync('docker run -d --name posterapp-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=posterapp -p 5432:5432 postgres:16-alpine', { stdio: 'inherit' })
    }
  }
} catch (err) {
  console.warn('⚠️ Could not check/start Docker. Make sure PostgreSQL is running locally.')
}

// 2. Kill zombie ports natively
function killPort(port) {
  try {
    if (isWin) {
      const pids = execSync(`netstat -ano | findstr :${port}`).toString().split('\n')
      for (const line of pids) {
        const parts = line.trim().split(/\s+/)
        if (parts.length > 4) {
          const pid = parts[parts.length - 1]
          if (pid !== '0') {
            try {
              execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' })
            } catch (e) {
              // Ignore if already dead
            }
          }
        }
      }
    } else {
      execSync(`fuser -k ${port}/tcp`)
    }
  } catch (e) {
    // Port likely already free
  }
}

import net from 'net'

console.log('🧹 Cleaning up port 3333...')
killPort(3333)

// 3. Spawn MinerU (WSL on Windows, bash on Unix)
let mineruProcess = null
let mineruBridgeServer = null
let isMinerURunning = false
try {
  await fetch('http://127.0.0.1:8001/docs')
  isMinerURunning = true
} catch (e) {
  isMinerURunning = false
}

if (isMinerURunning) {
  console.log('✅ MinerU is already reachable on port 8001.')
} else {
  console.log('🧠 Starting MinerU Sidecar...')
  const mineruCmd = isWin 
    ? ['wsl', '-d', 'Ubuntu', '-e', 'bash', '-c', 'cd ~/mineru && source .venv/bin/activate && mineru-api --host 0.0.0.0 --port 8001']
    : ['bash', '-c', 'cd ~/mineru && source .venv/bin/activate && mineru-api --port 8001']

  mineruProcess = spawn(mineruCmd[0], mineruCmd.slice(1), { stdio: 'pipe' })
  mineruProcess.stdout.on('data', (d) => process.stdout.write(`\x1b[35m[MinerU]\x1b[0m ${d}`))
  mineruProcess.stderr.on('data', (d) => process.stderr.write(`\x1b[35m[MinerU]\x1b[0m ${d}`))

  if (isWin) {
    // Start user-space WSL bridge on Windows to route 127.0.0.1:8001 to WSL
    mineruBridgeServer = net.createServer((clientSocket) => {
      const wslProcess = spawn("wsl", ["-d", "Ubuntu", "nc", "127.0.0.1", "8001"], { windowsHide: true })
      clientSocket.pipe(wslProcess.stdin)
      wslProcess.stdout.pipe(clientSocket)
      clientSocket.on("error", () => { try { wslProcess.kill() } catch {} })
      wslProcess.on("error", () => { try { clientSocket.destroy() } catch {} })
      wslProcess.on("close", () => { try { clientSocket.end() } catch {} })
    })
    mineruBridgeServer.on('error', () => {})
    mineruBridgeServer.listen(8001, '127.0.0.1', () => {
      console.log('🌉 WSL MinerU bridge listening on 127.0.0.1:8001')
    })
  }
}

// 4. Spawn Next.js
console.log('🌐 Starting Next.js...')
const nextProcess = spawn('npx', ['tsx', '--env-file=.env.local', 'server.ts'], {
  stdio: 'pipe',
  env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=8192' },
  shell: isWin
})
nextProcess.stdout.on('data', (d) => process.stdout.write(`\x1b[36m[Next]\x1b[0m ${d}`))
nextProcess.stderr.on('data', (d) => process.stderr.write(`\x1b[36m[Next]\x1b[0m ${d}`))

// 5. Graceful shutdown handler
function shutdown(code = 0) {
  console.log('\n🛑 Shutting down orchestrator. Cleaning up children...')
  if (nextProcess.pid) {
    treeKill(nextProcess.pid, 'SIGTERM', (err) => {
      if (err) console.error('Failed to kill Next.js:', err)
    })
  }
  if (mineruBridgeServer) {
    try { mineruBridgeServer.close() } catch {}
  }
  if (mineruProcess && mineruProcess.pid) {
    treeKill(mineruProcess.pid, 'SIGTERM', (err) => {
      if (err) console.error('Failed to kill MinerU:', err)
    })
  }
  setTimeout(() => process.exit(code), 2000)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
process.on('exit', () => shutdown(0))
