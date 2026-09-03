import { prisma as db } from "../prisma"
import { generateAIResponse } from "./client"
import { AI_TIMEOUTS } from "./models"
import { canonicalEntityName, canonicalKey, canonicalRelation, isPlaceholderEntity } from "./graph-rag"
import { z } from "zod"

const CANONICAL_LABELS: Record<string, string> = {
  hypothesis: "Hypothesis",
  methodology: "Methodology",
  dataset: "Dataset",
  metric: "Metric",
  finding: "Finding",
  citation: "Citation",
  concept: "Concept",
}

/** Maps an LLM-provided label to a stable display form; unknown labels pass through. */
function canonicalLabel(raw: string): string {
  const key = canonicalKey(raw)
  return CANONICAL_LABELS[key] ?? (raw.trim() || "Concept")
}

const safeString = (fallback: string) => z.preprocess((val) => {
  if (typeof val === "string") return val.trim() || fallback;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (Array.isArray(val)) {
    const s = val.find(v => typeof v === "string");
    return s ? s.trim() || fallback : fallback;
  }
  if (typeof val === "object" && val !== null) {
    const c = (val as any).name || (val as any).label || (val as any).type || (val as any).title || (val as any).value || (val as any).text;
    if (typeof c === "string") return c.trim() || fallback;
    return fallback; // Safe fallback if inner property is also an object
  }
  return fallback;
}, z.string().default(fallback));

const safeNullableString = () => z.preprocess((val) => {
  if (val === null || val === undefined) return null;
  if (typeof val === "string") return val.trim() || null;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (Array.isArray(val)) return val.map(String).join("; ") || null;
  if (typeof val === "object" && val !== null) {
    const c = (val as any).description || (val as any).text || (val as any).summary || (val as any).quote || (val as any).evidence;
    if (typeof c === "string") return c.trim() || null;
    return JSON.stringify(val); // Fallback to stringified JSON if it's an object
  }
  return null;
}, z.string().nullable().optional());

const nodeSchema = z.object({
  label: safeString("Concept").describe("Entity type, preferably: 'Hypothesis', 'Methodology', 'Dataset', 'Metric', 'Finding', 'Citation', 'Concept'"),
  name: safeString("Unnamed Entity").describe("The specific name of the entity, e.g. 'YOLOv8', 'COCO dataset'"),
  description: safeNullableString().describe("Brief description or context of this entity within the document"),
})

const edgeSchema = z.object({
  sourceName: safeString("").describe("Must match a node name"),
  targetName: safeString("").describe("Must match a node name"),
  relation: safeString("RELATED_TO").describe("Relationship type, preferably: 'EVALUATED_ON', 'PROVES', 'USES', 'CITES', 'MEASURES', 'CONTRADICTS', 'IMPROVES'"),
  evidence: safeNullableString().describe("A short verbatim quote from the text that proves this relationship"),
})

const safeArray = (schema: z.ZodTypeAny) => z.preprocess((val) => {
  if (Array.isArray(val)) return val;
  if (typeof val === "object" && val !== null) {
    const keys = Object.keys(val);
    if (keys.length > 0 && keys.every(k => !isNaN(Number(k)))) return Object.values(val);
    return [];
  }
  return [];
}, z.array(schema).default([]));

type ExtractedNode = z.infer<typeof nodeSchema>
type ExtractedEdge = z.infer<typeof edgeSchema>

const graphExtractionSchema = z.object({
  nodes: safeArray(nodeSchema) as unknown as z.ZodType<ExtractedNode[]>,
  edges: safeArray(edgeSchema) as unknown as z.ZodType<ExtractedEdge[]>,
})

/**
 * Extracts entities and relationships from a text chunk and saves them to the database.
 * This should be called asynchronously during the chunking phase (Lazy GraphRAG).
 */
