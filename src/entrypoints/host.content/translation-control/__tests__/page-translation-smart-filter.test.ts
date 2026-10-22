// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { CONTENT_WRAPPER_CLASS } from "@/utils/constants/dom-labels"
import { flushBatchedOperations } from "@/utils/host/dom/batch-dom"
import { PageTranslationManager } from "../page-translation"

const {
  mockGetLocalConfig,
  mockSendMessage,
  mockTranslateTextForPage,
  mockTranslateTextForPageTitle,
  mockValidateTranslationConfigAndToast,
} = vi.hoisted(() => ({
  mockGetLocalConfig: vi.fn(),
  mockSendMessage: vi.fn(),
  mockTranslateTextForPage: vi.fn(),
  mockTranslateTextForPageTitle: vi.fn(),
  mockValidateTranslationConfigAndToast: vi.fn(),
}))

vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: mockGetLocalConfig,
}))

vi.mock("@/utils/message", () => ({
  sendMessage: mockSendMessage,
}))

vi.mock("@/utils/host/translate/translate-text", () => ({
  validateTranslationConfigAndToast: mockValidateTranslationConfigAndToast,
}))

vi.mock("@/utils/host/translate/translate-variants", () => ({
  translateTextForPage: mockTranslateTextForPage,
  translateTextForPageTitle: mockTranslateTextForPageTitle,
}))

vi.mock("@/utils/host/translate/webpage-context", () => ({
  getOrCreateWebPageContext: vi.fn(),
}))

const intersectionObservers: MockIntersectionObserver[] = []

class MockIntersectionObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()

  constructor(
    private readonly callback: IntersectionObserverCallback,
    _options?: IntersectionObserverInit,
  ) {
    intersectionObservers.push(this)
  }

  async triggerIntersect(target: Element): Promise<void> {
    await this.callback([{
      isIntersecting: true,
      target,
    } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
}

function createConfig(enableAI: boolean, providerId = DEFAULT_CONFIG.translate.providerId): Config {
  return {
    ...DEFAULT_CONFIG,
    translate: {
      ...DEFAULT_CONFIG.translate,
      providerId,
      page: {
        ...DEFAULT_CONFIG.translate.page,
        smartFilter: { enableAI },
      },
    },
  }
}

async function flushDomUpdates(): Promise<void> {
  await Promise.resolve()
  await new Promise(resolve => setTimeout(resolve, 0))
  await Promise.resolve()
}

describe("page translation AI filtering", () => {
  let manager: PageTranslationManager | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    intersectionObservers.length = 0
    document.head.innerHTML = ""
    document.body.innerHTML = ""
    document.title = ""

    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver)
    mockGetLocalConfig.mockResolvedValue(createConfig(true))
    mockTranslateTextForPage.mockResolvedValue("translation")
    mockTranslateTextForPageTitle.mockResolvedValue("translated title")
    mockValidateTranslationConfigAndToast.mockReturnValue(true)
    mockSendMessage.mockResolvedValue(undefined)
  })

  afterEach(() => {
    manager?.stop()
    manager = null
  })

  it("merges filtering into page translation for an enabled LLM", async () => {
    document.body.innerHTML = `
      <nav><a>Home</a></nav>
      <main><p id="body">Readable body text</p></main>
    `

    manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()

    expect(mockSendMessage.mock.calls.some(([name]) => name === "classifySmartFilterRegions")).toBe(false)

    await intersectionObservers[0].triggerIntersect(document.getElementById("body")!)
    await flushDomUpdates()
    flushBatchedOperations()

    expect(mockTranslateTextForPage).toHaveBeenCalledWith(
      "Readable body text",
      expect.objectContaining({
        inlineSmartFilter: expect.objectContaining({
          strategyVersion: 1,
          hint: expect.objectContaining({ tag: "p" }),
        }),
      }),
    )
    expect(document.getElementById("body")!.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeTruthy()
  })

  it("uses normal translation when AI filtering is disabled", async () => {
    document.body.innerHTML = `<main><p id="body">Readable body text</p></main>`
    mockGetLocalConfig.mockResolvedValue(createConfig(false))

    manager = new PageTranslationManager()
    await manager.start()
    await intersectionObservers[0].triggerIntersect(document.getElementById("body")!)
    await flushDomUpdates()
    flushBatchedOperations()

    expect(mockTranslateTextForPage).toHaveBeenCalledWith("Readable body text")
    expect(document.getElementById("body")!.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeTruthy()
  })

  it("uses normal translation for a non-LLM page provider", async () => {
    document.body.innerHTML = `<main><p id="body">Readable body text</p></main>`
    mockGetLocalConfig.mockResolvedValue(createConfig(true, "google-translate-default"))

    manager = new PageTranslationManager()
    await manager.start()
    await intersectionObservers[0].triggerIntersect(document.getElementById("body")!)
    await flushDomUpdates()
    flushBatchedOperations()

    expect(mockTranslateTextForPage).toHaveBeenCalledWith("Readable body text")
  })
})
