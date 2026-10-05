/**
 * Isometric 3D mockup stage for template previews.
 *
 * PosterApp already presents finished projects as photographic mockups
 * (`public/showcases/mockups/*.png`): a lit room, a desk with props, a poster
 * standing on an easel, an open laptop and printed sheets. Template previews use
 * the same visual language here — this module is the mini "set" those scenes are
 * shot in, drawn as vector artwork so it stays deterministic, offline and
 * per-template accurate.
 *
 * How it works
 * ------------
 * A tiny orthographic projector turns 3D world coordinates into screen points.
 * Every physical surface (wall, desk top, board, laptop screen, sheet of paper)
 * is a planar quad: three projected corners are enough to build the affine SVG
 * `matrix()` that maps a document's own local coordinates onto that quad, so
 * each template's real layout is *printed* onto the mockup surface without
 * distortion.
 *
 * World units are roughly centimetres: `y` points up, `x` right and `z` towards
 * the viewer; the desk surface is `y = 0`. Scenes are fitted to the canvas
 * automatically, so geometry is declared in world units, never in pixels.
 */

const DEG = Math.PI / 180

export type Vec3 = readonly [number, number, number]
export type Point2 = readonly [number, number]

export type SceneCamera = {
  /** Rotation around the vertical axis, radians. */
  yaw: number
  /** Downward tilt of the camera, radians. */
  pitch: number
  /** Screen pixels per world unit. */
  zoom: number
  /** Screen position of the projected world origin. */
  cx: number
  cy: number
}

/** A planar quad: `origin` plus full edge vectors `u` (local +x) and `v` (local +y). */
export type Plane = { origin: Vec3; u: Vec3; v: Vec3 }

/** A rendered document (poster/slide/page) in its own local coordinate space. */
export type SceneDocument = { markup: string; width: number; height: number }

export type ScenePalette = { accent: string; accent2: string; ink: string }

export type MockupKind = "poster" | "slides" | "paper" | "posudok"

export type SceneInput = {
  kind: MockupKind
  /** Stable per-template variation: shifts the camera and the props slightly. */
  variant: number
  palette: ScenePalette
  /** The template's own document, printed onto the featured surface. */
  document: SceneDocument
  /**
   * Optional second artefact for the easel board. Slide decks print a portrait
   * handout (title slide + content slide) on the board while the laptop shows
   * the live deck; other kinds print `document` on both.
   */
  boardDocument?: SceneDocument
  /** Prefix for gradient/clip ids so two scenes can coexist in one document. */
  idPrefix: string
}

export type SceneSize = { width: number; height: number }

export const v3 = (x: number, y: number, z: number): Vec3 => [x, y, z]

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const mul = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k]

function round(n: number): number {
  return Math.round(n * 100) / 100
}

// ---------------------------------------------------------------------------
// Orthographic projector
// ---------------------------------------------------------------------------

function rawPoint(p: Vec3, yaw: number, pitch: number): Point2 {
  const cosYaw = Math.cos(yaw)
  const sinYaw = Math.sin(yaw)
  const cosPitch = Math.cos(pitch)
  const sinPitch = Math.sin(pitch)
  const x1 = p[0] * cosYaw - p[2] * sinYaw
  const z1 = p[0] * sinYaw + p[2] * cosYaw
  const y1 = p[1] * cosPitch - z1 * sinPitch
  return [x1, y1]
}

/** Project a world point onto the canvas. */
export function project(p: Vec3, cam: SceneCamera): Point2 {
  const [x1, y1] = rawPoint(p, cam.yaw, cam.pitch)
  return [cam.cx + x1 * cam.zoom, cam.cy - y1 * cam.zoom]
}

/** Position a camera of the given angles so `points` fill the canvas. */
export function fitCamera(
  points: readonly Vec3[],
  size: SceneSize,
  yawDeg: number,
  pitchDeg: number,
  marginPx: number,
): SceneCamera {
  const yaw = yawDeg * DEG
  const pitch = pitchDeg * DEG
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const p of points) {
    const [x, y] = rawPoint(p, yaw, pitch)
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  const usableW = Math.max(1, size.width - marginPx * 2)
  const usableH = Math.max(1, size.height - marginPx * 2)
  const zoom = Math.min(usableW / Math.max(1e-6, maxX - minX), usableH / Math.max(1e-6, maxY - minY))
  return {
    yaw,
    pitch,
    zoom,
    cx: size.width / 2 - ((minX + maxX) / 2) * zoom,
    cy: size.height / 2 + ((minY + maxY) / 2) * zoom,
  }
}

/** Corners of a plane, in order: origin → +u → +u+v → +v. */
export function planeCorners(plane: Plane): [Vec3, Vec3, Vec3, Vec3] {
  const p0 = plane.origin
  const p1 = add(plane.origin, plane.u)
  const p3 = add(plane.origin, plane.v)
  return [p0, p1, add(p1, plane.v), p3]
}

export function planePath(plane: Plane, cam: SceneCamera): string {
  const points = planeCorners(plane).map((corner) => {
    const [x, y] = project(corner, cam)
    return `${round(x)} ${round(y)}`
  })
  return `M${points[0]} L${points[1]} L${points[2]} L${points[3]} Z`
}

/**
 * Affine matrix that maps local document coordinates `(0..localW, 0..localH)`
 * onto the plane. Exact for orthographic projection, because the projection of a
 * plane is itself affine.
 */
