import { prisma } from "@/lib/prisma"

/**
 * Resolve the source documents that are visible to a restricted-context agent.
 *
 * Card restrictions are expressed as card IDs, while the RAG index is keyed by
 * the ingest-file/document ID stored in Card.sourceIds. Resolve the relationship
 * only through cards in the requested workspace so a key cannot smuggle a card
 * from another tenant into a retrieval query.
 *
 * `null` means that the key is unrestricted. An empty array is meaningful: a
 * restricted key whose cards have no indexed sources must receive no RAG hits,
 * rather than falling back to the complete workspace corpus.
 */
export async function resolveAgentRagDocumentIds(
  workspaceId: string,
  restrictCardIds: string[]
): Promise<string[] | null> {
  if (restrictCardIds.length === 0) return null

  const cards = await prisma.card.findMany({
    where: {
      id: { in: Array.from(new Set(restrictCardIds)) },
      output: { workspaceId },
    },
    select: { sourceIds: true },
  })

  const documentIds = new Set<string>()
  for (const card of cards) {
    const sourceIds =
      Array.isArray(card.sourceIds)
        ? card.sourceIds
        : typeof card.sourceIds === "string"
        ? (() => {
            try {
              const parsed = JSON.parse(card.sourceIds)
              return Array.isArray(parsed) ? parsed : []
            } catch {
              return []
            }
          })()
        : []

    for (const sourceId of sourceIds) {
      if (typeof sourceId === "string" && sourceId.length > 0) {
        documentIds.add(sourceId)
      }
    }
  }

  return Array.from(documentIds)
}

export function isSafeAgentAssetFilename(filename: string): boolean {
  return (
    filename.length > 0 &&
    filename.length <= 255 &&
    filename !== "." &&
    filename !== ".." &&
    !/[\\/\0]/.test(filename)
  )
}

/**
 * The ingestion worker may only be pointed at HTTPS academic/publication hosts.
 * Exact host or subdomain matching avoids accepting look-alikes such as
 * `evil-arxiv.org`.
 */
export function isAllowedAgentIngestionUrl(sourceUrl: string): boolean {
  let url: URL
  try {
    url = new URL(sourceUrl)
  } catch {
    return false
  }

  if (url.protocol !== "https:") return false

  const host = url.hostname.toLowerCase().replace(/\.$/, "")
  const exactOrSubdomain = (domain: string) => host === domain || host.endsWith(`.${domain}`)
  if (
    exactOrSubdomain("arxiv.org") ||
    exactOrSubdomain("doi.org") ||
    exactOrSubdomain("semanticscholar.org") ||
    exactOrSubdomain("openalex.org")
  ) {
    return true
  }

  const labels = host.split(".")
  const secondLevel = labels.length >= 2 ? labels[labels.length - 2] : ""
  const countryCodeTld = /^[a-z]{2}$/.test(labels[labels.length - 1] ?? "")
  return host.endsWith(".edu") || (countryCodeTld && (secondLevel === "edu" || secondLevel === "ac"))
}
