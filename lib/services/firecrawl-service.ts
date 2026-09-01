export interface FirecrawlScrapeResult {
  success: boolean
  data?: {
    markdown?: string
    html?: string
    metadata?: Record<string, any>
  }
  error?: string
}

export async function scrapeWithFirecrawl(url: string, signal?: AbortSignal): Promise<FirecrawlScrapeResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) {
    console.warn("FIRECRAWL_API_KEY not configured, skipping Firecrawl scrape.")
    return { success: false, error: "Missing API Key" }
  }

  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
      }),
      signal,
    })

    if (!res.ok) {
      console.warn(`Firecrawl scrape failed: ${res.statusText}`)
      return { success: false, error: res.statusText }
    }

    const data = await res.json()
    return data
  } catch (err) {
    console.error("Firecrawl scrape error:", err)
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}
