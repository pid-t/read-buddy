import type { Config } from "@/types/config/config"
import type { SmartFilterClassifyStatus } from "@/types/smart-filter"
import type { SmartFilterPageState } from "@/utils/host/smart-filter/page-state"
import type { SmartRegionCollection } from "@/utils/host/smart-filter/types"
import { isEnabledLLMProviderConfig } from "@/types/config/provider"
import { getProviderConfigById } from "@/utils/config/helpers"
import { getLocalConfig } from "@/utils/config/storage"
import { CONTENT_WRAPPER_CLASS } from "@/utils/constants/dom-labels"
import { resolveProviderConfig } from "@/utils/constants/feature-providers"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { flushBatchedOperations } from "@/utils/host/dom/batch-dom"
import { hasNoWalkAncestor, isDontWalkIntoAndDontTranslateAsChildElement, isDontWalkIntoButTranslateAsChildElement, isHTMLElement } from "@/utils/host/dom/filter"
import { deepQueryTopLevelSelector } from "@/utils/host/dom/find"
import { walkAndLabelElement } from "@/utils/host/dom/traversal"
import { collectSmartRegions, createSmartFilterDecision, createSmartFilterPageState, isComposedDescendant } from "@/utils/host/smart-filter"
import { logSmartFilterDiagnostic } from "@/utils/host/smart-filter/diagnostics"
import { removeAllTranslatedWrapperNodes, translateWalkedElement } from "@/utils/host/translate/node-manipulation"
import { validateTranslationConfigAndToast } from "@/utils/host/translate/translate-text"
import { translateTextForPageTitle } from "@/utils/host/translate/translate-variants"
import { getOrCreateWebPageContext } from "@/utils/host/translate/webpage-context"
import { logger } from "@/utils/logger"
import { sendMessage } from "@/utils/message"
import { resolveModelId } from "@/utils/providers/model-id"

type SimpleIntersectionOptions = Omit<IntersectionObserverInit, "threshold"> & {
  threshold?: number
}

interface IPageTranslationManager {
  /**
   * Indicates whether the page translation is currently active
   */
  readonly isActive: boolean

  /**
   * Starts the automatic page translation functionality
   * Registers observers, touch triggers and set storage
   */
  start: () => Promise<void>

  /**
   * Stops the automatic page translation functionality
   * Cleans up all observers and removes translated content and set storage
   */
  stop: () => void

  /**
   * Refreshes translation after an in-document route change without disabling
   * the tab-level page translation session.
   */
  restart: () => Promise<void>

  /**
   * Registers page translation triggers
   */
  registerPageTranslationTriggers: () => () => void
}

export class PageTranslationManager implements IPageTranslationManager {
  private static readonly MAX_DURATION = 500
  private static readonly MOVE_THRESHOLD = 30 * 30
  private static readonly SMART_FILTER_DURATION_MS = 2_000
  private static readonly DEFAULT_INTERSECTION_OPTIONS: SimpleIntersectionOptions = {
    root: null,
    rootMargin: "600px",
    threshold: 0.1,
  }

  private isPageTranslating: boolean = false
  private intersectionObserver: IntersectionObserver | null = null
  private mutationObservers: MutationObserver[] = []
  private walkId: string | null = null
  private intersectionOptions: IntersectionObserverInit
  private walkBlockedElementsCache = new WeakSet<HTMLElement>()
  private titleObserver: MutationObserver | null = null
  private lastSourceTitle: string | null = null
  private lastAppliedTranslatedTitle: string | null = null
  private titleRequestVersion = 0
  private smartFilterState: SmartFilterPageState | null = null
  private smartFilterCollection: SmartRegionCollection | null = null
  private smartFilterRequestId: string | null = null
  private smartFilterVersion = 0
  private smartFilterDeadlineTimer: ReturnType<typeof setTimeout> | null = null
  private smartFilterPendingTargets = new Set<HTMLElement>()
  private smartFilterPreloadMargin = 0
  private smartFilterSkipIds: string[] = []
  private smartFilterInvalidatedRegionIds = new Set<string>()
  private smartFilterRegionSignatures = new Map<string, string>()
  private smartFilterDiagnosticRequestId: string | null = null
  private smartFilterRequestStartedAt: number | null = null
  private smartFilterCache: { key: string, skipIds: string[] } | null = null

