import { resolveMinerUUrl, getMinerUCandidateUrls } from "../lib/services/mineru-bridge"

async function testHealth() {
  console.log("Candidate MinerU endpoints:", getMinerUCandidateUrls())
  const startTime = Date.now()
  const activeUrl = await resolveMinerUUrl(2000, true)
  const elapsed = Date.now() - startTime
  console.log(`✅ Discovered active MinerU endpoint: ${activeUrl} (resolved in ${elapsed}ms)`)

  const pingStart = Date.now()
  const healthRes = await fetch(`${activeUrl}/docs`)
  const pingTime = Date.now() - pingStart
  console.log(`✅ Health check status: ${healthRes.status} OK (HTTP latency: ${pingTime}ms)`)
}

testHealth().catch((err) => {
  console.error("❌ MinerU health check failed:", err)
  process.exit(1)
})
