import type { Config } from "@/types/config/config"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"
import { translateTextForSelection } from "../translate-selection"
import { translateTextCore } from "../translate-text"

vi.mock("../translate-text", () => ({
  translateTextCore: vi.fn().mockResolvedValue("译文"),
}))

describe("translateTextForSelection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("uses selection-specific target/provider settings and cache tags", async () => {
    const config: Config = {
      ...DEFAULT_CONFIG,
      selectionTranslation: {
        ...DEFAULT_CONFIG.selectionTranslation,
        targetCode: "eng",
        providerId: "deepseek-default",
      },
      providersConfig: DEFAULT_CONFIG.providersConfig.map(provider => provider.id === "deepseek-default"
        ? { ...provider, apiKey: "test-key" }
        : provider),
    }

    await expect(translateTextForSelection(config, "你好")).resolves.toBe("译文")
    expect(vi.mocked(translateTextCore)).toHaveBeenCalledWith(expect.objectContaining({
      text: "你好",
      langConfig: {
        sourceCode: "auto",
        targetCode: "eng",
        level: config.language.level,
      },
      providerConfig: expect.objectContaining({ id: "deepseek-default" }),
      enableAIContentAware: false,
      extraHashTags: ["selectionTranslation:v1"],
    }))
  })

  it("rejects a missing API key for DeepL", async () => {
    const config: Config = {
      ...DEFAULT_CONFIG,
      selectionTranslation: {
        ...DEFAULT_CONFIG.selectionTranslation,
        providerId: "deepl-default",
      },
      providersConfig: [...DEFAULT_CONFIG.providersConfig, DEFAULT_PROVIDER_CONFIG.deepl],
    }

    await expect(
      translateTextForSelection(config, "你好"),
    ).rejects.toThrow("Selection translation provider API key is missing")
    expect(vi.mocked(translateTextCore)).not.toHaveBeenCalled()
  })

  it("allows a missing API key for DeepLX", async () => {
    const config: Config = {
      ...DEFAULT_CONFIG,
      selectionTranslation: {
        ...DEFAULT_CONFIG.selectionTranslation,
        providerId: "deeplx-default",
      },
    }

    await expect(translateTextForSelection(config, "你好")).resolves.toBe("译文")
  })

  it.each([
    ["google-translate-default", "google-translate"],
    ["microsoft-translate-default", "microsoft-translate"],
  ])("allows a missing API key for %s", async (providerId, provider) => {
    const config: Config = {
      ...DEFAULT_CONFIG,
      selectionTranslation: {
        ...DEFAULT_CONFIG.selectionTranslation,
        providerId,
      },
    }

    await expect(translateTextForSelection(config, "你好")).resolves.toBe("译文")
    expect(vi.mocked(translateTextCore)).toHaveBeenCalledWith(expect.objectContaining({
      providerConfig: expect.objectContaining({ id: providerId, provider }),
    }))
  })
})