  constructor(intersectionOptions: SimpleIntersectionOptions = {}) {
    if (intersectionOptions.threshold !== undefined) {
      if (intersectionOptions.threshold < 0 || intersectionOptions.threshold > 1) {
        throw new Error("IntersectionObserver threshold must be between 0 and 1")
      }
    }

    this.intersectionOptions = {
      ...PageTranslationManager.DEFAULT_INTERSECTION_OPTIONS,
      ...intersectionOptions,
    }
  }

  get isActive(): boolean {
    return this.isPageTranslating
  }

  async start(): Promise<void> {
    if (this.isPageTranslating) {
      console.warn("PageTranslationManager is already active")
      return
    }

    const config = await getLocalConfig()
    if (!config) {
      console.warn("Config is not initialized")
      return
    }

    if (!validateTranslationConfigAndToast({
      providersConfig: config.providersConfig,
      translate: config.translate,
      language: config.language,
    })) {
      return
    }

    const providerConfig = resolveProviderConfig(config, "translate")

    await sendMessage("setAndNotifyPageTranslationStateChangedByManager", {
      enabled: true,
      url: window.location.href,
    })

    this.isPageTranslating = true
    this.smartFilterPreloadMargin = config.translate.page.preload.margin
    this.cancelSmartFilter()
    this.beginSmartFilter(config)
    await this.primeDocumentTitleContext(
      config.translate.enableAIContentAware && isEnabledLLMProviderConfig(providerConfig),
    )
    this.startDocumentTitleTracking()

    // Listen to existing elements when they enter the viewport
    const walkId = getRandomUUID()
    this.walkId = walkId
    this.intersectionObserver = new IntersectionObserver(async (entries, observer) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          if (isHTMLElement(entry.target)) {
            if (!entry.target.closest(`.${CONTENT_WRAPPER_CLASS}`)) {
              const currentConfig = await getLocalConfig()
              if (!currentConfig) {
                logger.error("Global config is not initialized")
                return
              }
              if (!this.isPageTranslating || this.walkId !== walkId)
                return

              const smartFilter = this.smartFilterState
              if (smartFilter && (
                smartFilter.isNodePending(entry.target)
                || smartFilter.containsPendingNode(entry.target)
              )) {
                this.smartFilterPendingTargets.add(entry.target)
                continue
              }

              if (smartFilter?.isNodeSkipped(entry.target)) {
                observer.unobserve(entry.target)
                continue
              }

              if (smartFilter) {
                void translateWalkedElement(entry.target, walkId, currentConfig, false, smartFilter)
              }
              else {
                void translateWalkedElement(entry.target, walkId, currentConfig)
              }
            }
          }
          observer.unobserve(entry.target)
        }
      }
    }, this.intersectionOptions)

    // Initialize walkability state for existing elements
    this.addWalkBlockedElements(document.body, config)
    await this.observeTopLevelParagraphs(document.body, config)

    // Start observing mutations from document.body and all shadow roots
    this.observeMutations(document.body)
  }

  stop(): void {
    this.stopInternal({ notify: true })
  }

  async restart(): Promise<void> {
    if (!this.isPageTranslating) {
      await this.start()
      return
    }

    this.stopInternal({ notify: false })
    await this.start()
  }

  private stopInternal({ notify }: { notify: boolean }): void {
    if (!this.isPageTranslating) {
      console.warn("PageTranslationManager is already inactive")
      return
    }

    if (notify) {
      void sendMessage("setAndNotifyPageTranslationStateChangedByManager", {
        enabled: false,
        url: window.location.href,
      })
    }

    this.isPageTranslating = false
    this.cancelSmartFilter()
    this.walkId = null
    this.walkBlockedElementsCache = new WeakSet()
    this.stopDocumentTitleTracking()

    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect()
      this.intersectionObserver = null
    }
    this.mutationObservers.forEach(observer => observer.disconnect())
    this.mutationObservers = []

    removeAllTranslatedWrapperNodes()
    flushBatchedOperations()
  }

  registerPageTranslationTriggers(): () => void {
    let startTime = 0
    let startTouches: TouchList | null = null

    const reset = () => {
      startTime = 0
      startTouches = null
    }

    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 4) {
        startTime = performance.now()
        startTouches = e.touches
      }
      else {
        reset()
      }
    }

    const onMove = (e: TouchEvent) => {
      if (!startTouches)
        return
      if (e.touches.length !== 4)
        return reset()

      for (let i = 0; i < 4; i++) {
        const dx = e.touches[i].clientX - startTouches[i].clientX
        const dy = e.touches[i].clientY - startTouches[i].clientY
        if (dx * dx + dy * dy > PageTranslationManager.MOVE_THRESHOLD)
          return reset()
      }
    }

    const onEnd = () => {
      if (!startTouches)
        return
      if (performance.now() - startTime < PageTranslationManager.MAX_DURATION) {
        this.isPageTranslating
          ? this.stop()
          : void this.start()
      }
      reset()
    }

    document.addEventListener("touchstart", onStart, { passive: true })
    document.addEventListener("touchmove", onMove, { passive: true })
    document.addEventListener("touchend", onEnd, { passive: true })
    document.addEventListener("touchcancel", reset, { passive: true })

    // Teardown: remove all touch listeners
    return () => {
      document.removeEventListener("touchstart", onStart)
      document.removeEventListener("touchmove", onMove)
      document.removeEventListener("touchend", onEnd)
      document.removeEventListener("touchcancel", reset)
    }
  }

  private shouldManageDocumentTitle(): boolean {
    return window === window.top
  }

  private async primeDocumentTitleContext(shouldPrimeWebPageContext: boolean): Promise<void> {
    if (!this.shouldManageDocumentTitle() || !shouldPrimeWebPageContext) {
      return
    }

    try {
      await getOrCreateWebPageContext()
    }
    catch (error) {
      logger.warn("Failed to prime webpage context before translating document title:", error)
    }
  }

  private startDocumentTitleTracking(): void {
    if (!this.shouldManageDocumentTitle()) {
      return
    }

    this.lastSourceTitle = document.title || ""
    this.lastAppliedTranslatedTitle = null
    this.titleRequestVersion = 0

    this.observeDocumentTitle()
    void this.syncDocumentTitle(this.lastSourceTitle)
  }

  private stopDocumentTitleTracking(): void {
    if (!this.shouldManageDocumentTitle()) {
      return
    }

    const currentTitle = document.title || ""
    if (currentTitle !== this.lastAppliedTranslatedTitle) {
      this.lastSourceTitle = currentTitle
    }

    if (this.titleObserver) {
      this.titleObserver.disconnect()
      this.titleObserver = null
    }

    this.titleRequestVersion++

    if (this.lastSourceTitle !== null && document.title !== this.lastSourceTitle) {
      document.title = this.lastSourceTitle
    }

    this.lastSourceTitle = null
    this.lastAppliedTranslatedTitle = null
  }

  private observeDocumentTitle(): void {
    if (!document.head) {
      return
    }

    if (this.titleObserver) {
      this.titleObserver.disconnect()
    }

    this.titleObserver = new MutationObserver(() => {
      this.handleDocumentTitleMutation()
    })

    this.titleObserver.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
    })
  }

  private handleDocumentTitleMutation(): void {
    if (!this.isPageTranslating || !this.shouldManageDocumentTitle()) {
      return
    }

    const currentTitle = document.title || ""

    if (currentTitle === this.lastSourceTitle) {
      return
    }

    if (currentTitle === this.lastAppliedTranslatedTitle) {
      return
    }

    this.lastSourceTitle = currentTitle
    void this.syncDocumentTitle(currentTitle)
  }

  private async syncDocumentTitle(sourceTitle: string): Promise<void> {
    if (!sourceTitle.trim() || !this.isPageTranslating || !this.shouldManageDocumentTitle()) {
      return
    }

    const requestVersion = ++this.titleRequestVersion

    try {
      const translatedTitle = await translateTextForPageTitle(sourceTitle)
      if (!this.isPageTranslating || requestVersion !== this.titleRequestVersion) {
        return
      }

      const nextTitle = translatedTitle || sourceTitle
      this.lastAppliedTranslatedTitle = nextTitle

      if (document.title === nextTitle) {
        return
      }

      document.title = nextTitle
    }
    catch (error) {
      if (requestVersion === this.titleRequestVersion) {
        logger.warn("Failed to translate document title:", error)
      }
    }
  }

  private async observeTopLevelParagraphs(container: HTMLElement, existingConfig?: Config): Promise<void> {
    const observer = this.intersectionObserver
    if (!this.walkId || !observer)
      return

    const config = existingConfig ?? await getLocalConfig()
    if (!config) {
      logger.error("Global config is not initialized")
      return
    }

    // Skip if container has an ancestor that should not be walked into
    if (hasNoWalkAncestor(container, config))
      return

    walkAndLabelElement(container, this.walkId, config)
    // if container itself has paragraph and the id
    if (container.hasAttribute("data-read-frog-paragraph") && container.getAttribute("data-read-frog-walked") === this.walkId) {
      observer.observe(container)
      return
    }

    const paragraphs = this.collectParagraphElementsDeep(container, this.walkId)
    const topLevelParagraphs = paragraphs.filter((el) => {
      const ancestor = el.parentElement?.closest("[data-read-frog-paragraph]")
      // keep it if either:
      //  • no paragraph ancestor at all, or
      //  • the ancestor is *not* inside container
      return !ancestor || !container.contains(ancestor)
    })
    topLevelParagraphs.forEach(el => observer.observe(el))
  }

  /**
   * Recursively collect elements with paragraph attributes from shadow roots and iframes
   */
  private collectParagraphElementsDeep(container: HTMLElement, walkId: string): HTMLElement[] {
    const result: HTMLElement[] = []

    const collectFromContainer = (root: HTMLElement | Document | ShadowRoot) => {
      const elements = root.querySelectorAll<HTMLElement>(`[data-read-frog-paragraph][data-read-frog-walked="${CSS.escape(walkId)}"]`)
      result.push(...[...elements])
    }

    const traverseElement = (element: HTMLElement) => {
      if (element.shadowRoot) {
        collectFromContainer(element.shadowRoot)
        for (const child of element.shadowRoot.children) {
          if (child instanceof HTMLElement) {
            traverseElement(child)
          }
        }
      }

      for (const child of element.children) {
        if (child instanceof HTMLElement) {
          traverseElement(child)
        }
      }
    }

    collectFromContainer(container)
    traverseElement(container)

    return result
  }

  /**
   * Track the same blocked states that the traversal skips, so hidden accordion
   * panels can be re-walked when the site reveals an existing subtree.
   */
  private isWalkBlockedElement(element: HTMLElement, config: Config): boolean {
    return isDontWalkIntoButTranslateAsChildElement(element)
      || isDontWalkIntoAndDontTranslateAsChildElement(element, config)
  }

  /**
   * Handle attribute changes and only trigger observation
   * when element transitions from blocked to walkable.
   */
  private didChangeToWalkable(element: HTMLElement, config: Config): boolean {
    const wasWalkBlocked = this.walkBlockedElementsCache.has(element)
    const isWalkBlockedNow = this.isWalkBlockedElement(element, config)

    // Update cache with current state
    if (isWalkBlockedNow) {
      this.walkBlockedElementsCache.add(element)
    }
    else {
      this.walkBlockedElementsCache.delete(element)
    }

    return wasWalkBlocked === true && isWalkBlockedNow === false
  }

  /**
   * Initialize walkability state for an element and its descendants
   */
  private addWalkBlockedElements(element: HTMLElement, config: Config): void {
    const walkBlockedElements = deepQueryTopLevelSelector(element, el => this.isWalkBlockedElement(el, config))
    walkBlockedElements.forEach(el => this.walkBlockedElementsCache.add(el))
  }

  /**
   * Start observing mutations for a container and all its shadow roots
   */
  private observeMutations(container: HTMLElement): void {
    const mutationObserver = new MutationObserver((records) => {
      void this.handleMutationRecords(records)
    })

    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "hidden", "aria-hidden"],
    })

    this.mutationObservers.push(mutationObserver)
    this.observeIsolatedDescendantsMutations(container)
  }

  private async handleMutationRecords(records: MutationRecord[]): Promise<void> {
    const rescanTargets = this.invalidateSmartFilterRegionsFromMutations(records)

    const config = await getLocalConfig()
    if (!config) {
      logger.error("Global config is not initialized")
      return
    }

    for (const target of rescanTargets) {
      if (target.isConnected)
        void this.observeTopLevelParagraphs(target, config)
    }

    for (const rec of records) {
      if (this.isExtensionMutationRecord(rec))
        continue

      if (rec.type === "childList") {
        rec.addedNodes.forEach((node) => {
          if (isHTMLElement(node)) {
            this.addWalkBlockedElements(node, config)
            void this.observeTopLevelParagraphs(node, config)
            this.observeIsolatedDescendantsMutations(node)
          }
        })
      }
      else if (this.isWalkabilityAttributeMutation(rec)) {
        const el = rec.target
        if (isHTMLElement(el) && this.didChangeToWalkable(el, config)) {
          void this.observeTopLevelParagraphs(el, config)
        }
      }
    }
  }

  private isWalkabilityAttributeMutation(record: MutationRecord): boolean {
    return record.type === "attributes"
      && (record.attributeName === "style"
        || record.attributeName === "class"
        || record.attributeName === "hidden"
        || record.attributeName === "aria-hidden")
  }

  /**
   * Recursively find and observe shadow roots and iframes in an element and its descendants
   * These can't be found as top level paragraph elements because isolated shadow roots and iframes are not
   * considered as part of the document.
   */
  private observeIsolatedDescendantsMutations(element: HTMLElement): void {
    // Check if this element has a shadow root
    if (element.shadowRoot) {
      for (const child of element.shadowRoot.children) {
        if (isHTMLElement(child)) {
          this.observeMutations(child)
        }
      }
    }

    // Recursively check children
    for (const child of element.children) {
      if (isHTMLElement(child)) {
        this.observeIsolatedDescendantsMutations(child)
      }
    }
  }

  private beginSmartFilter(config: Config): void {
    const { smartFilter } = config.translate.page
    if (!smartFilter.enableAI || !document.body) {
      this.smartFilterCache = null
      return
    }

    const providerId = smartFilter.providerId ?? config.translate.providerId
    const providerConfig = getProviderConfigById(config.providersConfig, providerId)
    if (!providerConfig || !isEnabledLLMProviderConfig(providerConfig)) {
      this.smartFilterCache = null
      return
    }

    const deadline = Date.now() + PageTranslationManager.SMART_FILTER_DURATION_MS
    const collection = collectSmartRegions(document.body, config, {
      shouldCollect: element => this.isElementInPreloadRange(element),
    })
    if (collection.regions.length === 0 || Date.now() >= deadline) {
      this.smartFilterCache = null
      return
    }

    const cacheKey = JSON.stringify([
      window.location.href, config.translate, config.language, providerConfig,
      collection.regions, [...collection.nodeById.values()].map(node => node.textContent),
    ])
    if (this.smartFilterCache?.key === cacheKey) {
      this.smartFilterCollection = collection
      this.smartFilterSkipIds = [...this.smartFilterCache.skipIds]
      this.smartFilterState = this.buildSmartFilterState()
      if (this.smartFilterSkipIds.length === 0)
        this.smartFilterCollection = null
      return
    }
    // Remember the attempt so toggling back never retries a missing result.
    this.smartFilterCache = { key: cacheKey, skipIds: [] }

    const requestId = getRandomUUID()
    const version = ++this.smartFilterVersion
    const startedAt = Date.now()
    this.smartFilterRequestId = requestId
    this.smartFilterDiagnosticRequestId = requestId
    this.smartFilterRequestStartedAt = startedAt
    this.smartFilterCollection = collection
    this.smartFilterSkipIds = []
    this.smartFilterInvalidatedRegionIds.clear()
    this.smartFilterRegionSignatures = new Map(
      [...collection.nodeById].map(([id, node]) => [id, node.textContent ?? ""]),
    )
    this.smartFilterState = this.buildSmartFilterState()
    logSmartFilterDiagnostic("request-start", {
      requestId,
      provider: providerConfig.provider,
      providerId,
      model: resolveModelId(providerConfig.model) ?? null,
      regions: collection.regions.map(region => ({
        id: region.id,
        tag: region.tag,
        role: region.role,
      })),
    })
    this.smartFilterDeadlineTimer = setTimeout(() => {
      this.finishSmartFilter(version, [], requestId, "timeout")
    }, Math.max(0, deadline - Date.now()))

    void this.requestSmartFilter(collection.regions, requestId, deadline, version, cacheKey)
  }

  private async requestSmartFilter(
    regions: SmartRegionCollection["regions"],
    requestId: string,
    deadline: number,
    version: number,
    cacheKey: string,
  ): Promise<void> {
    try {
      const result = await sendMessage("classifySmartFilterRegions", {
        requestId,
        regions,
        deadline,
      })
      this.finishSmartFilter(
        version,
        result?.skipIds ?? [],
        requestId,
        result?.status ?? "success",
        result?.errorCode,
        cacheKey,
      )
    }
    catch (error) {
      if (version === this.smartFilterVersion)
        logger.warn("Smart filter classification failed", error)
      this.finishSmartFilter(version, [], requestId, "error", "message_error")
    }
  }

  private getSmartFilterDuration(): number | null {
    return this.smartFilterRequestStartedAt === null
      ? null
      : Date.now() - this.smartFilterRequestStartedAt
  }

  private finishSmartFilter(
    version: number,
    skipIds: string[],
    requestId: string,
    outcome: SmartFilterClassifyStatus,
    errorCode?: string,
    cacheKey?: string,
  ): void {
    const durationMs = this.getSmartFilterDuration()

    if (version !== this.smartFilterVersion) {
      logSmartFilterDiagnostic("request-end", {
        requestId,
        outcome: "stale",
        durationMs,
        skipIds,
        ...(errorCode ? { errorCode } : {}),
      })
      logSmartFilterDiagnostic("result-apply", {
        requestId,
        keptSkipIds: [],
        discardedChangedRegion: [],
        discardedStaleVersion: skipIds,
      })
      return
    }

    this.smartFilterVersion++
    if (this.smartFilterDeadlineTimer) {
      clearTimeout(this.smartFilterDeadlineTimer)
      this.smartFilterDeadlineTimer = null
    }

    // A sampled region may change before the observer callback runs.
    this.markChangedSampledRegions()
    const discardedChangedRegion = skipIds.filter(id => this.smartFilterInvalidatedRegionIds.has(id))
    const appliedSkipIds = skipIds.filter(id => !this.smartFilterInvalidatedRegionIds.has(id))
    if (outcome === "success" && cacheKey && this.smartFilterInvalidatedRegionIds.size === 0)
      this.smartFilterCache = { key: cacheKey, skipIds: [...appliedSkipIds] }
    const pendingTargets = [...this.smartFilterPendingTargets]
    this.smartFilterPendingTargets.clear()
    this.smartFilterRequestId = null
    this.smartFilterSkipIds = appliedSkipIds
    this.smartFilterRegionSignatures.clear()

    logSmartFilterDiagnostic("request-end", {
      requestId,
      outcome,
      durationMs,
      skipIds,
      ...(errorCode ? { errorCode } : {}),
    })
    logSmartFilterDiagnostic("result-apply", {
      requestId,
      keptSkipIds: appliedSkipIds,
      discardedChangedRegion,
      discardedStaleVersion: [],
    })

    if (!this.isPageTranslating) {
      this.smartFilterState = null
      this.smartFilterCollection = null
      this.smartFilterSkipIds = []
      this.smartFilterInvalidatedRegionIds.clear()
      return
    }

    this.smartFilterState = this.buildSmartFilterState()

    if (this.smartFilterSkipIds.length === 0) {
      this.smartFilterCollection = null
      this.smartFilterInvalidatedRegionIds.clear()
    }

    void this.resumePendingTargets(pendingTargets, this.smartFilterVersion)
  }

  private cancelSmartFilter(): void {
    this.smartFilterVersion++
    if (this.smartFilterDeadlineTimer) {
      clearTimeout(this.smartFilterDeadlineTimer)
      this.smartFilterDeadlineTimer = null
    }

    const requestId = this.smartFilterRequestId
    if (requestId) {
      logSmartFilterDiagnostic("request-end", {
        requestId,
        outcome: "cancel",
        durationMs: this.getSmartFilterDuration(),
        skipIds: [],
      })
    }

    this.smartFilterRequestId = null
    this.smartFilterDiagnosticRequestId = null
    this.smartFilterRequestStartedAt = null
    this.smartFilterCollection = null
    this.smartFilterState = null
    this.smartFilterPendingTargets.clear()
    this.smartFilterSkipIds = []
    this.smartFilterInvalidatedRegionIds.clear()
    this.smartFilterRegionSignatures.clear()

    if (requestId) {
      void sendMessage("cancelSmartFilterClassification", { requestId })
        .catch(error => logger.warn("Failed to cancel smart filter classification", error))
    }
  }

  private buildSmartFilterState(): SmartFilterPageState | null {
    const collection = this.smartFilterCollection
    if (!collection)
      return null

    const pendingNodes: HTMLElement[] = []
    if (this.smartFilterRequestId) {
      for (const [id, node] of collection.nodeById) {
        if (!this.smartFilterInvalidatedRegionIds.has(id) && node.isConnected)
          pendingNodes.push(node)
      }
    }

    const validSkipIds = this.smartFilterSkipIds.filter(id => !this.smartFilterInvalidatedRegionIds.has(id))
    const decision = validSkipIds.length > 0
      ? createSmartFilterDecision(collection, { skipIds: validSkipIds })
      : null

    if ((!decision || decision.skipIds.length === 0) && pendingNodes.length === 0)
      return null

    return createSmartFilterPageState({
      decision: decision?.skipIds.length ? decision : null,
      pendingNodes,
    })
  }

  /** Detect sampled content that changed before its classification returned. */
  private markChangedSampledRegions(): void {
    const collection = this.smartFilterCollection
    if (!collection)
      return

    for (const [id, node] of collection.nodeById) {
      const signature = this.smartFilterRegionSignatures.get(id)
      if (signature === undefined || !node.isConnected || (node.textContent ?? "") !== signature)
        this.smartFilterInvalidatedRegionIds.add(id)
    }
  }

  private invalidateSmartFilterRegionsFromMutations(records: MutationRecord[]): HTMLElement[] {
    const collection = this.smartFilterCollection
    if (!collection)
      return []

    const rescanTargets = new Set<HTMLElement>()
    const invalidations: Array<{
      type: MutationRecord["type"]
      targetTag: string
      affectedRegionIds: string[]
    }> = []
    let changed = false
    for (const record of records) {
      if (this.isExtensionMutationRecord(record))
        continue

      const recordTarget = record.target
      const target = isHTMLElement(recordTarget)
        ? recordTarget
        : recordTarget instanceof ShadowRoot && isHTMLElement(recordTarget.host)
          ? recordTarget.host
          : recordTarget.parentElement
      const affectedRegionIds: string[] = []
      for (const [id, node] of collection.nodeById) {
        if (this.smartFilterInvalidatedRegionIds.has(id))
          continue

        if (this.isSmartFilterRegionAffectedByMutation(node, record, target)) {
          this.smartFilterInvalidatedRegionIds.add(id)
          affectedRegionIds.push(id)
          changed = true
          if (node.isConnected)
            rescanTargets.add(node)
        }
      }

      if (affectedRegionIds.length > 0) {
        if (target)
          rescanTargets.add(target)
        invalidations.push({
          type: record.type,
          targetTag: (target?.tagName ?? record.target.nodeName).toLowerCase(),
          affectedRegionIds,
        })
      }
    }

    if (invalidations.length > 0) {
      logSmartFilterDiagnostic("regions-invalidated", {
        requestId: this.smartFilterDiagnosticRequestId,
        mutations: invalidations,
      })
    }

    if (changed) {
      this.smartFilterState = this.buildSmartFilterState()
      if (!this.smartFilterState && !this.smartFilterRequestId) {
        this.smartFilterCollection = null
        this.smartFilterSkipIds = []
        this.smartFilterInvalidatedRegionIds.clear()
      }
    }

    return [...rescanTargets]
  }

  /**
   * Decide whether a mutation affects a sampled region. A changed container
   * only invalidates its sampled ancestors and itself; a sampled descendant is
   * affected only when the added or removed nodes actually intersect it. Adding
   * an unrelated sibling under a shared parent keeps the descendant's state.
   */
  private isSmartFilterRegionAffectedByMutation(
    node: HTMLElement,
    record: MutationRecord,
    target: HTMLElement | null,
  ): boolean {
    if (!node.isConnected)
      return true
    if (!target)
      return false
    if (node === target)
      return true

    // The mutation changed content inside this sampled region.
    if (isComposedDescendant(target, node))
      return true

    if (!isComposedDescendant(node, target))
      return false

    // Attribute changes on a container may reveal or hide its descendants, so
    // keep the existing ancestor invalidation for non-childList records.
    if (record.type !== "childList")
      return true

    for (const changedNode of [...record.addedNodes, ...record.removedNodes]) {
      if (changedNode === node
        || isComposedDescendant(changedNode, node)
        || isComposedDescendant(node, changedNode)) {
        return true
      }
    }

    return false
  }

  private isExtensionMutationRecord(record: MutationRecord): boolean {
    if (this.isInsideTranslatedContent(record.target))
      return true

    if (record.type !== "childList")
      return false

    const addedNodes = [...record.addedNodes]
    const removedNodes = [...record.removedNodes]
    const allAddedTranslated = addedNodes.length > 0 && addedNodes.every(node => this.isInsideTranslatedContent(node))
    const allRemovedTranslated = removedNodes.length > 0 && removedNodes.every(node => this.isInsideTranslatedContent(node))

    return allAddedTranslated || (addedNodes.length === 0 && allRemovedTranslated)
  }

  private isInsideTranslatedContent(node: Node): boolean {
    if (isHTMLElement(node))
      return node.classList.contains(CONTENT_WRAPPER_CLASS) || node.closest(`.${CONTENT_WRAPPER_CLASS}`) !== null

    const parent = node.parentNode
    return parent !== null && isHTMLElement(parent) && parent.closest(`.${CONTENT_WRAPPER_CLASS}`) !== null
  }

  private async resumePendingTargets(targets: HTMLElement[], version: number): Promise<void> {
    if (!this.isPageTranslating || targets.length === 0)
      return

    const observer = this.intersectionObserver
    const walkId = this.walkId
    const config = await getLocalConfig()
    if (!config || !observer || !walkId || !this.isPageTranslating || version !== this.smartFilterVersion)
      return

    const smartFilter = this.smartFilterState
    for (const target of targets) {
      if (!target.isConnected || target.closest(`.${CONTENT_WRAPPER_CLASS}`)) {
        observer.unobserve(target)
        continue
      }

      if (smartFilter?.isNodeSkipped(target)) {
        observer.unobserve(target)
        continue
      }

      // Keep offscreen units under the existing intersection observation.
      if (!this.isElementInPreloadRange(target))
        continue

      observer.unobserve(target)
      if (smartFilter) {
        void translateWalkedElement(target, walkId, config, false, smartFilter)
      }
      else {
        void translateWalkedElement(target, walkId, config)
      }
    }
  }

  private isElementInPreloadRange(element: HTMLElement): boolean {
    if (!element.isConnected)
      return false

    const rect = element.getBoundingClientRect()
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0
    const margin = this.smartFilterPreloadMargin
    return rect.bottom >= -margin
      && rect.top <= viewportHeight + margin
      && rect.right >= -margin
      && rect.left <= viewportWidth + margin
  }
}
