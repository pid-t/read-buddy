import type { SmartRegion } from "@/utils/host/smart-filter/types"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { browser } from "#imports"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

const onMessageMock = vi.fn()
const ensureInitializedConfigMock = vi.fn()
const getModelByIdMock = vi.fn()
const generateTextMock = vi.fn()
const outputObjectMock = vi.fn()
const loggerWarnMock = vi.fn()
const storageGetItemMock = vi.fn()
const storageSetItemMock = vi.fn()
const storageRemoveItemMock = vi.fn()
const tabsOnRemovedAddListenerMock = vi.fn()

const messageHandlers = new Map<string, (message: any) => any>()

vi.mock("wxt/utils/storage", () => ({
  storage: {
    getItem: storageGetItemMock,
    setItem: storageSetItemMock,
    removeItem: storageRemoveItemMock,
  },
}))

vi.mock("@/utils/message", () => ({
  onMessage: onMessageMock,
}))

vi.mock("../config", () => ({
  ensureInitializedConfig: ensureInitializedConfigMock,
}))

vi.mock("@/utils/providers/model", () => ({
  getModelById: getModelByIdMock,
}))

vi.mock("ai", () => ({
  generateText: generateTextMock,
  Output: {
    object: outputObjectMock,
  },
}))

vi.mock("@/utils/logger", () => ({
  logger: {
    warn: loggerWarnMock,
  },
}))

function createConfig(options: {
  enableAI?: boolean
  providerId?: string | null
  translateProviderId?: string
  timeoutSeconds?: number
  providersConfig?: typeof DEFAULT_CONFIG.providersConfig
} = {}) {
  return {
    ...DEFAULT_CONFIG,
    providersConfig: options.providersConfig ?? DEFAULT_CONFIG.providersConfig,
    translate: {
      ...DEFAULT_CONFIG.translate,
      providerId: options.translateProviderId ?? "deepseek-default",
      page: {
        ...DEFAULT_CONFIG.translate.page,
        smartFilter: {
          enableAI: options.enableAI ?? true,
          providerId: options.providerId ?? null,
          timeoutSeconds: options.timeoutSeconds ?? DEFAULT_CONFIG.translate.page.smartFilter.timeoutSeconds,
        },
      },
    },
  }
}

function createRegions(count = 2): SmartRegion[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `r${index + 1}`,
    parentId: index === 0 ? null : "r1",
    tag: index === 0 ? "nav" : "a",
    role: index === 0 ? "navigation" : null,
    heading: null,
    text: index === 0 ? "Home Products About" : `Link ${index}`,
  }))
}

function classifyMessage(requestId: string, regions: SmartRegion[] = createRegions(), deadline = Date.now() + DEFAULT_CONFIG.translate.page.smartFilter.timeoutSeconds * 1_000) {
  return {
    data: { requestId, regions, deadline },
    sender: { tab: { id: 42 } },
  }
}

async function setupSubject() {
  const subject = await import("../smart-filter")
  subject.setupSmartFilterMessageHandlers()
  return subject
}

function getHandler(name: string) {
  const handler = messageHandlers.get(name)
  if (!handler)
    throw new Error(`Message handler not registered: ${name}`)
  return handler
}

