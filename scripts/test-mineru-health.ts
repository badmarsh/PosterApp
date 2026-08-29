import fs from "fs"
import path from "path"

async function testParse() {
  console.log("Checking MinerU health at http://localhost:8001/docs...")
  const healthRes = await fetch("http://localhost:8001/docs")
  console.log("Health check status:", healthRes.status)
}

testParse().catch(console.error)
