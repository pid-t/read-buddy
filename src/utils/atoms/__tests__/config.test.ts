import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { mergeWithArrayOverwrite } from "../config"

describe("mergeWithArrayOverwrite", () => {
  it("should overwrite arrays and merge objects in complex config scenarios", () => {
    const config = {
      language: DEFAULT_CONFIG.language,
      translate: {
        ...DEFAULT_CONFIG.translate,
        page: {
          ...DEFAULT_CONFIG.translate.page,
          autoTranslatePatterns: ["old.com"],
          autoTranslateLanguages: ["eng"],
        },
      },
      videoSubtitles: DEFAULT_CONFIG.videoSubtitles,
    }

    const patch = {
      language: { targetCode: "jpn" },
      translate: {
        page: {
          autoTranslatePatterns: ["new.com", "test.org"],
          autoTranslateLanguages: [],
        },
        mode: "replace",
      },
      videoSubtitles: {
        batchQueueConfig: {
          maxItemsPerBatch: 8,
        },
      },
    }

    const result = mergeWithArrayOverwrite(config, patch)

    // Arrays should be completely replaced
    expect(result.translate.page.autoTranslatePatterns).toEqual(["new.com", "test.org"])
    expect(result.translate.page.autoTranslateLanguages).toEqual([])
    expect(result.videoSubtitles.batchQueueConfig.maxItemsPerBatch).toBe(8)

    expect(result.translate.mode).toBe("replace")
    expect(result.videoSubtitles.enabled).toBe(true)

    // Ensure immutability
    expect(result).not.toBe(config)
    expect(result.translate.page.autoTranslatePatterns).not.toBe(config.translate.page.autoTranslatePatterns)
  })

  it("should handle edge cases and type conversions", () => {
    // Array to non-array conversion
    expect(mergeWithArrayOverwrite({ arr: [1, 2] }, { arr: "string" })).toEqual({ arr: "string" })

    // Non-array to array conversion
    expect(mergeWithArrayOverwrite({ val: "text" }, { val: ["a", "b"] })).toEqual({ val: ["a", "b"] })

    // Empty array overwrite
    expect(mergeWithArrayOverwrite({ items: ["x"] }, { items: [] })).toEqual({ items: [] })

    // Null/undefined handling
    expect(mergeWithArrayOverwrite({ a: null }, { a: 1, b: undefined })).toEqual({ a: 1, b: undefined })
  })
})
