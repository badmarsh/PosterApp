// One-shot migration that rewrote 4 showcase cards in
// scripts/populate_elite_showcases.ts (WS1/WS2 metrics + bottleneck card).
//
// Status: STALE / NO-OP. The seed script has since been rewritten (PR #19)
// and none of this script's patch targets exist anymore.  The original
// version stored the card fragment in a nested template literal which made
// the file unparseable for ESLint; this repaired version keeps the exact
// patch semantics (guarded, idempotent) and exits cleanly when the targets
// are absent.  Delete this file once the showcase card refresh is handled
// by the seed script itself.

const fs = require("fs");
const file = "scripts/populate_elite_showcases.ts";
let content = fs.readFileSync(file, "utf8");

const WS1_NEEDLE = "- **28.4 BLEU** EN-DE Translation";
const WS2_NEEDLE = "- **3.57%** Top-5 Error";
const ANCHOR_NEEDLE = "id: 'res_c2_gradient_flow',";
const APPLIED_NEEDLE = "'res_c2_bottleneck'";

if (!content.includes(WS1_NEEDLE) && !content.includes(WS2_NEEDLE)) {
  console.log(
    "[patch_showcase_cards] stale one-shot script: patch targets are not " +
      "present in scripts/populate_elite_showcases.ts (seed was rewritten in " +
      "PR #19). Nothing to patch — exiting without changes. This script can " +
      "safely be deleted."
  );
  process.exit(0);
}

if (content.includes(APPLIED_NEEDLE)) {
  console.log("[patch_showcase_cards] already applied (res_c2_bottleneck present). No changes.");
  process.exit(0);
}

// WS1: bullet list -> compact "Metric | Value | Note" lines (same values)
content = content.replace(
  "- **28.4 BLEU** EN-DE Translation (+2.0 over prior SOTA)\\n- **41.0 BLEU** EN-FR Translation (Record single-model benchmark)\\n- **3.5 Days** Training Time (8 × NVIDIA P100 GPUs)",
  "- **28.4** | BLEU (EN-DE) | +2.0 over prior SOTA\\n- **41.0** | BLEU (EN-FR) | Record benchmark\\n- **3.5 d** | Training Time | 8 × P100 GPUs"
);

// WS2: classification metrics -> compact "Metric | Value | Note" lines
content = content.replace(
  "- **3.57%** Top-5 Error (Surpassed human benchmark of 5.1%)\\n- **1st Place** 5 Competition Tracks (Classification, Detection, Loc)\\n- **152 Layers** Deepest Architecture (8× deeper than VGG-16)",
  "- **3.57%** | Top-5 Error | Surpassed human 5.1%\\n- **1st** | 5 Tracks Winner | All ILSVRC & COCO tasks\\n- **152** | Layers | 8× deeper than VGG-16"
);

// Add Card 3 to WS2 Column 2 (Prisma card field for the seed file).
// Lines joined with newlines stay single-escaped ("\\times" -> "\times")
// so the content written into the seed file carries real LaTeX math.
const bottleneckLines = [
  "- **Dimension Reduction:** Uses $1 \\\\times 1$ conv to reduce feature dimensions (e.g. $256 \\\\to 64$), keeping computational cost bounded.",
  "- **Efficient Spatial Features:** Applies $3 \\\\times 3$ conv on the reduced bottleneck representations.",
  "- **Dimension Restoration:** Uses $1 \\\\times 1$ conv to restore channels ($64 \\\\to 256$) before the residual addition.",
  "- **Lower FLOPs than VGG:** Enables ResNet-152 (11.3 GFLOPs) to remain computationally lighter than VGG-16 (15.3 GFLOPs) despite an $8\\\\times$ increase in depth.",
];

const fragment =
  ",\n    {\n" +
  "      id: 'res_c2_bottleneck',\n" +
  "      outputId: out2.id,\n" +
  "      title: 'Bottleneck Design for Extreme Depth',\n" +
  "      column: 2,\n" +
  "      order: 2,\n" +
  "      pattern: 'bullets',\n" +
  "      content: `" +
  bottleneckLines.join("\\n") +
  "`,\n" +
  "      figureLayout: 'single',\n" +
  "      heightBudget: null,\n" +
  "      validation: 'valid',\n" +
  "      table: { hasHeader: false, caption: '', rows: [] },\n" +
  "      figures: [],\n" +
  "      sourceIds: [],\n" +
  "    }";

content = content.replace(
  /id: 'res_c2_gradient_flow',\n      outputId: out2\.id,[\s\S]*?sourceIds: \[\]\n    \}/,
  (match) => match + fragment
);

fs.writeFileSync(file, content, "utf8");
console.log("Successfully updated populate script");
