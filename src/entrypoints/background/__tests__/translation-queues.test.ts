import type { ProviderConfig } from "@/types/config/provider"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

const onMessageMock = vi.fn()
const ensureInitializedConfigMock = vi.fn()
const executeTranslateMock = vi.fn()
const executeInlineSmartFilterTranslationMock = vi.fn()
const isInlineSmartFilterResultErrorMock = vi.fn()
const generateArticleSummaryMock = vi.fn()
const articleSummaryCacheGetMock = vi.fn()
const articleSummaryCachePutMock = vi.fn()
const translationCacheGetMock = vi.fn()
const translationCachePutMock = vi.fn()

vi.mock("@/utils/message", () => ({
  onMessage: onMessageMock,
}))

vi.mock("../config", () => ({
  ensureInitializedConfig: ensureInitializedConfigMock,
}))

vi.mock("@/utils/host/translate/execute-translate", () => ({
  executeTranslate: executeTranslateMock,
}))

vi.mock("@/utils/host/translate/api/inline-smart-filter", () => ({
  executeInlineSmartFilterTranslation: executeInlineSmartFilterTranslationMock,
  isInlineSmartFilterResultError: isInlineSmartFilterResultErrorMock,
}))

vi.mock("@/utils/content/summary", () => ({
  generateArticleSummary: generateArticleSummaryMock,
}))

vi.mock("@/utils/db/dexie/db", () => ({
  db: {
    articleSummaryCache: {
      get: articleSummaryCacheGetMock,
      put: articleSummaryCachePutMock,
    },
    translationCache: {
      get: translationCacheGetMock,
      put: translationCachePutMock,
    },
  },
}))

function getRegisteredMessageHandler(name: string) {
  const registration = onMessageMock.mock.calls.find(call => call[0] === name)
  if (!registration) {
    throw new Error(`Message handler not registered: ${name}`)
  }
  return registration[1] as (message: { data: Record<string, unknown> }) => Promise<unknown>
}

const llmProvider: ProviderConfig = {
  id: "openai-default",
  name: "OpenAI",
  provider: "openai",
  enabled: true,
  apiKey: "sk-test",
  model: { model: "gpt-5-mini", isCustomModel: false, customModel: null },
}

const googleProvider: ProviderConfig = {
  id: "google-translate-default",
  name: "Google Translate",
  provider: "google-translate",
  enabled: true,
}

const microsoftProvider: ProviderConfig = {
  id: "microsoft-translate-default",
  name: "Microsoft Translate",
  provider: "microsoft-translate",
  enabled: true,
}

