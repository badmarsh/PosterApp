"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import * as d3 from "d3"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"

interface CitationNode extends d3.SimulationNodeDatum {
  id: string
  label: string
  fullTitle?: string
  type?: "central" | "citation"
  statusColor?: "emerald-400" | "amber-400" | "slate-400"
  year?: number
}

interface CitationLink extends d3.SimulationLinkDatum<CitationNode> {
  source: string | CitationNode
  target: string | CitationNode
}

export function CitationNetwork({ workspaceId }: { workspaceId: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  
  const [nodes, setNodes] = useState<CitationNode[]>([])
  const [links, setLinks] = useState<CitationLink[]>([])
  const [status, setStatus] = useState("Inicializujem sieť...")
  const [isDone, setIsDone] = useState(false)
  const [hoveredNode, setHoveredNode] = useState<CitationNode | null>(null)
  
  // Maintain a mutable ref of nodes/links for the D3 simulation to use
  const graphRef = useRef({ nodes: [] as CitationNode[], links: [] as CitationLink[] })
  const simulationRef = useRef<d3.Simulation<CitationNode, CitationLink> | null>(null)

  const updateSimulation = () => {
    setNodes([...graphRef.current.nodes])
    setLinks([...graphRef.current.links])
    
    if (simulationRef.current) {
      simulationRef.current.nodes(graphRef.current.nodes)
      
      const linkForce = d3.forceLink<CitationNode, CitationLink>(graphRef.current.links)
        .id(d => d.id)
        .distance(120)
        
      simulationRef.current.force("link", linkForce)
      simulationRef.current.alpha(1).restart()
      
      simulationRef.current.on("tick", () => {
        // Trigger React re-render for positions
        setNodes([...graphRef.current.nodes])
        setLinks([...graphRef.current.links])
      })
    }
  }

  useEffect(() => {
    if (!workspaceId) return
    
    // Initialize D3 Simulation
    if (!simulationRef.current) {
      simulationRef.current = d3.forceSimulation<CitationNode>()
        .force("charge", d3.forceManyBody().strength(-200))
        .force("center", d3.forceCenter(0, 0))
        .force("collision", d3.forceCollide().radius(25))
    }
    
    const eventSource = new EventSource(`/api/workspaces/${workspaceId}/thesis-review/citation-network`)
    
    eventSource.addEventListener("status", (e) => {
      const data = JSON.parse(e.data)
      setStatus(data.message)
    })
    
    eventSource.addEventListener("init_graph", (e) => {
      const data = JSON.parse(e.data)
      const centerNode: CitationNode = { ...data.thesisNode, x: 0, y: 0, fx: 0, fy: 0 }
      graphRef.current.nodes.push(centerNode)
      updateSimulation()
    })
    
    eventSource.addEventListener("verifying", (e) => {
      const data = JSON.parse(e.data)
      setStatus(`Overujem [${data.index}/${data.total}]: ${data.title.slice(0, 40)}...`)
    })
    
    eventSource.addEventListener("node_resolved", (e) => {
      const data = JSON.parse(e.data)
      const newNode: CitationNode = { 
        id: data.id, 
        label: data.label, 
        fullTitle: data.fullTitle,
        type: "citation",
        statusColor: data.statusColor,
        year: data.year
      }
      const newLink: CitationLink = { source: "thesis", target: data.id }
      
      graphRef.current.nodes.push(newNode)
      graphRef.current.links.push(newLink)
      updateSimulation()
    })
    
    eventSource.addEventListener("done", () => {
      setIsDone(true)
      eventSource.close()
    })

    eventSource.addEventListener("error", () => {
      setStatus("Chyba spojenia alebo validácie.")
      setIsDone(true)
      eventSource.close()
    })
    
    return () => {
      eventSource.close()
      if (simulationRef.current) simulationRef.current.stop()
    }
  }, [workspaceId])

  // Helper to extract or find node from D3 drag event
  const resolveNode = useCallback((e: any, d?: CitationNode): CitationNode | undefined => {
    if (d && d.id) return d
    if (e.subject && e.subject.id) return e.subject
    const target = e.sourceEvent?.target as Element | null
    const group = target?.closest?.(".node-group") as HTMLElement | null
    const id = group?.dataset?.id
    if (id) {
      return graphRef.current.nodes.find((n) => n.id === id)
    }
    return undefined
  }, [])

  // D3 Drag handlers integrated with React
  const dragStart = useCallback((e: any, d?: CitationNode) => {
    const node = resolveNode(e, d)
    if (!node) return
    if (!e.active && simulationRef.current) simulationRef.current.alphaTarget(0.3).restart()
    node.fx = node.x ?? e.x
    node.fy = node.y ?? e.y
  }, [resolveNode])

  const dragged = useCallback((e: any, d?: CitationNode) => {
    const node = resolveNode(e, d)
    if (!node) return
    node.fx = e.x
    node.fy = e.y
  }, [resolveNode])

  const dragEnd = useCallback((e: any, d?: CitationNode) => {
    const node = resolveNode(e, d)
    if (!node) return
    if (!e.active && simulationRef.current) simulationRef.current.alphaTarget(0)
    if (node.type !== "central") {
      node.fx = null
      node.fy = null
    }
  }, [resolveNode])

  useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    
    // Setup drag behavior on node groups
    const nodeGroups = svg.selectAll<SVGGElement, CitationNode>(".node-group")
    nodeGroups.data(graphRef.current.nodes, (d: any) => d?.id || "")

    const drag = d3.drag<SVGGElement, CitationNode>()
      .subject((event, d) => resolveNode(event, d) || event.subject)
      .on("start", dragStart)
      .on("drag", dragged)
      .on("end", dragEnd)
      
    nodeGroups.call(drag)
  }, [nodes.length, resolveNode, dragStart, dragged, dragEnd])

  // Get color based on status string
  const getColor = (status?: string, isCentral = false) => {
    if (isCentral) return "#3b82f6" // blue-500
    if (status === "emerald-400") return "#34d399"
    if (status === "amber-400") return "#fbbf24"
    return "#94a3b8" // slate-400
  }

  return (
    <div className="w-full flex flex-col rounded-md border border-border bg-card overflow-hidden h-[500px]">
      <div className="p-3 border-b border-border bg-muted/40 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <Badge variant={isDone ? "default" : "secondary"}>
            {isDone ? "Hotovo" : "Live Stream"}
          </Badge>
          <span className="text-sm font-medium text-foreground">{status}</span>
        </div>
        {!isDone && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>
      
      <div className="relative flex-1 bg-background/50" ref={containerRef}>
        <svg 
          ref={svgRef} 
          className="w-full h-full cursor-grab active:cursor-grabbing"
          viewBox="-400 -200 800 400"
        >
          <g className="links">
            {links.map((link, i) => {
              const source = link.source as CitationNode
              const target = link.target as CitationNode
              if (source.x == null || target.x == null) return null
              
              return (
                <line
                  key={`link-${i}`}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke="#cbd5e1"
                  strokeWidth={1.5}
                  strokeOpacity={0.6}
                />
              )
            })}
          </g>
          <g className="nodes">
            {nodes.map((node) => (
              <g 
                key={node.id} 
                data-id={node.id}
                className="node-group outline-none cursor-grab active:cursor-grabbing"
                transform={`translate(${node.x || 0},${node.y || 0})`}
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                <circle
                  r={node.type === "central" ? 24 : 14}
                  fill={getColor(node.statusColor, node.type === "central")}
                  stroke="#ffffff"
                  strokeWidth={2}
                  className="transition-transform hover:scale-110"
                  style={{
                    filter: "drop-shadow(0px 2px 4px rgba(0,0,0,0.1))"
                  }}
                />
                {node.type === "central" && (
                  <text
                    dy=".35em"
                    textAnchor="middle"
                    fill="white"
                    fontSize="10px"
                    fontWeight="bold"
                    pointerEvents="none"
                  >
                    THESIS
                  </text>
                )}
                {node.type !== "central" && node.year && (
                  <text
                    dy="22"
                    textAnchor="middle"
                    fill="currentColor"
                    fontSize="10px"
                    className="text-muted-foreground fill-current"
                    pointerEvents="none"
                  >
                    {node.year}
                  </text>
                )}
              </g>
            ))}
          </g>
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredNode && hoveredNode.type !== "central" && (
          <div className="absolute top-4 right-4 bg-popover text-popover-foreground border border-border shadow-md rounded-md p-3 max-w-sm pointer-events-none transition-opacity">
            <h4 className="font-semibold text-sm leading-tight mb-1">
              {hoveredNode.fullTitle || hoveredNode.label}
            </h4>
            <div className="flex gap-2 mt-2">
              <Badge variant="outline" className="text-xs font-normal">
                {hoveredNode.year || "Unknown Year"}
              </Badge>
              {hoveredNode.statusColor === "emerald-400" && <Badge className="bg-emerald-500 hover:bg-emerald-600 text-xs font-normal">Relevantné</Badge>}
              {hoveredNode.statusColor === "amber-400" && <Badge className="bg-amber-500 hover:bg-amber-600 text-xs font-normal">Zastarané</Badge>}
              {hoveredNode.statusColor === "slate-400" && <Badge className="bg-slate-500 hover:bg-slate-600 text-xs font-normal">Neoverené</Badge>}
            </div>
          </div>
        )}
        
        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-card/80 backdrop-blur border border-border p-2 rounded-md shadow-sm text-xs flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#34d399]" />
            <span>Overené (OpenAlex)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#fbbf24]" />
            <span>Zastarané (&lt; 2014)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#94a3b8]" />
            <span>Nenájdené / Neoverené</span>
          </div>
        </div>
      </div>
    </div>
  )
}
