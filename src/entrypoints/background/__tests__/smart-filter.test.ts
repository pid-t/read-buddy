import type { SmartRegion } from "@/utils/host/smart-filter/types"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

const onMessageMock = vi.fn()
const ensureInitializedConfigMock = vi.fn()
const getModelByIdMock = vi.fn()
const generateTextMock = vi.fn()
const outputObjectMock = vi.fn()
const loggerWarnMock = vi.fn()

const messageHandlers = new Map<string, (message: any) => any>()

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

function classifyMessage(requestId: string, regions: SmartRegion[] = createRegions(), deadline = Date.now() + 2_000) {
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

    await vi.advanceTimersByTimeAsync(0)
    expect(generateTextMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(2_000)
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
    const requestPromise = classify(classifyMessage(requestId))
    await vi.advanceTimersByTimeAsync(0)

    const abortSignal = generateTextMock.mock.calls[0][0].abortSignal as AbortSignal

    cancel({ data: { requestId }, sender: { tab: { id: 7 } } })
    expect(abortSignal.aborted).toBe(false)

    cancel({ data: { requestId }, sender: { tab: { id: 42 } } })
    expect(abortSignal.aborted).toBe(true)

    await expect(requestPromise).resolves.toEqual({ skipIds: [], status: "cancel" })

    // A late model result is ignored and the request slot can be reused.
    resolveModel?.({ output: { skipIds: ["r1"] } })
    generateTextMock.mockResolvedValueOnce({ output: { skipIds: ["r2"] } })
    await expect(classify(classifyMessage(requestId))).resolves.toEqual({ skipIds: ["r2"], status: "success" })
  })
})
