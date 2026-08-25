import type { SelectionButtonPosition } from "./selection-geometry"
import type { SelectionSnapshot } from "./selection-snapshot"
import type { Config } from "@/types/config/config"
import { translateTextForSelection } from "@/utils/host/translate/translate-selection"
import { getSelectionButtonPosition } from "./selection-geometry"
import { detectSelectionLanguage, shouldShowSelectionTranslateButton } from "./selection-language"
import { snapshotSelection } from "./selection-snapshot"

export interface SelectionSession extends SelectionSnapshot {
  id: number
  createdAt: number
}

export type SelectionTranslationState
  = | { status: "idle" }
    | { status: "detecting", session: SelectionSession }
    | { status: "ready", session: SelectionSession, position: SelectionButtonPosition }
    | { status: "translating", session: SelectionSession, position: SelectionButtonPosition }
    | { status: "success", session: SelectionSession, position: SelectionButtonPosition, translation: string }
    | { status: "error", session: SelectionSession, position: SelectionButtonPosition, error: unknown }

export interface SelectionControllerOptions {
  config: Config
  document?: Document
  window?: Window
  onStateChange?: (state: SelectionTranslationState) => void
  detectLanguage?: typeof detectSelectionLanguage
  translate?: typeof translateTextForSelection
}

const SELECTION_DEBOUNCE_MS = 120

export class SelectionController {
  private config: Config
  private readonly documentRef: Document
  private readonly windowRef: Window
  private readonly onStateChange?: (state: SelectionTranslationState) => void
  private readonly detectLanguage: typeof detectSelectionLanguage
  private readonly translate: typeof translateTextForSelection
  private listeningAbortController: AbortController | null = null
  private state: SelectionTranslationState = { status: "idle" }
  private currentSession: SelectionSession | null = null
  private sessionId = 0
  private debounceTimer: number | undefined
  private animationFrame: number | undefined
  private selectionUiPointerResetTimer: number | undefined
  private started = false
  private listening = false
  private pointerSelectionActive = false
  private selectionUiPointerActive = false

  constructor(options: SelectionControllerOptions) {
    this.config = options.config
    this.documentRef = options.document ?? document
    this.windowRef = options.window ?? this.documentRef.defaultView ?? window
    this.onStateChange = options.onStateChange
    this.detectLanguage = options.detectLanguage ?? detectSelectionLanguage
    this.translate = options.translate ?? translateTextForSelection
  }

  getState(): SelectionTranslationState {
    return this.state
  }

  start(): void {
    if (this.started)
      return
    this.started = true
    this.setListening(this.config.selectionTranslation.enabled)
    if (this.config.selectionTranslation.enabled)
      this.scheduleSelectionRead(0)
  }

  stop(): void {
    if (!this.started)
      return
    this.started = false
    this.setListening(false)
    this.clearScheduledWork()
    this.invalidate()
  }

  updateConfig(config: Config): void {
    const wasEnabled = this.config.selectionTranslation.enabled
    const shouldReset = wasEnabled !== config.selectionTranslation.enabled
      || this.config.selectionTranslation.targetCode !== config.selectionTranslation.targetCode
      || this.config.selectionTranslation.providerId !== config.selectionTranslation.providerId

    this.config = config
    if (!this.started)
      return
    this.setListening(config.selectionTranslation.enabled)

    if (!config.selectionTranslation.enabled) {
      this.invalidate()
      return
    }

    if (shouldReset) {
      const previousSession = this.currentSession
      this.invalidate()
      if (previousSession) {
        const session = { ...previousSession, id: ++this.sessionId, createdAt: Date.now() }
        this.currentSession = session
        this.emit({ status: "detecting", session })
        void this.evaluateSession(session)
      }
      else {
        this.scheduleSelectionRead(0)
      }
    }
  }

  dismiss(): void {
    this.invalidate()
  }

