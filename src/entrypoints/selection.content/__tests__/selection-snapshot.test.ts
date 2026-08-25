/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest"
import { normalizeSelectedText, restoreSelectionRanges, snapshotSelection } from "../selection-snapshot"

describe("selection snapshot", () => {
  it("normalizes text and preserves a range snapshot", () => {
    document.body.innerHTML = "<p>Hello <strong>world</strong></p>"
    const paragraph = document.querySelector("p")!
    const selection = window.getSelection()!
    const range = document.createRange()
    range.selectNodeContents(paragraph)
    selection.removeAllRanges()
    selection.addRange(range)

    const snapshot = snapshotSelection(selection, document)
    expect(snapshot?.text).toBe("Hello world")
    expect(snapshot?.ranges).toHaveLength(1)
    expect(snapshot?.direction).toBe("forward")
  })

  it("rejects collapsed, punctuation-only, input and oversized selections", () => {
    expect(normalizeSelectedText("\u200B  hello   world \u200D")).toBe("hello world")

    document.body.innerHTML = "<input value='hello world'><p>!!!</p><p id='long'></p>"
    const selection = window.getSelection()!
    const input = document.querySelector("input")!
    const inputRange = document.createRange()
    inputRange.selectNodeContents(input)
    selection.removeAllRanges()
    selection.addRange(inputRange)
    expect(snapshotSelection(selection, document)).toBeNull()

    const punctuation = document.querySelector("p")!
    const punctuationRange = document.createRange()
    punctuationRange.selectNodeContents(punctuation)
    selection.removeAllRanges()
    selection.addRange(punctuationRange)
    expect(snapshotSelection(selection, document)).toBeNull()

    const long = document.querySelector("#long")!
    long.textContent = "a".repeat(5001)
    const longRange = document.createRange()
    longRange.selectNodeContents(long)
    selection.removeAllRanges()
    selection.addRange(longRange)
    expect(snapshotSelection(selection, document)).toBeNull()
  })

  it("rejects a partially detached multi-range snapshot", () => {
    document.body.innerHTML = "<p id='first'>first</p><p id='second'>second</p>"
    const first = document.querySelector("#first")!.firstChild!
    const second = document.querySelector("#second")!.firstChild!
    const snapshot = {
      text: "firstsecond",
      direction: "forward" as const,
      ranges: [
        { startContainer: first, startOffset: 0, endContainer: first, endOffset: 5 },
        { startContainer: second, startOffset: 0, endContainer: second, endOffset: 6 },
      ],
    }

    document.querySelector("#first")!.remove()

    expect(restoreSelectionRanges(snapshot, document)).toEqual([])
  })
})
