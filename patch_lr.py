with open('lib/ai/local-reranker.ts', 'r', encoding='utf-8') as f:
    text = f.read()

old_fn = '''export async function crossEncoderScores(query: string, passages: string[]): Promise<number[] | null> {
  const reranker = getReranker()
  if (!reranker) return null
  return reranker.rerank(query, passages)
}'''

new_fn = '''export async function crossEncoderScores(query: string, passages: string[]): Promise<number[] | null> {
  // First attempt: High-performance GPU Qwen3-Reranker-0.6B microservice on CUDA (RTX 3090)
  try {
    const res = await fetch("http://127.0.0.1:8085/rerank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, documents: passages }),
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) {
      const data = await res.json() as any
      if (Array.isArray(data.scores) && data.scores.length === passages.length) {
        modelHealth.reranker.calls++
        modelHealth.reranker.warmedUp = true
        return data.scores
      }
    }
  } catch (gpuErr) {
    // GPU server unavailable or timed out; fall through to local fallback
  }

  // Fallback: Registry cross-encoder
  const reranker = getReranker()
  if (!reranker) return null
  return reranker.rerank(query, passages)
}'''

assert old_fn in text, "old_fn not found"
text = text.replace(old_fn, new_fn)

with open('lib/ai/local-reranker.ts', 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated crossEncoderScores in local-reranker.ts to use GPU Qwen3-Reranker-0.6B!")
