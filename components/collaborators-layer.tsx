"use client"

import { useEditor } from "@/components/editor-store"
import { useYjs } from "@/components/store/use-yjs"
import { MousePointer2 } from "lucide-react"

export function CollaboratorsLayer() {
  const projectId = useEditor(s => s.project.id)
  useYjs(projectId) // Mounts connection
  const collaborators = useEditor(s => s.collaborators)

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      {collaborators.map((c) => {
        if (!c.cursor) return null
        return (
          <div
            key={c.clientId}
            className="absolute transition-all duration-75 ease-linear flex flex-col items-start"
            style={{
              transform: `translate(${c.cursor.x}px, ${c.cursor.y}px)`,
              willChange: "transform"
            }}
          >
            <MousePointer2
              className="h-5 w-5 -translate-x-1.5 -translate-y-1.5"
              style={{ fill: c.color, color: c.color }}
            />
            <div
              className="ml-3 rounded px-1.5 py-0.5 text-[10px] text-white font-semibold shadow-sm whitespace-nowrap"
              style={{ backgroundColor: c.color }}
            >
              {c.name}
            </div>
          </div>
        )
      })}
    </div>
  )
}
