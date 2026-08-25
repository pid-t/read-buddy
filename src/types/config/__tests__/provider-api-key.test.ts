import { describe, expect, it } from "vitest"
import { isAPIKeyOptionalProvider } from "../provider"

describe("provider API key requirements", () => {
  it("keeps DeepLX and Ollama optional", () => {
    expect(isAPIKeyOptionalProvider("deeplx")).toBe(true)
    expect(isAPIKeyOptionalProvider("ollama")).toBe(true)
  })

  it("requires keys for DeepL and other API providers", () => {
    expect(isAPIKeyOptionalProvider("deepl")).toBe(false)
    expect(isAPIKeyOptionalProvider("openai")).toBe(false)
  })
})
