import { ALL_SHOWCASE_PROJECTS, DEMO_WORKSPACE_IDS } from "./showcases-data"
import type { Project, OutputConfig, Card } from "./poster-types"
import { galleryBibEntriesFor, templateGalleryFor } from "./template-showcase-data"

/**
 * The in-memory demo project shown before a workspace is selected.
 *
 * It is assembled from the curated galleries rather than hand-written, so the
 * first thing a user sees is a *finished* document — real prose, real tables,
 * real figures, a resolvable bibliography — instead of the previous
 * placeholder cards. All three outputs share one research subject because a
 * project has a single title, author list and venue: three unrelated studies
 * inside one project is a content bug, not a demo.
 */
function buildDefaultDemoProject(): Project {
  const demoOutputs: { type: OutputConfig["outputType"]; templateId: string; id: string }[] = [
    { type: "poster", templateId: "gemini", id: "out_poster_1" },
    { type: "paper", templateId: "article-twocol", id: "out_paper_1" },
    { type: "slides", templateId: "beamer-metropolis", id: "out_slides_1" },
  ]

  const outputs: OutputConfig[] = demoOutputs.map(({ type, templateId, id }) => {
    const gallery = templateGalleryFor(templateId)
    if (!gallery) throw new Error(`[mock-data] no curated example for demo template "${templateId}"`)
    return {
      ...gallery,
      id,
      // Per-project card ids: the gallery's ids are stable per template, but a
      // project may hold the same template more than once.
      cards: gallery.cards.map((card: Card, index: number) => ({
        ...card,
        id: `card_demo_${type}_${index + 1}`,
        order: card.order ?? index,
      })),
    }
  })

  const poster = outputs[0]
  const bibContent = galleryBibEntriesFor("gemini")
    .map((entry) => entry.rawBibtex)
    .join("\n\n")

  // `bibContent` is deliberately not part of the `Project` type (the editor
  // store owns the bibliography for server workspaces), but the LaTeX pipeline
  // reads it as a fallback — `resolveBibSource(workspace || { bibContent })` —
  // so the in-memory demo project carries its own so its posters and papers
  // compile with resolved citations instead of "?" keys.
  return {
    id: "demo_ws",
    name: poster.title,
    posterTitle: poster.title,
    authors: poster.authors ?? "",
    venue: poster.venue ?? "",
    templateName: poster.templateId,
    activeOutputId: poster.id,
    bibContent,
    assets: [],
    outputs,
    ingestFiles: [
      {
        id: "file_1",
        name: "surgivla_cvpr2026.pdf",
        size: 4500000,
        method: "MinerU",
        status: "done",
        progress: 100,
      },
    ],
  } as unknown as Project
}

const defaultDemoProject: Project = buildDefaultDemoProject()

export const sampleProjects: Project[] = [
  defaultDemoProject,
  ...ALL_SHOWCASE_PROJECTS,
]

/** ID of the in-memory demo project shown before a workspace is selected. */
export const DEMO_PROJECT_ID = defaultDemoProject.id
export const isDemoProject = (id: string) =>
  id === DEMO_PROJECT_ID || id.startsWith("demo_") || (DEMO_WORKSPACE_IDS as readonly string[]).includes(id)
