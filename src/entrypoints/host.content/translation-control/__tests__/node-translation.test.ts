// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { registerNodeTranslationTriggers } from "../node-translation"

const mocks = vi.hoisted(() => ({
  getLocalConfig: vi.fn(),
  removeOrShowNodeTranslationAtElement: vi.fn(),
}))

vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: mocks.getLocalConfig,
}))

vi.mock("@/utils/host/translate/node-manipulation", () => ({
  removeOrShowNodeTranslationAtElement: mocks.removeOrShowNodeTranslationAtElement,
}))

function createConfig(): Config {
  return {
    translate: {
      node: {
        enabled: true,
        hotkey: "backtick",
      },
    },
  } as Config
}

function dispatchKeyboardEvent(type: "keydown" | "keyup", key: string) {
  document.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }))
}

function dispatchMouseEvent(type: "mousemove", init: MouseEventInit) {
  document.dispatchEvent(new MouseEvent(type, { bubbles: true, ...init }))
}

describe("registerNodeTranslationTriggers", () => {
  let teardown: (() => void) | null = null
  let originalElementFromPoint: typeof document.elementFromPoint

  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      const id = Math.floor(Math.random() * 10000)
      queueMicrotask(() => callback(performance.now()))
      return id
    })
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {})
    originalElementFromPoint = document.elementFromPoint
  })

  afterEach(() => {
    teardown?.()
    teardown = null
    document.elementFromPoint = originalElementFromPoint
    document.body.innerHTML = ""
    vi.clearAllMocks()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  async function triggerBacktickNodeTranslation(target: HTMLElement) {
    dispatchMouseEvent("mousemove", { clientX: 15, clientY: 25 })
    dispatchKeyboardEvent("keydown", "`")
    await Promise.resolve()
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(250)
    dispatchKeyboardEvent("keyup", "`")
    return target
  }

  it("runs node translation for the block element hovered at dwell start", async () => {
    const target = document.createElement("p")
    target.textContent = "source"
    document.body.append(target)
    document.elementFromPoint = vi.fn(() => target)
    mocks.getLocalConfig.mockResolvedValue(createConfig())
    mocks.removeOrShowNodeTranslationAtElement.mockResolvedValue(true)
    teardown = registerNodeTranslationTriggers()

    await triggerBacktickNodeTranslation(target)

    expect(mocks.removeOrShowNodeTranslationAtElement).toHaveBeenCalledWith(
      target,
      expect.objectContaining({
        translate: expect.objectContaining({
          node: expect.objectContaining({ enabled: true, hotkey: "backtick" }),
        }),
      }),
    )
  })

  it("continues to handle repeated independent node translation holds", async () => {
    const target = document.createElement("p")
    target.textContent = "source"
    document.body.append(target)
    document.elementFromPoint = vi.fn(() => target)
    mocks.getLocalConfig.mockResolvedValue(createConfig())
    mocks.removeOrShowNodeTranslationAtElement.mockResolvedValue(true)
    teardown = registerNodeTranslationTriggers()

    await triggerBacktickNodeTranslation(target)
    await triggerBacktickNodeTranslation(target)

    expect(mocks.removeOrShowNodeTranslationAtElement).toHaveBeenCalledTimes(2)
    expect(mocks.removeOrShowNodeTranslationAtElement).toHaveBeenNthCalledWith(
      2,
      target,
      expect.anything(),
    )
  })
})
