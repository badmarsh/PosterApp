import * as fs from "fs"
import * as path from "path"
import { AI_CONFIG } from "@/lib/config/ai"

const WORKSPACES_DIR = path.join(process.cwd(), "workspaces")
export const MAX_SOURCE_CHARS = AI_CONFIG.generation.maxSourceChars

const contextCache = new Map<string, { snippets: string; timestamp: number }>()

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
  
  let latestTimestamp = 0;
  try {
    const stats = await Promise.all(mdFiles.map(f => fs.promises.stat(path.join(sourcesDir, f))));
    latestTimestamp = Math.max(...stats.map(s => s.mtimeMs), 0);
  } catch (e) {
    // Ignore stat errors
  }

  const cacheKey = `${workspaceId}:${maxChars}:${Array.isArray(sourceIds) ? sourceIds.join(",") : "all"}`;
  const cached = contextCache.get(cacheKey);
  
  if (cached && cached.timestamp === latestTimestamp) {
    return cached.snippets;
  }
  
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
  const finalContext = sourceContext.trim();
  contextCache.set(cacheKey, { snippets: finalContext, timestamp: latestTimestamp });
  
  return finalContext;
}
