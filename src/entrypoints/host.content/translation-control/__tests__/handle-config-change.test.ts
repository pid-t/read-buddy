import type { PageTranslationManager } from "../page-translation"
import type { Config } from "@/types/config/config"
import type { ProviderConfig } from "@/types/config/provider"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { CONFIG_STORAGE_KEY } from "@/utils/constants/config"
import { handleTranslationModeChange, watchTranslationConfigChanges } from "../handle-config-change"

const { mockWatch } = vi.hoisted(() => ({
  mockWatch: vi.fn(),
}))

vi.mock("#imports", () => ({
  storage: {
    watch: mockWatch,
  },
}))

vi.mock("wxt/utils/storage", () => ({
  storage: {
    watch: mockWatch,
  },
}))

interface MockConfigOptions {
  providerId?: string
  enableAI?: boolean
  providersConfig?: Config["providersConfig"]
}

function createMockConfig(mode: "bilingual" | "translationOnly", options: MockConfigOptions = {}): Config {
  return {
    providersConfig: options.providersConfig ?? [],
    translate: {
      mode,
      providerId: options.providerId ?? "deepseek-default",
      page: {
        smartFilter: {
          enableAI: options.enableAI ?? false,
        },
      },
    },
  } as unknown as Config
}

function createLLMProvider(enabled: boolean, baseURL = "https://api.deepseek.com/v1"): ProviderConfig {
  return {
    id: "deepseek-default",
    name: "DeepSeek",
    provider: "deepseek",
    enabled,
    apiKey: "test-key",
    baseURL,
    model: {
      model: "deepseek-chat",
      isCustomModel: false,
      customModel: null,
    },
  } as unknown as ProviderConfig
}

function createMockManager(isActive: boolean): PageTranslationManager {
  return {
    isActive,
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
  } as unknown as PageTranslationManager
}

beforeEach(() => {
  mockWatch.mockReset()
})

describe("handleTranslationModeChange", () => {
  it("should trigger re-translation when mode changes and manager is active", () => {
    const manager = createMockManager(true)

    handleTranslationModeChange(
      createMockConfig("translationOnly"),
      createMockConfig("bilingual"),
      manager,
    )

    expect(manager.stop).toHaveBeenCalled()
    expect(manager.start).toHaveBeenCalled()
  })

  it("should not trigger when mode stays the same", () => {
    const manager = createMockManager(true)

    handleTranslationModeChange(
      createMockConfig("bilingual"),
      createMockConfig("bilingual"),
      manager,
    )

    expect(manager.stop).not.toHaveBeenCalled()
  })

  it("should not trigger when manager is not active", () => {
    const manager = createMockManager(false)

    handleTranslationModeChange(
      createMockConfig("translationOnly"),
      createMockConfig("bilingual"),
      manager,
    )

    expect(manager.stop).not.toHaveBeenCalled()
  })

  it("re-translates when the page provider changes", () => {
    const manager = createMockManager(true)

    handleTranslationModeChange(
      createMockConfig("bilingual", { providerId: "openai-default" }),
      createMockConfig("bilingual", { providerId: "deepseek-default" }),
      manager,
    )

    expect(manager.stop).toHaveBeenCalled()
    expect(manager.start).toHaveBeenCalled()
  })

  it("re-translates when the AI filtering switch changes", () => {
    const manager = createMockManager(true)

    handleTranslationModeChange(
      createMockConfig("bilingual", { enableAI: true }),
      createMockConfig("bilingual", { enableAI: false }),
      manager,
    )

    expect(manager.stop).toHaveBeenCalled()
    expect(manager.start).toHaveBeenCalled()
  })

  it("re-translates when the effective smart filter provider becomes available", () => {
    const manager = createMockManager(true)

    handleTranslationModeChange(
      createMockConfig("bilingual", {
        enableAI: true,
        providersConfig: [createLLMProvider(true)],
      }),
      createMockConfig("bilingual", {
        enableAI: true,
        providersConfig: [createLLMProvider(false)],
      }),
      manager,
    )

    expect(manager.stop).toHaveBeenCalled()
    expect(manager.start).toHaveBeenCalled()
  })

  it("re-translates when the effective provider request config changes at the same id", () => {
    const manager = createMockManager(true)

    handleTranslationModeChange(
      createMockConfig("bilingual", {
        enableAI: true,
        providersConfig: [createLLMProvider(true, "https://proxy.example.com/v1")],
      }),
      createMockConfig("bilingual", {
        enableAI: true,
        providersConfig: [createLLMProvider(true, "https://api.deepseek.com/v1")],
      }),
      manager,
    )

    expect(manager.stop).toHaveBeenCalled()
    expect(manager.start).toHaveBeenCalled()
  })

  it("does not re-translate when a provider becomes available while AI is off", () => {
    const manager = createMockManager(true)

    handleTranslationModeChange(
      createMockConfig("bilingual", {
        providersConfig: [createLLMProvider(true)],
      }),
      createMockConfig("bilingual", {
        providersConfig: [createLLMProvider(false)],
      }),
      manager,
    )

    expect(manager.stop).not.toHaveBeenCalled()
  })
})

describe("watchTranslationConfigChanges", () => {
  it("drives the manager from the registered storage callback and unsubscribes on cleanup", () => {
    const manager = createMockManager(true)
    const unwatch = vi.fn()
    let registeredCallback: ((newConfig: Config | null, oldConfig: Config | null) => void) | undefined

    mockWatch.mockImplementation((_key: string, callback: (newConfig: Config | null, oldConfig: Config | null) => void) => {
      registeredCallback = callback
      return unwatch
    })

    const cleanup = watchTranslationConfigChanges(manager)

    expect(mockWatch).toHaveBeenCalledWith(`local:${CONFIG_STORAGE_KEY}`, expect.any(Function))

    registeredCallback?.(
      createMockConfig("bilingual", { enableAI: false }),
      createMockConfig("bilingual", { enableAI: true }),
    )

    expect(manager.stop).toHaveBeenCalled()
    expect(manager.start).toHaveBeenCalled()

    cleanup()
    expect(unwatch).toHaveBeenCalledOnce()
  })
})
