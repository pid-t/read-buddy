import type { Config } from "@/types/config/config"
import type { Point } from "@/types/dom"
import { REACT_SHADOW_HOST_CLASS } from "@/utils/constants/dom-labels"
import { HOTKEY_EVENT_KEYS } from "@/utils/constants/hotkeys"
import { isHTMLElement } from "@/utils/host/dom/filter"
import { findNearestAncestorBlockNodeAt } from "@/utils/host/dom/find"

export const NODE_TRANSLATION_HOLD_TRIGGER_MS = 250
const CLICK_AND_HOLD_MOVE_TOLERANCE = 6

const EXTENSION_UI_SELECTORS = [
  `.${REACT_SHADOW_HOST_CLASS}`,
  "[data-read-frog-selection-ui]",
  "[data-read-frog-selection-wrapper]",
  "[data-read-frog-selection-button]",
  "[data-read-frog-selection-popover]",
  "[data-read-frog-host-toast]",
] as const

interface NodeTranslationTriggerCommonOptions {
  getConfig: () => Promise<Config | null>
  resolveTarget?: (point: Point) => HTMLElement | null
  shouldIgnoreEvent?: () => boolean
}

export type NodeTranslationTriggerOptions = NodeTranslationTriggerCommonOptions & (
  | {
    onTrigger: (point: Point, config: Config) => void | Promise<void>
    onTriggerElement?: never
  }
  | {
    onTriggerElement: (element: HTMLElement, config: Config) => void | Promise<void>
    onTrigger?: never
  }
)

function isEditableElement(element: HTMLElement): boolean {
  const tag = element.tagName.toUpperCase()
  return tag === "INPUT"
    || tag === "TEXTAREA"
    || tag === "SELECT"
    || element.isContentEditable
}

function getEventPath(event: Event): EventTarget[] {
  const path = typeof event.composedPath === "function"
    ? event.composedPath()
    : [event.target]
  return path.filter((item): item is EventTarget => {
    return item !== null && (typeof item === "object" || typeof item === "function")
  })
}

function isExtensionUiSelectorMatch(element: HTMLElement): boolean {
  return EXTENSION_UI_SELECTORS.some(selector => element.matches(selector))
}

function hasEditableAncestor(element: HTMLElement | null): boolean {
  let current: HTMLElement | null = element
  while (current) {
    if (isEditableElement(current))
      return true
    current = current.parentElement
  }
  return false
}

function isExtensionUiElement(element: HTMLElement): boolean {
  let current: Node | null = element
  while (current) {
    if (isHTMLElement(current)) {
      const currentElement = current
      if (EXTENSION_UI_SELECTORS.some(selector => currentElement.matches(selector)))
        return true
    }

    if (current.parentNode) {
      current = current.parentNode
      continue
    }

    // Events from an open shadow root have a ShadowRoot as their parentless
    // boundary. Continue at the host so the UI remains excluded.
    const root = current.getRootNode?.()
    current = root && "host" in root ? (root.host as Node | null) : null
  }
  return false
}

function isDocumentSurfaceTarget(target: EventTarget | null): boolean {
  return target === document
    || target === window
    || target === document.documentElement
    || target === document.body
}

function hasEffectiveTextSelection(): boolean {
  const selection = window.getSelection?.()
  return !!selection
    && !selection.isCollapsed
    && selection.toString().trim().length > 0
}

function isDocumentHidden(): boolean {
  return document.hidden || document.visibilityState === "hidden"
}

function hasKeyboardEventModifierConflict(event: KeyboardEvent): boolean {
  const hasAnyModifier = event.ctrlKey || event.altKey || event.shiftKey || event.metaKey
  if (event.key === "Control")
    return event.altKey || event.shiftKey || event.metaKey
  if (event.key === "Alt")
    return event.ctrlKey || event.shiftKey || event.metaKey
  if (event.key === "Shift")
    return event.ctrlKey || event.altKey || event.metaKey
  if (event.key === "`")
    return hasAnyModifier
  return hasAnyModifier
}

/**
 * Registers the node-translation interaction state machine.
 *
 * Keyboard hotkeys are hold gestures: a key press arms the gesture, the
 * current pointer is resolved to a block element, and that same element must
 * remain hovered for the dwell interval before translation starts. The old
 * click-and-hold gesture remains available as a separate compatibility mode.
 */
