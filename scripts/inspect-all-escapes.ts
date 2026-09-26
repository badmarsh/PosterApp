import fs from "fs"

const text = fs.readFileSync("./lib/showcases-data.ts", "utf8")
const regex = /\\\\n/g
let match
let count = 0
while ((match = regex.exec(text)) !== null) {
  count++
  const start = Math.max(0, match.index - 30)
  const end = Math.min(text.length, match.index + 40)
  console.log(`[${count}] at ${match.index}: ...${text.slice(start, end).replace(/\n/g, "\\n")}...`)
}
console.log(`Total: ${count}`)
