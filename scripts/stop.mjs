import { execSync } from "child_process";

console.log("🛑 Stopping Dev Servers...");

try {
  console.log("🧹 Cleaning up port 3333...");
  execSync("npx kill-port 3333", { stdio: "inherit" });
} catch (e) {
  // Ignore errors if ports are already free
}

try {
  console.log("🔪 Force killing orphaned Node processes...");
  // Safely kill other node processes, excluding this script (process.pid) and its parent (pnpm)
  execSync(`powershell -Command "Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne ${process.pid} -and $_.Id -ne ${process.ppid} } | Stop-Process -Force -ErrorAction SilentlyContinue"`, { stdio: "inherit" });
} catch (e) {
  // Ignore if no Node processes or permission denied
}

console.log("✅ All dev processes stopped!");
