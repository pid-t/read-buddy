/** @vitest-environment jsdom */
import type { Config } from "@/types/config/config"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { SelectionController } from "../selection-controller"

function selectText(text: string) {
  document.body.innerHTML = `<p>${text}</p>`
  const paragraph = document.querySelector("p")!
  const selection = window.getSelection()!
  const range = document.createRange()
  range.selectNodeContents(paragraph)
  selection.removeAllRanges()
  selection.addRange(range)
}

describe("selection controller", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(Range.prototype, "getClientRects", {
      configurable: true,
      value: () => [{ left: 100, top: 100, right: 200, bottom: 120, width: 100, height: 20 }],
    })
  })

  it("shows a ready state for a detected non-target selection", async () => {
    selectText("Hello world")
    const states: string[] = []
    const config: Config = DEFAULT_CONFIG
    const controller = new SelectionController({
      config,
      document,
      window,
      detectLanguage: vi.fn().mockResolvedValue({ code: "eng", source: "franc" }),
      onStateChange: state => states.push(state.status),
    })

    controller.start()
    await vi.runAllTimersAsync()

    expect(controller.getState().status).toBe("ready")
    expect(states).toContain("detecting")
    controller.stop()
    vi.useRealTimers()
  })

  it("waits for pointerup before exposing a pointer-created selection", async () => {
    window.getSelection()?.removeAllRanges()
    const controller = new SelectionController({
      config: DEFAULT_CONFIG,
      document,
      window,
      detectLanguage: vi.fn().mockResolvedValue({ code: "eng", source: "franc" }),
    })

    controller.start()
    await vi.runAllTimersAsync()

    document.dispatchEvent(new Event("pointerdown", { bubbles: true }))
    selectText("hold the pointer while selecting")
    document.dispatchEvent(new Event("selectionchange"))
    await vi.advanceTimersByTimeAsync(120)
    await vi.runAllTimersAsync()

    expect(controller.getState().status).toBe("idle")

    document.dispatchEvent(new Event("pointerup", { bubbles: true }))
    await vi.runAllTimersAsync()

    expect(controller.getState().status).toBe("ready")
    controller.stop()
    vi.useRealTimers()
  })

  it("ignores a language result from an older selection session", async () => {
    const firstDetection = Promise.withResolvers<{ code: "eng", source: "franc" }>()
    const detectLanguage = vi.fn()
      .mockReturnValueOnce(firstDetection.promise)
      .mockResolvedValue({ code: "fra", source: "franc" })
    const controller = new SelectionController({
      config: DEFAULT_CONFIG,
      document,
      window,
      detectLanguage,
    })

    selectText("first selection")
    controller.start()
    await vi.runAllTimersAsync()

    selectText("deuxième sélection")
    document.dispatchEvent(new Event("selectionchange"))
    await vi.advanceTimersByTimeAsync(120)
    await vi.runAllTimersAsync()
    const nextState = controller.getState()
    expect(nextState.status).toBe("ready")
    if (nextState.status === "ready")
      expect(nextState.session.text).toContain("deuxième")

    firstDetection.resolve({ code: "eng", source: "franc" })
    await Promise.resolve()
    const finalState = controller.getState()
    expect(finalState.status).toBe("ready")
    if (finalState.status === "ready")
      expect(finalState.session.text).toContain("deuxième")
    controller.stop()
    vi.useRealTimers()
  })

  it("keeps the button available when language detection rejects", async () => {
    selectText("language detection failure")
    const controller = new SelectionController({
      config: DEFAULT_CONFIG,
      document,
      window,
      detectLanguage: vi.fn().mockRejectedValue(new Error("detector unavailable")),
    })

    controller.start()
    await vi.runAllTimersAsync()

    expect(controller.getState().status).toBe("ready")
    controller.stop()
    vi.useRealTimers()
  })

  it("sends at most one translation request while a request is pending", async () => {
    selectText("translate this selection")
    const translation = Promise.withResolvers<string>()
    const translate = vi.fn().mockReturnValue(translation.promise)
    const controller = new SelectionController({
      config: DEFAULT_CONFIG,
      document,
      window,
      detectLanguage: vi.fn().mockResolvedValue({ code: "eng", source: "franc" }),
      translate,
    })

    controller.start()
    await vi.runAllTimersAsync()
    expect(controller.getState().status).toBe("ready")

    const firstRequest = controller.translateCurrent()
    const secondRequest = controller.translateCurrent()

    expect(translate).toHaveBeenCalledTimes(1)
    translation.resolve("translated")
    await Promise.all([firstRequest, secondRequest])
    expect(controller.getState().status).toBe("success")
    controller.stop()
    vi.useRealTimers()
  })

  it("keeps the session when a pointer event comes from the selection UI host", async () => {
    selectText("keep this selection")
    const controller = new SelectionController({
      config: DEFAULT_CONFIG,
      document,
      window,
      detectLanguage: vi.fn().mockResolvedValue({ code: "eng", source: "franc" }),
    })

    controller.start()
    await vi.runAllTimersAsync()
    expect(controller.getState().status).toBe("ready")

    const host = document.createElement("div")
    host.setAttribute("data-read-frog-selection-ui", "true")
    const shadowRoot = host.attachShadow({ mode: "open" })
    const button = document.createElement("button")
    shadowRoot.append(button)
    document.body.append(host)

    button.dispatchEvent(new Event("pointerdown", { bubbles: true, composed: true }))

    expect(controller.getState().status).toBe("ready")
    controller.stop()
    vi.useRealTimers()
  })
})
