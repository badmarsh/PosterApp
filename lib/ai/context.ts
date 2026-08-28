import * as fs from "fs"
import * as path from "path"

const WORKSPACES_DIR = path.join(process.cwd(), "workspaces")
export const MAX_SOURCE_CHARS = 80_000

export interface LoadContextOptions {
  workspaceId: string;
  sourceIds?: string[];
  maxChars?: number;
}

/**
 * Loads and concatenates source markdown documents for a workspace.
 * Implements deterministic ordering and character limits.
 */
export async function loadSourceContext(options: LoadContextOptions): Promise<string> {
  const { workspaceId, sourceIds, maxChars = MAX_SOURCE_CHARS } = options;
  const sourcesDir = path.join(WORKSPACES_DIR, workspaceId, "sources");
  
  if (!fs.existsSync(sourcesDir)) {
    return "";
  }

  const files = await fs.promises.readdir(sourcesDir);
  
  // Sort files deterministically to ensure stable cache hits if we implement one
  const mdFiles = files.filter(f => f.endsWith(".md")).sort();
  
  let sourceContext = "";
  
  for (const file of mdFiles) {
    const id = file.replace(".md", "");
    
    // Filter by specific sourceIds if provided
    if (Array.isArray(sourceIds) && sourceIds.length > 0 && !sourceIds.includes(id)) {
      continue;
    }
    
    const content = await fs.promises.readFile(path.join(sourcesDir, file), "utf-8");
    const chunk = `\n\n--- Source Document: ${file} ---\n\n${content}`;
    
    // Enforce size limits
    if (sourceContext.length + chunk.length > maxChars) {
      const remaining = maxChars - sourceContext.length;
      if (remaining > 500) {
        sourceContext += chunk.slice(0, remaining) + "\n\n[...truncated for length...]";
      }
      break;
    }
    
    sourceContext += chunk;
  }
  
  return sourceContext.trim();
}
