"use client"

import { EditorProvider } from "@/components/editor-store"
import { Shell } from "@/components/layout/shell"

export default function Page() {
  return (
    <EditorProvider>
      <Shell />
    </EditorProvider>
  )
}