describe("smart filter background classification", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    messageHandlers.clear()
    vi.useRealTimers()

    onMessageMock.mockImplementation((name: string, handler: (message: any) => any) => {
      messageHandlers.set(name, handler)
      return vi.fn()
    })
    outputObjectMock.mockImplementation((options: unknown) => options)
    ensureInitializedConfigMock.mockResolvedValue(createConfig())
    getModelByIdMock.mockResolvedValue("mock-model")
    generateTextMock.mockResolvedValue({ output: { skipIds: ["r1"] } })
    storageGetItemMock.mockResolvedValue(null)
    storageSetItemMock.mockResolvedValue(undefined)
    storageRemoveItemMock.mockResolvedValue(undefined)
    browser.tabs.onRemoved.addListener = tabsOnRemovedAddListenerMock
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("classifies with the configured provider and validates returned ids", async () => {
    await setupSubject()
    const handler = getHandler("classifySmartFilterRegions")

    generateTextMock.mockResolvedValueOnce({ output: { skipIds: ["r2", "r2", "r1"] } })

    const result = await handler(classifyMessage("follow-page-provider"))

    expect(result).toEqual({ skipIds: ["r2", "r1"], status: "success" })
    expect(getModelByIdMock).toHaveBeenCalledWith("deepseek-default")
    expect(generateTextMock).toHaveBeenCalledTimes(1)

    const generateArgs = generateTextMock.mock.calls[0][0]
    expect(generateArgs.model).toBe("mock-model")
    expect(generateArgs.maxRetries).toBe(0)
    expect(generateArgs.abortSignal).toBeInstanceOf(AbortSignal)
    expect(generateArgs.system).toContain("untrusted")
    expect(generateArgs.prompt).toContain("Home Products About")
    expect(outputObjectMock).toHaveBeenCalledWith({ schema: expect.anything() })

    ensureInitializedConfigMock.mockResolvedValueOnce(createConfig({ providerId: "openai-default" }))
    generateTextMock.mockResolvedValueOnce({ output: { skipIds: ["r999"] } })
    await expect(handler(classifyMessage("explicit-provider"))).resolves.toEqual({ skipIds: [], status: "success" })
    expect(getModelByIdMock).toHaveBeenLastCalledWith("openai-default")

    generateTextMock.mockResolvedValueOnce({ output: { skipIds: "r1" } })
    await expect(handler(classifyMessage("malformed-result"))).resolves.toEqual({ skipIds: [], status: "success" })

    generateTextMock.mockRejectedValueOnce(new Error("network error"))
    await expect(handler(classifyMessage("model-error"))).resolves.toEqual({ skipIds: [], status: "error", errorCode: "model_error" })
    expect(loggerWarnMock).toHaveBeenCalled()
  })

  it("reuses successful main-frame results by hashed key and reclassifies changed keys", async () => {
    await setupSubject()
    const handler = getHandler("classifySmartFilterRegions")
    const cache = new Map<string, { key: string, skipIds: string[] }>()
    storageGetItemMock.mockImplementation(async (key: string) => cache.get(key) ?? null)
    storageSetItemMock.mockImplementation(async (key: string, value: { key: string, skipIds: string[] }) => {
      cache.set(key, value)
    })
    const message = (requestId: string, key: string, frameId = 0) => ({
      ...classifyMessage(requestId),
      data: { ...classifyMessage(requestId).data, cacheKey: key },
      sender: { tab: { id: 42 }, frameId },
    })

    await expect(handler(message("first", "a".repeat(64)))).resolves.toEqual({ skipIds: ["r1"], status: "success" })
    expect(storageSetItemMock).toHaveBeenCalledWith("session:smartFilterCache.42", { key: "a".repeat(64), skipIds: ["r1"] })
    expect(Object.keys(cache.get("session:smartFilterCache.42") ?? {}).sort()).toEqual(["key", "skipIds"])

    await expect(handler(message("cached", "a".repeat(64)))).resolves.toEqual({ skipIds: ["r1"], status: "success" })
    expect(generateTextMock).toHaveBeenCalledTimes(1)

    await expect(handler(message("changed", "b".repeat(64)))).resolves.toEqual({ skipIds: ["r1"], status: "success" })
    expect(generateTextMock).toHaveBeenCalledTimes(2)

    await expect(handler(message("iframe", "c".repeat(64), 1))).resolves.toEqual({ skipIds: ["r1"], status: "success" })
    expect(generateTextMock).toHaveBeenCalledTimes(3)
  })

  it("skips the model when disabled, unavailable, expired, or without regions", async () => {
    await setupSubject()
    const handler = getHandler("classifySmartFilterRegions")

    ensureInitializedConfigMock.mockResolvedValueOnce(createConfig({ enableAI: false }))
    await expect(handler(classifyMessage("disabled"))).resolves.toEqual({ skipIds: [], status: "success" })

    ensureInitializedConfigMock.mockResolvedValueOnce(createConfig({ providerId: "missing-provider" }))
    await expect(handler(classifyMessage("missing-provider"))).resolves.toEqual({ skipIds: [], status: "success" })

    ensureInitializedConfigMock.mockResolvedValueOnce(createConfig({
      providersConfig: DEFAULT_CONFIG.providersConfig.map(provider =>
        provider.id === "deepseek-default" ? { ...provider, enabled: false } : provider,
      ),
    }))
    await expect(handler(classifyMessage("disabled-provider"))).resolves.toEqual({ skipIds: [], status: "success" })

    ensureInitializedConfigMock.mockResolvedValueOnce(createConfig())
    await expect(handler(classifyMessage("no-regions", []))).resolves.toEqual({ skipIds: [], status: "success" })

    ensureInitializedConfigMock.mockResolvedValueOnce(createConfig())
    await expect(handler(classifyMessage("expired", createRegions(), Date.now() - 1))).resolves.toEqual({ skipIds: [], status: "timeout" })

    ensureInitializedConfigMock.mockResolvedValueOnce(createConfig())
    await expect(handler(classifyMessage("too-many-regions", createRegions(33)))).resolves.toEqual({ skipIds: [], status: "success" })

    expect(getModelByIdMock).not.toHaveBeenCalled()
    expect(generateTextMock).not.toHaveBeenCalled()
  })

  it("returns empty on timeout and clears pending state", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    await setupSubject()
    const handler = getHandler("classifySmartFilterRegions")

    generateTextMock.mockImplementation(() => new Promise(() => {}))

    const requestId = "timeout-request"
    const requestPromise = handler(classifyMessage(requestId))
    let settled = false
    void requestPromise.then(() => settled = true)

    await vi.advanceTimersByTimeAsync(0)
    expect(generateTextMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(2_000)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(8_000)
    await expect(requestPromise).resolves.toEqual({ skipIds: [], status: "timeout" })

    generateTextMock.mockResolvedValueOnce({ output: { skipIds: ["r2"] } })
    await expect(handler(classifyMessage(requestId))).resolves.toEqual({ skipIds: ["r2"], status: "success" })
  })

  it("cancels by sender tab and request id and discards late results", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(2_000_000)
    await setupSubject()
    const classify = getHandler("classifySmartFilterRegions")
    const cancel = getHandler("cancelSmartFilterClassification")

    let resolveModel: ((value: { output: { skipIds: string[] } }) => void) | undefined
    generateTextMock.mockImplementation(() => new Promise((resolve) => {
      resolveModel = resolve
    }))

    const requestId = "cancel-request"
    const baseRequest = classifyMessage(requestId)
    const request = {
      ...baseRequest,
      data: { ...baseRequest.data, cacheKey: "d".repeat(64) },
    }
    const requestPromise = classify(request)
    await vi.advanceTimersByTimeAsync(0)

    const abortSignal = generateTextMock.mock.calls[0][0].abortSignal as AbortSignal

    cancel({ data: { requestId }, sender: { tab: { id: 7 } } })
    expect(abortSignal.aborted).toBe(false)

    cancel({ data: { requestId }, sender: { tab: { id: 42 } } })
    expect(abortSignal.aborted).toBe(true)

    await expect(requestPromise).resolves.toEqual({ skipIds: [], status: "cancel" })

    // A late model result is ignored and the request slot can be reused.
    resolveModel?.({ output: { skipIds: ["r1"] } })
    await Promise.resolve()
    expect(storageSetItemMock).not.toHaveBeenCalled()
    generateTextMock.mockResolvedValueOnce({ output: { skipIds: ["r2"] } })
    await expect(classify(classifyMessage(requestId))).resolves.toEqual({ skipIds: ["r2"], status: "success" })
  })

  it("cancels pending classifications and clears the session result when a tab closes", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(3_000_000)
    await setupSubject()
    const classify = getHandler("classifySmartFilterRegions")

    let resolveModel: ((value: { output: { skipIds: string[] } }) => void) | undefined
    generateTextMock.mockImplementation(() => new Promise((resolve) => {
      resolveModel = resolve
    }))

    const baseRequest = classifyMessage("closed-tab")
    const request = {
      ...baseRequest,
      data: { ...baseRequest.data, cacheKey: "e".repeat(64) },
    }
    const requestPromise = classify(request)
    await vi.advanceTimersByTimeAsync(0)
    const abortSignal = generateTextMock.mock.calls[0][0].abortSignal as AbortSignal

    const onRemoved = tabsOnRemovedAddListenerMock.mock.calls.at(-1)?.[0] as ((tabId: number) => void)
    onRemoved(42)

    expect(abortSignal.aborted).toBe(true)
    expect(storageRemoveItemMock).toHaveBeenCalledWith("session:smartFilterCache.42")
    await expect(requestPromise).resolves.toEqual({ skipIds: [], status: "cancel" })
    resolveModel?.({ output: { skipIds: ["r1"] } })
    await Promise.resolve()
    expect(storageSetItemMock).not.toHaveBeenCalled()
  })
})
