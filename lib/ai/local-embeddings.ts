import { pipeline, env } from "@xenova/transformers"

// We want to download the model if it's missing, but not rely on local filesystem caching
// inside standard Next.js folders that might get wiped.
env.allowLocalModels = false

class PipelineSingleton {
  static task: any = "feature-extraction"
  // Using a multilingual model that works very well for Slovak and Czech
  // It outputs 384-dimensional vectors.
  static model = "Xenova/paraphrase-multilingual-MiniLM-L12-v2"
  static instance: any = null

  static async getInstance(progress_callback?: any) {
    if (this.instance === null) {
      this.instance = await pipeline(this.task, this.model, { progress_callback })
    }
    return this.instance
  }
}

/**
 * Generates an embedding array for the given text using local Transformers.js model.
 * No API calls to OpenAI or external providers are made.
 *
 * @param text The chunk of text to embed
 * @returns number[] of 384 dimensions
 */
export async function generateLocalEmbedding(text: string): Promise<number[]> {
  const embedder = await PipelineSingleton.getInstance()
  const output = await embedder(text, { pooling: "mean", normalize: true })
  
  // output.data is a Float32Array, convert it to standard Array for Prisma/Postgres
  return Array.from(output.data)
}