export function planeMatrix(plane: Plane, cam: SceneCamera, localW: number, localH: number): string {
  const p0 = project(plane.origin, cam)
  const p1 = project(add(plane.origin, plane.u), cam)
  const p3 = project(add(plane.origin, plane.v), cam)
  const a = (p1[0] - p0[0]) / localW
  const b = (p1[1] - p0[1]) / localW
  const c = (p3[0] - p0[0]) / localH
  const d = (p3[1] - p0[1]) / localH
  return `matrix(${round(a)} ${round(b)} ${round(c)} ${round(d)} ${round(p0[0])} ${round(p0[1])})`
}

/**
 * Plane whose top edge is centred on `topCentre`. Local +x runs to screen-right
 * and local +y runs *down the page*, so a rendered document lands upright.
 * `lean` (radians) tips the top of the plane away from the viewer, the way an
 * open laptop lid leans back.
 */
export function uprightFromTop(topCentre: Vec3, width: number, height: number, yaw: number, lean = 0): Plane {
  const u = v3(Math.cos(yaw) * width, 0, -Math.sin(yaw) * width)
  const v = v3(Math.sin(lean) * Math.sin(yaw) * height, -Math.cos(lean) * height, Math.sin(lean) * Math.cos(yaw) * height)
  return { origin: sub(topCentre, mul(u, 0.5)), u, v }
}

/**
 * Flat plane lying at height `y`, centred on `centre` and rotated by `rot`
 * radians. Local +x maps to screen-right and local +y to "towards the viewer",
 * so documents printed on it read the right way up.
 */
export function flatPlane(centre: Vec3, width: number, depth: number, rot = 0): Plane {
  const u = v3(Math.cos(rot) * width, 0, -Math.sin(rot) * width)
  const v = v3(Math.sin(rot) * depth, 0, Math.cos(rot) * depth)
  return { origin: sub(centre, add(mul(u, 0.5), mul(v, 0.5))), u, v }
}

export function shiftPlane(plane: Plane, offset: Vec3): Plane {
  return { origin: add(plane.origin, offset), u: plane.u, v: plane.v }
}

// ---------------------------------------------------------------------------
// SVG helpers
// ---------------------------------------------------------------------------

export function withAlpha(hex: string, alpha: number): string {
  const m = hex.replace(/^#/, "")
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return hex
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0")
  return `#${m}${a}`
}

/** Mix two hex colours; `ratio` 0 → `a`, 1 → `b`. */
export function mixHex(a: string, b: string, ratio: number): string {
  const pa = parseHex(a)
  const pb = parseHex(b)
  if (!pa || !pb) return a
  const t = Math.max(0, Math.min(1, ratio))
  const channel = (i: number) =>
    Math.round(pa[i] + (pb[i] - pa[i]) * t)
      .toString(16)
      .padStart(2, "0")
  return `#${channel(0)}${channel(1)}${channel(2)}`
}

function parseHex(hex: string): [number, number, number] | null {
  const m = hex.replace(/^#/, "")
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return null
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)]
}

/** Painter helper: gradients/clips first, then artwork in `begin()` groups. */
export class SceneCanvas {
  private readonly defs: string[] = []
  private readonly layers: string[][] = []
  private seq = 0

  constructor(private readonly prefix: string) {}

  uid(role: string): string {
    this.seq += 1
    return `${this.prefix}-${role}-${this.seq}`
  }

  def(markup: string): void {
    this.defs.push(markup)
  }

  draw(markup: string): void {
    this.layers[this.layers.length - 1].push(markup)
  }

  /** Start a new artwork layer, drawn on top of the previous ones. */
  begin(): void {
    this.layers.push([])
  }

  build(): string {
    const defs = this.defs.length ? `<defs>${this.defs.join("")}</defs>` : ""
    return defs + this.layers.map((layer) => layer.join("")).join("")
  }
}

/** Closed polygon through projected screen points. */
export function polygon(points: readonly Point2[], fill: string, extra = ""): string {
  const d = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${round(x)} ${round(y)}`).join(" ") + " Z"
  return `<path d="${d}" fill="${fill}"${extra}/>`
}

export function planePolygon(plane: Plane, cam: SceneCamera, fill: string, extra = ""): string {
  return polygon(planeCorners(plane).map((corner) => project(corner, cam)), fill, extra)
}

/** Document content mapped onto a plane, clipped to the plane's outline. */
export function planeContent(
  canvas: SceneCanvas,
  plane: Plane,
  cam: SceneCamera,
  doc: SceneDocument,
  clipRole = "clip",
): string {
  const clipId = canvas.uid(clipRole)
  canvas.def(`<clipPath id="${clipId}"><path d="${planePath(plane, cam)}"/></clipPath>`)
  const matrix = planeMatrix(plane, cam, doc.width, doc.height)
  // The clip lives on an untransformed wrapper: `clipPathUnits="userSpaceOnUse"`
  // resolves against the referencing element's own user space, so clipping and
  // transforming the same element would clip in document coordinates.
  return `<g clip-path="url(#${clipId})"><g transform="${matrix}">${doc.markup}</g></g>`
}

/** Text-line placeholder bar in local (unprojected) coordinates. */
export function bar(x: number, y: number, w: number, h: number, fill: string, opacity = 1): string {
  return `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" rx="${round(h / 2)}" fill="${fill}" opacity="${opacity}"/>`
}

// ---------------------------------------------------------------------------
// Neutral placeholder artwork — "a document", never fake content
// ---------------------------------------------------------------------------

const PAGE_ASPECT = 210 / 297
const SLIDE_ASPECT = 16 / 9