export async function extractAndStoreGraphEntities(
  workspaceId: string, 
  documentId: string, 
  textChunk: string
) {
  try {
    const result = await generateAIResponse("GraphRAG-Extraction", {
      model: process.env.AI_MODEL || "gemini-3.7-flash",
      systemPrompt: `You are an expert academic knowledge graph extractor.
Analyze the following text from an academic document and extract key entities and the relationships between them.
Keep nodes focused on core academic elements: Hypotheses, Methodologies, Datasets, Metrics, Findings, Citations, or Concepts.
Ensure that relationship 'sourceName' and 'targetName' strictly match the 'name' of extracted nodes.
Respond strictly with a JSON object containing "nodes" and "edges" arrays.`,
      userPrompt: textChunk,
      schema: graphExtractionSchema,
      temperature: 0.1,
      signal: AbortSignal.timeout(AI_TIMEOUTS.structure),
    })

    if (!result || !result.nodes || result.nodes.length === 0) return { nodes: 0, edges: 0 }

    // 1. Canonicalize + intra-batch dedup of nodes (LLMs emit case/spacing variants)
    const batchNodeByKey = new Map<string, { label: string; name: string; description: string | null }>()
    for (const node of result.nodes) {
      const label = canonicalLabel(node.label)
      const name = canonicalEntityName(node.name)
      if (isPlaceholderEntity(name, label)) continue
      const key = `${canonicalKey(label)}::${canonicalKey(name)}`
      const existing = batchNodeByKey.get(key)
      if (existing) {
        if (!existing.description && node.description) existing.description = node.description
      } else {
        batchNodeByKey.set(key, { label, name, description: node.description ?? null })
      }
    }
    if (batchNodeByKey.size === 0) return { nodes: 0, edges: 0 }

    // 2. Load existing nodes for the involved labels once — canonical-key lookup
    // merges near-duplicates ("yolov8" vs "YOLOv8") that the exact-match unique
    // constraint would otherwise store twice.
    const labels = [...new Set([...batchNodeByKey.values()].map((n) => n.label))]
    const existingNodes = await db.graphNode.findMany({
      where: { workspaceId, label: { in: labels } },
      select: { id: true, label: true, name: true, description: true },
    })
    const existingByKey = new Map<string, { id: string; description: string | null }>()
    for (const n of existingNodes) {
      existingByKey.set(`${canonicalKey(n.label)}::${canonicalKey(n.name)}`, {
        id: n.id,
        description: n.description,
      })
    }

    const nodeMap = new Map<string, string>() // canonicalKey(name) -> db id
    let nodesCreated = 0
    let nodesEnriched = 0

    for (const node of batchNodeByKey.values()) {
      const nameKey = canonicalKey(node.name)
      const existing = existingByKey.get(`${canonicalKey(node.label)}::${nameKey}`)
      if (existing) {
        nodeMap.set(nameKey, existing.id)
        // Enrich an existing node that had no description
        if (!existing.description && node.description) {
          await db.graphNode.update({
            where: { id: existing.id },
            data: { description: node.description.slice(0, 500) },
          })
          nodesEnriched++
        }
      } else {
        const created = await db.graphNode.create({
          data: {
            workspaceId,
            documentId,
            label: node.label,
            name: node.name,
            description: node.description?.slice(0, 500) ?? null,
          },
        })
        nodeMap.set(nameKey, created.id)
        existingByKey.set(`${canonicalKey(node.label)}::${nameKey}`, {
          id: created.id,
          description: node.description ?? null,
        })
        nodesCreated++
      }
    }

    // 3. Insert edges with canonical relation names + per-document provenance
    let edgesCreated = 0
    for (const edge of result.edges) {
      const sourceId = nodeMap.get(canonicalKey(edge.sourceName))
      const targetId = nodeMap.get(canonicalKey(edge.targetName))
      if (!sourceId || !targetId || sourceId === targetId) continue

      const relation = canonicalRelation(edge.relation)
      const existingEdge = await db.graphEdge.findFirst({
        where: { workspaceId, sourceId, targetId, relation },
      })
      if (existingEdge) continue

      await db.graphEdge.create({
        data: {
          workspaceId,
          sourceId,
          targetId,
          relation,
          evidence: edge.evidence?.slice(0, 400) ?? null,
          documentId,
        },
      })
      edgesCreated++
    }

    return { nodes: nodesCreated + nodesEnriched, edges: edgesCreated }
  } catch (error) {
    console.error("[GraphRAG] Failed to extract entities from chunk:", error)
  }
}

/**
 * Retrieves the constructed GraphRAG knowledge graph for a workspace,
 * formatted as a textual string to be injected into the LLM context.
 */
export async function getGraphContextForWorkspace(workspaceId: string, documentId?: string): Promise<string> {
  const nodes = await db.graphNode.findMany({
    where: { workspaceId, ...(documentId ? { documentId } : {}) },
  });

  if (nodes.length === 0) return "";

  let graphText = "### GraphRAG Knowledge Graph (Entities & Relationships)\n\n";
  graphText += "**Entities:**\n";
  nodes.forEach(node => {
    graphText += `- [${node.label}] ${node.name}: ${node.description || "No description"}\n`;
  });

  graphText += "\n**Relationships (Multi-hop Reasoning):**\n";
  const edges = await db.graphEdge.findMany({
    where: { workspaceId },
    include: {
      source: true,
      target: true,
    }
  });

  edges.forEach(edge => {
    graphText += `- ${edge.source.name} [${edge.relation}] ${edge.target.name}\n`;
    if (edge.evidence) {
      graphText += `  *Evidence: "${edge.evidence}"*\n`;
    }
  });

  return graphText;
}

