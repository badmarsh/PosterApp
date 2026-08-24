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
          if (pid !== '0') execSync(`taskkill /F /PID ${pid}`)
        }
      }
    } else {
      execSync(`fuser -k ${port}/tcp`)
    }
  } catch (e) {
    // Port likely already free
  }
}

console.log('🧹 Cleaning up ports 3333 and 8001...')
killPort(3333)
killPort(8001)

// 3. Spawn MinerU (WSL on Windows, bash on Unix)
console.log('🧠 Starting MinerU Sidecar...')
const mineruCmd = isWin 
  ? ['wsl', '-d', 'Ubuntu', '-e', 'bash', '-c', 'cd ~/mineru && source .venv/bin/activate && mineru-api --port 8001']
  : ['bash', '-c', 'cd ~/mineru && source .venv/bin/activate && mineru-api --port 8001']

const mineruProcess = spawn(mineruCmd[0], mineruCmd.slice(1), { stdio: 'pipe' })
mineruProcess.stdout.on('data', (d) => process.stdout.write(`\x1b[35m[MinerU]\x1b[0m ${d}`))
mineruProcess.stderr.on('data', (d) => process.stderr.write(`\x1b[35m[MinerU]\x1b[0m ${d}`))

// 4. Spawn Next.js
console.log('🌐 Starting Next.js...')
const nextProcess = spawn('npx', ['tsx', '--env-file=.env.local', 'server.ts'], {
  stdio: 'pipe',
  env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' },
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
  if (mineruProcess.pid) {
    treeKill(mineruProcess.pid, 'SIGTERM', (err) => {
      if (err) console.error('Failed to kill MinerU:', err)
    })
  }
  setTimeout(() => process.exit(code), 2000)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
process.on('exit', () => shutdown(0))
