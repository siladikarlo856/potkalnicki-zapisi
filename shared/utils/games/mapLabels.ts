/**
 * Collision-aware map labels. Candidates are tried in priority order and a label is kept only when its box, measured
 * in screen pixels, overlaps neither an already kept label nor (unless `overDots`) a dot. Zooming in spreads the
 * anchors apart, so more labels survive the check.
 */
export interface LabelCandidate {
  key: string
  /** Anchor (the dot) in frame pixels. */
  x: number
  y: number
  text: string
  /** Higher wins a collision; ties keep input order. */
  priority: number
  /** Drawn over dots: only other labels can hide it. */
  overDots?: boolean
}

/** Bold 14px label ink: average glyph width and line height in screen pixels, plus breathing room between labels. */
export const LABEL_FONT_PX = 14
const GLYPH_PX = 8
const LABEL_GAP_PX = 3
/** The label baseline sits this far above its dot's centre (matches the drawn offset). */
export const LABEL_RISE_PX = 13
const DOT_CLEARANCE_PX = 9

interface Box { left: number, right: number, top: number, bottom: number }

const overlaps = (a: Box, b: Box) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top

/**
 * Keys of the labels that fit at this zoom (`scale` = screen pixels per frame pixel). `dots` are frame-space points
 * that labels must not cover; `rise` is how far above its anchor each label's baseline is drawn, in screen pixels.
 */
export function placeLabels(
  candidates: LabelCandidate[],
  scale: number,
  dots: { x: number, y: number }[] = [],
  rise = LABEL_RISE_PX
): Set<string> {
  const kept: Box[] = []
  const dotBoxes: Box[] = dots.map(d => ({
    left: d.x * scale - DOT_CLEARANCE_PX,
    right: d.x * scale + DOT_CLEARANCE_PX,
    top: d.y * scale - DOT_CLEARANCE_PX,
    bottom: d.y * scale + DOT_CLEARANCE_PX
  }))
  const shown = new Set<string>()
  const ordered = candidates
    .map((c, index) => ({ c, index }))
    .sort((a, b) => b.c.priority - a.c.priority || a.index - b.index)
  for (const { c } of ordered) {
    const width = c.text.length * GLYPH_PX + LABEL_GAP_PX * 2
    const cx = c.x * scale
    const baseline = c.y * scale - rise
    const box: Box = {
      left: cx - width / 2,
      right: cx + width / 2,
      top: baseline - LABEL_FONT_PX - LABEL_GAP_PX,
      bottom: baseline + LABEL_GAP_PX
    }
    // A dot under its own label is fine; only other dots count.
    const ownDot = (d: Box) => Math.abs((d.left + d.right) / 2 - cx) < 0.5 && Math.abs((d.top + d.bottom) / 2 - c.y * scale) < 0.5
    if (kept.some(k => overlaps(box, k)) || (!c.overDots && dotBoxes.some(d => !ownDot(d) && overlaps(box, d)))) continue
    kept.push(box)
    shown.add(c.key)
  }
  return shown
}

const EDGE_PAD_PX = 4

/**
 * The frame x a centred label is drawn at so its whole box stays inside the viewport while its anchor is in view.
 * `scale` is screen pixels per frame pixel, `translateX` the frame's screen offset and `viewportWidth` the screen width;
 * a label wider than the viewport is centred on it, and a label whose anchor is off-screen stays put to be clipped.
 */
export function clampLabelX(x: number, text: string, scale: number, translateX: number, viewportWidth: number): number {
  if (!viewportWidth) return x
  const half = (text.length * GLYPH_PX + LABEL_GAP_PX * 2) / 2
  const min = half + EDGE_PAD_PX
  const max = viewportWidth - half - EDGE_PAD_PX
  const screen = x * scale + translateX
  if (screen < 0 || screen > viewportWidth) return x
  if (min > max) return (viewportWidth / 2 - translateX) / scale
  return (Math.min(max, Math.max(min, screen)) - translateX) / scale
}
