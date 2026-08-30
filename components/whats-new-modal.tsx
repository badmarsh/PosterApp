import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { CheckCircle2, ShieldCheck, Microscope, GitMerge, FileText } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface WhatsNewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WhatsNewModal({ open, onOpenChange }: WhatsNewModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="default" className="bg-green-600 hover:bg-green-700">All Branches Merged to Main</Badge>
          </div>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <GitMerge className="size-6 text-primary" />
            What's New in PosterApp
          </DialogTitle>
          <DialogDescription className="text-base text-muted-foreground mt-2">
            We have successfully integrated several major feature branches directly into the <code className="bg-muted px-1 rounded">main</code> branch. Here are the newly available modules:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          
          <div className="flex gap-4">
            <div className="mt-1 bg-primary/10 p-2 rounded-full h-fit">
              <Microscope className="size-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                1. Academic Reviewer Evidence Engine
                <Badge variant="outline" className="text-xs">feat/academic-reviewer-evidence-engine</Badge>
              </h3>
              <p className="text-sm text-muted-foreground mt-1 mb-2">
                Introduces advanced RAG-based evidence gathering for PhD opponent reviews. Automatically grounds AI observations in actual document citations.
              </p>
              <ul className="text-sm space-y-1">
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-green-500 mt-0.5" /> Verbatim evidence offset locator</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-green-500 mt-0.5" /> Automated objective alignment verification</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-green-500 mt-0.5" /> High-confidence scientific validation reports</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="mt-1 bg-primary/10 p-2 rounded-full h-fit">
              <FileText className="size-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                2. Peer Review Expert Module
                <Badge variant="outline" className="text-xs">feat/peer-review-expert-module</Badge>
              </h3>
              <p className="text-sm text-muted-foreground mt-1 mb-2">
                A full workspace dedicated to evaluating theses, featuring EQUATOR reporting standard integration and multi-format document export.
              </p>
              <ul className="text-sm space-y-1">
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-green-500 mt-0.5" /> Split-view finding analysis</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-green-500 mt-0.5" /> EQUATOR audits (CONSORT 2025, PRISMA 2020)</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-green-500 mt-0.5" /> DOCX and plain-text review export</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="mt-1 bg-primary/10 p-2 rounded-full h-fit">
              <ShieldCheck className="size-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                3. Security & Stability Hardening
                <Badge variant="outline" className="text-xs">feat/hardening-security-stability</Badge>
              </h3>
              <p className="text-sm text-muted-foreground mt-1 mb-2">
                Extensive foundational work to ensure robust authorization, serialization, and deterministic data handling across collaboration.
              </p>
              <ul className="text-sm space-y-1">
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-green-500 mt-0.5" /> Canonical domain model enforcement & IDOR guards</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-green-500 mt-0.5" /> Reliable Yjs realtime synchronization</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-green-500 mt-0.5" /> CI pipeline fixes with full E2E Playwright verification</li>
              </ul>
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  )
}
