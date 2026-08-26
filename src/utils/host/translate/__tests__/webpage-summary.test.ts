// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/utils/message", () => ({
  sendMessage: vi.fn(),
}))

describe("getOrGenerateWebPageSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("requests webpage summary through a dedicated background message", async () => {
    const { sendMessage } = await import("@/utils/message")
    vi.mocked(sendMessage).mockResolvedValue("Generated summary")

    const { getOrGenerateWebPageSummary } = await import("../webpage-summary")
    const result = await getOrGenerateWebPageSummary(
      {
        url: "https://example.com/article",
        webTitle: "Page title",
        webContent: "Page body",
      },
      {
        id: "openai-default",
        name: "OpenAI",
        provider: "openai",
        enabled: true,
        apiKey: "sk-test",
        model: { model: "gpt-5-mini", isCustomModel: false, customModel: null },
      },
      true,
    )

    expect(result).toBe("Generated summary")
    expect(sendMessage).toHaveBeenCalledWith("getOrGenerateWebPageSummary", {
      webTitle: "Page title",
      webContent: "Page body",
      providerConfig: expect.objectContaining({ id: "openai-default" }),
    })
  })

  it("does not request a summary for a disabled LLM provider", async () => {
    const { sendMessage } = await import("@/utils/message")
    const { getOrGenerateWebPageSummary } = await import("../webpage-summary")
    const result = await getOrGenerateWebPageSummary(
      {
        url: "https://example.com/article",
        webTitle: "Page title",
        webContent: "Page body",
      },
      {
        id: "openai-default",
        name: "OpenAI",
        provider: "openai",
        enabled: false,
        apiKey: "sk-test",
        model: { model: "gpt-5-mini", isCustomModel: false, customModel: null },
      },
      true,
    )

    expect(result).toBeNull()
    expect(sendMessage).not.toHaveBeenCalled()
  })
})
