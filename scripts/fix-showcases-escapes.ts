import fs from "fs"

const filePath = "./lib/showcases-data.ts"
let content = fs.readFileSync(filePath, "utf8")

const beforeCount = (content.match(/\\\\n-/g) || []).length
console.log(`Found ${beforeCount} occurrences of "\\\\n-"`)

// Replace "\\n-" with "\n-"
content = content.replace(/\\\\n-/g, "\\n-")

const afterCount = (content.match(/\\\\n-/g) || []).length
console.log(`Remaining occurrences of "\\\\n-": ${afterCount}`)

fs.writeFileSync(filePath, content, "utf8")
console.log("Updated lib/showcases-data.ts successfully.")
