// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { registerNodeTranslationTriggerListeners } from "../node-translation-trigger"

function createConfig(hotkey: Config["translate"]["node"]["hotkey"]): Config {
  return {
    translate: {
      node: {
        enabled: true,
        hotkey,
      },
    },
  } as Config
}

function dispatchKeyboardEvent(
  type: "keydown" | "keyup",
  key: string,
  target: EventTarget = document,
  repeat = false,
  modifiers: Pick<KeyboardEventInit, "ctrlKey" | "altKey" | "shiftKey" | "metaKey"> = {},
) {
  target.dispatchEvent(new KeyboardEvent(type, { key, repeat, bubbles: true, ...modifiers }))
}

function dispatchPointerEvent(
  type: "pointermove" | "mousemove" | "mousedown" | "mouseup",
  init: MouseEventInit,
  target: EventTarget = document,
) {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, ...init }))
}

async function flushConfigAndFrame() {
  await Promise.resolve()
  await Promise.resolve()
}

describe("registerNodeTranslationTriggerListeners", () => {
  let teardown: (() => void) | null = null
  let targetByX = new Map<number, HTMLElement>()

  afterEach(() => {
    teardown?.()
    teardown = null
    targetByX = new Map()
    document.body.innerHTML = ""
    window.getSelection()?.removeAllRanges()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  function createTarget(text: string, x: number) {
    const target = document.createElement("p")
    target.textContent = text
    document.body.append(target)
    targetByX.set(x, target)
    return target
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      const id = Math.floor(Math.random() * 10000)
      queueMicrotask(() => callback(performance.now()))
      return id
    })
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {})
  })

  it("triggers after hovering then holding the configured key for 250ms", async () => {
    const target = createTarget("first", 50)
    const onTriggerElement = vi.fn()
    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("control")),
      onTriggerElement,
      resolveTarget: point => targetByX.get(point.x) ?? null,
    })

    dispatchPointerEvent("pointermove", { clientX: 50, clientY: 60 }, target)
    dispatchKeyboardEvent("keydown", "Control")
    await flushConfigAndFrame()

    await vi.advanceTimersByTimeAsync(249)
    expect(onTriggerElement).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)

    expect(onTriggerElement).toHaveBeenCalledTimes(1)
    expect(onTriggerElement).toHaveBeenCalledWith(target, expect.anything())
  })

  it("triggers after holding the key then moving onto a target", async () => {
    const target = createTarget("first", 70)
    const onTriggerElement = vi.fn()
    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("control")),
      onTriggerElement,
      resolveTarget: point => targetByX.get(point.x) ?? null,
    })

    dispatchKeyboardEvent("keydown", "Control")
    await flushConfigAndFrame()
    await vi.advanceTimersByTimeAsync(250)
    expect(onTriggerElement).not.toHaveBeenCalled()

    dispatchPointerEvent("pointermove", { clientX: 70, clientY: 80, ctrlKey: true }, target)
    await flushConfigAndFrame()
    await vi.advanceTimersByTimeAsync(250)

    expect(onTriggerElement).toHaveBeenCalledTimes(1)
    expect(onTriggerElement).toHaveBeenCalledWith(target, expect.anything())
  })

  it("does not fire at 249ms and fires once at 250ms", async () => {
    const target = createTarget("first", 10)
    const onTriggerElement = vi.fn()
    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("backtick")),
      onTriggerElement,
      resolveTarget: point => targetByX.get(point.x) ?? null,
    })

    dispatchPointerEvent("pointermove", { clientX: 10, clientY: 1 }, target)
    dispatchKeyboardEvent("keydown", "`")
    await flushConfigAndFrame()
    await vi.advanceTimersByTimeAsync(249)
    expect(onTriggerElement).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(onTriggerElement).toHaveBeenCalledTimes(1)

    dispatchPointerEvent("pointermove", { clientX: 10, clientY: 2 }, target)
    await flushConfigAndFrame()
    await vi.advanceTimersByTimeAsync(250)
    expect(onTriggerElement).toHaveBeenCalledTimes(1)
  })

  it("allows a new target once during one key hold", async () => {
    const first = createTarget("first", 10)
    const second = createTarget("second", 20)
    const onTriggerElement = vi.fn()
    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("control")),
      onTriggerElement,
      resolveTarget: point => targetByX.get(point.x) ?? null,
    })

    dispatchPointerEvent("pointermove", { clientX: 10, clientY: 1 }, first)
    dispatchKeyboardEvent("keydown", "Control")
    await flushConfigAndFrame()
    await vi.advanceTimersByTimeAsync(250)
    dispatchPointerEvent("pointermove", { clientX: 20, clientY: 1, ctrlKey: true }, second)
    await flushConfigAndFrame()
    await vi.advanceTimersByTimeAsync(250)

    expect(onTriggerElement.mock.calls.map(([element]) => element)).toEqual([first, second])
  })

  it("cancels a new target timer when returning to an already triggered target", async () => {
    const first = createTarget("first", 10)
    const second = createTarget("second", 20)
    const onTriggerElement = vi.fn()
    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("control")),
      onTriggerElement,
      resolveTarget: point => targetByX.get(point.x) ?? null,
    })

    dispatchPointerEvent("pointermove", { clientX: 10, clientY: 1 }, first)
    dispatchKeyboardEvent("keydown", "Control")
    await flushConfigAndFrame()
    await vi.advanceTimersByTimeAsync(250)

    dispatchPointerEvent("pointermove", { clientX: 20, clientY: 1, ctrlKey: true }, second)
    await flushConfigAndFrame()
    await vi.advanceTimersByTimeAsync(125)
    dispatchPointerEvent("pointermove", { clientX: 10, clientY: 1, ctrlKey: true }, first)
    await flushConfigAndFrame()
    await vi.advanceTimersByTimeAsync(125)
    expect(onTriggerElement).toHaveBeenCalledTimes(1)

    dispatchPointerEvent("pointermove", { clientX: 20, clientY: 1, ctrlKey: true }, second)
    await flushConfigAndFrame()
    await vi.advanceTimersByTimeAsync(250)
    expect(onTriggerElement.mock.calls.map(([element]) => element)).toEqual([first, second])
  })

  it("rechecks the resolved target and cancels on pointer leave", async () => {
    const first = createTarget("first", 10)
    const second = createTarget("second", 20)
    let resolvedTarget: HTMLElement | null = first
    const onTriggerElement = vi.fn()
    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("control")),
      onTriggerElement,
      resolveTarget: () => resolvedTarget,
    })

    dispatchPointerEvent("pointermove", { clientX: 10, clientY: 1, ctrlKey: true }, first)
    dispatchKeyboardEvent("keydown", "Control")
    await flushConfigAndFrame()
    await vi.advanceTimersByTimeAsync(125)
    resolvedTarget = second
    await vi.advanceTimersByTimeAsync(125)
    expect(onTriggerElement).not.toHaveBeenCalled()

    resolvedTarget = first
    dispatchPointerEvent("pointermove", { clientX: 10, clientY: 1, ctrlKey: true }, first)
    await flushConfigAndFrame()
    document.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true, relatedTarget: null }))
    await vi.advanceTimersByTimeAsync(250)
    expect(onTriggerElement).not.toHaveBeenCalled()

    dispatchPointerEvent("pointermove", { clientX: 10, clientY: 1, ctrlKey: true }, first)
    await flushConfigAndFrame()
    await vi.advanceTimersByTimeAsync(250)
    expect(onTriggerElement).toHaveBeenCalledWith(first, expect.anything())
  })

  it("cancels a quick tap, keyup, second key, mousedown and blur", async () => {
    const target = createTarget("first", 10)
    const onTriggerElement = vi.fn()
    const setup = () => {
      teardown = registerNodeTranslationTriggerListeners({
        getConfig: () => Promise.resolve(createConfig("control")),
        onTriggerElement,
        resolveTarget: point => targetByX.get(point.x) ?? null,
      })
      dispatchPointerEvent("pointermove", { clientX: 10, clientY: 1 }, target)
      dispatchKeyboardEvent("keydown", "Control")
    }
    const reset = () => {
      teardown?.()
      teardown = null
    }

    setup()
    await flushConfigAndFrame()
    dispatchKeyboardEvent("keyup", "Control")
    await vi.advanceTimersByTimeAsync(250)
    expect(onTriggerElement).not.toHaveBeenCalled()
    reset()

    setup()
    await flushConfigAndFrame()
    dispatchKeyboardEvent("keydown", "a")
    await vi.advanceTimersByTimeAsync(250)
    expect(onTriggerElement).not.toHaveBeenCalled()
    reset()

    setup()
    await flushConfigAndFrame()
    dispatchPointerEvent("mousedown", { button: 0, clientX: 10, clientY: 1 }, target)
    await vi.advanceTimersByTimeAsync(250)
    expect(onTriggerElement).not.toHaveBeenCalled()
    reset()

    setup()
    await flushConfigAndFrame()
    window.dispatchEvent(new Event("blur"))
    await vi.advanceTimersByTimeAsync(250)
    expect(onTriggerElement).not.toHaveBeenCalled()
  })

  it("ignores editable targets and effective text selections", async () => {
    const target = createTarget("first", 10)
    const input = document.createElement("input")
    document.body.append(input)
    const onTriggerElement = vi.fn()
    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("control")),
      onTriggerElement,
      resolveTarget: point => targetByX.get(point.x) ?? null,
    })

    dispatchPointerEvent("pointermove", { clientX: 10, clientY: 1, ctrlKey: true }, target)
    dispatchKeyboardEvent("keydown", "Control", input)
    await vi.advanceTimersByTimeAsync(250)
    expect(onTriggerElement).not.toHaveBeenCalled()

    const range = document.createRange()
    range.selectNodeContents(target)
    window.getSelection()?.addRange(range)
    dispatchKeyboardEvent("keydown", "Control")
    await vi.advanceTimersByTimeAsync(250)
    expect(onTriggerElement).not.toHaveBeenCalled()
  })

  it("does not trigger twice for key repeat and handles custom hotkeys", async () => {
    const target = createTarget("first", 10)
    const onTriggerElement = vi.fn()
    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("alt")),
      onTriggerElement,
      resolveTarget: point => targetByX.get(point.x) ?? null,
    })

    dispatchPointerEvent("pointermove", { clientX: 10, clientY: 1 }, target)
    dispatchKeyboardEvent("keydown", "Alt")
    dispatchKeyboardEvent("keydown", "Alt", document, true)
    await flushConfigAndFrame()
    await vi.advanceTimersByTimeAsync(250)
    expect(onTriggerElement).toHaveBeenCalledTimes(1)
  })

  it("keeps idle pointer movement cheap and defers selection and target resolution", async () => {
    const target = createTarget("first", 10)
    const resolveTarget = vi.fn(() => target)
    const getConfig = vi.fn(() => Promise.resolve(createConfig("control")))
    const selection = window.getSelection()!
    const selectionText = vi.spyOn(selection, "toString")
    teardown = registerNodeTranslationTriggerListeners({
      getConfig,
      onTriggerElement: vi.fn(),
      resolveTarget,
    })

    dispatchPointerEvent("pointermove", { clientX: 10, clientY: 1 }, target)
    dispatchPointerEvent("mousemove", { clientX: 10, clientY: 1 }, target)
    expect(getConfig).not.toHaveBeenCalled()
    expect(resolveTarget).not.toHaveBeenCalled()
    expect(selectionText).not.toHaveBeenCalled()

    dispatchKeyboardEvent("keydown", "Control")
    await flushConfigAndFrame()
    expect(resolveTarget).toHaveBeenCalled()
    expect(selectionText).not.toHaveBeenCalled()
  })

  it("rebuilds the pointer gate after blur and recovers from a lost keyup", async () => {
    const target = createTarget("first", 10)
    const onTriggerElement = vi.fn()
    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("control")),
      onTriggerElement,
      resolveTarget: point => targetByX.get(point.x) ?? null,
    })

    dispatchPointerEvent("pointermove", { clientX: 10, clientY: 1 }, target)
    dispatchKeyboardEvent("keydown", "Control")
    await flushConfigAndFrame()
    window.dispatchEvent(new Event("blur"))
    vi.spyOn(document, "querySelectorAll").mockImplementation((selector) => {
      if (selector === ":hover") {
        const hoveredElements = [document.documentElement, document.body, target]
        return {
          length: hoveredElements.length,
          item: (index: number) => hoveredElements[index] ?? null,
        } as unknown as NodeListOf<Element>
      }
      return [] as unknown as NodeListOf<Element>
    })
    window.dispatchEvent(new Event("focus"))
    dispatchKeyboardEvent("keydown", "Control")
    await flushConfigAndFrame()
    await vi.advanceTimersByTimeAsync(250)
    expect(onTriggerElement).toHaveBeenCalledTimes(1)

    dispatchKeyboardEvent("keydown", "Control")
    await flushConfigAndFrame()
    await vi.advanceTimersByTimeAsync(200)
    dispatchKeyboardEvent("keydown", "Control")
    await flushConfigAndFrame()
    await vi.advanceTimersByTimeAsync(249)
    expect(onTriggerElement).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(onTriggerElement).toHaveBeenCalledTimes(2)
  })

  it("resolves the newly hovered target after blur and focus", async () => {
    const first = createTarget("first", 10)
    const second = createTarget("second", 20)
    second.getBoundingClientRect = vi.fn(() => ({
      x: 20,
      y: 0,
      top: 0,
      left: 19.5,
      right: 20.5,
      bottom: 1,
      width: 1,
      height: 1,
      toJSON: () => ({}),
    }))
    const onTriggerElement = vi.fn()
    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("control")),
      onTriggerElement,
      resolveTarget: point => targetByX.get(point.x) ?? null,
    })

    dispatchPointerEvent("pointermove", { clientX: 10, clientY: 1 }, first)
    dispatchKeyboardEvent("keydown", "Control", document, false, { ctrlKey: true })
    await flushConfigAndFrame()
    window.dispatchEvent(new Event("blur"))
    vi.spyOn(document, "querySelectorAll").mockImplementation((selector) => {
      if (selector === ":hover") {
        const hoveredElements = [document.documentElement, document.body, second]
        return {
          length: hoveredElements.length,
          item: (index: number) => hoveredElements[index] ?? null,
        } as unknown as NodeListOf<Element>
      }
      return [] as unknown as NodeListOf<Element>
    })
    window.dispatchEvent(new Event("focus"))
    dispatchKeyboardEvent("keydown", "Control", document, false, { ctrlKey: true })
    await flushConfigAndFrame()
    await vi.advanceTimersByTimeAsync(250)

    expect(onTriggerElement).toHaveBeenCalledTimes(1)
    expect(onTriggerElement).toHaveBeenCalledWith(second, expect.anything())
  })

  it("does not arm Control while Alt is held", async () => {
    const target = createTarget("first", 10)
    const onTriggerElement = vi.fn()
    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("control")),
      onTriggerElement,
      resolveTarget: point => targetByX.get(point.x) ?? null,
    })

    dispatchPointerEvent("pointermove", { clientX: 10, clientY: 1 }, target)
    dispatchKeyboardEvent("keydown", "Alt", document, false, { altKey: true })
    await flushConfigAndFrame()
    dispatchKeyboardEvent("keydown", "Control", document, false, { ctrlKey: true, altKey: true })
    await flushConfigAndFrame()
    await vi.advanceTimersByTimeAsync(250)

    expect(onTriggerElement).not.toHaveBeenCalled()
  })

  it("cancels an armed Control session when Shift joins", async () => {
    const target = createTarget("first", 10)
    const onTriggerElement = vi.fn()
    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("control")),
      onTriggerElement,
      resolveTarget: point => targetByX.get(point.x) ?? null,
    })

    dispatchPointerEvent("pointermove", { clientX: 10, clientY: 1 }, target)
    dispatchKeyboardEvent("keydown", "Control", document, false, { ctrlKey: true })
    await flushConfigAndFrame()
    await vi.advanceTimersByTimeAsync(200)
    dispatchKeyboardEvent("keydown", "Shift", document, false, { ctrlKey: true, shiftKey: true })
    await vi.advanceTimersByTimeAsync(250)

    expect(onTriggerElement).not.toHaveBeenCalled()
  })

  it("clears a stale Alt modifier when a fresh Control keydown reports Alt up", async () => {
    const target = createTarget("first", 10)
    const onTriggerElement = vi.fn()
    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("control")),
      onTriggerElement,
      resolveTarget: point => targetByX.get(point.x) ?? null,
    })

    dispatchPointerEvent("pointermove", { clientX: 10, clientY: 1 }, target)
    dispatchKeyboardEvent("keydown", "Alt", document, false, { altKey: true })
    await flushConfigAndFrame()
    dispatchKeyboardEvent("keydown", "Control", document, false, { ctrlKey: true, altKey: false })
    await flushConfigAndFrame()
    await vi.advanceTimersByTimeAsync(250)

    expect(onTriggerElement).toHaveBeenCalledTimes(1)
  })

  it("clears physical keys on blur before a later activation", async () => {
    const target = createTarget("first", 10)
    const onTriggerElement = vi.fn()
    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("control")),
      onTriggerElement,
      resolveTarget: point => targetByX.get(point.x) ?? null,
    })

    dispatchPointerEvent("pointermove", { clientX: 10, clientY: 1 }, target)
    dispatchKeyboardEvent("keydown", "Alt", document, false, { altKey: true })
    await flushConfigAndFrame()
    window.dispatchEvent(new Event("blur"))
    dispatchPointerEvent("pointermove", { clientX: 10, clientY: 1 }, target)
    dispatchKeyboardEvent("keydown", "Control", document, false, { ctrlKey: true })
    await flushConfigAndFrame()
    await vi.advanceTimersByTimeAsync(250)

    expect(onTriggerElement).toHaveBeenCalledTimes(1)
  })

  it("rejects Control when Alt remains active across blur", async () => {
    const target = createTarget("first", 10)
    const onTriggerElement = vi.fn()
    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("control")),
      onTriggerElement,
      resolveTarget: point => targetByX.get(point.x) ?? null,
    })

    dispatchPointerEvent("pointermove", { clientX: 10, clientY: 1 }, target)
    dispatchKeyboardEvent("keydown", "Alt", document, false, { altKey: true })
    await flushConfigAndFrame()
    window.dispatchEvent(new Event("blur"))
    dispatchPointerEvent("pointermove", { clientX: 10, clientY: 1 }, target)
    dispatchKeyboardEvent("keydown", "Control", document, false, { ctrlKey: true, altKey: true })
    await flushConfigAndFrame()
    await vi.advanceTimersByTimeAsync(250)

    expect(onTriggerElement).not.toHaveBeenCalled()
  })

  it("rechecks dynamic ignore state before keyboard and click timers fire", async () => {
    const target = createTarget("first", 10)
    let ignored = false
    const onTriggerElement = vi.fn()
    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("control")),
      onTriggerElement,
      shouldIgnoreEvent: () => ignored,
      resolveTarget: point => targetByX.get(point.x) ?? null,
    })

    dispatchPointerEvent("pointermove", { clientX: 10, clientY: 1 }, target)
    dispatchKeyboardEvent("keydown", "Control")
    await flushConfigAndFrame()
    ignored = true
    await vi.advanceTimersByTimeAsync(250)
    expect(onTriggerElement).not.toHaveBeenCalled()

    ignored = false
    dispatchPointerEvent("pointermove", { clientX: 10, clientY: 1, ctrlKey: true }, target)
    await flushConfigAndFrame()
    await vi.advanceTimersByTimeAsync(250)
    expect(onTriggerElement).toHaveBeenCalledTimes(1)
  })

  it("does not use stale coordinates after pointer leaves the document", async () => {
    const target = createTarget("first", 10)
    const onTriggerElement = vi.fn()
    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("control")),
      onTriggerElement,
      resolveTarget: point => targetByX.get(point.x) ?? null,
    })

    dispatchPointerEvent("pointermove", { clientX: 10, clientY: 1 }, target)
    document.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true, relatedTarget: null }))
    dispatchKeyboardEvent("keydown", "Control")
    await flushConfigAndFrame()
    await vi.advanceTimersByTimeAsync(250)

    expect(onTriggerElement).not.toHaveBeenCalled()
  })

  it("rebuilds an active lost-keyup session when the key is pressed again", async () => {
    const first = createTarget("first", 10)
    const second = createTarget("second", 20)
    const onTriggerElement = vi.fn()
    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("control")),
      onTriggerElement,
      resolveTarget: point => targetByX.get(point.x) ?? null,
    })

    dispatchPointerEvent("pointermove", { clientX: 10, clientY: 1 }, first)
    dispatchKeyboardEvent("keydown", "Control")
    await flushConfigAndFrame()
    await vi.advanceTimersByTimeAsync(200)

    dispatchKeyboardEvent("keydown", "Control")
    dispatchPointerEvent("pointermove", { clientX: 20, clientY: 1, ctrlKey: true }, second)
    await flushConfigAndFrame()
    await vi.advanceTimersByTimeAsync(250)

    expect(onTriggerElement).toHaveBeenCalledTimes(1)
    expect(onTriggerElement).toHaveBeenCalledWith(second, expect.anything())
  })

  it("clears stale conflict keys before a new activation keydown", async () => {
    const target = createTarget("first", 10)
    const onTriggerElement = vi.fn()
    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("control")),
      onTriggerElement,
      resolveTarget: point => targetByX.get(point.x) ?? null,
    })

    dispatchPointerEvent("pointermove", { clientX: 10, clientY: 1 }, target)
    dispatchKeyboardEvent("keydown", "a")
    await flushConfigAndFrame()
    dispatchKeyboardEvent("keyup", "a")
    dispatchKeyboardEvent("keydown", "Control")
    await flushConfigAndFrame()
    await vi.advanceTimersByTimeAsync(250)

    expect(onTriggerElement).toHaveBeenCalledTimes(1)
  })

  it("does not fire a dwell timer when the document becomes hidden", async () => {
    const target = createTarget("first", 10)
    const onTriggerElement = vi.fn()
    const originalHidden = Object.getOwnPropertyDescriptor(document, "hidden")
    Object.defineProperty(document, "hidden", { configurable: true, value: false })
    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("control")),
      onTriggerElement,
      resolveTarget: point => targetByX.get(point.x) ?? null,
    })

    dispatchPointerEvent("pointermove", { clientX: 10, clientY: 1 }, target)
    dispatchKeyboardEvent("keydown", "Control")
    await flushConfigAndFrame()
    Object.defineProperty(document, "hidden", { configurable: true, value: true })
    await vi.advanceTimersByTimeAsync(250)
    expect(onTriggerElement).not.toHaveBeenCalled()

    Object.defineProperty(document, "hidden", { configurable: true, value: false })
    originalHidden
      ? Object.defineProperty(document, "hidden", originalHidden)
      : Reflect.deleteProperty(document, "hidden")
  })

  it("rechecks dynamic gates before click-and-hold fires", async () => {
    const target = createTarget("first", 30)
    let ignored = false
    const onTrigger = vi.fn()
    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("clickAndHold")),
      onTrigger,
      shouldIgnoreEvent: () => ignored,
      resolveTarget: point => targetByX.get(point.x) ?? null,
    })

    dispatchPointerEvent("mousedown", { button: 0, clientX: 30, clientY: 40 }, target)
    await flushConfigAndFrame()
    ignored = true
    await vi.advanceTimersByTimeAsync(250)
    expect(onTrigger).not.toHaveBeenCalled()

    ignored = false
    dispatchPointerEvent("mousedown", { button: 0, clientX: 30, clientY: 40 }, target)
    await flushConfigAndFrame()
    await vi.advanceTimersByTimeAsync(250)
    expect(onTrigger).toHaveBeenCalledTimes(1)
  })

  it("drops late config results after keyup and clears timers on teardown", async () => {
    let resolveConfig!: (config: Config) => void
    const getConfig = vi.fn(() => new Promise<Config>((resolve) => {
      resolveConfig = resolve
    }))
    const target = createTarget("first", 10)
    const onTriggerElement = vi.fn()
    teardown = registerNodeTranslationTriggerListeners({
      getConfig,
      onTriggerElement,
      resolveTarget: point => targetByX.get(point.x) ?? null,
    })

    dispatchPointerEvent("pointermove", { clientX: 10, clientY: 1 }, target)
    dispatchKeyboardEvent("keydown", "Control")
    dispatchKeyboardEvent("keyup", "Control")
    resolveConfig(createConfig("control"))
    await flushConfigAndFrame()
    await vi.advanceTimersByTimeAsync(250)
    expect(onTriggerElement).not.toHaveBeenCalled()

    dispatchKeyboardEvent("keydown", "Control")
    resolveConfig(createConfig("control"))
    await flushConfigAndFrame()
    teardown()
    expect(vi.getTimerCount()).toBe(0)
  })

  it("keeps click-and-hold behavior", async () => {
    const target = createTarget("first", 30)
    const onTrigger = vi.fn()
    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("clickAndHold")),
      onTrigger,
      resolveTarget: point => targetByX.get(point.x) ?? null,
    })

    dispatchPointerEvent("mousedown", { button: 0, clientX: 30, clientY: 40 }, target)
    await flushConfigAndFrame()
    await vi.advanceTimersByTimeAsync(249)
    expect(onTrigger).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(onTrigger).toHaveBeenCalledWith({ x: 30, y: 40 }, expect.anything())
  })
})
