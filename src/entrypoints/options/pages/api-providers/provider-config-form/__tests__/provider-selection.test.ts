import { describe, expect, it } from "vitest"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"
import { chooseNextProviderConfig } from "../provider-selection"

describe("chooseNextProviderConfig", () => {
  it("returns the first remaining API provider", () => {
    expect(chooseNextProviderConfig([
      DEFAULT_PROVIDER_CONFIG["microsoft-translate"],
      DEFAULT_PROVIDER_CONFIG.openai,
      DEFAULT_PROVIDER_CONFIG["google-translate"],
    ])).toEqual(DEFAULT_PROVIDER_CONFIG.openai)
  })

  it("returns undefined when only free non-API providers remain", () => {
    expect(chooseNextProviderConfig([
      DEFAULT_PROVIDER_CONFIG["microsoft-translate"],
      DEFAULT_PROVIDER_CONFIG["google-translate"],
    ])).toBeUndefined()
  })
})
