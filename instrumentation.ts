/**
 * Next.js instrumentation hook — runs once per server process start.
 * Pre-loads the local embedding model so the first thesis-review RAG query
 * does not pay the 10–30 s WASM cold start inside a user-facing request.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  if (process.env.VITEST || process.env.SKIP_EMBEDDING_WARMUP === "1") return
  // Fire-and-forget; never block boot on the model download.
  import("@/lib/ai/local-embeddings")
    .then(({ warmUpLocalEmbeddings }) => warmUpLocalEmbeddings())
    .then((ok) => {
      if (ok) console.info("[instrumentation] Local embedding model warmed up")
    })
    .catch((err) => console.warn("[instrumentation] Embedding warm-up failed:", err))
  // Cross-encoder reranker (bge-reranker-base) — warmed after the embedder so
  // the two downloads don't compete on first boot.
  import("@/lib/ai/local-reranker")
    .then(({ warmUpLocalReranker }) => warmUpLocalReranker())
    .then((ok) => {
      if (ok) console.info("[instrumentation] Local cross-encoder reranker warmed up")
    })
    .catch((err) => console.warn("[instrumentation] Reranker warm-up failed:", err))
}
