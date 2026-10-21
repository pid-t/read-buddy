// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  CONTENT_WRAPPER_CLASS,
  TRANSLATION_MODE_ATTRIBUTE,
} from "@/utils/constants/dom-labels"
import { flushBatchedOperations } from "@/utils/host/dom/batch-dom"
import { extractTextContent, walkAndLabelElement } from "@/utils/host/dom/traversal"
import { collectSmartRegions, createSmartFilterDecision, createSmartFilterPageState } from "@/utils/host/smart-filter"
import { originalContentMap } from "@/utils/host/translate/core/translation-state"
import { removeAllTranslatedWrapperNodes, translateWalkedElement } from "@/utils/host/translate/node-manipulation"

vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: vi.fn(() => Promise.resolve(DEFAULT_CONFIG)),
}))

vi.mock("@/utils/host/translate/translate-variants", () => ({
  translateTextForPage: vi.fn(() => Promise.resolve("translation")),
}))

const TRANSLATION_ONLY_CONFIG: Config = {
  ...DEFAULT_CONFIG,
  translate: {
    ...DEFAULT_CONFIG.translate,
    mode: "translationOnly",
  },
}

function getRegionIdForNode(collection: ReturnType<typeof collectSmartRegions>, node: HTMLElement): string {
  for (const [id, mappedNode] of collection.nodeById) {
    if (mappedNode === node)
      return id
  }
  throw new Error("node was not collected as a region")
}

describe("translation-only smart filter compatibility", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    originalContentMap.clear()
  })

  it("falls back to bilingual for mixed units while normal units stay translation-only", async () => {
    document.body.innerHTML = `
      <div id="mixed-container">
        <p id="mixed">Readable text <span id="nav-marker"></span></p>
      </div>
      <div id="plain-container">
        <p id="plain">Plain body</p>
      </div>
    `

    const mixed = document.getElementById("mixed")!
    const nav = document.createElement("div")
    nav.id = "nav"
    nav.textContent = "Home"
    mixed.replaceChild(nav, document.getElementById("nav-marker")!)

    const plain = document.getElementById("plain")!
    const navClicks = vi.fn()
    nav.addEventListener("click", navClicks)

    const collection = collectSmartRegions(document.body, TRANSLATION_ONLY_CONFIG)
    const navRegionId = getRegionIdForNode(collection, nav)
    const decision = createSmartFilterDecision(collection, { skipIds: [navRegionId] })
    const smartFilter = createSmartFilterPageState({ decision })

    expect(extractTextContent(mixed, TRANSLATION_ONLY_CONFIG, smartFilter).trim()).toBe("Readable text")

    const walkId = "smart-filter-walk"
    walkAndLabelElement(document.body, walkId, TRANSLATION_ONLY_CONFIG)

    await translateWalkedElement(mixed, walkId, TRANSLATION_ONLY_CONFIG, false, smartFilter)
    await translateWalkedElement(plain, walkId, TRANSLATION_ONLY_CONFIG, false, smartFilter)
    flushBatchedOperations()

    const mixedWrapper = mixed.querySelector(`.${CONTENT_WRAPPER_CLASS}`)
    expect(mixedWrapper).toHaveAttribute(TRANSLATION_MODE_ATTRIBUTE, "bilingual")
    expect(mixedWrapper).toHaveTextContent("translation")
    expect(document.getElementById("nav")).toBe(nav)
    expect(nav.textContent).toBe("Home")

    const plainWrapper = plain.querySelector(`.${CONTENT_WRAPPER_CLASS}`)
    expect(plainWrapper).toHaveAttribute(TRANSLATION_MODE_ATTRIBUTE, "translationOnly")
    expect(plainWrapper).toHaveTextContent("translation")

    nav.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    expect(navClicks).toHaveBeenCalledTimes(1)

    removeAllTranslatedWrapperNodes()
    flushBatchedOperations()
    expect(document.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeNull()
    expect(document.getElementById("nav")).toBe(nav)
    expect(nav.textContent).toBe("Home")
    expect(document.getElementById("mixed")).toHaveTextContent("Readable text")
    expect(document.getElementById("plain-container")).toHaveTextContent("Plain body")

    nav.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    expect(navClicks).toHaveBeenCalledTimes(2)
  })
})
