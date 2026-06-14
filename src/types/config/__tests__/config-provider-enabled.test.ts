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
    const providersConfig = DEFAULT_CONFIG.providersConfig.map((provider) => {
      if (provider.id === "microsoft-translate-default") {
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
    const providersConfig = DEFAULT_CONFIG.providersConfig.map((provider) => {
      if (provider.id === "microsoft-translate-default") {
        return { ...provider, enabled: false }
      }
      return provider
    })

    const issuePaths = getIssuePaths({
      ...DEFAULT_CONFIG,
      providersConfig,
      videoSubtitles: {
        ...DEFAULT_CONFIG.videoSubtitles,
        providerId: "microsoft-translate-default",
      },
    })

    expect(issuePaths).toContain("videoSubtitles.providerId")
  })
})