/** A blank page: accent masthead, title bars, body columns. */
export function neutralPage(palette: ScenePalette, width = 300): SceneDocument {
  const height = width / PAGE_ASPECT
  const pad = width * 0.1
  const inner = width - pad * 2
  const markup = [
    `<rect width="${round(width)}" height="${round(height)}" fill="#FFFFFF"/>`,
    `<rect x="${round(pad)}" y="${round(height * 0.09)}" width="${round(inner * 0.34)}" height="${round(height * 0.012)}" fill="${palette.ink}" opacity="0.3"/>`,
    `<rect x="${round(pad)}" y="${round(height * 0.13)}" width="${round(inner * 0.86)}" height="${round(height * 0.028)}" rx="${round(height * 0.004)}" fill="${palette.ink}" opacity="0.78"/>`,
    `<rect x="${round(pad)}" y="${round(height * 0.175)}" width="${round(inner * 0.6)}" height="${round(height * 0.018)}" rx="${round(height * 0.003)}" fill="${palette.ink}" opacity="0.38"/>`,
    `<rect x="${round(pad)}" y="${round(height * 0.215)}" width="${round(inner * 0.2)}" height="${round(height * 0.006)}" fill="${withAlpha(palette.accent, 0.85)}"/>`,
    ...columnBars(palette, pad, inner, height * 0.26, height * 0.62),
  ].join("")
  return { markup, width, height }
}

function columnBars(palette: ScenePalette, x: number, width: number, top: number, height: number): string[] {
  const parts: string[] = []
  const columns = 2
  const rows = 8
  const gap = width * 0.05
  const colW = (width - gap * (columns - 1)) / columns
  for (let column = 0; column < columns; column++) {
    const cx = x + column * (colW + gap)
    for (let i = 0; i < rows; i++) {
      const y = top + (height / rows) * i
      const w = colW * (i % 4 === 0 ? 0.66 : i % 3 === 0 ? 0.94 : 0.82)
      parts.push(bar(cx, y, w, height * 0.02, palette.ink, i % 4 === 0 ? 0.48 : 0.24))
      parts.push(bar(cx, y + height * 0.035, colW * 0.9, height * 0.012, palette.ink, 0.15))
    }
  }
  return parts
}

/** A dark, switched-off laptop screen with a faint accent glow. */
export function neutralScreenArt(palette: ScenePalette, width = 320): SceneDocument {
  const height = width / SLIDE_ASPECT
  const id = `neutral-screen-${width}`
  const markup = [
    `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0.6" y2="1">`,
    `<stop offset="0" stop-color="${mixHex(palette.ink, "#000000", 0.4)}"/>`,
    `<stop offset="1" stop-color="${mixHex(palette.ink, "#FFFFFF", 0.06)}"/>`,
    `</linearGradient></defs>`,
    `<rect width="${round(width)}" height="${round(height)}" fill="url(#${id})"/>`,
    `<rect x="${round(width * 0.06)}" y="${round(height * 0.12)}" width="${round(width * 0.3)}" height="${round(height * 0.06)}" rx="${round(height * 0.02)}" fill="${withAlpha(palette.accent, 0.5)}"/>`,
    `<rect x="${round(width * 0.06)}" y="${round(height * 0.24)}" width="${round(width * 0.42)}" height="${round(height * 0.035)}" rx="${round(height * 0.015)}" fill="#FFFFFF" opacity="0.45"/>`,
    `<rect x="${round(width * 0.06)}" y="${round(height * 0.34)}" width="${round(width * 0.34)}" height="${round(height * 0.035)}" rx="${round(height * 0.015)}" fill="#FFFFFF" opacity="0.26"/>`,
    `<rect x="${round(width * 0.06)}" y="${round(height * 0.44)}" width="${round(width * 0.26)}" height="${round(height * 0.035)}" rx="${round(height * 0.015)}" fill="#FFFFFF" opacity="0.18"/>`,
  ].join("")
  return { markup, width, height }
}

// ---------------------------------------------------------------------------
// The set: room, desk, easel, laptop, sheets and props
// ---------------------------------------------------------------------------

const ROOM = {
  wallZ: -24,
  wallHalfWidth: 74,
  wallHeight: 88,
  deskHalfWidth: 70,
  deskBackZ: -22,
  deskFrontZ: 56,
  deskThickness: 7,
}

type Layout = {
  /** Board on the easel: world width, bottom edge height, position and its slight turn. */
  board: { width: number; bottom: number; centreX: number; z: number; yaw: number }
  laptop: { x: number; z: number; yaw: number; width: number }
  sheets: { x: number; z: number; rot: number }[]
  mug: { x: number; z: number }
  plant: { x: number; z: number; scale: number }
  keyboard: { x: number; z: number }
  notebook: { x: number; z: number; rot: number }
}

/**
 * One composition per output type: posters stand on the easel, decks are shown
 * on the open laptop, papers and posudky are pinned on the board while printed
 * copies wait on the desk. Room, desk and props are otherwise identical, so all
 * previews read as shots of the same studio.
 */
