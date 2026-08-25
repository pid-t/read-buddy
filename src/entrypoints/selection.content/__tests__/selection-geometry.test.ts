import { describe, expect, it } from "vitest"
import { BUTTON_SIZE, calculateSelectionButtonPosition } from "../selection-geometry"

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height } as DOMRect
}

describe("selection button geometry", () => {
  it("prefers the right-bottom position for a normal selection", () => {
    expect(calculateSelectionButtonPosition([rect(100, 100, 100, 20)], "forward", 800, 600)).toEqual({
      left: 208,
      top: 92,
      placement: "right-bottom",
    })
  })

  it("moves above or below a selection at the viewport edge", () => {
    const result = calculateSelectionButtonPosition([rect(740, 560, 52, 20)], "forward", 800, 600)
    if (!result)
      throw new Error("Expected a button position")
    expect(["right-top", "below-end", "above-end", "left-center"]).toContain(result?.placement)
    expect(result.left).toBeGreaterThanOrEqual(8)
    expect(result.top).toBeGreaterThanOrEqual(8)
    expect(result.left + BUTTON_SIZE).toBeLessThanOrEqual(792)
    expect(result.top + BUTTON_SIZE).toBeLessThanOrEqual(592)
  })

  it("uses the first line for a backward selection", () => {
    const result = calculateSelectionButtonPosition(
      [rect(100, 100, 100, 20), rect(100, 130, 180, 20)],
      "backward",
      800,
      600,
    )
    expect(result?.left).toBe(208)
    expect(result?.top).toBe(92)
  })

  it("clamps the first candidate when every candidate collides", () => {
    const result = calculateSelectionButtonPosition([rect(0, 0, 800, 600)], "forward", 800, 600)
    expect(result?.left).toBe(764)
    expect(result?.top).toBe(564)
  })
})
