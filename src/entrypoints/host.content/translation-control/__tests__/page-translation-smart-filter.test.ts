// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import type { SmartFilterClassifyRequest, SmartFilterClassifyResponse } from "@/types/smart-filter"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { CONTENT_WRAPPER_CLASS } from "@/utils/constants/dom-labels"
import { flushBatchedOperations } from "@/utils/host/dom/batch-dom"
import { extractTextContent } from "@/utils/host/dom/traversal"
import { collectSmartRegions, createSmartFilterDecision, createSmartFilterPageState } from "@/utils/host/smart-filter"
import { handleTranslationModeChange } from "../handle-config-change"
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

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve
  })
  return { promise, resolve }
}

function createConfig(enableAI: boolean): Config {
  return {
    ...DEFAULT_CONFIG,
    translate: {
      ...DEFAULT_CONFIG.translate,
      page: {
        ...DEFAULT_CONFIG.translate.page,
        smartFilter: {
          enableAI,
          providerId: null,
        },
      },
    },
  }
}

function createRect(top: number, height: number): DOMRect {
  return {
    top,
    left: 0,
    width: 100,
    height,
    right: 100,
    bottom: top + height,
    x: 0,
    y: top,
    toJSON() {
      return {
        top,
        left: 0,
        width: 100,
        height,
        right: 100,
        bottom: top + height,
        x: 0,
        y: top,
      }
    },
  } as DOMRect
}

async function flushDomUpdates(): Promise<void> {
  await Promise.resolve()
  await new Promise(resolve => setTimeout(resolve, 0))
  await Promise.resolve()
}

function getRegionIdForNode(collection: ReturnType<typeof collectSmartRegions>, node: HTMLElement): string {
  for (const [id, mappedNode] of collection.nodeById) {
    if (mappedNode === node)
      return id
  }
  throw new Error("node was not collected as a region")
}