function layoutFor(kind: MockupKind, aspect: number): Layout {
  // `aspect` is height / width: < 1 means a landscape document (e.g. an A0 board).
  const shared = {
    mug: { x: -52, z: 18 },
    keyboard: { x: -6, z: 30 },
    notebook: { x: -60, z: 44, rot: 12 },
  }
  if (kind === "slides") {
    return {
      board: { width: 32, bottom: 22, centreX: -36, z: -13, yaw: 9 },
      laptop: { x: 14, z: 16, yaw: -11, width: 48 },
      sheets: [
        { x: -50, z: 36, rot: -9 },
        { x: 34, z: 44, rot: 8 },
      ],
      plant: { x: 58, z: -10, scale: 1 },
      ...shared,
    }
  }
  if (kind === "paper" || kind === "posudok") {
    return {
      board: { width: 41, bottom: 16, centreX: -24, z: -13, yaw: 7 },
      laptop: { x: 48, z: 0, yaw: -20, width: 30 },
      sheets: [
        { x: -54, z: 40, rot: -8 },
        { x: 34, z: 38, rot: 9 },
      ],
      plant: { x: 60, z: -12, scale: 0.92 },
      ...shared,
    }
  }
  // Posters: landscape boards are wider and sit lower than portrait ones.
  const landscape = aspect < 0.95
  return {
    board: { width: landscape ? 56 : 38, bottom: landscape ? 26 : 12, centreX: -18, z: -13, yaw: 6 },
    laptop: { x: 46, z: 4, yaw: -18, width: 32 },
    sheets: [
      { x: -54, z: 40, rot: -8 },
      { x: 34, z: 42, rot: 8 },
    ],
    plant: { x: 58, z: -10, scale: 1 },
    ...shared,
  }
}

/** Three fixed camera angles keep every preview recognisably the same room. */
function variantYaw(variant: number): number {
  return 16 + (variant % 3) * 2.5
}

/**
 * Tallest point of any board, and the framing height. Every scene is fitted from
 * this fixed set of points — never from the template's own document — so all
 * previews share one camera, one crop and therefore identical file dimensions.
 */
const FRAME = { top: 78, boardZ: -13 }

function roomKeyPoints(): Vec3[] {
  const { wallZ, wallHalfWidth, deskHalfWidth, deskBackZ, deskFrontZ, deskThickness } = ROOM
  return [
    v3(-wallHalfWidth, 0, wallZ),
    v3(wallHalfWidth, 0, wallZ),
    v3(0, FRAME.top, wallZ),
    v3(0, FRAME.top, FRAME.boardZ),
    v3(-deskHalfWidth, 0, deskBackZ),
    v3(deskHalfWidth, 0, deskBackZ),
    v3(-deskHalfWidth, -deskThickness, deskFrontZ),
    v3(deskHalfWidth, -deskThickness, deskFrontZ),
  ]
}

function drawRoom(c: SceneCanvas, cam: SceneCamera, palette: ScenePalette, variant: number): void {
  const { wallZ, wallHalfWidth, wallHeight } = ROOM
  const warm = mixHex("#F7F0E4", palette.accent, 0.05)
  const shade = mixHex("#E1D4C3", palette.ink, 0.16)

  const wallGrad = c.uid("wall")
  c.def(
    `<linearGradient id="${wallGrad}" x1="0" y1="0" x2="0.35" y2="1">` +
      `<stop offset="0" stop-color="${mixHex(warm, "#FFFFFF", 0.22)}"/>` +
      `<stop offset="0.62" stop-color="${warm}"/>` +
      `<stop offset="1" stop-color="${shade}"/>` +
      `</linearGradient>`,
  )
  const wall: Plane = { origin: v3(-wallHalfWidth, 0, wallZ), u: v3(wallHalfWidth * 2, 0, 0), v: v3(0, wallHeight, 0) }
  c.draw(planePolygon(wall, cam, `url(#${wallGrad})`))

  // Window: the warm light source behind the desk, as in the showcase mockups.
  const window: Plane = {
    origin: v3(-wallHalfWidth + 5 + (variant % 3) * 3, wallHeight * 0.3, wallZ + 0.4),
    u: v3(40, 0, 0),
    v: v3(0, wallHeight * 0.52, 0),
  }
  const glow = c.uid("window")
  c.def(
    `<linearGradient id="${glow}" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#FFFCF2"/>` +
      `<stop offset="1" stop-color="#FFEFD2"/>` +
      `</linearGradient>`,
  )
  c.draw(planePolygon(window, cam, `url(#${glow})`))
  const windowBottomLeft = project(window.origin, cam)
  const windowTop = project(add(window.origin, window.v), cam)
  const windowBottomRight = project(add(window.origin, window.u), cam)
  const mullionX = (windowBottomLeft[0] + windowBottomRight[0]) / 2
  c.draw(
    `<rect x="${round(mullionX - 1.7)}" y="${round(windowTop[1])}" width="3.4" height="${round(windowBottomLeft[1] - windowTop[1])}" fill="#FFFFFF" opacity="0.72"/>`,
  )
  c.draw(
    `<rect x="${round(windowBottomLeft[0])}" y="${round(windowTop[1] + (windowBottomLeft[1] - windowTop[1]) * 0.5)}" width="${round(windowBottomRight[0] - windowBottomLeft[0])}" height="2.6" fill="#FFFFFF" opacity="0.55"/>`,
  )

  drawShelf(c, cam, palette, variant)
}

