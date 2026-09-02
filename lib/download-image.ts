import fs from "fs/promises"
import path from "path"
import { WORKSPACES_ROOT } from "@/lib/workspace-files"

/**
 * Downloads a remote image and saves it locally in the workspace assets directory.
 * Returns the local URL that can be used in LaTeX.
 */
export async function downloadRemoteImage(url: string, workspaceId: string, filename: string): Promise<string> {
  try {
    // Create assets directory if it doesn't exist
    const assetsDir = path.join(WORKSPACES_ROOT, workspaceId, "assets")
    await fs.mkdir(assetsDir, { recursive: true })
    
    // Download the image
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`)
    }
    
    // Get the image buffer
    const buffer = await response.arrayBuffer()
    
    // Save the image to the assets directory
    const filePath = path.join(assetsDir, filename)
    await fs.writeFile(filePath, Buffer.from(buffer))
    
    // Return the local URL that the LaTeX generator can use
    return `/api/workspaces/${workspaceId}/assets/${filename}`
  } catch (error) {
    console.error(`Failed to download and save image from ${url}:`, error)
    // Return the original URL if download fails (though this will still cause LaTeX errors)
    return url
  }
}