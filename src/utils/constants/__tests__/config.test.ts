import { describe, expect, it } from "vitest"

describe("dEFAULT_CONFIG", () => {
  it("seeds DeepSeek without the removed legacy provider in the default providers config", async () => {
    const { DEFAULT_CONFIG } = await import("../config")
    const { configSchema } = await import("@/types/config/config")

    const parseResult = configSchema.safeParse(DEFAULT_CONFIG)
    if (!parseResult.success) {
      console.error(parseResult.error.issues)
    }

    expect(parseResult.success).toBe(true)
    expect(DEFAULT_CONFIG.providersConfig.map(provider => provider.id)).toEqual([
      "microsoft-translate-default",
      "google-translate-default",
      "openai-default",
      "deepseek-default",
      "tensdaq-default",
      "google-default",
      "deeplx-default",
    ])
    expect(DEFAULT_CONFIG.providersConfig.find(provider => provider.id === "deepseek-default")).toEqual(
      expect.objectContaining({
        model: {
          model: "deepseek-v4-flash",
          isCustomModel: false,
          customModel: null,
        },
      }),
    )
  })
})
