// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { afterEach, describe, expect, it, vi } from "vitest"
import { registerNodeTranslationTriggers } from "../node-translation"

const mocks = vi.hoisted(() => ({
  getLocalConfig: vi.fn(),
  removeOrShowNodeTranslation: vi.fn(),
}))

vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: mocks.getLocalConfig,
}))

vi.mock("@/utils/host/translate/node-manipulation", () => ({
  removeOrShowNodeTranslation: mocks.removeOrShowNodeTranslation,
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

function dispatchMouseEvent(type: "mousemove" | "mouseover", init: MouseEventInit) {
  document.dispatchEvent(new MouseEvent(type, { bubbles: true, ...init }))
}

async function triggerBacktickNodeTranslation() {
  dispatchMouseEvent("mousemove", { clientX: 15, clientY: 25 })
  dispatchKeyboardEvent("keydown", "`")
  await Promise.resolve()
  dispatchKeyboardEvent("keyup", "`")
}

describe("registerNodeTranslationTriggers", () => {
  let teardown: (() => void) | null = null

  afterEach(() => {
    teardown?.()
    teardown = null
    vi.clearAllMocks()
  })

  it("runs node translation for the current pointer position", async () => {
    mocks.getLocalConfig.mockResolvedValue(createConfig())
    mocks.removeOrShowNodeTranslation.mockResolvedValue(true)
    teardown = registerNodeTranslationTriggers()

    await triggerBacktickNodeTranslation()

    await vi.waitFor(() => {
      expect(mocks.removeOrShowNodeTranslation).toHaveBeenCalledWith(
        { x: 15, y: 25 },
        expect.objectContaining({
          translate: expect.objectContaining({
            node: expect.objectContaining({ enabled: true }),
          }),
        }),
      )
    })
  })

  it("continues to handle repeated node translation triggers", async () => {
    mocks.getLocalConfig.mockResolvedValue(createConfig())
    mocks.removeOrShowNodeTranslation.mockResolvedValue(true)
    teardown = registerNodeTranslationTriggers()

    await triggerBacktickNodeTranslation()
    await triggerBacktickNodeTranslation()

    await vi.waitFor(() => {
      expect(mocks.removeOrShowNodeTranslation).toHaveBeenCalledTimes(2)
    })
  })
})
