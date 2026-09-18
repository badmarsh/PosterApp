"use client"

import ReactMarkdown from "react-markdown"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import "katex/dist/katex.min.css"

/** Safe markdown + KaTeX rendering for the compact canvas preview. */
export function InlineCardContent({ content }: { content: string }) {
  return (
    <div className="line-clamp-4 text-[11px] leading-relaxed text-muted-foreground [&_.katex]:text-[0.9em] [&_.katex-display]:my-1 [&_p]:m-0 [&_ul]:my-0 [&_ul]:pl-4">
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false, trust: false }]]}>
        {content || "No content yet"}
      </ReactMarkdown>
    </div>
  )
}
