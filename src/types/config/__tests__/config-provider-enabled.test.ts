import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { configSchema } from "../config"

function getIssuePaths(input: unknown) {
  const result = configSchema.safeParse(input)
  if (result.success) {
    return []
  }

  return result.error.issues.map(issue => issue.path.join("."))
}

describe("config provider enabled validation", () => {
  it("fails when a built-in feature uses a disabled provider", () => {
    const disabledId = DEFAULT_CONFIG.translate.providerId
    const providersConfig = DEFAULT_CONFIG.providersConfig.map((provider) => {
      if (provider.id === disabledId) {
        return { ...provider, enabled: false }
      }
      return provider
    })

    const issuePaths = getIssuePaths({
      ...DEFAULT_CONFIG,
      providersConfig,
    })

    expect(issuePaths).toContain("translate.providerId")
  })

  it("fails when video subtitles use a disabled provider", () => {
    const disabledId = DEFAULT_CONFIG.videoSubtitles.providerId
    const providersConfig = DEFAULT_CONFIG.providersConfig.map((provider) => {
      if (provider.id === disabledId) {
        return { ...provider, enabled: false }
      }
      return provider
    })

    const issuePaths = getIssuePaths({
      ...DEFAULT_CONFIG,
      providersConfig,
      videoSubtitles: {
        ...DEFAULT_CONFIG.videoSubtitles,
        providerId: disabledId,
      },
    })

    expect(issuePaths).toContain("videoSubtitles.providerId")
  })

  it("fails when selection translation uses a disabled provider", () => {
    const disabledId = DEFAULT_CONFIG.selectionTranslation.providerId
    const providersConfig = DEFAULT_CONFIG.providersConfig.map((provider) => {
      if (provider.id === disabledId) {
        return { ...provider, enabled: false }
      }
      return provider
    })

    const issuePaths = getIssuePaths({
      ...DEFAULT_CONFIG,
      providersConfig,
      selectionTranslation: {
        ...DEFAULT_CONFIG.selectionTranslation,
        providerId: disabledId,
      },
    })

    expect(issuePaths).toContain("selectionTranslation.providerId")
  })
})
