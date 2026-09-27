import { generateLocalEmbeddings } from "../lib/ai/local-embeddings"
import { getModelHealthSnapshot } from "../lib/ai/model-registry"

async function main() {
  process.env.TEST_REAL_EMBEDDINGS = "1"
  process.env.EMBEDDING_LOCAL_ONLY = "1"
  process.env.EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2"
  process.env.EMBEDDING_LOCAL_PATH = ".cache/models"
  const v = await generateLocalEmbeddings(
    [
      "hadronic W boson jet energy scale",
      "calibration of the jet energy scale using the W mass",
      "banana bread recipe with walnuts",
    ],
    "passage",
  )
  const h = getModelHealthSnapshot()
  const cos = (a: number[], b: number[]) => {
    let d = 0, na = 0, nb = 0
    for (let i = 0; i < a.length; i++) {
      d += a[i] * b[i]
      na += a[i] * a[i]
      nb += b[i] * b[i]
    }
    return d / Math.sqrt(na * nb)
  }
  console.log(JSON.stringify({
    dim: v[0]?.length,
    fallback: h.embedding.fallbackCount,
    err: h.embedding.lastError,
    ms: h.embedding.inferenceMs,
    cosineRelated: Number(cos(v[0], v[1]).toFixed(3)),
    cosineUnrelated: Number(cos(v[0], v[2]).toFixed(3)),
    norm0: Number(Math.sqrt(v[0].reduce((s, x) => s + x * x, 0)).toFixed(3)),
  }))
  if (h.embedding.fallbackCount > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