  async translateCurrent(): Promise<void> {
    const current = this.state
    if (current.status === "idle" || current.status === "detecting" || current.status === "translating")
      return

    const session = current.session
    const position = this.getPosition(session)
    if (!position) {
      this.invalidate()
      return
    }

    this.emit({ status: "translating", session, position })
    try {
      const translation = await this.translate(this.config, session.text)
      if (!this.isCurrentSession(session.id))
        return
      const nextPosition = this.getPosition(session)
      if (!nextPosition) {
        this.invalidate()
        return
      }
      this.emit({ status: "success", session, position: nextPosition, translation })
    }
    catch (error) {
      if (!this.isCurrentSession(session.id))
        return
      const nextPosition = this.getPosition(session)
      if (!nextPosition) {
        this.invalidate()
        return
      }
      this.emit({ status: "error", session, position: nextPosition, error })
    }
  }

  retry(): Promise<void> {
    return this.translateCurrent()
  }

  private setListening(enabled: boolean): void {
    if (enabled === this.listening)
      return

    this.listening = enabled
    if (!enabled) {
      this.listeningAbortController?.abort()
      this.listeningAbortController = null
      this.pointerSelectionActive = false
      this.selectionUiPointerActive = false
      this.clearScheduledWork()
      return
    }

    const listeningAbortController = new AbortController()
    this.listeningAbortController = listeningAbortController
    const { signal } = listeningAbortController
    this.documentRef.addEventListener("pointerdown", this.handlePointerDown, { signal })
    this.documentRef.addEventListener("pointerup", this.handlePointerUp, { signal })
    this.documentRef.addEventListener("pointercancel", this.handlePointerUp, { signal })
    this.documentRef.addEventListener("keyup", this.handleKeyUp, { signal })
    this.documentRef.addEventListener("selectionchange", this.handleSelectionChange, { signal })
    this.documentRef.addEventListener("scroll", this.handleViewportChange, { signal, capture: true })
    this.windowRef.addEventListener("resize", this.handleViewportChange, { signal })
    this.documentRef.addEventListener("visibilitychange", this.handleVisibilityChange, { signal })
  }