describe("page translation smart filter", () => {
  const classifyRequests: SmartFilterClassifyRequest[] = []
  const classifyDeferreds: ReturnType<typeof createDeferred<SmartFilterClassifyResponse>>[] = []
  const cancelRequests: Array<{ requestId: string }> = []
  let manager: PageTranslationManager | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    classifyRequests.length = 0
    classifyDeferreds.length = 0
    cancelRequests.length = 0
    intersectionObservers.length = 0
    document.head.innerHTML = ""
    document.body.innerHTML = ""
    document.title = ""

    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver)
    mockGetLocalConfig.mockResolvedValue(createConfig(true))
    mockTranslateTextForPage.mockResolvedValue("translation")
    mockTranslateTextForPageTitle.mockResolvedValue("translated title")
    mockValidateTranslationConfigAndToast.mockReturnValue(true)
    mockSendMessage.mockImplementation((name: string, data: unknown) => {
      if (name === "classifySmartFilterRegions") {
        classifyRequests.push(data as SmartFilterClassifyRequest)
        const deferred = createDeferred<SmartFilterClassifyResponse>()
        classifyDeferreds.push(deferred)
        return deferred.promise
      }
      if (name === "cancelSmartFilterClassification") {
        cancelRequests.push(data as { requestId: string })
      }
      return Promise.resolve(undefined)
    })
  })

  afterEach(() => {
    manager?.stop()
    manager = null
    vi.useRealTimers()
  })

  it.each(["bilingual", "translationOnly"] as const)("reuses AI filtering when %s translation is toggled back on", async (mode) => {
    document.body.innerHTML = `<nav id="nav"><a>Home</a></nav><main><p id="body">Readable body text</p></main>`
    const config = createConfig(true)
    config.translate = { ...config.translate, mode }
    mockGetLocalConfig.mockResolvedValue(config)
    manager = new PageTranslationManager()
    await manager.start()
    const navId = classifyRequests[0].regions.find(region => region.text.includes("Home"))!.id
    classifyDeferreds[0].resolve({ skipIds: [navId], status: "success" })
    await flushDomUpdates()
    await intersectionObservers[0].triggerIntersect(document.getElementById("body")!)
    await flushDomUpdates()
    flushBatchedOperations()
    manager.stop()

    await manager.start()
    expect(classifyRequests).toHaveLength(1)
    const observer = intersectionObservers.at(-1)!
    await observer.triggerIntersect(document.getElementById("nav")!)
    await observer.triggerIntersect(document.getElementById("body")!)
    await flushDomUpdates()
    flushBatchedOperations()
    expect(document.getElementById("nav")!.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeNull()
    expect(document.getElementById("body")!.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toHaveTextContent("translation")
  })

  it.each(["content", "config"])("repeats AI filtering after %s changes", async (change) => {
    document.body.innerHTML = `<p id="body">Readable body text</p>`
    manager = new PageTranslationManager()
    await manager.start()
    classifyDeferreds[0].resolve({ skipIds: [], status: "success" })
    await flushDomUpdates()
    manager.stop()
    if (change === "content")
      document.getElementById("body")!.textContent = "Changed body text"
    else
      mockGetLocalConfig.mockResolvedValue({ ...createConfig(true), language: { ...DEFAULT_CONFIG.language, targetCode: "jpn" } })
    await manager.start()
    expect(classifyRequests).toHaveLength(2)
  })

  it("waits for classification, keeps offscreen units on normal translation and applies nav skips", async () => {
    document.body.innerHTML = `
      <main id="content">
        <nav id="nav"><a href="#home">Home</a></nav>
        <p id="body">Readable body text</p>
      </main>
      <section id="offscreen-section"><p id="offscreen">Offscreen body text</p></section>
    `

    const content = document.getElementById("content")!
    const nav = document.getElementById("nav")!
    const body = document.getElementById("body")!
    const offscreen = document.getElementById("offscreen")!
    const offscreenSection = document.getElementById("offscreen-section")!
    offscreenSection.getBoundingClientRect = () => createRect(3000, 30)
    offscreen.getBoundingClientRect = () => createRect(3000, 30)

    const config = createConfig(true)
    mockGetLocalConfig.mockResolvedValue(config)

    manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()

    expect(classifyRequests).toHaveLength(1)
    const request = classifyRequests[0]
    expect(request.regions.map(region => region.text)).toContain("Home")
    expect(request.regions.map(region => region.text)).toContain("Readable body text")
    expect(request.regions.map(region => region.text)).not.toContain("Offscreen body text")
    expect(typeof request.requestId).toBe("string")
    expect(request.deadline).toBeLessThanOrEqual(Date.now() + 2_000)

    const extractionCollection = collectSmartRegions(document.body, config, {
      shouldCollect: element => element.getBoundingClientRect().top < 3000,
    })
    const navRegionId = getRegionIdForNode(extractionCollection, nav)
    expect(request.regions.map(region => region.id)).toContain(navRegionId)
    const decision = createSmartFilterDecision(extractionCollection, { skipIds: [navRegionId] })
    const smartFilter = createSmartFilterPageState({ decision })
    const extractedParentText = extractTextContent(content, config, smartFilter)
    expect(extractedParentText).toContain("Readable body text")
    expect(extractedParentText).not.toContain("Home")

    const observer = intersectionObservers[0]
    await observer.triggerIntersect(nav)
    await observer.triggerIntersect(body)
    await observer.triggerIntersect(offscreen)
    await flushDomUpdates()
    flushBatchedOperations()

    expect(offscreen.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeTruthy()
    expect(body.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeNull()
    expect(nav.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeNull()

    classifyDeferreds[0].resolve({ skipIds: [navRegionId], status: "success" })
    await flushDomUpdates()
    await flushDomUpdates()
    flushBatchedOperations()

    expect(body.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeTruthy()
    expect(nav.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeNull()
  })

  it("keeps a nav region pending and skipped when unrelated siblings are added to body", async () => {
    document.body.innerHTML = `
      <nav id="nav"><a href="#home">Home</a></nav>
      <main id="content"><p id="body">Readable body text</p></main>
    `
    const nav = document.getElementById("nav")!
    const body = document.getElementById("body")!
    mockGetLocalConfig.mockResolvedValue(createConfig(true))

    manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()
    expect(classifyRequests).toHaveLength(1)

    const navRegionId = classifyRequests[0].regions.find(region => region.text.includes("Home"))?.id
    if (!navRegionId)
      throw new Error("nav region was not collected")

    const observer = intersectionObservers[0]

    // Adding an unrelated sibling while classification is pending must not
    // invalidate the nav or cancel its waiting state.
    const firstAdded = document.createElement("p")
    firstAdded.textContent = "First added readable paragraph"
    document.body.append(firstAdded)
    await flushDomUpdates()

    await observer.triggerIntersect(nav)
    await flushDomUpdates()
    flushBatchedOperations()
    expect(nav.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeNull()

    classifyDeferreds[0].resolve({ skipIds: [navRegionId], status: "success" })
    await flushDomUpdates()
    await flushDomUpdates()
    flushBatchedOperations()

    expect(nav.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeNull()

    await observer.triggerIntersect(firstAdded)
    await flushDomUpdates()
    flushBatchedOperations()
    expect(firstAdded.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeTruthy()

    // A later unrelated sibling must keep the applied skip.
    const secondAdded = document.createElement("p")
    secondAdded.textContent = "Second added readable paragraph"
    document.body.append(secondAdded)
    await flushDomUpdates()
    await flushDomUpdates()

    await observer.triggerIntersect(nav)
    await flushDomUpdates()
    flushBatchedOperations()
    expect(nav.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeNull()

    await observer.triggerIntersect(body)
    await flushDomUpdates()
    flushBatchedOperations()
    expect(body.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeTruthy()

    await observer.triggerIntersect(secondAdded)
    await flushDomUpdates()
    flushBatchedOperations()
    expect(secondAdded.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeTruthy()

    expect(classifyRequests).toHaveLength(1)
  })

  it("does not collect or request classification when AI is disabled", async () => {
    document.body.innerHTML = "<p id=\"body\">Readable body text</p>"
    const body = document.getElementById("body")!
    mockGetLocalConfig.mockResolvedValue(createConfig(false))

    manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()

    expect(classifyRequests).toHaveLength(0)
    expect(cancelRequests).toHaveLength(0)

    const observer = intersectionObservers[0]
    await observer.triggerIntersect(body)
    await flushDomUpdates()
    flushBatchedOperations()

    expect(body.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeTruthy()
  })

  async function startRegionReplacementScenario() {
    document.body.innerHTML = "<section id=\"region\"><a href=\"/home\">Menu</a></section>"
    mockGetLocalConfig.mockResolvedValue(createConfig(true))

    manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()

    const section = document.getElementById("region")!
    const region = classifyRequests[0]?.regions.find(item => item.text.includes("Menu"))
    if (!region)
      throw new Error("menu region was not collected")

    return { section, regionId: region.id }
  }

  it("invalidates a pending region when its content is replaced before the result", async () => {
    const { section, regionId } = await startRegionReplacementScenario()
    const newContent = document.createElement("p")
    newContent.textContent = "New readable article content"

    section.replaceChildren(newContent)
    classifyDeferreds[0].resolve({ skipIds: [regionId], status: "success" })
    await flushDomUpdates()
    await flushDomUpdates()

    const observer = intersectionObservers[0]
    await observer.triggerIntersect(newContent)
    await flushDomUpdates()
    flushBatchedOperations()

    expect(newContent.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeTruthy()
    expect(classifyRequests).toHaveLength(1)
  })

  it("invalidates an applied skip when its content is replaced after the result", async () => {
    const { section, regionId } = await startRegionReplacementScenario()

    classifyDeferreds[0].resolve({ skipIds: [regionId], status: "success" })
    await flushDomUpdates()

    const newContent = document.createElement("p")
    newContent.textContent = "New readable article content"

    section.replaceChildren(newContent)
    await flushDomUpdates()
    await flushDomUpdates()

    const observer = intersectionObservers[0]
    await observer.triggerIntersect(newContent)
    await flushDomUpdates()
    flushBatchedOperations()

    expect(newContent.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeTruthy()
    expect(classifyRequests).toHaveLength(1)
  })

  it("re-observes a skipped region when only its text node is replaced", async () => {
    const { section, regionId } = await startRegionReplacementScenario()

    classifyDeferreds[0].resolve({ skipIds: [regionId], status: "success" })
    await flushDomUpdates()

    const observer = intersectionObservers[0]
    expect(observer.observe).toHaveBeenCalledWith(section)

    await observer.triggerIntersect(section)
    await flushDomUpdates()
    expect(observer.unobserve).toHaveBeenCalledWith(section)
    expect(section.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeNull()

    observer.observe.mockClear()
    observer.unobserve.mockClear()

    section.textContent = "New readable article content"
    await flushDomUpdates()
    await flushDomUpdates()

    expect(observer.observe).toHaveBeenCalledWith(section)

    await observer.triggerIntersect(section)
    await flushDomUpdates()
    flushBatchedOperations()

    expect(section.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeTruthy()
    expect(classifyRequests).toHaveLength(1)
  })

  it("invalidates a host skip when content changes inside its open shadow root", async () => {
    document.body.innerHTML = "<div id=\"shadow-host\"></div>"
    const shadowHost = document.getElementById("shadow-host")!
    const shadowRoot = shadowHost.attachShadow({ mode: "open" })
    shadowRoot.innerHTML = "<section id=\"shadow-region\"><a href=\"/home\">Menu</a></section>"
    const section = shadowRoot.querySelector<HTMLElement>("#shadow-region")!
    mockGetLocalConfig.mockResolvedValue(createConfig(true))

    manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()

    const hostRegion = classifyRequests[0]?.regions.find(region => region.tag === "div" && region.text.includes("Menu"))
    if (!hostRegion)
      throw new Error("shadow host region was not collected")

    classifyDeferreds[0].resolve({ skipIds: [hostRegion.id], status: "success" })
    await flushDomUpdates()

    const observer = intersectionObservers[0]
    expect(observer.observe).toHaveBeenCalledWith(section)

    await observer.triggerIntersect(section)
    await flushDomUpdates()
    expect(observer.unobserve).toHaveBeenCalledWith(section)
    expect(section.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeNull()

    observer.observe.mockClear()

    section.textContent = "New readable article content"
    await flushDomUpdates()
    await flushDomUpdates()

    expect(observer.observe).toHaveBeenCalledWith(section)

    await observer.triggerIntersect(section)
    await flushDomUpdates()
    flushBatchedOperations()

    expect(section.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeTruthy()
    expect(classifyRequests).toHaveLength(1)
  })

  it("continues queued translation after the deadline and ignores a late result", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
    document.body.innerHTML = "<p id=\"body\">Readable body text</p>"
    const body = document.getElementById("body")!
    mockGetLocalConfig.mockResolvedValue(createConfig(true))

    manager = new PageTranslationManager()
    await manager.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(classifyRequests).toHaveLength(1)

    const observer = intersectionObservers[0]
    await observer.triggerIntersect(body)
    await vi.advanceTimersByTimeAsync(0)
    expect(body.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeNull()

    await vi.advanceTimersByTimeAsync(2_000)
    await vi.advanceTimersByTimeAsync(0)
    flushBatchedOperations()
    expect(body.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeTruthy()

    classifyDeferreds[0].resolve({ skipIds: ["r1"], status: "success" })
    await vi.advanceTimersByTimeAsync(0)
    flushBatchedOperations()
    expect(body.querySelectorAll(`.${CONTENT_WRAPPER_CLASS}`)).toHaveLength(1)

    manager.stop()
    await manager.start()
    expect(classifyRequests).toHaveLength(1)
    await intersectionObservers.at(-1)!.triggerIntersect(body)
    await vi.advanceTimersByTimeAsync(0)
    flushBatchedOperations()
    expect(body.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeTruthy()
  })

  it("keeps the fallback translation after a background model error", async () => {
    document.body.innerHTML = "<p id=\"body\">Readable body text</p>"
    const body = document.getElementById("body")!
    mockGetLocalConfig.mockResolvedValue(createConfig(true))

    manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()
    expect(classifyRequests).toHaveLength(1)

    classifyDeferreds[0].resolve({ skipIds: [], status: "error", errorCode: "model_error" })
    await flushDomUpdates()
    await flushDomUpdates()

    const observer = intersectionObservers[0]
    await observer.triggerIntersect(body)
    await flushDomUpdates()
    flushBatchedOperations()
    expect(body.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeTruthy()
    expect(classifyRequests).toHaveLength(1)

    manager.stop()
    await manager.start()
    expect(classifyRequests).toHaveLength(1)
    await intersectionObservers.at(-1)!.triggerIntersect(body)
    await flushDomUpdates()
    flushBatchedOperations()
    expect(body.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeTruthy()
  })

  it("cancels on stop and ignores stale results after restart", async () => {
    document.body.innerHTML = "<p id=\"body\">Readable body text</p>"
    const body = document.getElementById("body")!
    mockGetLocalConfig.mockResolvedValue(createConfig(true))

    manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()
    expect(classifyRequests).toHaveLength(1)
    const firstRequest = classifyRequests[0]

    const firstObserver = intersectionObservers[0]
    await firstObserver.triggerIntersect(body)
    await flushDomUpdates()
    expect(body.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeNull()

    manager.stop()
    expect(cancelRequests).toEqual([{ requestId: firstRequest.requestId }])

    await manager.start()
    await flushDomUpdates()
    expect(classifyRequests).toHaveLength(1)

    const secondObserver = intersectionObservers[1]
    await secondObserver.triggerIntersect(body)
    await flushDomUpdates()
    flushBatchedOperations()
    expect(body.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeTruthy()

    // The first request belongs to the stopped session and must be discarded.
    classifyDeferreds[0].resolve({ skipIds: ["r1"], status: "success" })
    await flushDomUpdates()
    flushBatchedOperations()
    expect(body.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeTruthy()
  })

  it("cancels the in-flight classification when a config change turns AI off", async () => {
    document.body.innerHTML = "<p id=\"body\">Readable body text</p>"
    mockGetLocalConfig.mockResolvedValue(createConfig(true))

    manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()
    expect(classifyRequests).toHaveLength(1)
    const firstRequest = classifyRequests[0]

    const disabledConfig = createConfig(false)
    mockGetLocalConfig.mockResolvedValue(disabledConfig)
    handleTranslationModeChange(disabledConfig, createConfig(true), manager)

    expect(cancelRequests).toEqual([{ requestId: firstRequest.requestId }])

    await flushDomUpdates()
    expect(manager.isActive).toBe(true)
    expect(classifyRequests).toHaveLength(1)
  })
})
