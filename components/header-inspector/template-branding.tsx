"use client"

import { useState, useEffect, useRef } from "react"
import { Palette, RotateCcw, Upload, Loader2, QrCode, Sparkles, AlertTriangle } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiFetch } from "@/lib/api-fetch"
import { toast } from "sonner"

interface TemplateBrandingProps {
  project: any
  activeOutput: any
  templateDef: any
  metadata: {
    logoUrl: string | null
    isLogoOverridden: boolean
  }
  updateActiveOutput: (patch: any) => void
  updateActiveThemeColor: (color: string) => void
  pushEvent: (event: any) => void
}

export function TemplateBranding({
  project,
  activeOutput,
  templateDef,
  metadata,
  updateActiveOutput,
  updateActiveThemeColor,
  pushEvent,
}: TemplateBrandingProps) {
  const activeThemeColor = activeOutput?.themeColor ?? null
  const headerLogoInputRef = useRef<HTMLInputElement>(null)
  const [isUploadingHeaderLogo, setIsUploadingHeaderLogo] = useState(false)
  const [logoLoadError, setLogoLoadError] = useState(false)
  const [isFixingLogo, setIsFixingLogo] = useState(false)

  // QR Code state
  const [qrUrl, setQrUrl] = useState("")
  const [qrLabel, setQrLabel] = useState("Scan for Paper & Code")
  const [isGeneratingQr, setIsGeneratingQr] = useState(false)
  const [qrAssetUrl, setQrAssetUrl] = useState<string | null>(null)

  useEffect(() => {
    const existingQr = project.assets?.find((a: any) => a.filename === "qrcode.png")
    if (existingQr) {
      setQrAssetUrl(existingQr.url ?? null)
    }
  }, [project.assets])

  async function handleGenerateQr() {
    if (!qrUrl.trim() || isGeneratingQr) return
    setIsGeneratingQr(true)
    try {
      const res = await apiFetch(`/api/workspaces/${project.id}/qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: qrUrl.trim(), label: qrLabel.trim() }),
      })
      const data = await res.json()
      if (data.ok) {
        setQrAssetUrl(data.url)
        pushEvent({
          kind: "info",
          status: "done",
          title: "QR Code Generated",
          detail: `Generated interactive QR code asset linking to ${qrUrl}`,
        })
      }
    } finally {
      setIsGeneratingQr(false)
    }
  }

  return (
    <>
      {/* Logo Override (for logo-enabled templates like ATLAS) */}
      {activeOutput?.templateId === "atlas" && (
        <div className="space-y-1.5 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-foreground">
              Document Logo
            </Label>
            {metadata.isLogoOverridden ? (
              <button
                type="button"
                onClick={() => updateActiveOutput({ logoUrl: null })}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline cursor-pointer"
              >
                <RotateCcw className="size-3" /> Reset to project logo
              </button>
            ) : (
              <span className="text-xs font-mono text-muted-foreground">
                (Inherited)
              </span>
            )}
          </div>

          {metadata.logoUrl ? (
            <div className="flex items-center justify-between gap-2 p-2 rounded-md border border-border bg-muted/20">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-8 relative rounded border border-border bg-background flex items-center justify-center overflow-hidden p-0.5 shrink-0">
                  <Image
                    src={metadata.logoUrl}
                    alt="Document Logo"
                    fill
                    className="object-contain"
                    onError={() => setLogoLoadError(true)}
                    onLoad={() => setLogoLoadError(false)}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">
                    {metadata.isLogoOverridden ? "Custom Document Logo" : "Project Default Logo"}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => headerLogoInputRef.current?.click()}
                      className="text-[11px] font-medium text-primary hover:underline cursor-pointer"
                      disabled={isUploadingHeaderLogo}
                    >
                      {isUploadingHeaderLogo ? "Uploading..." : "Override logo"}
                    </button>
                    {logoLoadError && (
                      <button
                        type="button"
                        onClick={async () => {
                          setIsFixingLogo(true);
                          try {
                            const res = await apiFetch(`/api/workspaces/${project.id}/fix-asset`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ type: "logo" }),
                            })
                            const data = await res.json()
                            if (res.ok && data.ok && data.fixedUrl) {
                              updateActiveOutput({ logoUrl: data.fixedUrl })
                              setLogoLoadError(false)
                              toast.success("Logo reconnected", { description: data.explanation })
                            } else {
                              toast.error("Logo fix failed", { description: data.error || "No matching logo found." })
                            }
                          } catch {
                            toast.error("Failed to run AI fix on logo")
                          } finally {
                            setIsFixingLogo(false)
                          }
                        }}
                        disabled={isFixingLogo}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-destructive hover:underline cursor-pointer"
                      >
                        {isFixingLogo ? <Loader2 className="size-2.5 animate-spin" /> : <Sparkles className="size-2.5" />}
                        AI Fix Logo
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {metadata.isLogoOverridden && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => updateActiveOutput({ logoUrl: null })}
                  className="size-6 text-muted-foreground hover:text-destructive shrink-0"
                  title="Remove override"
                >
                  <RotateCcw className="size-3" />
                </Button>
              )}
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-center text-xs h-7 gap-1.5 border-dashed"
              onClick={() => headerLogoInputRef.current?.click()}
              disabled={isUploadingHeaderLogo}
            >
              {isUploadingHeaderLogo ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Upload className="size-3.5" />
              )}
              {isUploadingHeaderLogo ? "Uploading..." : "Override Document Logo"}
            </Button>
          )}
          <input
            ref={headerLogoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (file) {
                setIsUploadingHeaderLogo(true)
                try {
                  const formData = new FormData()
                  formData.append("file", file)
                  const res = await apiFetch(`/api/workspaces/${project.id}/assets/upload`, {
                    method: "POST",
                    body: formData,
                  })
                  const data = await res.json()
                  if (data.ok) {
                    updateActiveOutput({ logoUrl: data.asset.url })
                  }
                } finally {
                  setIsUploadingHeaderLogo(false)
                }
              }
              e.target.value = ""
            }}
          />
        </div>
      )}

      {/* Accent Theme Color */}
      {templateDef && templateDef.colors.length > 1 && (
        <div className="space-y-1.5 pt-2 border-t border-border">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Palette className="size-3.5 text-muted-foreground" />
            <Label className="text-xs font-medium text-muted-foreground">
              Template Accent Colour
            </Label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {templateDef.colors.map((c: any) => (
              <button
                key={c.id}
                title={c.name}
                onClick={() => updateActiveThemeColor(c.hex)}
                className="group relative size-6 rounded-full border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer"
                style={{
                  backgroundColor: c.hex,
                  borderColor: activeThemeColor === c.hex ? c.hex : "transparent",
                  boxShadow:
                    activeThemeColor === c.hex
                      ? `0 0 0 2px var(--background), 0 0 0 4px ${c.hex}`
                      : undefined,
                }}
                aria-pressed={activeThemeColor === c.hex}
              />
            ))}
          </div>
          {activeThemeColor && (
            <p className="text-xs font-mono text-muted-foreground">
              {activeThemeColor}
            </p>
          )}
        </div>
      )}

      {/* Interactive QR Code Generator */}
      <div className="space-y-2 pt-3 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <QrCode className="size-4 text-primary" />
            <Label className="text-xs font-medium text-foreground">
              Interactive QR Code (Paper / GitHub)
            </Label>
          </div>
          {qrAssetUrl && (
            <span className="text-[11px] font-mono font-medium text-success bg-success/10 px-1.5 py-0.5 rounded border border-success/20">
              Active
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-snug">
          Generate a high-res vector QR code for conference attendees to scan and view your paper, GitHub repo, or supplementary materials.
        </p>

        <div className="space-y-1.5">
          <Input
            aria-label="QR code URL"
            value={qrUrl}
            onChange={(e) => setQrUrl(e.target.value)}
            placeholder="https://arxiv.org/abs/... or https://github.com/..."
            className="h-7 text-xs bg-background"
          />
          <div className="flex items-center gap-1.5">
            <Input
              aria-label="QR code label"
              value={qrLabel}
              onChange={(e) => setQrLabel(e.target.value)}
              placeholder="Label (e.g. Scan for Paper & Code)"
              className="h-7 text-xs bg-background flex-1"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerateQr}
              disabled={!qrUrl.trim() || isGeneratingQr}
              className="h-7 text-xs px-2.5 gap-1 shrink-0 shadow-xs"
            >
              {isGeneratingQr ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5 text-warning" />
              )}
              Generate QR
            </Button>
          </div>
        </div>

        {qrAssetUrl && (
          <div className="flex items-center justify-between gap-3 p-2 rounded-md border border-border bg-muted/20 mt-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-10 relative rounded border border-border bg-white flex items-center justify-center p-0.5 shrink-0">
                <Image src={qrAssetUrl} alt="QR Code" fill className="object-contain" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <p className="text-xs font-semibold text-foreground truncate">
                  qrcode.png
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  Saved in assets · Available for cards &amp; headers
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
