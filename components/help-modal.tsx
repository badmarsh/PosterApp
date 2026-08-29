import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { FileStack, LayoutTemplate, BoxSelect, Image as ImageIcon, Sparkles, BookOpen } from "lucide-react"

interface HelpModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HelpModal({ open, onOpenChange }: HelpModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-w-5xl w-[90vw] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-background">
        <div className="p-6 pb-4 border-b border-border bg-muted/20">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              PosterApp Guide
            </DialogTitle>
            <DialogDescription className="text-sm">
              A comprehensive guide to creating beautiful scientific posters with AI assistance.
            </DialogDescription>
          </DialogHeader>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-background">
          <Accordion defaultValue={["ingestion"]} className="w-full space-y-2">
            
            <AccordionItem value="ingestion" className="border border-border bg-card px-4 rounded-lg">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-md">
                    <FileStack className="size-4 text-primary" />
                  </div>
                  <span className="font-semibold text-base">Ingestion & Sources</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-4 leading-relaxed space-y-4">
                <p>
                  The first step in creating your poster is giving the AI the literature it needs. Click <strong className="text-foreground font-medium">Ingest</strong> in the top bar to upload your research papers (.pdf).
                </p>
                <div className="bg-muted/50 p-4 rounded-lg border border-border">
                  <h4 className="font-medium text-foreground mb-1">Local Processing & Auto-Extraction</h4>
                  <p className="text-sm">
                    The system uses MinerU locally on your machine to extract text, <strong>figures, tables, and mathematical formulas</strong> with high precision. During ingestion, it automatically extracts the References section and converts it into BibTeX format. The robust concurrent job queue handles multiple large PDFs efficiently without stalling.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="formats" className="border border-border bg-card px-4 rounded-lg">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-md">
                    <LayoutTemplate className="size-4 text-primary" />
                  </div>
                  <span className="font-semibold text-base">Formats & Layouts</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-4 leading-relaxed space-y-4">
                <p>
                  You can seamlessly switch your workspace between three output formats: <strong>Posters</strong>, <strong>Slides</strong>, and <strong>Papers</strong>.
                </p>
                <div className="bg-primary/5 p-4 rounded-lg border border-primary/10">
                  <p className="text-sm">
                    Open the <strong className="text-foreground font-medium">Format Settings + Ops</strong> tab in the right sidebar to change your layout at any time. When switching between formats (e.g., from Poster to Slides), the system preserves your cards but recalculates layout properties, like columns and heights, to fit the new format constraints.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="cards" className="border border-border bg-card px-4 rounded-lg">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-md">
                    <BoxSelect className="size-4 text-primary" />
                  </div>
                  <span className="font-semibold text-base">Cards & AI Auto-fill</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-4 leading-relaxed space-y-4">
                <p>
                  Each section of your document is represented as a <strong className="text-foreground font-medium">Card</strong>. You can write the content manually or use the powerful AI Auto-fill feature.
                </p>
                <ul className="space-y-3 mt-4">
                  <li className="flex gap-3">
                    <div className="bg-muted rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-0.5"><span className="text-xs font-bold text-foreground">1</span></div>
                    <div>
                      <strong className="text-foreground block">Directed Generation</strong>
                      <p className="text-sm">Give the card a title (e.g., &quot;Methodology&quot;), leave the content empty, and click the <Sparkles className="size-3 inline mx-1"/> icon. The AI will write the content specifically for that section.</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <div className="bg-muted rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-0.5"><span className="text-xs font-bold text-foreground">2</span></div>
                    <div>
                      <strong className="text-foreground block">Bulk Auto-fill</strong>
                      <p className="text-sm">Click <strong className="text-foreground font-medium">Generate All</strong> in the top bar to auto-fill all empty cards sequentially.</p>
                    </div>
                  </li>
                </ul>
                <div className="bg-primary/5 p-4 rounded-lg border border-primary/10 mt-4">
                  <h4 className="font-medium text-foreground mb-1">Smart Digestion Features</h4>
                  <ul className="list-disc pl-5 mt-2 text-sm space-y-1 text-foreground/80">
                    <li><strong>Semantic Citations:</strong> The AI automatically inserts \cite{} commands corresponding to the extracted BibTeX keys.</li>
                    <li><strong>Figure Matching:</strong> It analyzes figure filenames and assigns the most relevant visuals to your generated text.</li>
                    <li><strong>Math Passthrough:</strong> Mathematical formulas from source documents are accurately preserved as inline LaTeX equations.</li>
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="layout" className="border border-border bg-card px-4 rounded-lg">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-md">
                    <BoxSelect className="size-4 text-primary" />
                  </div>
                  <span className="font-semibold text-base">Height Budgets</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-4 leading-relaxed space-y-4">
                <p>
                  Unlike a scrolling webpage, your document is constrained by physical space. Each card is allocated a <strong className="text-foreground font-medium">Height Budget</strong> (measured in generic units &quot;u&quot;).
                </p>
                <div className="grid sm:grid-cols-2 gap-4 mt-2">
                  <div className="border border-border p-4 rounded-lg bg-muted/30">
                    <strong className="text-foreground block mb-2">Overflow Management</strong>
                    <p className="text-sm">If the AI generates too much content, it will overflow its container. The AI is instructed to stay under this limit, but you should manually trim text if it exceeds the boundary.</p>
                  </div>
                  <div className="border border-border p-4 rounded-lg bg-muted/30">
                    <strong className="text-foreground block mb-2">Adjusting Budgets</strong>
                    <p className="text-sm">You can freely adjust the height budget of any card by dragging its bottom edge in the preview area to make room for more content or figures.</p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="assets" className="border border-border bg-card px-4 rounded-lg">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-md">
                    <ImageIcon className="size-4 text-primary" />
                  </div>
                  <span className="font-semibold text-base">Figures, Tables & Equations</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-4 leading-relaxed space-y-4">
                <p>
                  A great poster balances text with rich visuals. The left panel shows all extracted assets (figures and tables) from your PDFs.
                </p>
                <p>
                  You can assign these assets to specific slots in your cards using the <strong className="text-foreground font-medium">Card Content</strong> panel on the right. During AI Auto-fill, the AI will also automatically suggest and assign relevant figures. You can also preview PDF assets natively in the Figure Editor.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="review" className="border border-border bg-card px-4 rounded-lg">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-md">
                    <Sparkles className="size-4 text-primary" />
                  </div>
                  <span className="font-semibold text-base">AI Poster Review</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-4 leading-relaxed space-y-4">
                <p>
                  Before finalizing your poster, click <strong className="text-foreground font-medium">AI Poster review</strong> in the top bar.
                </p>
                <div className="bg-primary/5 p-4 rounded-lg border border-primary/10">
                  <p className="text-sm">
                    This triggers a comprehensive evaluation of your entire workspace by the local AI. It will check for:
                  </p>
                  <ul className="list-disc pl-5 mt-2 text-sm space-y-1 text-foreground/80">
                    <li>Missing references or uncited claims</li>
                    <li>Layout imbalances and text overflow</li>
                    <li>Missed opportunities to include key figures</li>
                    <li>Typos and structural flow</li>
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="chat" className="border border-border bg-card px-4 rounded-lg">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-md">
                    <Sparkles className="size-4 text-primary" />
                  </div>
                  <span className="font-semibold text-base">AI Chat</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-4 leading-relaxed space-y-4">
                <p>
                  The <strong className="text-foreground font-medium">AI Chat</strong> in the right panel provides an interactive assistant to help you write and refine your poster content.
                </p>
                <ul className="list-disc pl-5 mt-2 text-sm space-y-2 text-foreground/80">
                  <li><strong>Context-Aware:</strong> The AI knows about all ingested source documents, your current workspace layout, and the currently selected card.</li>
                  <li><strong>Interactive Guidance:</strong> Ask it to summarize a section, suggest a better title, or rewrite a paragraph for clarity.</li>
                  <li><strong>Status Strip:</strong> The top of the panel contains a collapsible event log showing the status of ongoing background tasks (like bulk auto-fill or poster compilation).</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="bib" className="border border-border bg-card px-4 rounded-lg">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-md">
                    <BookOpen className="size-4 text-primary" />
                  </div>
                  <span className="font-semibold text-base">Bibliography</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-4 leading-relaxed space-y-4">
                <p>
                  PosterApp maintains a central BibTeX file for your workspace, which is <strong>automatically populated</strong> when you ingest research papers.
                </p>
                <p>
                  You can further manage your bibliography by clicking <strong className="text-foreground font-medium">Edit references.bib</strong> in the Project Settings (bottom left). Only the citations actually used by the AI (or manually added by you) will appear in the final poster&apos;s reference block, preventing your poster from overflowing with unused citations.
                </p>
              </AccordionContent>
            </AccordionItem>

          </Accordion>
        </div>
      </DialogContent>
    </Dialog>
  )
}
