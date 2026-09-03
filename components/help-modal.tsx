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

            <AccordionItem value="thesis-review-tech" className="border border-primary/30 bg-primary/5 px-4 rounded-lg">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-md">
                    <BookOpen className="size-4 text-primary" />
                  </div>
                  <div className="text-left">
                    <span className="font-semibold text-base block">Školiteľské posudky — Technická dokumentácia</span>
                    <span className="text-xs text-muted-foreground font-normal">Pipeline · Vector RAG · GraphRAG · HNSW · MinerU → pgvector</span>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-4 leading-relaxed space-y-5">

                {/* ── 1. E2E Pipeline ─────────────────────── */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-foreground text-sm border-b pb-1">1 · End-to-End Pipeline (od bakalárky po dizertáciu)</h4>
                  <ol className="list-decimal pl-5 text-sm space-y-2 text-foreground/80">
                    <li><strong>Nahranie PDF</strong> — používateľ dropne súbor; frontend (IndexedDB + IngestFile) zaradí do fronty (max 3 súbežné joby).</li>
                    <li><strong>MinerU parse</strong> — <code className="bg-muted px-1 rounded text-xs">POST {"{MINERU_API_URL}"}/file_parse</code> s 5-minútovým timeoutom. Vracia <code className="bg-muted px-1 rounded text-xs">md_content</code> (CommonMark Markdown s ATX nadpismi), <code className="bg-muted px-1 rounded text-xs">images{"{}"}</code> (base64), <code className="bg-muted px-1 rounded text-xs">middle_json</code> (tabuľky, rovnice, stránkovanie).</li>
                    <li><strong>Post-processing</strong> — premenúvanie obrázkov na <code className="bg-muted px-1 rounded text-xs">*_figure_N</code> / <code className="bg-muted px-1 rounded text-xs">*_table_N</code>; vkladanie markdown pipe-tabuliek priamo do <code className="bg-muted px-1 rounded text-xs">md_content</code> pre čitateľnosť AI.</li>
                    <li><strong>Uloženie na disk</strong> — <code className="bg-muted px-1 rounded text-xs">workspaces/{"{id}"}/sources/{"{fileId}"}.md</code> (max 5 MB), assets do <code className="bg-muted px-1 rounded text-xs">workspaces/{"{id}"}/assets/</code>.</li>
                    <li><strong>BibTeX extrakcia</strong> — AI spracuje sekciu References a vytvorí <code className="bg-muted px-1 rounded text-xs">.bib</code> záznam.</li>
                    <li><strong>Vector Chunking (async, fire-and-forget)</strong> — po uložení .md súboru sa spustí <code className="bg-muted px-1 rounded text-xs">ingestDocumentChunks()</code> na pozadí (neblokuje SSE). Sekcia .md sa rozsekne na chunky podľa ATX nadpisov; pre dlhé dizertácie ({">"} 200k znakov) sú chunky väčšie (3000 znakov), pre kratšie práce 1800 znakov.</li>
                    <li><strong>Embedding generovanie</strong> — každý chunk sa vektorizuje lokálnym modelom (bez API volania) a uloží do PostgreSQL s HNSW indexom.</li>
                    <li><strong>AI generovanie posudku</strong> — thesis-review route načíta kontext cez <em>criterion-routed section scoring</em> (thesis-context.ts) a spustí LLM s 90s timeoutom.</li>
                  </ol>
                </div>

                {/* ── 2. Vector RAG Architecture ──────────── */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-foreground text-sm border-b pb-1">2 · Vector RAG Architektúra (Hybrid Search + HNSW)</h4>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="bg-muted/40 rounded-lg p-3 text-xs space-y-1">
                      <strong className="text-foreground block">Embedding model</strong>
                      <code className="block text-[10px]">Xenova/paraphrase-multilingual-MiniLM-L12-v2</code>
                      <span className="text-muted-foreground">384-dim · SK/CS/EN · beží lokálne v Node.js (Transformers.js / WASM) · bez externého API · 0 Kč za token</span>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-3 text-xs space-y-1">
                      <strong className="text-foreground block">pgvector HNSW index</strong>
                      <code className="block text-[10px]">m=16, ef_construction=64</code>
                      <span className="text-muted-foreground">Hierarchical Navigable Small World — O(log n) ANN search. Vytvorí sa automaticky po prvom ingeste.</span>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-3 text-xs space-y-1">
                      <strong className="text-foreground block">Hybrid Search (70/30)</strong>
                      <code className="block text-[10px]">0.7 · cosine + 0.3 · FTS ts_rank</code>
                      <span className="text-muted-foreground">Vektorová sémantika + presné kľúčové slová v jednom SQL dopyte. Top 20 výsledkov.</span>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-3 text-xs space-y-1">
                      <strong className="text-foreground block">Reranking (cross-encoder)</strong>
                      <code className="block text-[10px]">keyword overlap · heading boost · length penalty</code>
                      <span className="text-muted-foreground">Lokálny heuristický reranker (bez API). Vyberie Top 10 najrelevantnejších chunkov pre LLM prompt.</span>
                    </div>
                  </div>
                </div>

                {/* ── 3. Chunking Strategy ────────────────── */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-foreground text-sm border-b pb-1">3 · Stratégia chunkovania podľa typu práce</h4>
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full border-collapse">
                      <thead>
                        <tr className="text-foreground border-b">
                          <th className="text-left py-1 pr-4 font-semibold">Typ práce</th>
                          <th className="text-left py-1 pr-4 font-semibold">Rozsah .md</th>
                          <th className="text-left py-1 pr-4 font-semibold">Max chunk</th>
                          <th className="text-left py-1 font-semibold">Overlap</th>
                        </tr>
                      </thead>
                      <tbody className="text-foreground/70">
                        <tr className="border-b border-border/50"><td className="py-1 pr-4">Bc. práca</td><td className="py-1 pr-4">~50–80 strán</td><td className="py-1 pr-4">1800 znakov</td><td className="py-1">200 znakov</td></tr>
                        <tr className="border-b border-border/50"><td className="py-1 pr-4">Diplomová práca</td><td className="py-1 pr-4">~80–130 strán</td><td className="py-1 pr-4">1800 znakov</td><td className="py-1">200 znakov</td></tr>
                        <tr className="border-b border-border/50"><td className="py-1 pr-4">Vedecký článok</td><td className="py-1 pr-4">~10–20 strán</td><td className="py-1 pr-4">1800 znakov</td><td className="py-1">200 znakov</td></tr>
                        <tr><td className="py-1 pr-4 text-primary font-medium">Dizertácia (PhD)</td><td className="py-1 pr-4">{">"} 200k znakov</td><td className="py-1 pr-4 text-primary font-medium">3000 znakov</td><td className="py-1">200 znakov</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground">Chunkovanie prebieha podľa ATX nadpisov (<code className="bg-muted px-1 rounded text-[10px]"># Heading</code>) — každá sekcia je samostatný chunk. Ak sekcia prekračuje limit, rozseká sa na prekrývajúce sa podchunky. Krátke chunky ({"<"} 100 znakov) sú preskočené.</p>
                </div>

                {/* ── 4. DB schema note ───────────────────── */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-foreground text-sm border-b pb-1">4 · Databázový model (PostgreSQL + pgvector)</h4>
                  <pre className="bg-muted rounded-lg p-3 text-[10px] overflow-x-auto font-mono">{`model DocumentChunk {
  id          String    @id @default(cuid())
  workspaceId String
  documentId  String           -- = IngestFile.id
  heading     String?          -- nadpis sekcie
  content     String           -- text chunku
  tokens      Int              -- ~content.length / 4
  embedding   vector(384)?     -- MiniLM L12 v2
  createdAt   DateTime @default(now())
  -- Index: HNSW (m=16, ef_construction=64)
}`}</pre>
                </div>

                {/* ── 5. Doménové prednastavenia ──────────── */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-foreground text-sm border-b pb-1">5 · Doménové prednastavenia (STEM / Fyzika)</h4>
                  <p className="text-xs">Všetky embedding volania predraďujú doménový prefix <code className="bg-muted px-1 rounded text-xs">&quot;STEM, Fyzika: &quot;</code> pred dotazom, čo posúva vektory bližšie k fyzikálnej terminológii (energia, experiment, meranie, výsledok, chyba merania). Formulár posudku je prednastavený na: <strong className="text-foreground">Dizertačná práca · Prírodovedecká fakulta · Katedra Fyziky (STEM)</strong>.</p>
                </div>

                {/* ── 6. Knowledge Graph (GraphRAG) ───────── */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-foreground text-sm border-b pb-1">6 · Znalostný graf (GraphRAG — multi-hop dôkazy)</h4>
                  <p className="text-xs">Počas ingestácie beží na pozadí <strong className="text-foreground">entitná extrakcia</strong> (LLM, <code className="bg-muted px-1 rounded text-[10px]">graph-extractor.ts</code>): z chunkov sa extrahujú akademické entity (Hypotéza, Metodika, Dataset, Metrika, Zistenie, Citácia) a vzťahy medzi nimi s verbatim dôkazom. Názvy entít sa <strong className="text-foreground">kanonizujú</strong> (diakritika, veľkosť písmen, interpunkcia), takže &quot;YOLOv8&quot; a &quot;yolov8&quot; sa zlúčia do jedného uzla.</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="bg-muted/40 rounded-lg p-3 text-xs space-y-1">
                      <strong className="text-foreground block">Extrakcia (ingest)</strong>
                      <span className="text-muted-foreground">Max 60 chunkov/dokument · prioritné sekcie (metodika, výsledky, literatúra) · min. 400 znakov · sekvenčne na pozadí, neblokuje embedding · vypnuteľné cez <code className="text-[10px]">GRAPH_RAG_ENABLED=false</code></span>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-3 text-xs space-y-1">
                      <strong className="text-foreground block">Retrieval (Stage 7)</strong>
                      <span className="text-muted-foreground"><code className="text-[10px]">retrieveGraphContext()</code> — prepojí dopyt s entitami (lexikálne + lokálny embedding), rozbalí okolie do 2 hopov (max 40 uzlov) a serializuje s pevným rozpočtom (max 4 000 znakov) a značkami pôvodu <code className="text-[10px]">[doc: …]</code></span>
                    </div>
                  </div>
                  <pre className="bg-muted rounded-lg p-3 text-[10px] overflow-x-auto font-mono">{`model GraphNode {
  label       String   -- Hypothesis | Methodology | Dataset | Metric | Finding | Citation | Concept
  name        String   -- kanonizovaný názov entity
  documentId  String   -- dokument prvej extrakcie
  -- unique [workspaceId, label, name] + kanonizačný kľúč proti near-duplikátom
}
model GraphEdge {
  sourceId → GraphNode
  targetId → GraphNode
  relation    String   -- EVALUATED_ON | PROVES | USES | CITES | MEASURES | …
  evidence    String?  -- verbatim dôkaz zo zdrojového textu
  documentId  String?  -- pôvod extrakcie (provenance)
}`}</pre>
                  <p className="text-xs text-muted-foreground">Graf je workspace-scoped: entity zdieľané viacerými nahranými dokumentmi (napr. práca + citované články) sa prepoja — posudok tak získa multi-hop súvislosti (metodika → dataset → metrika) aj naprieč dokumentmi, pričom každý fakt je dohľadateľný späť k dokumentu pôvodu.</p>
                </div>

                {/* ── 7. Graph Communities (LightRAG) ───────── */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-foreground text-sm border-b pb-1">7 · Graph Communities (LightRAG prístup)</h4>
                  <p className="text-xs">Na detekciu širšieho kontextu (high-level pochopenie práce) sa na vybudovanom grafe (pozri bod 6) vykonáva <strong>Louvain community detection algoritmus</strong> (<code className="bg-muted px-1 rounded text-[10px]">graph-communities.ts</code>). Ten rozdelí uzly do zhlukov a pre každý zhluk vygeneruje abstraktné syntetické zhrnutie. Tieto komunity sa pri vyhľadávaní použijú (spolu s HNSW chunkmi) ako prídavný sémantický kontext, čo rieši neschopnosť štandardného Vector RAGu odpovedať na globálne otázky (napr. &quot;Aký je celkový prínos práce?&quot;).</p>
                </div>

                {/* ── 8. Chýbajúci Prior Art & Novosť (PaperQA2) ── */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-foreground text-sm border-b pb-1">8 · Kontrola Novosti a Prior Artu (PaperQA2 prístup)</h4>
                  <p className="text-xs">Novosť (Novelty) posudzujeme detekciou chýbajúceho <em>prior artu</em>. Cez <code className="bg-muted px-1 rounded text-[10px]">novelty-detector.ts</code> systém zistí atomické tvrdenia (claims) obsiahnuté v práci, zavolá Semantic Scholar a OpenAlex API a vektorovou podobnosťou zistí, či existujú významné články z posledných rokov (podobnosť {">"} 0.82), ktoré autor ignoroval alebo necitoval.</p>
                </div>

                {/* ── 9. Multi-Agent Debate (Hivemind Bias) ── */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-foreground text-sm border-b pb-1">9 · Kritická sebarevízia (druhý AI prechod)</h4>
                  <p className="text-xs">Umelá inteligencia má tendenciu skĺznuť k prvému nájdenému riešeniu (sycophancy / hivemind bias). Keď je zapnutá voľba <strong>Kritická sebarevízia</strong>, po primárnom posudku prebehne <strong>druhé, nezávislé volanie modelu</strong> s vyššou teplotou, ktoré dostane návrh zistení spolu s citovanými dôkazmi z práce a hľadá nadhodnotené závery, chýbajúce slabiny a nesprávne nastavenú závažnosť. Nadhodnotené zistenia sa znížia o jeden stupeň a označia na ľudskú kontrolu. Súhrn kritiky nájdete v posudku v sekcii <em>Kritická sebarevízia AI</em>. Voľba približne zdvojnásobí čas a cenu generovania.</p>
                </div>

              </AccordionContent>
            </AccordionItem>

          </Accordion>
        </div>
      </DialogContent>
    </Dialog>
  )
}
