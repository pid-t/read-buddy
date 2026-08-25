import { describe, expect, it } from "vitest"
import {
  areSelectionLanguagesEquivalent,
  createSelectionLanguageSample,
  shouldShowSelectionTranslateButton,
} from "../selection-language"

describe("selection language decision", () => {
  it("uses the first 384 and last 128 code points for long samples", () => {
    const text = `${"a".repeat(384)}${"b".repeat(200)}`
    const sample = createSelectionLanguageSample(text)

    expect(sample).toHaveLength(512)
    expect(sample.startsWith("a".repeat(384))).toBe(true)
    expect(sample.endsWith("b".repeat(128))).toBe(true)
  })

  it("treats simplified and traditional Chinese as the same target family", () => {
    expect(areSelectionLanguagesEquivalent("cmn", "cmn-Hant")).toBe(true)
    expect(areSelectionLanguagesEquivalent("cmn-Hant", "cmn")).toBe(true)
    expect(areSelectionLanguagesEquivalent("yue", "cmn")).toBe(false)
  })

  it("shows the button for unknown and non-target languages", () => {
    expect(shouldShowSelectionTranslateButton("und", "cmn")).toBe(true)
    expect(shouldShowSelectionTranslateButton("eng", "cmn")).toBe(true)
    expect(shouldShowSelectionTranslateButton("cmn", "cmn")).toBe(false)
  })
})