function drawShelf(c: SceneCanvas, cam: SceneCamera, palette: ScenePalette, variant: number): void {
  const woodTop = mixHex("#C89B6A", palette.ink, 0.08)
  const woodSide = mixHex("#A97C4F", palette.ink, 0.18)
  const shelfX = 14
  const shelfWidth = ROOM.wallHalfWidth - shelfX - 2
  const bookColours = [
    mixHex("#B45309", palette.accent, 0.35),
    mixHex("#0F766E", palette.ink, 0.15),
    mixHex("#7C2D12", palette.accent2, 0.4),
    mixHex("#1D4ED8", palette.ink, 0.08),
    mixHex("#92400E", palette.accent, 0.2),
    mixHex("#155E75", palette.accent2, 0.25),
    mixHex("#4C1D95", palette.ink, 0.12),
    mixHex("#065F46", palette.accent, 0.3),
  ]
  const levels: [number, number][] = [
    [0, ROOM.wallHeight * 0.45],
    [1, ROOM.wallHeight * 0.64],
  ]

  for (const [level, y] of levels) {
    const board: Plane = { origin: v3(shelfX, y, ROOM.wallZ), u: v3(shelfWidth, 0, 0), v: v3(0, 0, 7) }
    const lip: Plane = { origin: v3(shelfX, y - 2.4, ROOM.wallZ + 7), u: v3(shelfWidth, 0, 0), v: v3(0, 2.4, 0) }
    c.draw(planePolygon(board, cam, mixHex(woodTop, "#FFFFFF", 0.2)))
    c.draw(planePolygon(lip, cam, woodSide))
    if (level === 0) {
      let x = shelfX + 3
      let i = 0
      while (x < shelfX + shelfWidth - 8) {
        const bw = 2.4 + ((variant + i) % 3) * 0.5
        const bh = 12 + ((variant + i * 2) % 4) * 1.5
        const colour = bookColours[(i + variant) % bookColours.length]
        c.draw(planePolygon({ origin: v3(x, y, ROOM.wallZ + 5), u: v3(bw, 0, 0), v: v3(0, bh, 0) }, cam, colour))
        c.draw(planePolygon({ origin: v3(x + bw, y, ROOM.wallZ + 5), u: v3(0, 0, 2), v: v3(0, bh, 0) }, cam, mixHex(colour, "#000000", 0.28)))
        x += bw + 1.2
        i++
      }
    } else {
      c.draw(planePolygon({ origin: v3(shelfX + 4, y, ROOM.wallZ + 1), u: v3(17, 0, 0), v: v3(0, 0, 5) }, cam, bookColours[variant % bookColours.length]))
      c.draw(
        planePolygon(
          { origin: v3(shelfX + 24, y, ROOM.wallZ + 1), u: v3(13, 0, 0), v: v3(0, 0, 5) },
          cam,
          mixHex(bookColours[(variant + 3) % bookColours.length], "#FFFFFF", 0.18),
        ),
      )
    }
  }
}

function drawDesk(c: SceneCanvas, cam: SceneCamera, palette: ScenePalette): void {
  const { deskHalfWidth, deskBackZ, deskFrontZ, deskThickness } = ROOM
  const top = mixHex("#D8A868", palette.accent, 0.04)
  const topGrad = c.uid("desk")
  c.def(
    `<linearGradient id="${topGrad}" x1="0" y1="0" x2="0.15" y2="1">` +
      `<stop offset="0" stop-color="${mixHex(top, "#FFFFFF", 0.34)}"/>` +
      `<stop offset="0.55" stop-color="${top}"/>` +
      `<stop offset="1" stop-color="${mixHex(top, "#000000", 0.16)}"/>` +
      `</linearGradient>`,
  )
  const surface: Plane = {
    origin: v3(-deskHalfWidth, 0, deskBackZ),
    u: v3(deskHalfWidth * 2, 0, 0),
    v: v3(0, 0, deskFrontZ - deskBackZ),
  }
  c.draw(planePolygon(surface, cam, `url(#${topGrad})`))
  c.draw(
    planePolygon({ origin: v3(-deskHalfWidth, -deskThickness, deskFrontZ), u: v3(deskHalfWidth * 2, 0, 0), v: v3(0, deskThickness, 0) }, cam, mixHex(top, "#000000", 0.38)),
  )
  c.draw(
    planePolygon({ origin: v3(deskHalfWidth, -deskThickness, deskFrontZ), u: v3(0, 0, -(deskFrontZ - deskBackZ)), v: v3(0, deskThickness, 0) }, cam, mixHex(top, "#000000", 0.28)),
  )

  // Timber grain, printed straight onto the desk plane.
  const grain: string[] = []
  for (let i = 0; i < 7; i++) {
    const y = ((i + 1) / 8) * (deskFrontZ - deskBackZ)
    grain.push(`<rect x="${i % 2 ? 6 : 24}" y="${round(y)}" width="${i % 2 ? 118 : 92}" height="0.6" fill="#8A5A2B" opacity="0.13"/>`)
  }
  c.draw(planeContent(c, surface, cam, { markup: grain.join(""), width: deskHalfWidth * 2, height: deskFrontZ - deskBackZ }, "grain"))
}

/** Soft contact shadow: a gradient pool lying flat on the desk. */
function drawShadow(c: SceneCanvas, cam: SceneCamera, centre: Vec3, width: number, depth: number, opacity = 0.22): void {
  const id = c.uid("shadow")
  c.def(
    `<radialGradient id="${id}" cx="0.5" cy="0.5" r="0.5">` +
      `<stop offset="0" stop-color="#22160A" stop-opacity="${opacity}"/>` +
      `<stop offset="0.6" stop-color="#22160A" stop-opacity="${round(opacity * 0.5)}"/>` +
      `<stop offset="1" stop-color="#22160A" stop-opacity="0"/>` +
      `</radialGradient>`,
  )
  c.draw(planePolygon(flatPlane(centre, width, depth), cam, `url(#${id})`))
}

