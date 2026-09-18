"use client"

import { Plus, Trash2 } from "lucide-react"
import { useEditor } from "@/components/editor-store"
import { useShallow } from "zustand/react/shallow"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { decodeHtmlEntities, cn } from "@/lib/utils"
import type { Card } from "@/lib/poster-types"
import { FieldLabel } from "./shared"

export function TableTab({ card }: { card: Card }) {
  const { updateCard, project } = useEditor(
    useShallow((s) => ({
      updateCard: s.updateCard,
      project: s.project,
    }))
  )
  const parsedTables = (project.assets || []).filter(a => a.kind === "table" && a.tableRows && a.tableRows.length > 0)
  const table = card.table || { hasHeader: false, caption: "", rows: [] }
  const rows = table.rows || []
  const cols = rows[0]?.length ?? 0
  const enabled = card.pattern === "bullets-table" || card.pattern === "section-table"

  function setCell(r: number, c: number, val: string) {
    const newRows = rows.map((row) => [...row])
    newRows[r][c] = val
    updateCard(card.id, { table: { ...table, rows: newRows } })
  }
  function addRow() {
    const width = cols || 2
    updateCard(card.id, {
      table: { ...table, rows: [...rows, Array(width).fill("")] },
    })
  }
  function removeRow(r: number) {
    updateCard(card.id, {
      table: { ...table, rows: rows.filter((_, i) => i !== r) },
    })
  }
  function addCol() {
    updateCard(card.id, {
      table: { ...table, rows: rows.map((row) => [...row, ""]) },
    })
  }
  function removeCol() {
    if (cols <= 1) return
    updateCard(card.id, {
      table: { ...table, rows: rows.map((row) => row.slice(0, -1)) },
    })
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      {!enabled && (
        <p className="rounded-md border border-dashed border-border bg-muted/40 px-2.5 py-2 text-[11px] text-muted-foreground">
          This pattern does not render a table. Select <span className="font-mono">bullets-table</span> (poster/slides) or <span className="font-mono">section-table</span> (paper) in Basics to include it.
        </p>
      )}

      {enabled && parsedTables.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-md border border-border bg-muted/20 p-2.5 mb-2">
          <FieldLabel>Populate from parsed tables</FieldLabel>
          <Select
            value=""
            onValueChange={(val) => {
              if (!val) return
              const asset = parsedTables.find(a => a.id === val)
              if (asset && asset.tableRows) {
                const rawRows: string[][] = Array.isArray(asset.tableRows)
                  ? (asset.tableRows as string[][])
                  : typeof asset.tableRows === "string"
                  ? (() => {
                      try {
                        const p = JSON.parse(asset.tableRows as string)
                        return Array.isArray(p) ? (p as string[][]) : []
                      } catch {
                        return []
                      }
                    })()
                  : []
                const maxCols = Math.max(0, ...rawRows.map(r => Array.isArray(r) ? r.length : 0))
                const parsedRows = rawRows.map(row => {
                  const clean = Array.isArray(row) ? row.map(c => decodeHtmlEntities(String(c ?? ""))) : []
                  while (clean.length < maxCols) clean.push("")
                  return clean
                })
                updateCard(card.id, {
                  table: {
                    hasHeader: true,
                    caption: decodeHtmlEntities(asset.caption ?? table.caption),
                    rows: parsedRows,
                  }
                })
              }
            }}
          >
            <SelectTrigger size="sm" className="w-full bg-card text-[11px] h-7" aria-label="Populate from parsed table">
              <SelectValue placeholder="Select a parsed table..." />
            </SelectTrigger>
            <SelectContent>
              {parsedTables.map(t => (
                <SelectItem key={t.id} value={t.id} className="text-[11px]">
                  {t.filename ? `${t.filename} - ` : ""} {t.caption || `Table from p.${t.page}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            checked={table.hasHeader}
            onCheckedChange={(v) => updateCard(card.id, { table: { ...table, hasHeader: v } })}
            size="sm"
          />
          <span className="text-[11px] text-foreground">Header row</span>
        </div>
        <div className="flex gap-1.5">
          <Button variant="outline" size="xs" className="gap-1" onClick={addCol}>
            <Plus className="size-3" /> Col
          </Button>
          <Button variant="outline" size="xs" onClick={removeCol} disabled={cols <= 1}>
            Remove col
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full border-collapse text-xs">
          <tbody>
            {table.rows.map((row, r) => (
              <tr
                key={r}
                className={cn(
                  "border-b border-border last:border-0",
                  r === 0 && table.hasHeader && "bg-muted/60",
                )}
              >
                {row.map((cell, c) => (
                  <td key={c} className="border-r border-border p-0 last:border-0">
                    <input
                      value={cell}
                      onChange={(e) => setCell(r, c, e.target.value)}
                      className={cn(
                        "w-full bg-transparent px-2 py-1 outline-none focus:bg-accent/40",
                        r === 0 && table.hasHeader && "font-semibold",
                      )}
                    />
                  </td>
                ))}
                <td className="w-7 bg-muted/30 text-center">
                  <button
                    type="button"
                    aria-label="Remove row"
                    onClick={() => removeRow(r)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button variant="outline" size="xs" className="w-fit gap-1" onClick={addRow}>
        <Plus className="size-3" /> Add row
      </Button>

      <div className="flex flex-col gap-1">
        <FieldLabel>Caption</FieldLabel>
        <Input
          aria-label="Caption"
          value={table.caption}
          onChange={(e) => updateCard(card.id, { table: { ...table, caption: e.target.value } })}
          placeholder="Table caption"
          className="h-8 text-sm"
        />
      </div>
    </div>
  )
}

