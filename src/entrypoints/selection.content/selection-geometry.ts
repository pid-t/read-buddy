import type { SelectionSnapshot } from "./selection-snapshot"
import { restoreSelectionRanges } from "./selection-snapshot"

export const BUTTON_SIZE = 28
export const SELECTION_GAP = 8
export const VIEWPORT_MARGIN = 8

export type SelectionButtonPlacement
  = | "right-bottom"
    | "right-top"
    | "right-center"
    | "below-end"
    | "above-end"
    | "left-center"

export interface SelectionButtonPosition {
  left: number
  top: number
  placement: SelectionButtonPlacement
}

interface RectLike {
  left: number
  right: number
  top: number
  bottom: number
  width: number
  height: number
}

function toRect(rect: DOMRect): RectLike {
  return {
    left: rect.left,
    right: rect.right,
    top: rect.top,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  }
}

function overlaps(left: number, top: number, rect: RectLike): boolean {
  return left < rect.right
    && left + BUTTON_SIZE > rect.left
    && top < rect.bottom
    && top + BUTTON_SIZE > rect.top
}

function isWithinViewport(left: number, top: number, viewportWidth: number, viewportHeight: number): boolean {
  return left >= VIEWPORT_MARGIN
    && top >= VIEWPORT_MARGIN
    && left + BUTTON_SIZE <= viewportWidth - VIEWPORT_MARGIN
    && top + BUTTON_SIZE <= viewportHeight - VIEWPORT_MARGIN
}

function clamp(value: number, max: number): number {
  return Math.min(Math.max(value, VIEWPORT_MARGIN), Math.max(VIEWPORT_MARGIN, max - BUTTON_SIZE - VIEWPORT_MARGIN))
}

export function calculateSelectionButtonPosition(
  rects: DOMRect[],
  direction: "forward" | "backward" = "forward",
  viewportWidth = typeof window === "undefined" ? 0 : window.innerWidth,
  viewportHeight = typeof window === "undefined" ? 0 : window.innerHeight,
): SelectionButtonPosition | null {
  const visibleRects = rects
    .filter(rect => rect.width > 0 && rect.height > 0)
    .map(toRect)
  if (visibleRects.length === 0)
    return null

  const firstRect = visibleRects[0]
  const lastRect = visibleRects[visibleRects.length - 1]
  if (!firstRect || !lastRect)
    return null

  const focusRect = direction === "backward" ? firstRect : lastRect
  const selectionRect = visibleRects.reduce(
    (result, rect) => ({
      left: Math.min(result.left, rect.left),
      right: Math.max(result.right, rect.right),
      top: Math.min(result.top, rect.top),
      bottom: Math.max(result.bottom, rect.bottom),
      width: 0,
      height: 0,
    }),
    { ...visibleRects[0], width: 0, height: 0 },
  )
  selectionRect.width = selectionRect.right - selectionRect.left
  selectionRect.height = selectionRect.bottom - selectionRect.top

  const candidates: Array<{ placement: SelectionButtonPlacement, left: number, top: number }> = [
    { placement: "right-bottom", left: focusRect.right + SELECTION_GAP, top: focusRect.bottom - BUTTON_SIZE },
    { placement: "right-top", left: focusRect.right + SELECTION_GAP, top: focusRect.top },
    { placement: "right-center", left: selectionRect.right + SELECTION_GAP, top: selectionRect.top + (selectionRect.height - BUTTON_SIZE) / 2 },
    { placement: "below-end", left: focusRect.right - BUTTON_SIZE, top: focusRect.bottom + SELECTION_GAP },
    { placement: "above-end", left: focusRect.right - BUTTON_SIZE, top: focusRect.top - BUTTON_SIZE - SELECTION_GAP },
    { placement: "left-center", left: selectionRect.left - BUTTON_SIZE - SELECTION_GAP, top: selectionRect.top + (selectionRect.height - BUTTON_SIZE) / 2 },
  ]

  const scored = candidates.map((candidate, index) => ({
    candidate,
    index,
    safe: isWithinViewport(candidate.left, candidate.top, viewportWidth, viewportHeight),
    collision: visibleRects.some(rect => overlaps(candidate.left, candidate.top, rect)),
  }))

  scored.sort((left, right) => {
    if (left.safe !== right.safe)
      return left.safe ? -1 : 1
    if (left.collision !== right.collision)
      return left.collision ? 1 : -1
    return left.index - right.index
  })

  const selected = scored.every(candidate => candidate.collision)
    ? scored.find(candidate => candidate.index === 0)
    : scored[0]
  if (!selected)
    return null

  return {
    left: clamp(selected.candidate.left, viewportWidth),
    top: clamp(selected.candidate.top, viewportHeight),
    placement: selected.candidate.placement,
  }
}

export function getSelectionButtonPosition(
  snapshot: SelectionSnapshot,
  documentRef: Document = document,
  viewportWidth = documentRef.defaultView?.innerWidth ?? 0,
  viewportHeight = documentRef.defaultView?.innerHeight ?? 0,
): SelectionButtonPosition | null {
  const ranges = restoreSelectionRanges(snapshot, documentRef)
  const rects = ranges.flatMap(range => Array.from(range.getClientRects()))
  return calculateSelectionButtonPosition(rects, snapshot.direction, viewportWidth, viewportHeight)
}