/** Board on its easel, carrying the template's own document. */
function drawEasel(c: SceneCanvas, cam: SceneCamera, palette: ScenePalette, layout: Layout["board"], doc: SceneDocument): void {
  const wood = mixHex("#B8804A", palette.ink, 0.1)
  const woodDark = mixHex("#8A5A2F", palette.ink, 0.18)
  const yaw = layout.yaw * DEG
  const contentH = layout.width * (doc.height / doc.width)
  const plateW = layout.width + 3.4
  const plateH = contentH + 3.4
  const plateBottom = layout.bottom - 1.7
  const plateTop = plateBottom + plateH
  const totalH = plateTop

  // Legs and mast stand behind the board.
  const legSpread = plateW * 0.36
  for (const side of [-1, 1]) {
    const legW = 3.2
    const x = layout.centreX + side * legSpread - legW / 2
    c.draw(
      planePolygon(
        { origin: v3(x, 0, layout.z + 3.6), u: v3(Math.sin(side * 0.05) * totalH * 0.09, totalH - 1.5, 0), v: v3(2.4, 0, -1.2) },
        cam,
        side < 0 ? wood : woodDark,
      ),
    )
  }
  c.draw(planePolygon({ origin: v3(layout.centreX - 2.4, 0, layout.z - 2.2), u: v3(0, totalH + 6, 0), v: v3(4.8, 0, 0) }, cam, mixHex(wood, "#000000", 0.2)))
  drawShadow(c, cam, v3(layout.centreX + 8, 0.2, layout.z + 13), plateW * 1.6, 24, 0.26)

  // The side face of the board, then the printing board itself.
  const plateRightX = layout.centreX + Math.cos(yaw) * plateW * 0.5
  const plateRightZ = layout.z - Math.sin(yaw) * plateW * 0.5 - 1.3
  c.draw(planePolygon(uprightFromTop(v3(plateRightX, plateTop, plateRightZ), 2.6, plateH, yaw + Math.PI / 2), cam, withAlpha(palette.ink, 0.14)))
  c.draw(
    planePolygon(
      uprightFromTop(v3(layout.centreX, plateTop, layout.z), plateW, plateH, yaw),
      cam,
      mixHex("#FFFFFF", palette.accent, 0.035),
      ` stroke="${withAlpha(palette.ink, 0.14)}"`,
    ),
  )

  // The document itself, inset inside the board margin.
  const content = uprightFromTop(v3(layout.centreX, layout.bottom + contentH, layout.z + 0.25), layout.width, contentH, yaw)
  c.draw(planeContent(c, content, cam, doc, "board"))

  for (const side of [-1, 1]) {
    const pin = project(v3(layout.centreX + side * plateW * 0.42, layout.bottom + contentH + 1.6, layout.z + 0.4), cam)
    c.draw(`<circle cx="${round(pin[0])}" cy="${round(pin[1])}" r="2.6" fill="${withAlpha(palette.accent, 0.92)}"/>`)
  }

  // Ledge the board rests on.
  c.draw(
    planePolygon(
      { origin: v3(layout.centreX - plateW / 2 - 1.4, plateBottom, layout.z + 4), u: v3(plateW + 2.8, 0, 0), v: v3(0, 0, -4) },
      cam,
      mixHex(wood, "#FFFFFF", 0.2),
    ),
  )
  c.draw(
    planePolygon(
      { origin: v3(layout.centreX - plateW / 2 - 1.4, plateBottom - 2.3, layout.z + 4), u: v3(plateW + 2.8, 0, 0), v: v3(0, 2.3, 0) },
      cam,
      woodDark,
    ),
  )
}

const LAPTOP_LEAN = 10 * DEG

/** Open laptop: base on the desk, screen hinged on the back edge. */
function drawLaptop(c: SceneCanvas, cam: SceneCamera, palette: ScenePalette, layout: Layout["laptop"], screen: SceneDocument): void {
  const bodyW = layout.width
  const bodyD = bodyW * 0.68
  const rot = layout.yaw * DEG
  const centre = v3(layout.x, 1.4, layout.z)
  const base = flatPlane(centre, bodyW, bodyD, rot)
  const aluminium = mixHex("#B9BFC8", palette.ink, 0.22)

  drawShadow(c, cam, v3(layout.x + 2, 0.15, layout.z + 5), bodyW * 1.3, bodyD * 1.6, 0.2)
  c.draw(planePolygon(base, cam, aluminium))
  // Front skirt gives the base its thickness.
  c.draw(planePolygon({ origin: add(base.origin, base.v), u: base.u, v: v3(0, -1.4, 0) }, cam, mixHex(aluminium, "#000000", 0.42)))

  // Keyboard well, keys and trackpad.
  const wellCentre = add(centre, v3(-Math.sin(rot) * bodyD * 0.05, 0.1, Math.cos(rot) * bodyD * 0.05))
  const well = flatPlane(wellCentre, bodyW * 0.86, bodyD * 0.5, rot)
  c.draw(planePolygon(well, cam, mixHex(aluminium, "#000000", 0.22)))
  const keys: string[] = []
  for (let row = 0; row < 5; row++) {
    keys.push(
      `<rect x="${round(bodyW * 0.06)}" y="${round(bodyD * 0.03 + row * bodyD * 0.1)}" width="${round(bodyW * 0.88)}" height="${round(bodyD * 0.06)}" rx="${round(bodyD * 0.012)}" fill="#FFFFFF" opacity="0.22"/>`,
    )
  }
  c.draw(planeContent(c, well, cam, { markup: keys.join(""), width: bodyW * 0.86, height: bodyD * 0.5 }, "keys"))
  const trackpadCentre = add(centre, v3(-Math.sin(rot) * bodyD * 0.3, 0.15, Math.cos(rot) * bodyD * 0.3))
  c.draw(planePolygon(flatPlane(trackpadCentre, bodyW * 0.3, bodyD * 0.24, rot), cam, mixHex(aluminium, "#FFFFFF", 0.18)))

  // Screen, hinged on the back edge of the base and leaning back from it.
  const screenW = bodyW * 0.96
  const screenH = screenW * (screen.height / screen.width)
  const hinge = add(centre, mul(base.v, -0.5))
  const screenTop = add(hinge, v3(-Math.sin(LAPTOP_LEAN) * screenH * Math.sin(rot), Math.cos(LAPTOP_LEAN) * screenH, -Math.sin(LAPTOP_LEAN) * screenH * Math.cos(rot)))
  const screenPlane = uprightFromTop(screenTop, screenW, screenH, rot, LAPTOP_LEAN)
  c.draw(planePolygon(shiftPlane(screenPlane, v3(0, 0, -0.3)), cam, mixHex(palette.ink, "#000000", 0.3)))
  c.draw(planeContent(c, screenPlane, cam, screen, "screen"))
}