  private clearScheduledWork(): void {
    if (this.debounceTimer !== undefined) {
      this.windowRef.clearTimeout(this.debounceTimer)
      this.debounceTimer = undefined
    }
    if (this.animationFrame !== undefined) {
      this.cancelAnimationFrame(this.animationFrame)
      this.animationFrame = undefined
    }
    if (this.selectionUiPointerResetTimer !== undefined) {
      this.windowRef.clearTimeout(this.selectionUiPointerResetTimer)
      this.selectionUiPointerResetTimer = undefined
    }
    this.selectionUiPointerActive = false
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (event.target instanceof Node && this.isInsideSelectionUi(event.target)) {
      if (this.selectionUiPointerResetTimer !== undefined) {
        this.windowRef.clearTimeout(this.selectionUiPointerResetTimer)
        this.selectionUiPointerResetTimer = undefined
      }
      this.selectionUiPointerActive = true
      return
    }
    this.selectionUiPointerActive = false
    this.pointerSelectionActive = true
    this.invalidate()
  }

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (this.selectionUiPointerActive || (event.target instanceof Node && this.isInsideSelectionUi(event.target))) {
      this.pointerSelectionActive = false
      this.selectionUiPointerResetTimer = this.windowRef.setTimeout(() => {
        this.selectionUiPointerResetTimer = undefined
        this.selectionUiPointerActive = false
      }, 0)
      return
    }
    this.pointerSelectionActive = false
    this.scheduleSelectionRead(0)
  }

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    if (event.key === "Shift" || event.shiftKey)
      this.scheduleSelectionRead(0)
  }

  private readonly handleSelectionChange = (): void => {
    if (this.selectionUiPointerActive)
      return

    const selection = this.documentRef.getSelection()
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      if (this.state.status === "translating" || this.state.status === "success" || this.state.status === "error")
        return
      this.invalidate()
      return
    }
    this.invalidate()
    if (this.pointerSelectionActive)
      return
    this.scheduleSelectionRead(SELECTION_DEBOUNCE_MS)
  }

  private readonly handleViewportChange = (): void => {
    if (!this.currentSession || this.state.status === "idle" || this.state.status === "detecting")
      return
    this.schedulePositionUpdate()
  }

  private readonly handleVisibilityChange = (): void => {
    if (this.documentRef.visibilityState === "visible")
      this.scheduleSelectionRead(0)
  }

  private scheduleSelectionRead(delay: number): void {
    if (!this.listening)
      return
    if (this.debounceTimer !== undefined)
      this.windowRef.clearTimeout(this.debounceTimer)
    this.debounceTimer = this.windowRef.setTimeout(() => {
      this.debounceTimer = undefined

      // A viewport update can already own the pending animation frame. It
      // must yield to the latest selection read, or the new selection can
      // remain undetected until another user event occurs.
      if (this.animationFrame !== undefined) {
        this.cancelAnimationFrame(this.animationFrame)
        this.animationFrame = undefined
      }
      this.schedulePositionUpdate(() => void this.readSelection())
    }, delay)
  }

  private schedulePositionUpdate(callback?: () => void): void {
    if (this.animationFrame !== undefined)
      return
    this.animationFrame = this.requestAnimationFrame(() => {
      this.animationFrame = undefined
      callback?.()
      if (!callback && this.currentSession && this.state.status !== "idle" && this.state.status !== "detecting") {
        const position = this.getPosition(this.currentSession)
        if (position)
          this.emit({ ...this.state, position } as SelectionTranslationState)
        else
          this.invalidate()
      }
    })
  }

  private async readSelection(): Promise<void> {
    const snapshot = snapshotSelection(this.documentRef.getSelection(), this.documentRef)
    if (!snapshot) {
      this.invalidate()
      return
    }

    const session: SelectionSession = {
      ...snapshot,
      id: ++this.sessionId,
      createdAt: Date.now(),
    }
    this.currentSession = session
    this.emit({ status: "detecting", session })
    await this.evaluateSession(session)
  }

  private async evaluateSession(session: SelectionSession): Promise<void> {
    let code: Awaited<ReturnType<typeof detectSelectionLanguage>>["code"] = "und"
    try {
      code = (await this.detectLanguage(session.text)).code
    }
    catch {
      // Detection is a gating hint. An unavailable detector leaves the
      // language unknown, which keeps translation available to the user.
    }

    if (!this.isCurrentSession(session.id) || !this.config.selectionTranslation.enabled)
      return

    if (!shouldShowSelectionTranslateButton(code, this.config.selectionTranslation.targetCode)) {
      this.emit({ status: "idle" })
      return
    }

    const position = this.getPosition(session)
    if (!position) {
      this.invalidate()
      return
    }
    this.emit({ status: "ready", session, position })
  }

  private getPosition(session: SelectionSession): SelectionButtonPosition | null {
    try {
      return getSelectionButtonPosition(session, this.documentRef, this.windowRef.innerWidth, this.windowRef.innerHeight)
    }
    catch {
      // DOM layout can change between a selection event and the next frame.
      // Treat an invalidated range as a dismissed session instead of letting
      // the event handler surface an unhandled layout error.
      return null
    }
  }

  private isCurrentSession(id: number): boolean {
    return this.currentSession?.id === id && this.sessionId === id
  }

  private invalidate(): void {
    ++this.sessionId
    this.currentSession = null
    this.clearScheduledWork()
    this.emit({ status: "idle" })
  }

  private isInsideSelectionUi(node: Node): boolean {
    let current: Node | null = node
    while (current) {
      if (current instanceof Element && current.hasAttribute("data-read-frog-selection-ui"))
        return true

      const root = current.getRootNode()
      if (root instanceof ShadowRoot) {
        current = root.host
      }
      else {
        current = current.parentNode
      }
    }

    return false
  }

  private requestAnimationFrame(callback: FrameRequestCallback): number {
    if (typeof this.windowRef.requestAnimationFrame === "function")
      return this.windowRef.requestAnimationFrame(callback)
    return this.windowRef.setTimeout(() => callback(Date.now()), 0)
  }

  private cancelAnimationFrame(id: number): void {
    if (typeof this.windowRef.cancelAnimationFrame === "function")
      this.windowRef.cancelAnimationFrame(id)
    else
      this.windowRef.clearTimeout(id)
  }

  private emit(state: SelectionTranslationState): void {
    this.state = state
    this.onStateChange?.(state)
  }
}
