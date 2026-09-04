#!/usr/bin/env node
/**
 * lint:a11y — icon-only button auditor (UI polish plan, Phase 5).
 *
 * Rule: an icon-only `Button` (size="icon" / "icon-xs" / "icon-sm", or a raw
 * `<button>` containing only an <svg>) must expose an accessible name via
 * `aria-label` or `title`. Buttons wrapped in a Tooltip are exempt (base-ui
 * Tooltip adds aria-describedby to the trigger).
 *
 * Grep-style on purpose: fast, dependency-free, reviewable. Exit code 1 if
 * any violation is found.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["components", "app"];
const EXT = ".tsx";
const ICON_SIZES = ['size="icon"', 'size="icon-xs"', 'size="icon-sm"'];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else if (p.endsWith(EXT)) yield p;
  }
}

/** Strip self-closing tags and comment blocks to see if real text remains. */
function hasTextContent(inner) {
  const noComments = inner.replace(/<!--[\s\S]*?-->/g, "");
  const noSelfClosing = noComments.replace(/<[^>]*\/>/g, "");
  const noTags = noSelfClosing.replace(/<[^>]*>/g, "");
  return noTags.trim().length > 0;
}

const violations = [];

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const src = readFileSync(file, "utf8");
    const lines = src.split("\n");

    for (let i = 0; i < lines.length; i++) {
      for (const size of ICON_SIZES) {
        if (!lines[i].includes(size)) continue;
        // Walk back to the opening tag of this Button (max 6 lines up).
        let start = i;
        for (let j = i; j >= Math.max(0, i - 6); j--) {
          if (lines[j].includes("<Button") || lines[j].includes("<button")) {
            start = j;
            break;
          }
        }
        // Collect the JSX block up to the closing tag.
        let end = i;
        let depth = 0;
        for (let j = start; j < Math.min(lines.length, start + 40); j++) {
          const opens = (lines[j].match(/<Button[\s>]/g) ?? []).length + (lines[j].includes("<button") ? 1 : 0);
          const closes = (lines[j].match(/<\/Button>/g) ?? []).length + (lines[j].match(/<\/button>/g) ?? []).length;
          depth += opens - closes;
          if (depth <= 0 && j > start) {
            end = j;
            break;
          }
          if (depth <= 0 && j === start) {
            // Single-line or tag starts later than we assumed; keep scanning.
            end = j + 1;
          }
        }
        const block = lines.slice(start, end + 1).join("\n");
        if (!block.includes("</Button>") && !block.includes("</button>")) continue; // not a full block
        if (block.includes("aria-label") || block.includes("title=")) continue;
        if (block.includes("TooltipTrigger")) continue; // tooltip provides the name
        // If the button actually renders visible text, it is not icon-only.
        // Neutralize arrow functions (`=>`) so their `>` cannot terminate the
        // opening-tag match early.
        const sanitized = block.replace(/=>/g, "⇒");
        const inner = sanitized
          .replace(/<Button[\s\S]*?>/, "")
          .replace(/<\/Button>[\s\S]*$/, "")
          .replace(/<button[\s\S]*?>/, "")
          .replace(/<\/button>[\s\S]*$/, "");
        if (hasTextContent(inner)) continue;
        violations.push(`${relative(process.cwd(), file)}:${start + 1}`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error(`lint:a11y — icon-only controls missing an accessible name (${violations.length}):`);
  for (const v of violations) console.error(`  ${v}`);
  console.error("\nAdd aria-label (or a Tooltip wrapper) to each control above.");
  process.exit(1);
}
console.log("lint:a11y — all icon-only controls have accessible names ✓");