/** A printed sheet lying flat on the desk. */
function drawSheet(
  c: SceneCanvas,
  cam: SceneCamera,
  palette: ScenePalette,
  sheet: { x: number; z: number; rot: number },
  doc: SceneDocument,
  width: number,
  raised: number,
): void {
  const depth = width * (doc.height / doc.width)
  const plane = flatPlane(v3(sheet.x, raised, sheet.z), width, depth, sheet.rot * DEG)
  c.draw(planePolygon(shiftPlane(plane, v3(1, -0.6, 1.2)), cam, withAlpha("#241708", 0.18)))
  const pageGrad = c.uid("page")
  c.def(
    `<linearGradient id="${pageGrad}" x1="0" y1="1" x2="1" y2="0">` +
      `<stop offset="0" stop-color="#FFFFFF"/>` +
      `<stop offset="1" stop-color="${mixHex("#FFFFFF", palette.ink, 0.08)}"/>` +
      `</linearGradient>`,
  )
  c.draw(planePolygon(plane, cam, `url(#${pageGrad})`, ` stroke="${withAlpha(palette.ink, 0.12)}"`))
  c.draw(planeContent(c, plane, cam, doc, "sheet"))
}

function drawSheetStack(c: SceneCanvas, cam: SceneCamera, palette: ScenePalette, sheets: Layout["sheets"]): void {
  const offsets = [
    { x: -1.5, z: 1.8, rot: -4 },
    { x: 1, z: 0.8, rot: 2.5 },
  ]
  sheets.forEach((sheet, index) => {
    const offset = offsets[index % offsets.length]
    drawSheet(
      c,
      cam,
      palette,
      { x: sheet.x + offset.x, z: sheet.z + offset.z, rot: sheet.rot + offset.rot },
      neutralPage(palette, 220),
      21,
      0.25 + index * 0.22,
    )
  })
}

function drawBackProps(c: SceneCanvas, cam: SceneCamera, palette: ScenePalette, layout: Layout): void {
  // Potted plant in the back corner.
  const potW = 9 * layout.plant.scale
  const potH = 8 * layout.plant.scale
  const potCentre = v3(layout.plant.x, 0, layout.plant.z)
  drawShadow(c, cam, add(potCentre, v3(2, 0.15, 3)), potW * 2.6, potW * 2.4, 0.24)
  const potColour = mixHex("#C87F5A", palette.accent, 0.12)
  c.draw(planePolygon({ origin: v3(potCentre[0] - potW / 2, 0, potCentre[2]), u: v3(potW, 0, 0), v: v3(0, potH, 0) }, cam, potColour))
  c.draw(planePolygon(flatPlane(v3(potCentre[0], potH, potCentre[2]), potW, potW * 0.9), cam, mixHex(potColour, "#000000", 0.2)))
  const leafColour = mixHex("#3F7D4F", palette.accent, 0.2)
  const leafDark = mixHex(leafColour, "#000000", 0.25)
  const potBase = project(v3(potCentre[0], potH, potCentre[2]), cam)
  for (let i = 0; i < 7; i++) {
    const angle = -0.95 + i * 0.31
    const len = (11 + (i % 4) * 2.1) * layout.plant.scale
    const tip = project(
      v3(potCentre[0] + Math.sin(angle) * len, potH + Math.cos(angle) * len * 0.95, potCentre[2] + Math.cos(angle) * 1.4),
      cam,
    )
    const midX = (potBase[0] + tip[0]) / 2
    const midY = (potBase[1] + tip[1]) / 2
    c.draw(
      `<path d="M${round(potBase[0])} ${round(potBase[1])} Q${round(midX - 7)} ${round(midY - 4)} ${round(tip[0])} ${round(tip[1])} Q${round(midX + 7)} ${round(midY - 4)} ${round(potBase[0])} ${round(potBase[1])}" fill="${i % 2 ? leafColour : leafDark}" opacity="0.96"/>`,
    )
  }

  // Mug on the left.
  const mugH = 6.2
  const mugR = 3.5
  const mugCentre = v3(layout.mug.x, 0, layout.mug.z)
  const mugColour = mixHex(palette.accent2, "#FFFFFF", 0.5)
  drawShadow(c, cam, add(mugCentre, v3(1.4, 0.15, 1.8)), mugR * 3.4, mugR * 3.4, 0.22)
  c.draw(planePolygon({ origin: v3(mugCentre[0] - mugR, 0, mugCentre[2]), u: v3(mugR * 2, 0, 0), v: v3(0, mugH, 0) }, cam, mugColour))
  c.draw(planePolygon(flatPlane(v3(mugCentre[0], mugH, mugCentre[2]), mugR * 2, mugR * 2), cam, mixHex(mugColour, "#FFFFFF", 0.4)))
  c.draw(planePolygon(flatPlane(v3(mugCentre[0], mugH + 0.06, mugCentre[2]), mugR * 1.5, mugR * 1.1), cam, "#4A2C16"))
  const handle = project(v3(mugCentre[0] + mugR * 0.4, mugH * 0.58, mugCentre[2] + mugR * 0.6), cam)
  c.draw(`<path d="M${round(handle[0])} ${round(handle[1])} q10 -3 10 4.5 q0 6.5 -10 3" fill="none" stroke="${mugColour}" stroke-width="2.4"/>`)
}

