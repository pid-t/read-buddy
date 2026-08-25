export interface SelectionRangeSnapshot {
  startContainer: Node
  startOffset: number
  endContainer: Node
  endOffset: number
}

export interface SelectionSnapshot {
  text: string
  ranges: SelectionRangeSnapshot[]
  direction: "forward" | "backward"
}

const ZERO_WIDTH_CHARACTERS = /[\u200B-\u200D\uFEFF]/g
const UI_HOST_ATTRIBUTE = "data-read-frog-selection-ui"

export function normalizeSelectedText(text: string): string {
  return text
    .replace(ZERO_WIDTH_CHARACTERS, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function isSelectionUiNode(node: Node | null): boolean {
  if (!node)
    return false

  if (node instanceof Element && node.hasAttribute(UI_HOST_ATTRIBUTE))
    return true

  const root = node.getRootNode()
  if (root instanceof ShadowRoot) {
    return root.host.hasAttribute(UI_HOST_ATTRIBUTE)
      || root.host.classList.contains("notranslate")
  }

  return Boolean(node.parentElement?.closest(`[${UI_HOST_ATTRIBUTE}]`))
}

function compareBoundaryPoints(
  documentRef: Document,
  leftNode: Node,
  leftOffset: number,
  rightNode: Node,
  rightOffset: number,
): number {
  const left = documentRef.createRange()
  const right = documentRef.createRange()
  left.setStart(leftNode, leftOffset)
  left.collapse(true)
  right.setStart(rightNode, rightOffset)
  right.collapse(true)
  return left.compareBoundaryPoints(0, right)
}

function collectSelectionShadowRoots(selection: Selection): ShadowRoot[] {
  const roots = new Set<ShadowRoot>()
  const boundaryNodes = [selection.anchorNode, selection.focusNode]

  for (let index = 0; index < selection.rangeCount; index++) {
    try {
      const range = selection.getRangeAt(index)
      boundaryNodes.push(range.startContainer, range.endContainer)
    }
    catch {
      break
    }
  }

  for (const boundaryNode of boundaryNodes) {
    let current: Node | null = boundaryNode
    while (current) {
      const root = current.getRootNode()
      if (!(root instanceof ShadowRoot))
        break
      roots.add(root)
      current = root.host
    }
  }

  return [...roots]
}

function getSelectionRanges(selection: Selection, documentRef: Document): Range[] {
  const composedSelection = selection as Selection & {
    getComposedRanges?: (options?: { shadowRoots?: ShadowRoot[] }) => StaticRange[]
  }

  try {
    if (typeof composedSelection.getComposedRanges === "function") {
      const shadowRoots = collectSelectionShadowRoots(selection)
      const composedRanges = composedSelection.getComposedRanges({ shadowRoots })
      if (composedRanges.length > 0) {
        return composedRanges.map((staticRange) => {
          const range = documentRef.createRange()
          range.setStart(staticRange.startContainer, staticRange.startOffset)
          range.setEnd(staticRange.endContainer, staticRange.endOffset)
          return range
        })
      }
    }

    return Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index))
  }
  catch {
    return []
  }
}

function readRangeText(ranges: Range[], selection: Selection): string {
  const selectedText = selection.toString()
  if (selectedText)
    return normalizeSelectedText(selectedText)

  return normalizeSelectedText(ranges.map(range => range.toString()).join("\n"))
}

export function snapshotSelection(
  selection: Selection | null = document.getSelection(),
  documentRef: Document = document,
): SelectionSnapshot | null {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0)
    return null

  const activeElement = documentRef.activeElement
  if (activeElement && ["INPUT", "TEXTAREA"].includes(activeElement.tagName))
    return null

  const ranges = getSelectionRanges(selection, documentRef)
  if (ranges.length === 0)
    return null

  if (ranges.some(range => isSelectionUiNode(range.startContainer) || isSelectionUiNode(range.endContainer)))
    return null

  const text = readRangeText(ranges, selection)
  const codePointLength = Array.from(text).length
  if (!text || !/\p{L}/u.test(text) || codePointLength < 1 || codePointLength > 5000)
    return null

  const snapshots = ranges.map(range => ({
    startContainer: range.startContainer,
    startOffset: range.startOffset,
    endContainer: range.endContainer,
    endOffset: range.endOffset,
  }))

  let direction: "forward" | "backward" = "forward"
  try {
    const firstRange = ranges[0]
    const comparison = compareBoundaryPoints(
      documentRef,
      selection.anchorNode!,
      selection.anchorOffset,
      selection.focusNode!,
      selection.focusOffset,
    )
    direction = comparison <= 0 ? "forward" : "backward"
    if (!firstRange)
      return null
  }
  catch {
    return null
  }

  return { text, ranges: snapshots, direction }
}

export function restoreSelectionRange(
  snapshot: SelectionRangeSnapshot,
  documentRef: Document = document,
): Range | null {
  try {
    const range = documentRef.createRange()
    range.setStart(snapshot.startContainer, snapshot.startOffset)
    range.setEnd(snapshot.endContainer, snapshot.endOffset)
    return range
  }
  catch {
    return null
  }
}

export function restoreSelectionRanges(
  snapshot: SelectionSnapshot,
  documentRef: Document = document,
): Range[] {
  const ranges = snapshot.ranges.map(range => restoreSelectionRange(range, documentRef))

  // A snapshot is usable only while every boundary node remains in the
  // document. Keeping a subset of ranges would position the button next to a
  // stale partial selection after a DOM update.
  if (ranges.includes(null))
    return []

  const restoredRanges = ranges as Range[]
  if (restoredRanges.some(range => !range.startContainer.isConnected || !range.endContainer.isConnected))
    return []

  return restoredRanges
}

export function isSelectionUiHost(element: Element): boolean {
  return element.hasAttribute(UI_HOST_ATTRIBUTE)
}
