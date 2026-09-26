import type { OutputConfig } from "./poster-types"
import { galleryTemplateIds, templateGalleryFor } from "./template-showcase-data"

/**
 * Legacy entry point for "give me the demo document for this template".
 *
 * This module used to hold a hand-written demo where every template received
 * the *same* twelve blocks with a different accent colour — the exact failure
 * mode the curated galleries were written to fix. It now delegates to
 * `lib/template-showcase-data.ts`, which composes a genuinely different
 * document per template (four research subjects × per-output editions), so any
 * remaining caller gets real content instead of a re-tinted copy.
 *
 * Kept as a thin shim rather than deleted so external/older call sites keep
 * compiling; new code should import from `template-showcase-data` directly.
 */
export function getTemplateDemoOutput(templateId: string): OutputConfig | null {
  return templateGalleryFor(templateId)
}

export function getAllDemoTemplateIds(): string[] {
  return galleryTemplateIds()
}
