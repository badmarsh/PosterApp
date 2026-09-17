"use client"

/**
 * RehearsalTimer — defense rehearsal countdown (audit 2026-09-17).
 *
 * Pair with the sorted-by-risk question list: pick a rehearsal budget,
 * start the timer and walk the questions top-down. Uses design tokens only,
 * announces state changes via aria-live so it is usable with a screen reader,
 * and cleans its interval up on unmount.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Pause, Play, RotateCcw, Timer } from "lucide-react"
import { cn } from "@/lib/utils"

const MINUTE_OPTIONS = [3, 5, 10] as const

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

export function RehearsalTimer({ className }: { className?: string }) {
  const [minutes, setMinutes] = useState<number>(5)
  const [remaining, setRemaining] = useState<number>(5 * 60)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const totalSeconds = minutes * 60
  const finished = remaining === 0

  const stopTicking = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => stopTicking, [stopTicking])

  useEffect(() => {
    if (!running) return
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          stopTicking()
          setRunning(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return stopTicking
  }, [running, stopTicking])

  function chooseMinutes(value: number) {
    setMinutes(value)
    setRemaining(value * 60)
    setRunning(false)
    stopTicking()
  }

  function toggle() {
    if (finished) {
      setRemaining(totalSeconds)
      setRunning(true)
      return
    }
    setRunning((v) => !v)
  }

  function reset() {
    setRunning(false)
    setRemaining(totalSeconds)
    stopTicking()
  }

  const progress = useMemo(() => 1 - remaining / totalSeconds, [remaining, totalSeconds])
  const lowTime = remaining <= 30 && remaining > 0

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 shadow-xs",
        className,
      )}
      aria-label="Časovač na nácvik obhajoby"
    >
      <Timer className={cn("size-4 shrink-0", running ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
      <div className="flex flex-col">
        <span
          className={cn(
            "font-mono text-lg leading-none tabular-nums",
            finished ? "text-destructive" : lowTime && running ? "text-warning" : "text-foreground",
          )}
          role="timer"
          aria-live={running ? "off" : "polite"}
        >
          {formatClock(remaining)}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {finished ? "Čas vypršal" : running ? "Nácvik prebieha…" : "Nácvik otázok"}
        </span>
      </div>

      <div className="flex items-center gap-1" role="group" aria-label="Dĺžka nácviku v minútach">
        {MINUTE_OPTIONS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => chooseMinutes(m)}
            aria-pressed={minutes === m}
            aria-label={`${m} minúty nácvik`}
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              minutes === m
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {m}m
          </button>
        ))}
      </div>

      <div className="h-1 w-16 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-150",
            finished ? "bg-destructive" : running ? "bg-primary" : "bg-muted-foreground/50",
          )}
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>

      <div className="flex items-center gap-1">
        <Button
          size="icon-xs"
          variant="outline"
          onClick={toggle}
          aria-label={running ? "Pauza nácviku" : finished ? "Reštartovať nácvik" : "Spustiť nácvik"}
          title={running ? "Pauza" : "Štart"}
        >
          {running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={reset}
          disabled={remaining === totalSeconds && !running}
          aria-label="Vynulovať časovač"
          title="Vynulovať"
        >
          <RotateCcw className="size-3.5" />
        </Button>
      </div>

      <span className="sr-only" aria-live="polite">
        {finished ? "Rehearsal time is up." : running ? "Rehearsal timer running." : "Rehearsal timer paused."}
      </span>
    </div>
  )
}
