/**
 * Held-out golden retrieval evaluation (offline, no network).
 *
 * Generation (first run, needs the local ONNX model documented in
 * scripts/embed-analysis2.ts; rejects any embedding fallback and writes the
 * compact vector cache):
 *   pnpm exec tsx scripts/score-heldout-golden.ts
 *
 * Offline replay (verifies the saved vector fingerprint; no model, no network):
 *   pnpm exec tsx scripts/score-heldout-golden.ts --cached-vectors
 *
 * Results go to artifacts/eval/heldout-golden/{report,label-audit}.json.
 * These metrics pin harness behavior against the committed golden-v2
 * judgments; they do NOT establish real retrieval quality (see report.scope).
 */
import { runHeldoutGoldenEval } from "../lib/ai/eval/heldout-golden-retrieval"

runHeldoutGoldenEval({ cachedVectors: process.argv.includes("--cached-vectors") })
  .then(({ report }) => {
    console.log(JSON.stringify(report.bindings.map((b) => ({
      binding: b.binding,
      chunkUnits: b.chunkUnits,
      judgedChunksMissing: b.judgedChunksMissing,
      conditions: b.conditions.map(({ perQuery, lowestNdcg10, ...summary }) => summary),
    })), null, 2))
  })
  .catch((err) => { console.error(err); process.exit(1) })