function drawFrontProps(c: SceneCanvas, cam: SceneCamera, palette: ScenePalette, layout: Layout): void {
  // Keyboard.
  const kbCentre = v3(layout.keyboard.x, 1.2, layout.keyboard.z)
  const kb = flatPlane(kbCentre, 32, 12, -2 * DEG)
  drawShadow(c, cam, v3(kbCentre[0] + 2, 0.15, kbCentre[2] + 2.4), 40, 18, 0.2)
  c.draw(planePolygon(kb, cam, mixHex("#E8E6E3", palette.ink, 0.06), ` stroke="${withAlpha(palette.ink, 0.18)}"`))
  const keys: string[] = []
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 12; col++) {
      keys.push(
        `<rect x="${round(1.8 + col * 2.45)}" y="${round(1.4 + row * 2.3)}" width="2.1" height="1.9" rx="0.4" fill="#FFFFFF" opacity="0.6"/>`,
      )
    }
  }
  c.draw(planeContent(c, kb, cam, { markup: keys.join(""), width: 32, height: 12 }, "keys"))

  // Notebook and pen in the near corner.
  const nbCentre = v3(layout.notebook.x, 1, layout.notebook.z)
  const nb = flatPlane(nbCentre, 24, 17, layout.notebook.rot * DEG)
  drawShadow(c, cam, v3(nbCentre[0] + 2, 0.12, nbCentre[2] + 2.4), 30, 22, 0.22)
  c.draw(planePolygon(nb, cam, mixHex("#6D4C41", palette.ink, 0.2), ` stroke="${withAlpha(palette.ink, 0.2)}"`))
  c.draw(planePolygon(shiftPlane(nb, v3(0, 0.5, 0)), cam, mixHex("#F5F1E8", palette.ink, 0.04)))
  c.draw(
    planePolygon(flatPlane(v3(nbCentre[0] + 4, 1.6, nbCentre[2] + 5), 13, 1.1, (layout.notebook.rot + 14) * DEG), cam, mixHex(palette.accent, "#111111", 0.3)),
  )
}

/** Warm window light plus a vignette, laid over the finished scene. */
function drawLighting(c: SceneCanvas, size: SceneSize): void {
  const warm = c.uid("warm")
  c.def(
    `<linearGradient id="${warm}" x1="0" y1="0" x2="0.7" y2="1">` +
      `<stop offset="0" stop-color="#FFF4DC" stop-opacity="0.42"/>` +
      `<stop offset="0.45" stop-color="#FFF4DC" stop-opacity="0.1"/>` +
      `<stop offset="1" stop-color="#3B2410" stop-opacity="0.14"/>` +
      `</linearGradient>`,
  )
  c.draw(`<rect width="${round(size.width)}" height="${round(size.height)}" fill="url(#${warm})"/>`)
  const vignette = c.uid("vignette")
  c.def(
    `<radialGradient id="${vignette}" cx="0.45" cy="0.42" r="0.8">` +
      `<stop offset="0.55" stop-color="#000000" stop-opacity="0"/>` +
      `<stop offset="1" stop-color="#000000" stop-opacity="0.28"/>` +
      `</radialGradient>`,
  )
  c.draw(`<rect width="${round(size.width)}" height="${round(size.height)}" fill="url(#${vignette})"/>`)
}

/**
 * Compose the mockup scene: the same studio for every template, staging the
 * template's own document on the surface that matches its output type.
 */
export function renderMockupScene(input: SceneInput, size: SceneSize): string {
  const { kind, palette, document: doc, boardDocument, variant, idPrefix } = input
  const canvas = new SceneCanvas(idPrefix)
  const layout = layoutFor(kind, doc.height / doc.width)
  const cam = fitCamera(roomKeyPoints(), size, variantYaw(variant), 15, size.width * 0.045)

  // Back to front: room, desk, easel, back props, laptop, sheets, near props, light.
  canvas.begin()
  drawRoom(canvas, cam, palette, variant)
  canvas.begin()
  drawDesk(canvas, cam, palette)
  canvas.begin()
  drawEasel(canvas, cam, palette, layout.board, kind === "slides" ? (boardDocument ?? neutralPage(palette, 260)) : doc)
  drawBackProps(canvas, cam, palette, layout)
  canvas.begin()
  drawLaptop(canvas, cam, palette, layout.laptop, kind === "slides" ? doc : neutralScreenArt(palette, 320))
  canvas.begin()
  drawSheetStack(canvas, cam, palette, layout.sheets)
  drawFrontProps(canvas, cam, palette, layout)
  canvas.begin()
  drawLighting(canvas, size)

  return canvas.build()
}