export function registerNodeTranslationTriggerListeners({
  getConfig,
  onTrigger,
  onTriggerElement,
  resolveTarget,
  shouldIgnoreEvent = () => false,
}: NodeTranslationTriggerOptions): () => void {
  const ac = new AbortController()
  const { signal } = ac

  const mousePosition: Point = { x: 0, y: 0 }
  let hasMousePosition = false
  let pointerInDocument = false
  let pointerTargetBlocked = false

  const updateMousePosition = (point: Point) => {
    mousePosition.x = point.x
    mousePosition.y = point.y
    hasMousePosition = true
  }

  const getHoveredElement = (): Element | null => {
    const hoveredElements = document.querySelectorAll(":hover")
    return hoveredElements.item(hoveredElements.length - 1)
  }

  const restorePointerFromHover = (): boolean => {
    const hoveredElement = getHoveredElement()
    if (
      !hoveredElement
      || hoveredElement === document.documentElement
      || hoveredElement === document.body
    ) {
      return false
    }
    // Coordinates captured before blur can point at a different block after
    // the page is refocused. Resolve the current :hover chain instead.
    hasMousePosition = false
    pointerInDocument = true
    pointerTargetBlocked = false
    return true
  }

  const getElementCenterPoint = (element: Element): Point | null => {
    const rect = element.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0)
      return null

    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }
  }

  const resolveTriggerPoint = (): Point => {
    if (hasMousePosition)
      return { ...mousePosition }

    const hoveredElement = getHoveredElement()
    const hoveredPoint = hoveredElement ? getElementCenterPoint(hoveredElement) : null
    return hoveredPoint ?? { ...mousePosition }
  }

  const getCurrentConfig = async (): Promise<Config | null> => {
    try {
      const config = await getConfig()
      return signal.aborted ? null : config
    }
    catch {
      return null
    }
  }

  const isEventBlocked = (event: Event): boolean => {
    if (shouldIgnoreEvent() || isDocumentHidden() || hasEffectiveTextSelection())
      return true

    const path = getEventPath(event)
    let firstElement: HTMLElement | null = null
    for (const item of path) {
      if (!isHTMLElement(item as Node))
        continue
      const element = item as HTMLElement
      firstElement ??= element
      if (isEditableElement(element) || isExtensionUiSelectorMatch(element))
        return true
    }

    // Synthetic events and a few browser event paths expose only the target.
    // Scan its ancestors once for those cases.
    return path.length <= 1 && !!firstElement
      && (hasEditableAncestor(firstElement) || isExtensionUiElement(firstElement))
  }

  const isCheapBlockedPointerTarget = (target: EventTarget | null): boolean => {
    const element = target && isHTMLElement(target as Node) ? target as HTMLElement : null
    return !!element && (isEditableElement(element) || isExtensionUiSelectorMatch(element))
  }

  const isCandidateUsable = (element: HTMLElement | null): element is HTMLElement => {
    if (!element || !element.isConnected)
      return false
    if (element === document.body || element === document.documentElement)
      return false
    if (!element.textContent?.trim())
      return false
    if (hasEditableAncestor(element) || isExtensionUiElement(element))
      return false
    return true
  }

  const resolveCandidateAtPointer = (): HTMLElement | null => {
    if (!pointerInDocument)
      return null
    if (pointerTargetBlocked)
      return null
    if (!hasMousePosition && !getHoveredElement())
      return null

    try {
      const node = resolveTarget
        ? resolveTarget(resolveTriggerPoint())
        : findNearestAncestorBlockNodeAt(resolveTriggerPoint())
      return node && isHTMLElement(node) && isCandidateUsable(node) ? node : null
    }
    catch {
      // elementFromPoint is unavailable on a few document-like surfaces and
      // can throw while a frame is being torn down. Treat that as no target.
      return null
    }
  }

  // Keyboard session state. Session invalidation preserves the physical-key
  // snapshot; blur/hidden/teardown clear it explicitly.
  let keyboardSessionId = 0
  let keyboardPressed = false
  let activationKey: string | null = null
  let keyboardConfig: Config | null = null
  const pressedKeys = new Set<string>()
  const triggeredTargets = new Set<HTMLElement>()
  let currentTarget: HTMLElement | null = null
  let dwellTimerId: ReturnType<typeof setTimeout> | null = null

  const clearDwellTimer = () => {
    if (dwellTimerId !== null) {
      clearTimeout(dwellTimerId)
      dwellTimerId = null
    }
  }

  const clearCurrentTarget = () => {
    clearDwellTimer()
    currentTarget = null
  }

  const isActivationModifierMismatch = (event: MouseEvent | PointerEvent): boolean => {
    if (!keyboardPressed || !activationKey)
      return false
    const hasOtherModifier = (modifier: "ctrlKey" | "altKey" | "shiftKey") => {
      return (modifier !== "ctrlKey" && event.ctrlKey)
        || (modifier !== "altKey" && event.altKey)
        || (modifier !== "shiftKey" && event.shiftKey)
        || event.metaKey
    }
    if (activationKey === "Control")
      return !event.ctrlKey || hasOtherModifier("ctrlKey")
    if (activationKey === "Alt")
      return !event.altKey || hasOtherModifier("altKey")
    if (activationKey === "Shift")
      return !event.shiftKey || hasOtherModifier("shiftKey")
    return event.ctrlKey || event.altKey || event.shiftKey || event.metaKey
  }

  const invalidateKeyboardSession = () => {
    keyboardSessionId += 1
    keyboardPressed = false
    activationKey = null
    keyboardConfig = null
    triggeredTargets.clear()
    clearCurrentTarget()
  }

  const clearPressedKeys = () => {
    pressedKeys.clear()
  }

  const invokeTrigger = (element: HTMLElement, config: Config) => {
    const point = resolveTriggerPoint()
    try {
      const result = onTriggerElement
        ? onTriggerElement(element, config)
        : onTrigger?.(point, config)
      void Promise.resolve(result).catch(() => {
        // Translation providers expose their own error UI. Keep the interaction
        // listener alive when an injected callback rejects unexpectedly.
      })
    }
    catch {
      // Keep the interaction listener alive when an injected callback throws.
    }
  }

  const startDwell = (element: HTMLElement, sessionId: number) => {
    if (!keyboardPressed || !keyboardConfig || sessionId !== keyboardSessionId)
      return
    if (!isCandidateUsable(element) || triggeredTargets.has(element))
      return
    if (currentTarget === element && dwellTimerId !== null)
      return

    clearDwellTimer()
    currentTarget = element
    dwellTimerId = setTimeout(() => {
      dwellTimerId = null
      if (
        !keyboardPressed
        || !keyboardConfig
        || sessionId !== keyboardSessionId
        || currentTarget !== element
        || !isCandidateUsable(element)
        || shouldIgnoreEvent()
        || isDocumentHidden()
        || hasEffectiveTextSelection()
        || triggeredTargets.has(element)
      ) {
        return
      }
      if (resolveCandidateAtPointer() !== element)
        return

      // Mark before invoking user code so synchronous DOM mutations and
      // re-entrant pointer events cannot trigger this node twice per hold.
      triggeredTargets.add(element)
      invokeTrigger(element, keyboardConfig)
    }, NODE_TRANSLATION_HOLD_TRIGGER_MS)
  }

  type FrameId = ReturnType<typeof requestAnimationFrame>
  let frameId: FrameId | null = null
  const processPointerForKeyboard = () => {
    frameId = null
    if (!keyboardPressed || !keyboardConfig)
      return
    if (pointerTargetBlocked || shouldIgnoreEvent() || isDocumentHidden() || hasEffectiveTextSelection()) {
      clearCurrentTarget()
      return
    }

    const candidate = resolveCandidateAtPointer()
    if (!candidate) {
      clearCurrentTarget()
      return
    }

    if (triggeredTargets.has(candidate)) {
      // Returning to an already translated target must cancel the previous
      // target's timer before waiting for any future untriggered target.
      clearCurrentTarget()
      return
    }

    if (candidate === currentTarget) {
      // A pointermove inside the same block leaves the dwell deadline intact.
      if (dwellTimerId === null)
        startDwell(candidate, keyboardSessionId)
      return
    }

    startDwell(candidate, keyboardSessionId)
  }

  const schedulePointerProcessing = () => {
    if (frameId !== null)
      return
    frameId = requestAnimationFrame(processPointerForKeyboard)
  }

  const isEditableTarget = (target: EventTarget | null): boolean => {
    const element = target && isHTMLElement(target as Node) ? target as HTMLElement : null
    return !!element && hasEditableAncestor(element)
  }

  const updatePointerFromEvent = (event: MouseEvent | PointerEvent) => {
    updateMousePosition({ x: event.clientX, y: event.clientY })
    pointerInDocument = true
    if (isActivationModifierMismatch(event)) {
      invalidateKeyboardSession()
      return
    }
    pointerTargetBlocked = isCheapBlockedPointerTarget(event.target)
    if (!keyboardPressed)
      return

    if (pointerTargetBlocked)
      clearCurrentTarget()
    schedulePointerProcessing()
  }

  // A move handler only records coordinates while idle. Once armed, all hit
  // testing is merged into one requestAnimationFrame callback per frame.
  document.addEventListener("mousemove", updatePointerFromEvent, { signal, capture: true })
  document.addEventListener("pointermove", updatePointerFromEvent, { signal, capture: true })
  document.addEventListener("mouseover", updatePointerFromEvent, { signal, capture: true })
  document.addEventListener("pointerover", updatePointerFromEvent, { signal, capture: true })

  const handlePointerLeave = (event: MouseEvent | PointerEvent) => {
    if (event.relatedTarget !== null && event.relatedTarget !== undefined)
      return
    pointerInDocument = false
    pointerTargetBlocked = true
    if (keyboardPressed)
      clearCurrentTarget()
  }
  document.addEventListener("mouseleave", handlePointerLeave, { signal, capture: true })
  document.addEventListener("pointerleave", handlePointerLeave, { signal, capture: true })

  const clickSessionId = { value: 0 }
  let mousePressed = false
  let clickAndHoldTriggered = false
  let mousePressPosition: Point | null = null
  let clickAndHoldTimerId: ReturnType<typeof setTimeout> | null = null

  const clearClickAndHoldTimer = () => {
    if (clickAndHoldTimerId !== null) {
      clearTimeout(clickAndHoldTimerId)
      clickAndHoldTimerId = null
    }
  }

  const resetClickAndHoldState = () => {
    clickSessionId.value += 1
    mousePressed = false
    clickAndHoldTriggered = false
    mousePressPosition = null
    clearClickAndHoldTimer()
  }

  const invokeTriggerAtPoint = (point: Point, config: Config) => {
    if (onTriggerElement) {
      try {
        const node = resolveTarget
          ? resolveTarget(point)
          : findNearestAncestorBlockNodeAt(point)
        if (node && isHTMLElement(node) && isCandidateUsable(node))
          invokeTrigger(node, config)
      }
      catch {
        // The frame can disappear between mousedown and the hold deadline.
      }
      return
    }
    if (!onTrigger)
      return
    try {
      void Promise.resolve(onTrigger(point, config)).catch(() => {})
    }
    catch {
      // Keep the interaction listener alive when an injected callback throws.
    }
  }

  document.addEventListener("mousedown", (event) => {
    // Any mouse press cancels a keyboard dwell, including a press that the
    // page later handles itself. Defaults remain untouched because no event is
    // prevented or stopped.
    invalidateKeyboardSession()

    if (event.button !== 0 || isEventBlocked(event) || isDocumentSurfaceTarget(event.target)) {
      pointerInDocument = true
      resetClickAndHoldState()
      return
    }

    pointerInDocument = true
    const sessionId = ++clickSessionId.value
    mousePressed = true
    clickAndHoldTriggered = false
    mousePressPosition = { x: event.clientX, y: event.clientY }
    clearClickAndHoldTimer()

    void getCurrentConfig().then((config) => {
      if (
        !config
        || !mousePressed
        || sessionId !== clickSessionId.value
        || !mousePressPosition
        || !config.translate.node.enabled
        || config.translate.node.hotkey !== "clickAndHold"
      ) {
        return
      }

      clickAndHoldTimerId = setTimeout(() => {
        clickAndHoldTimerId = null
        if (
          !mousePressed
          || clickAndHoldTriggered
          || sessionId !== clickSessionId.value
          || !mousePressPosition
          || shouldIgnoreEvent()
          || isDocumentHidden()
          || hasEffectiveTextSelection()
        ) {
          return
        }
        clickAndHoldTriggered = true
        invokeTriggerAtPoint(mousePressPosition, config)
      }, NODE_TRANSLATION_HOLD_TRIGGER_MS)
    })
  }, { signal, capture: true })

  document.addEventListener("mouseup", (event) => {
    if (event.button === 0)
      resetClickAndHoldState()
  }, { signal, capture: true })

  document.addEventListener("pointercancel", () => {
    resetClickAndHoldState()
  }, { signal, capture: true })

  // Preserve click-and-hold's original immediate cancellation when the pointer
  // moves away from the press location.
  const handleClickAndHoldMovement = (event: MouseEvent | PointerEvent) => {
    if (!mousePressed || !mousePressPosition)
      return
    if (isEventBlocked(event)) {
      resetClickAndHoldState()
      return
    }
    const deltaX = event.clientX - mousePressPosition.x
    const deltaY = event.clientY - mousePressPosition.y
    if (Math.hypot(deltaX, deltaY) > CLICK_AND_HOLD_MOVE_TOLERANCE)
      resetClickAndHoldState()
  }
  document.addEventListener("mousemove", handleClickAndHoldMovement, { signal, capture: true })
  document.addEventListener("pointermove", handleClickAndHoldMovement, { signal, capture: true })

  document.addEventListener("keydown", (event) => {
    const hadPressedKey = pressedKeys.has(event.key)
    if (isEventBlocked(event) || isEditableTarget(event.target)) {
      invalidateKeyboardSession()
      return
    }

    // Modifier flags on a fresh key event are the most reliable recovery
    // signal when a browser dropped an earlier modifier keyup.
    if (event.key !== "Control" && !event.ctrlKey)
      pressedKeys.delete("Control")
    if (event.key !== "Alt" && !event.altKey)
      pressedKeys.delete("Alt")
    if (event.key !== "Shift" && !event.shiftKey)
      pressedKeys.delete("Shift")
    if (event.key !== "Meta" && !event.metaKey)
      pressedKeys.delete("Meta")
    if (event.key !== "Control" && event.ctrlKey)
      pressedKeys.add("Control")
    if (event.key !== "Alt" && event.altKey)
      pressedKeys.add("Alt")
    if (event.key !== "Shift" && event.shiftKey)
      pressedKeys.add("Shift")
    if (event.key !== "Meta" && event.metaKey)
      pressedKeys.add("Meta")

    // A non-repeat activation-key keydown after a lost keyup represents a new
    // physical hold. Rebuild the session instead of remaining permanently
    // armed behind the stale pressedKeys entry.
    if (!event.repeat && hadPressedKey) {
      pressedKeys.delete(event.key)
      invalidateKeyboardSession()
    }

    if (hasKeyboardEventModifierConflict(event)) {
      if (!event.repeat)
        pressedKeys.add(event.key)
      invalidateKeyboardSession()
      return
    }

    if (event.repeat || pressedKeys.has(event.key))
      return

    if (pressedKeys.size > 0) {
      pressedKeys.add(event.key)
      invalidateKeyboardSession()
      return
    }

    pressedKeys.add(event.key)
    if (!pointerInDocument)
      restorePointerFromHover()
    keyboardPressed = true
    keyboardSessionId += 1
    const sessionId = keyboardSessionId
    const pressedKey = event.key

    void getCurrentConfig().then((config) => {
      if (
        !config
        || !keyboardPressed
        || sessionId !== keyboardSessionId
        || !pressedKeys.has(pressedKey)
        || pressedKeys.size !== 1
        || !config.translate.node.enabled
        || config.translate.node.hotkey === "clickAndHold"
      ) {
        if (sessionId === keyboardSessionId)
          invalidateKeyboardSession()
        return
      }

      const configuredKey = HOTKEY_EVENT_KEYS[config.translate.node.hotkey]
      if (configuredKey !== pressedKey) {
        invalidateKeyboardSession()
        return
      }

      activationKey = configuredKey
      keyboardConfig = config
      schedulePointerProcessing()
    })
  }, { signal, capture: true })

  document.addEventListener("keyup", (event) => {
    const wasPressed = pressedKeys.delete(event.key)
    if (!wasPressed)
      return

    if (keyboardPressed && (event.key === activationKey || !pressedKeys.has(activationKey ?? "")))
      invalidateKeyboardSession()
  }, { signal, capture: true })

  const cancelAllInteraction = () => {
    invalidateKeyboardSession()
    clearPressedKeys()
    resetClickAndHoldState()
    pointerInDocument = false
    pointerTargetBlocked = true
  }

  window.addEventListener("blur", cancelAllInteraction, { signal, capture: true })
  window.addEventListener("focus", () => {
    if (!pointerInDocument)
      restorePointerFromHover()
  }, { signal, capture: true })
  document.addEventListener("visibilitychange", () => {
    if (isDocumentHidden())
      cancelAllInteraction()
    else if (!pointerInDocument)
      restorePointerFromHover()
  }, { signal, capture: true })

  return () => {
    ac.abort()
    cancelAllInteraction()
    if (frameId !== null) {
      cancelAnimationFrame(frameId)
      frameId = null
    }
  }
}
