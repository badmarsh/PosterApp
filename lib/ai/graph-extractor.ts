import { prisma as db } from "../prisma"
import { generateAIResponse } from "./client"
import { z } from "zod"

const nodeSchema = z.object({
  label: z.preprocess((val) => {
    if (Array.isArray(val)) return String(val[0] || "Concept")
    if (typeof val === "object" && val !== null) return (val as any).name || (val as any).label || (val as any).type || "Concept"
    return typeof val === "string" && val.trim() ? val.trim() : "Concept"
  }, z.string().default("Concept")).describe("Entity type, preferably: 'Hypothesis', 'Methodology', 'Dataset', 'Metric', 'Finding', 'Citation', 'Concept'"),
  name: z.preprocess((val) => {
    if (Array.isArray(val)) return String(val[0] || "Unnamed Entity")
    if (typeof val === "object" && val !== null) return (val as any).name || (val as any).label || (val as any).title || "Unnamed Entity"
    return typeof val === "string" && val.trim() ? val.trim() : "Unnamed Entity"
  }, z.string().default("Unnamed Entity")).describe("The specific name of the entity, e.g. 'YOLOv8', 'COCO dataset'"),
  description: z.preprocess((val) => {
    if (Array.isArray(val)) return val.filter(Boolean).map(String).join("; ")
    if (typeof val === "object" && val !== null) return (val as any).description || (val as any).text || (val as any).summary || JSON.stringify(val)
    return typeof val === "string" ? val.trim() : null
  }, z.string().nullable().optional()).describe("Brief description or context of this entity within the document"),
})

const edgeSchema = z.object({
  sourceName: z.preprocess((val) => {
    if (typeof val === "string" && val.trim()) return val.trim()
    if (typeof val === "object" && val !== null) return (val as any).name || (val as any).source || (val as any).sourceName || ""
    return String(val || "")
  }, z.string().default("")).describe("Must match a node name"),
  targetName: z.preprocess((val) => {
    if (typeof val === "string" && val.trim()) return val.trim()
    if (typeof val === "object" && val !== null) return (val as any).name || (val as any).target || (val as any).targetName || ""
    return String(val || "")
  }, z.string().default("")).describe("Must match a node name"),
  relation: z.preprocess((val) => {
    if (Array.isArray(val)) return String(val[0] || "RELATED_TO")
    if (typeof val === "object" && val !== null) return (val as any).type || (val as any).relation || (val as any).name || "RELATED_TO"
    return typeof val === "string" && val.trim() ? val.trim() : "RELATED_TO"
  }, z.string().default("RELATED_TO")).describe("Relationship type, preferably: 'EVALUATED_ON', 'PROVES', 'USES', 'CITES', 'MEASURES', 'CONTRADICTS', 'IMPROVES'"),
  evidence: z.preprocess((val) => {
    if (Array.isArray(val)) return val.filter(Boolean).map(String).join(" ")
    if (typeof val === "object" && val !== null) return (val as any).quote || (val as any).text || (val as any).evidence || null
    return typeof val === "string" ? val.trim() : null
  }, z.string().nullable().optional()).describe("A short verbatim quote from the text that proves this relationship"),
})

const graphExtractionSchema = z.object({
  nodes: z.array(nodeSchema).default([]),
  edges: z.array(edgeSchema).default([]),
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
      model: process.env.AI_MODEL || "gemini-3-flash",
      systemPrompt: `You are an expert academic knowledge graph extractor.
Analyze the following text from an academic document and extract key entities and the relationships between them.
Keep nodes focused on core academic elements: Hypotheses, Methodologies, Datasets, Metrics, Findings, Citations, or Concepts.
Ensure that relationship 'sourceName' and 'targetName' strictly match the 'name' of extracted nodes.
Respond strictly with a JSON object containing "nodes" and "edges" arrays.`,
      userPrompt: textChunk,
      schema: graphExtractionSchema,
      temperature: 0.1,
    })

    if (!result || !result.nodes || result.nodes.length === 0) return

    // 1. Upsert Nodes
    const nodeMap = new Map<string, string>() // name -> db id
    
    for (const node of result.nodes) {
      const dbNode = await db.graphNode.upsert({
        where: {
          workspaceId_label_name: {
            workspaceId,
            label: node.label,
            name: node.name
          }
        },
        update: {
          // If we see it again, we might append description, but for now just keep existing
        },
        create: {
          workspaceId,
          documentId,
          label: node.label,
          name: node.name,
          description: node.description
        }
      })
      nodeMap.set(node.name, dbNode.id)
    }

    // 2. Insert Edges
    for (const edge of result.edges) {
      const sourceId = nodeMap.get(edge.sourceName)
      const targetId = nodeMap.get(edge.targetName)
      
      if (sourceId && targetId) {
        // Prevent exact duplicate edges
        const existingEdge = await db.graphEdge.findFirst({
          where: {
            workspaceId,
            sourceId,
            targetId,
            relation: edge.relation
          }
        })
        
        if (!existingEdge) {
          await db.graphEdge.create({
            data: {
              workspaceId,
              sourceId,
              targetId,
              relation: edge.relation,
              evidence: edge.evidence
            }
          })
        }
      }
    }
    
    return result
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

