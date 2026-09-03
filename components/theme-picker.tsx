"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Palette } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type ThemeEntry = {
  id: string
  name: string
  desc: string
  palette: [string, string, string]
  bg: string
  accent: string
  border: string
}

export const THEMES: ThemeEntry[] = [
  {
    id: "light",
    name: "Light",
    desc: "Academic Maroon",
    palette: ["#faf9f6", "#8B2635", "#e0d9d4"],
    bg: "#faf9f6",
    accent: "#8B2635",
    border: "rgba(0,0,0,0.12)",
  },
  {
    id: "forest",
    name: "Forest",
    desc: "Evergreen Light",
    palette: ["#f2f6f1", "#2f6b4f", "#d9e4d8"],
    bg: "#f2f6f1",
    accent: "#2f6b4f",
    border: "rgba(40,80,55,0.18)",
  },
  {
    id: "ocean",
    name: "Ocean",
    desc: "Cerulean Light",
    palette: ["#f1f5fa", "#2b5cab", "#d7e1f0"],
    bg: "#f1f5fa",
    accent: "#2b5cab",
    border: "rgba(35,70,120,0.18)",
  },
  {
    id: "plum",
    name: "Plum",
    desc: "Berry Light",
    palette: ["#f8f3f8", "#8a3a76", "#e4d2e3"],
    bg: "#f8f3f8",
    accent: "#8a3a76",
    border: "rgba(90,40,80,0.18)",
  },
  {
    id: "dark",
    name: "Dark",
    desc: "Maroon Dark",
    palette: ["#1c1917", "#d9777f", "#3a2a2a"],
    bg: "#1c1917",
    accent: "#d9777f",
    border: "rgba(255,255,255,0.15)",
  },
  {
    id: "ember",
    name: "Ember",
    desc: "Warm Copper Dark",
    palette: ["#201712", "#d99a4e", "#3a2c1e"],
    bg: "#201712",
    accent: "#d99a4e",
    border: "rgba(255,255,255,0.14)",
  },
  {
    id: "sage",
    name: "Sage",
    desc: "Muted Green Dark",
    palette: ["#15211c", "#7fae95", "#24352e"],
    bg: "#15211c",
    accent: "#7fae95",
    border: "rgba(255,255,255,0.14)",
  },
  {
    id: "midnight",
    name: "Midnight",
    desc: "Deep Navy / Indigo",
    palette: ["#1a1a3a", "#7c6cf0", "#2a2a5a"],
    bg: "#1a1a3a",
    accent: "#7c6cf0",
    border: "rgba(255,255,255,0.15)",
  },
  {
    id: "vercel",
    name: "Vercel",
    desc: "Monochrome Light",
    palette: ["#ffffff", "#000000", "#e5e5e5"],
    bg: "#ffffff",
    accent: "#000000",
    border: "rgba(0,0,0,0.15)",
  },
  {
    id: "vercel-dark",
    name: "Vercel Dark",
    desc: "Monochrome Dark",
    palette: ["#000000", "#ffffff", "#1a1a1a"],
    bg: "#000000",
    accent: "#ffffff",
    border: "rgba(255,255,255,0.2)",
  },
] as const

export function ThemePicker() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Theme"
            >
              <Palette className="size-4" />
            </Button>
          }
        />
        <TooltipContent>Theme</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label="Theme"
                >
                  <Palette className="size-4" />
                </Button>
              }
            />
          }
        />
        <TooltipContent>Theme</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-64 p-1.5 shadow-lg">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
              <Palette className="size-3.5 text-primary" />
              <span>Theme Palette</span>
            </div>
            <p className="text-[10px] text-muted-foreground font-normal">
              Select workspace appearance
            </p>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(val) => val && setTheme(val)}
        >
          {THEMES.map((t) => {
            const isActive = theme === t.id
            return (
              <DropdownMenuRadioItem
                key={t.id}
                value={t.id}
                closeOnClick
                className="group flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer transition-colors"
              >
                {/* Mini palette preview strip */}
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-md overflow-hidden shadow-xs ring-1 ring-inset ring-border"
                  aria-hidden="true"
                >
                  {t.palette.map((color, i) => (
                    <span
                      key={i}
                      className="block size-full"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </span>

                {/* Label + description */}
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-medium text-xs text-foreground leading-tight">
                    {t.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-tight truncate">
                    {t.desc}
                  </span>
                </div>

                {/* Active indicator dot */}
                {isActive && (
                  <span className="size-1.5 rounded-full bg-primary shrink-0" />
                )}
              </DropdownMenuRadioItem>
            )
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
