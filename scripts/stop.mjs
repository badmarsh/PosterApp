import { execSync } from "child_process";

console.log("🛑 Stopping Dev Servers...");

try {
  console.log("🧹 Cleaning up ports 3333 and 8001...");
  execSync("npx kill-port 3333 8001", { stdio: "inherit" });
} catch (e) {
  // Ignore errors if ports are already free
}

try {
  console.log("🔪 Force killing orphaned Node processes...");
  execSync("powershell -Command \"Stop-Process -Name node -Force -ErrorAction SilentlyContinue\"", { stdio: "inherit" });
} catch (e) {
  // Ignore if no Node processes
}

try {
  console.log("🔪 Force killing WSL sidecars...");
  execSync("powershell -Command \"Stop-Process -Name wsl -Force -ErrorAction SilentlyContinue\"", { stdio: "inherit" });
} catch (e) {
  // Ignore if no WSL processes
}

console.log("✅ All dev processes stopped!");
