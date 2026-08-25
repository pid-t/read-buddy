// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { afterEach, describe, expect, it, vi } from "vitest"
import { registerNodeTranslationTriggers } from "../node-translation"

const mocks = vi.hoisted(() => ({
  getLocalConfig: vi.fn(),
  removeOrShowNodeTranslationAtElement: vi.fn(),
  registerNodeTranslationTriggerListeners: vi.fn(),
}))

vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: mocks.getLocalConfig,
}))

vi.mock("@/utils/host/translate/node-manipulation", () => ({
  removeOrShowNodeTranslationAtElement: mocks.removeOrShowNodeTranslationAtElement,
}))

vi.mock("../node-translation-trigger", () => ({
  registerNodeTranslationTriggerListeners: mocks.registerNodeTranslationTriggerListeners,
}))

function createConfig(): Config {
  return {
    translate: {
      node: {
        enabled: true,
        hotkey: "control",
      },
    },
  } as Config
}

describe("registerNodeTranslationTriggers adapter", () => {
  let teardown: (() => void) | null = null
  let listenerOptions: {
    onTriggerElement?: (element: HTMLElement, config: Config) => void | Promise<void>
  } | null = null

  afterEach(() => {
    teardown?.()
    teardown = null
    listenerOptions = null
    vi.clearAllMocks()
  })

  it("passes the locked element directly and preserves callback rejection", async () => {
    const target = document.createElement("p")
    const config = createConfig()
    const error = new Error("translation failed")
    mocks.getLocalConfig.mockResolvedValue(config)
    mocks.removeOrShowNodeTranslationAtElement.mockRejectedValue(error)
    mocks.registerNodeTranslationTriggerListeners.mockImplementation((options) => {
      listenerOptions = options
      return vi.fn()
    })

    teardown = registerNodeTranslationTriggers()

    expect(listenerOptions?.onTriggerElement).toBeTypeOf("function")
    await expect(listenerOptions!.onTriggerElement!(target, config)).rejects.toThrow(error)
    expect(mocks.removeOrShowNodeTranslationAtElement).toHaveBeenCalledWith(target, config)
  })
})