describe("translation queue helpers", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    ensureInitializedConfigMock.mockResolvedValue({
      ...DEFAULT_CONFIG,
      translate: {
        ...DEFAULT_CONFIG.translate,
        enableAIContentAware: true,
      },
      videoSubtitles: {
        ...DEFAULT_CONFIG.videoSubtitles,
        providerId: llmProvider.id,
        requestQueueConfig: {
          rate: 10,
          capacity: 10,
        },
        batchQueueConfig: {
          maxCharactersPerBatch: 1000,
          maxItemsPerBatch: 1,
        },
      },
    })

    executeTranslateMock.mockResolvedValue("translated subtitle")
    executeInlineSmartFilterTranslationMock.mockReset()
    isInlineSmartFilterResultErrorMock.mockReset()
    isInlineSmartFilterResultErrorMock.mockImplementation(error => (error as { inlineFormat?: boolean })?.inlineFormat === true)
    generateArticleSummaryMock.mockResolvedValue("Generated summary")
    articleSummaryCacheGetMock.mockResolvedValue(undefined)
    articleSummaryCachePutMock.mockResolvedValue(undefined)
    translationCacheGetMock.mockResolvedValue(undefined)
    translationCachePutMock.mockResolvedValue(undefined)
  })

  it(
    "routes only llm providers through the batch queue",
    async () => {
      const { shouldUseBatchQueue } = await import("../translation-queues")

      const deeplProvider: ProviderConfig = {
        id: "deepl",
        name: "DeepL",
        provider: "deepl",
        enabled: true,
        apiKey: "key",
      }

      const deeplxProvider: ProviderConfig = {
        id: "deeplx",
        name: "DeepLX",
        provider: "deeplx",
        enabled: true,
        baseURL: "https://api.deeplx.org",
      }

      expect(shouldUseBatchQueue(deeplProvider)).toBe(false)
      expect(shouldUseBatchQueue(deeplxProvider)).toBe(false)
      expect(shouldUseBatchQueue(llmProvider)).toBe(true)
    },
    15_000,
  )

  it("passes subtitle summary through the translation queue without generating a new summary", async () => {
    const { setUpSubtitlesTranslationQueue } = await import("../translation-queues")
    await setUpSubtitlesTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueSubtitlesTranslateRequest")
    const result = await handler({
      data: {
        text: "hello",
        langConfig: DEFAULT_CONFIG.language,
        providerConfig: llmProvider,
        scheduleAt: Date.now(),
        hash: "subtitle-hash",
        webTitle: "Video title",
        webDescription: "Video description",
        summary: "Ready summary",
      },
    })

    expect(result).toBe("translated subtitle")
    expect(generateArticleSummaryMock).not.toHaveBeenCalled()
    expect(executeTranslateMock).toHaveBeenCalledWith(
      "hello",
      DEFAULT_CONFIG.language,
      llmProvider,
      expect.any(Function),
      expect.objectContaining({
        isBatch: true,
        context: {
          webTitle: "Video title",
          webDescription: "Video description",
          videoSummary: "Ready summary",
        },
      }),
    )
  })

  it("keeps subtitle translations with different video context in separate batches", async () => {
    ensureInitializedConfigMock.mockResolvedValue({
      ...DEFAULT_CONFIG,
      translate: {
        ...DEFAULT_CONFIG.translate,
        enableAIContentAware: true,
      },
      videoSubtitles: {
        ...DEFAULT_CONFIG.videoSubtitles,
        providerId: llmProvider.id,
        requestQueueConfig: {
          rate: 10,
          capacity: 10,
        },
        batchQueueConfig: {
          maxCharactersPerBatch: 1000,
          maxItemsPerBatch: 10,
        },
      },
    })

    const { setUpSubtitlesTranslationQueue } = await import("../translation-queues")
    await setUpSubtitlesTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueSubtitlesTranslateRequest")
    const requests = [
      handler({
        data: {
          text: "hello",
          langConfig: DEFAULT_CONFIG.language,
          providerConfig: llmProvider,
          scheduleAt: Date.now(),
          hash: "subtitle-hash-one",
          webTitle: "First video",
          webDescription: "First description",
        },
      }),
      handler({
        data: {
          text: "hello",
          langConfig: DEFAULT_CONFIG.language,
          providerConfig: llmProvider,
          scheduleAt: Date.now(),
          hash: "subtitle-hash-two",
          webTitle: "Second video",
          webDescription: "Second description",
        },
      }),
    ]

    await expect(Promise.all(requests)).resolves.toEqual([
      "translated subtitle",
      "translated subtitle",
    ])
    expect(executeTranslateMock).toHaveBeenCalledTimes(2)
    expect(executeTranslateMock).toHaveBeenNthCalledWith(
      1,
      "hello",
      DEFAULT_CONFIG.language,
      llmProvider,
      expect.any(Function),
      expect.objectContaining({
        isBatch: true,
        context: expect.objectContaining({
          webTitle: "First video",
          webDescription: "First description",
        }),
      }),
    )
    expect(executeTranslateMock).toHaveBeenNthCalledWith(
      2,
      "hello",
      DEFAULT_CONFIG.language,
      llmProvider,
      expect.any(Function),
      expect.objectContaining({
        isBatch: true,
        context: expect.objectContaining({
          webTitle: "Second video",
          webDescription: "Second description",
        }),
      }),
    )
  })

  it("passes webpage context through the translation queue without generating a new summary", async () => {
    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    await setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    const result = await handler({
      data: {
        text: "hello",
        langConfig: DEFAULT_CONFIG.language,
        providerConfig: llmProvider,
        scheduleAt: Date.now(),
        hash: "webpage-hash",
        webTitle: "Page title",
        webDescription: "Page description",
        webContent: "Page body",
        webSummary: "Ready summary",
      },
    })

    expect(result).toBe("translated subtitle")
    expect(generateArticleSummaryMock).not.toHaveBeenCalled()
    expect(executeTranslateMock).toHaveBeenCalledWith(
      "hello",
      DEFAULT_CONFIG.language,
      llmProvider,
      expect.any(Function),
      expect.objectContaining({
        context: {
          webTitle: "Page title",
          webDescription: "Page description",
          webContent: "Page body",
          webSummary: "Ready summary",
        },
      }),
    )
  })

  it("runs merged filtering in one batch and caches explicit skips", async () => {
    ensureInitializedConfigMock.mockResolvedValue({
      ...DEFAULT_CONFIG,
      translate: {
        ...DEFAULT_CONFIG.translate,
        batchQueueConfig: { maxCharactersPerBatch: 1000, maxItemsPerBatch: 10 },
      },
    })
    executeInlineSmartFilterTranslationMock.mockResolvedValue(["", "translated body"])

    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    await setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    const inlineSmartFilter = {
      strategyVersion: 1,
      hint: { tag: "a", role: null, ancestors: [{ tag: "nav", role: "navigation" }] },
    }
    const requests = [
      handler({
        data: {
          text: "Home",
          langConfig: DEFAULT_CONFIG.language,
          providerConfig: llmProvider,
          scheduleAt: Date.now(),
          hash: "inline-hash-nav",
          inlineSmartFilter,
        },
      }),
      handler({
        data: {
          text: "Readable body text",
          langConfig: DEFAULT_CONFIG.language,
          providerConfig: llmProvider,
          scheduleAt: Date.now(),
          hash: "inline-hash-body",
          inlineSmartFilter,
        },
      }),
    ]

    await expect(Promise.all(requests)).resolves.toEqual(["", "translated body"])
    expect(executeInlineSmartFilterTranslationMock).toHaveBeenCalledTimes(1)
    expect(executeTranslateMock).not.toHaveBeenCalled()
    expect(translationCachePutMock).toHaveBeenCalledWith(expect.objectContaining({
      key: "inline-hash-nav",
      translation: "",
    }))
    expect(translationCachePutMock).toHaveBeenCalledWith(expect.objectContaining({
      key: "inline-hash-body",
      translation: "translated body",
    }))
  })

  it("returns a cached empty skip for merged translation", async () => {
    translationCacheGetMock.mockResolvedValueOnce({
      key: "cached-skip-hash",
      translation: "",
    })

    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    await setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    const result = await handler({
      data: {
        text: "Home",
        langConfig: DEFAULT_CONFIG.language,
        providerConfig: llmProvider,
        scheduleAt: Date.now(),
        hash: "cached-skip-hash",
        inlineSmartFilter: {
          strategyVersion: 1,
          hint: { tag: "a", role: null, ancestors: [] },
        },
      },
    })

    expect(result).toBe("")
    expect(executeInlineSmartFilterTranslationMock).not.toHaveBeenCalled()
  })

  it("falls back to normal batch translation once when merged results are malformed", async () => {
    ensureInitializedConfigMock.mockResolvedValue({
      ...DEFAULT_CONFIG,
      translate: {
        ...DEFAULT_CONFIG.translate,
        batchQueueConfig: { maxCharactersPerBatch: 1000, maxItemsPerBatch: 10 },
      },
    })
    const formatError = Object.assign(new Error("malformed result"), { inlineFormat: true })
    executeInlineSmartFilterTranslationMock.mockRejectedValue(formatError)
    executeTranslateMock.mockResolvedValue("First translation\n\n%%\n\nSecond translation")

    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    await setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    const inlineSmartFilter = {
      strategyVersion: 1,
      hint: { tag: "p", role: null, ancestors: [] },
    }
    const requests = ["first", "second"].map((text, index) => handler({
      data: {
        text,
        langConfig: DEFAULT_CONFIG.language,
        providerConfig: llmProvider,
        scheduleAt: Date.now(),
        hash: `fallback-hash-${index}`,
        inlineSmartFilter,
      },
    }))

    await expect(Promise.all(requests)).resolves.toEqual(["First translation", "Second translation"])
    expect(executeInlineSmartFilterTranslationMock).toHaveBeenCalledTimes(1)
    expect(executeTranslateMock).toHaveBeenCalledTimes(1)
  })

  it("turns a failed merged fallback into a non-retryable error without individual fallback", async () => {
    ensureInitializedConfigMock.mockResolvedValue({
      ...DEFAULT_CONFIG,
      translate: {
        ...DEFAULT_CONFIG.translate,
        batchQueueConfig: { maxCharactersPerBatch: 1000, maxItemsPerBatch: 10 },
      },
    })
    const formatError = Object.assign(new Error("malformed result"), { inlineFormat: true })
    executeInlineSmartFilterTranslationMock.mockRejectedValue(formatError)
    executeTranslateMock.mockRejectedValue(new Error("network down"))

    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    await setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    await expect(handler({
      data: {
        text: "first",
        langConfig: DEFAULT_CONFIG.language,
        providerConfig: llmProvider,
        scheduleAt: Date.now(),
        hash: "failed-fallback-hash",
        inlineSmartFilter: {
          strategyVersion: 1,
          hint: { tag: "p", role: null, ancestors: [] },
        },
      },
    })).rejects.toThrow("Inline smart filter fallback failed: network down")
    expect(executeTranslateMock).toHaveBeenCalledTimes(1)
  })

  it("preserves fallback error metadata and the queue-stop policy", async () => {
    ensureInitializedConfigMock.mockResolvedValue({
      ...DEFAULT_CONFIG,
      translate: {
        ...DEFAULT_CONFIG.translate,
        batchQueueConfig: { maxCharactersPerBatch: 1000, maxItemsPerBatch: 10 },
      },
    })
    const { attachRequestErrorMeta, defaultRequestRetryPolicy, getRequestErrorMeta } = await import("@/utils/request/retry-policy")
    const formatError = Object.assign(new Error("malformed result"), { inlineFormat: true })
    executeInlineSmartFilterTranslationMock.mockRejectedValue(formatError)
    executeTranslateMock.mockRejectedValue(attachRequestErrorMeta(new Error("Unauthorized"), {
      statusCode: 401,
      responseHeaders: { "www-authenticate": "Bearer realm=\"test\"" },
    }))

    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    await setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    let failure: unknown
    try {
      await handler({
        data: {
          text: "first",
          langConfig: DEFAULT_CONFIG.language,
          providerConfig: llmProvider,
          scheduleAt: Date.now(),
          hash: "metadata-fallback-hash",
          inlineSmartFilter: {
            strategyVersion: 1,
            hint: { tag: "p", role: null, ancestors: [] },
          },
        },
      })
    }
    catch (error) {
      failure = error
    }

    expect(executeInlineSmartFilterTranslationMock).toHaveBeenCalledTimes(1)
    expect(executeTranslateMock).toHaveBeenCalledTimes(1)
    expect(getRequestErrorMeta(failure)).toMatchObject({
      statusCode: 401,
      isRetryable: false,
      responseHeaders: { "www-authenticate": "Bearer realm=\"test\"" },
    })
    expect(defaultRequestRetryPolicy.decide(failure, {
      retryCount: 0,
      maxRetries: 2,
      baseRetryDelayMs: 1000,
      now: Date.now(),
    })).toEqual({ action: "fail", failQueue: true })
  })

  it("normalizes cached Google translations before returning them", async () => {
    translationCacheGetMock.mockResolvedValueOnce({
      key: "webpage-hash",
      translation: "L&#39;Iran chiama &quot;Dichiarazione&quot; &lt;span&gt;",
    })

    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    await setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    const result = await handler({
      data: {
        text: "hello",
        langConfig: DEFAULT_CONFIG.language,
        providerConfig: googleProvider,
        scheduleAt: Date.now(),
        hash: "webpage-hash",
      },
    })

    expect(result).toBe("L'Iran chiama \"Dichiarazione\" <span>")
    expect(executeTranslateMock).not.toHaveBeenCalled()
    expect(translationCachePutMock).not.toHaveBeenCalled()
  })

  it("does not normalize cached non-Google translations", async () => {
    translationCacheGetMock.mockResolvedValueOnce({
      key: "webpage-hash",
      translation: "A&amp;B",
    })

    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    await setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    const result = await handler({
      data: {
        text: "hello",
        langConfig: DEFAULT_CONFIG.language,
        providerConfig: microsoftProvider,
        scheduleAt: Date.now(),
        hash: "webpage-hash",
      },
    })

    expect(result).toBe("A&amp;B")
    expect(executeTranslateMock).not.toHaveBeenCalled()
    expect(translationCachePutMock).not.toHaveBeenCalled()
  })

  it("exposes webpage summary generation as a separate background handler", async () => {
    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    await setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("getOrGenerateWebPageSummary")
    const result = await handler({
      data: {
        webTitle: "Page title",
        webContent: "page body",
        providerConfig: llmProvider,
      },
    })

    expect(result).toBe("Generated summary")
    expect(generateArticleSummaryMock).toHaveBeenCalledWith(
      "Page title",
      "page body",
      llmProvider,
    )
  })

  it("does not generate a webpage summary for a disabled LLM provider", async () => {
    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    await setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("getOrGenerateWebPageSummary")
    const result = await handler({
      data: {
        webTitle: "Page title",
        webContent: "page body",
        providerConfig: { ...llmProvider, enabled: false },
      },
    })

    expect(result).toBeNull()
    expect(generateArticleSummaryMock).not.toHaveBeenCalled()
  })

  it("exposes subtitle summary generation as a separate background handler", async () => {
    const { setUpSubtitlesTranslationQueue } = await import("../translation-queues")
    await setUpSubtitlesTranslationQueue()

    const handler = getRegisteredMessageHandler("getSubtitlesSummary")
    const result = await handler({
      data: {
        videoTitle: "Video title",
        subtitlesContext: "subtitle transcript",
        providerConfig: llmProvider,
      },
    })

    expect(result).toBe("Generated summary")
    expect(generateArticleSummaryMock).toHaveBeenCalledWith(
      "Video title",
      "subtitle transcript",
      llmProvider,
    )
  })

  it("returns null for invalid subtitle summary requests", async () => {
    const { setUpSubtitlesTranslationQueue } = await import("../translation-queues")
    await setUpSubtitlesTranslationQueue()

    const handler = getRegisteredMessageHandler("getSubtitlesSummary")
    const result = await handler({
      data: {
        videoTitle: "",
        subtitlesContext: "subtitle transcript",
        providerConfig: llmProvider,
      },
    })

    expect(result).toBeNull()
    expect(generateArticleSummaryMock).not.toHaveBeenCalled()
  })

  it("returns null when subtitle summary generation has no result", async () => {
    generateArticleSummaryMock.mockResolvedValue(null)

    const { setUpSubtitlesTranslationQueue } = await import("../translation-queues")
    await setUpSubtitlesTranslationQueue()

    const handler = getRegisteredMessageHandler("getSubtitlesSummary")
    const result = await handler({
      data: {
        videoTitle: "Video title",
        subtitlesContext: "subtitle transcript",
        providerConfig: llmProvider,
      },
    })

    expect(result).toBeNull()
  })

  it("deduplicates concurrent subtitle summary generation requests", async () => {
    let resolveSummary!: (summary: string) => void
    generateArticleSummaryMock.mockImplementation(
      () => new Promise((resolve: (summary: string) => void) => {
        resolveSummary = resolve
      }),
    )

    const { setUpSubtitlesTranslationQueue } = await import("../translation-queues")
    await setUpSubtitlesTranslationQueue()

    const handler = getRegisteredMessageHandler("getSubtitlesSummary")
    const firstRequest = handler({
      data: {
        videoTitle: "Video title",
        subtitlesContext: "subtitle transcript",
        providerConfig: llmProvider,
      },
    })
    const secondRequest = handler({
      data: {
        videoTitle: "Video title",
        subtitlesContext: "subtitle transcript",
        providerConfig: llmProvider,
      },
    })

    await Promise.resolve()
    await Promise.resolve()
    resolveSummary("Generated summary")

    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([
      "Generated summary",
      "Generated summary",
    ])
    expect(generateArticleSummaryMock).toHaveBeenCalledTimes(1)
  })
})
