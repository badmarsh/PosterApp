export async function generateCaption(base64Image: string, context: string): Promise<{caption: string, snippet: string}> {
  try {
    const prompt = context
      ? `You are an academic assistant. Here is the text surrounding this image in the document:\n\n<context>\n${context}\n</context>\n\nBased on the text context and the image, please provide:\n1. The exact original caption of the figure or table as it appears in the text.\n2. A concise 1-2 sentence description of what the figure or table shows. Do not start with phrases like "The figure shows" or "This image depicts" — just write the description directly.\n\nRespond EXACTLY with the following XML tags and nothing else:\n<original_caption>...</original_caption>\n<description>...</description>`
      : `You are an academic assistant. Concisely describe this figure or table in 1-2 sentences. Do not start with phrases like "The figure shows" or "This image depicts" — just write the description directly.\n\nRespond EXACTLY with the following XML tags and nothing else:\n<original_caption></original_caption>\n<description>...</description>`

    if (!process.env.AI_API_URL || !process.env.AI_API_KEY) {
      return { caption: "", snippet: "" }
    }

    const response = await fetch(process.env.AI_API_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.AI_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.AI_VISION_MODEL || process.env.AI_MODEL || "gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
            ]
          }
        ]
      }),
      signal: AbortSignal.timeout(30000)
    })

    if (!response.ok) return { caption: "", snippet: "" }
    const data = await response.json()
    const rawText = data.choices?.[0]?.message?.content?.trim() ?? ""
    
    // Extract using more forgiving regex
    const captionMatch = rawText.match(/<original_caption>([\s\S]*?)(?:<\/original[^>]*>|<description>|$)/i)
    const descMatch = rawText.match(/<description>([\s\S]*?)(?:<\/description[^>]*>|$)/i)
    
    // Fallback: if it ignored tags completely, just dump everything into snippet
    if (!captionMatch && !descMatch) {
      return { caption: "", snippet: rawText.replace(/<\/?[^>]+(>|$)/g, "").trim() }
    }
    
    let caption = captionMatch ? captionMatch[1].replace(/<\/?[^>]+(>|$)/g, "").trim() : ""
    let snippet = descMatch ? descMatch[1].replace(/<\/?[^>]+(>|$)/g, "").trim() : ""
    
    return { caption, snippet }
  } catch (e) {
    console.error("Vision caption generation failed:", e)
    return { caption: "", snippet: "" }
  }
}
