import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { microsoftTranslate } from "../microsoft"

const fetchMock = vi.fn()

describe("microsoft translate adapter", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("uses the public translation endpoint without authentication headers", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: vi.fn().mockResolvedValue([
        { translations: [{ text: "图书馆" }] },
        { translations: [{ text: "书架" }] },
      ]),
      text: vi.fn().mockResolvedValue(""),
    })

    await expect(microsoftTranslate(["Library", "Shelf"], "en", "zh")).resolves.toEqual(["图书馆", "书架"])

    expect(fetchMock).toHaveBeenCalledWith(
      "https://edge.microsoft.com/translate/translatetext?from=en&to=zh",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(["Library", "Shelf"]),
      }),
    )

    const [, requestInit] = fetchMock.mock.calls[0]
    expect(requestInit.headers).not.toHaveProperty("Authorization")
    expect(requestInit.headers).not.toHaveProperty("Ocp-Apim-Subscription-Key")
  })

  it("keeps single-item and auto-source semantics", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: vi.fn().mockResolvedValue([{ translations: [{ text: "圖書館" }] }]),
      text: vi.fn().mockResolvedValue(""),
    })

    await expect(microsoftTranslate("Library", "auto", "zh-TW")).resolves.toBe("圖書館")
    expect(fetchMock).toHaveBeenCalledWith(
      "https://edge.microsoft.com/translate/translatetext?from=&to=zh-TW",
      expect.any(Object),
    )
  })
})
