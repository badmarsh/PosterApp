export interface TavilySearchResult {
  title: string
  url: string
  content: string
  score: number
}

export async function searchTavily(query: string, signal?: AbortSignal): Promise<TavilySearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) {
    console.warn("TAVILY_API_KEY not configured, skipping Tavily search.")
    return []
  }

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        include_answer: false,
        max_results: 3,
      }),
      signal,
    })

    if (!res.ok) {
      console.warn(`Tavily search failed: ${res.statusText}`)
      return []
    }

    const data = await res.json()
    return data.results || []
  } catch (err) {
    console.error("Tavily search error:", err)
    return []
  }
}
