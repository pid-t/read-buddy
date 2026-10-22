// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  CONTENT_WRAPPER_CLASS,
  TRANSLATION_MODE_ATTRIBUTE,
} from "@/utils/constants/dom-labels"
import { flushBatchedOperations } from "@/utils/host/dom/batch-dom"
import { walkAndLabelElement } from "@/utils/host/dom/traversal"
import { originalContentMap } from "@/utils/host/translate/core/translation-state"
import { translateWalkedElement } from "@/utils/host/translate/node-manipulation"
import { translateTextForPage } from "@/utils/host/translate/translate-variants"

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

describe("inline smart filter translation", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    originalContentMap.clear()
    vi.mocked(translateTextForPage).mockReset()
    vi.mocked(translateTextForPage).mockResolvedValue("translation")
  })

  it("keeps mixed interactive units and skip results during inline filtering", async () => {
    document.body.innerHTML = `
      <p id="mixed">Readable <a id="link" href="#read">link</a></p>
      <p id="menu">Menu</p>
    `
    const mixed = document.getElementById("mixed")!
    const link = document.getElementById("link")!
    const menu = document.getElementById("menu")!
    const linkClicks = vi.fn()
    link.addEventListener("click", linkClicks)
    vi.mocked(translateTextForPage).mockImplementation(async text => text.includes("Menu") ? "" : "translation")

    const walkId = "inline-walk"
    walkAndLabelElement(document.body, walkId, TRANSLATION_ONLY_CONFIG)
    await translateWalkedElement(mixed, walkId, TRANSLATION_ONLY_CONFIG, false, true)
    await translateWalkedElement(menu, walkId, TRANSLATION_ONLY_CONFIG, false, true)
    flushBatchedOperations()

    const mixedWrapper = mixed.querySelector(`.${CONTENT_WRAPPER_CLASS}`)
    expect(mixedWrapper).toHaveAttribute(TRANSLATION_MODE_ATTRIBUTE, "bilingual")
    expect(document.getElementById("link")).toBe(link)
    expect(link.textContent).toBe("link")
    link.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    expect(linkClicks).toHaveBeenCalledTimes(1)
    expect(menu.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeNull()
    expect(menu.textContent).toBe("Menu")
    expect(translateTextForPage).toHaveBeenCalledWith(
      "Readable link",
      expect.objectContaining({
        inlineSmartFilter: expect.objectContaining({
          strategyVersion: 1,
          hint: expect.objectContaining({ tag: "p" }),
        }),
      }),
    )
  })

  it("drops a late inline result after the source unit changes", async () => {
    document.body.innerHTML = `<p id="late">Original body</p>`
    const paragraph = document.getElementById("late")!
    let resolveTranslation!: (translation: string) => void
    vi.mocked(translateTextForPage).mockImplementation(() => new Promise((resolve) => {
      resolveTranslation = resolve
    }))

    const walkId = "inline-late-walk"
    walkAndLabelElement(document.body, walkId, TRANSLATION_ONLY_CONFIG)
    const translation = translateWalkedElement(paragraph, walkId, TRANSLATION_ONLY_CONFIG, false, true)
    await new Promise(resolve => setTimeout(resolve, 0))
    await Promise.resolve()
    paragraph.textContent = "Changed body"
    resolveTranslation("late translation")
    await translation
    flushBatchedOperations()

    expect(paragraph.textContent).toBe("Changed body")
    expect(paragraph.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeNull()
  })

  it("keeps a valid inline translation for source text with surrounding whitespace", async () => {
    document.body.innerHTML = `<p id="spaced"> Hello world </p>`
    const paragraph = document.getElementById("spaced")!
    vi.mocked(translateTextForPage).mockResolvedValue("你好世界")

    const walkId = "inline-spaced-walk"
    walkAndLabelElement(document.body, walkId, TRANSLATION_ONLY_CONFIG)
    await translateWalkedElement(paragraph, walkId, TRANSLATION_ONLY_CONFIG, false, true)
    flushBatchedOperations()

    expect(paragraph.textContent).toBe("你好世界")
    expect(paragraph.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toHaveTextContent("你好世界")
  })

  it("drops a late inline result after source text is appended", async () => {
    document.body.innerHTML = `<p id="late-append">Original body</p>`
    const paragraph = document.getElementById("late-append")!
    let resolveTranslation!: (translation: string) => void
    vi.mocked(translateTextForPage).mockImplementation(() => new Promise((resolve) => {
      resolveTranslation = resolve
    }))

    const walkId = "inline-append-walk"
    walkAndLabelElement(document.body, walkId, TRANSLATION_ONLY_CONFIG)
    const translation = translateWalkedElement(paragraph, walkId, TRANSLATION_ONLY_CONFIG, false, true)
    await new Promise(resolve => setTimeout(resolve, 0))
    await Promise.resolve()
    paragraph.append(" Updated body")
    resolveTranslation("stale translation")
    await translation
    flushBatchedOperations()

    expect(paragraph.textContent).toBe("Original body Updated body")
    expect(paragraph.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeNull()
  })

  it("drops a late inline result after a source node is replaced", async () => {
    document.body.innerHTML = `<p id="late-replace">Original <span id="part">body</span></p>`
    const paragraph = document.getElementById("late-replace")!
    let resolveTranslation!: (translation: string) => void
    vi.mocked(translateTextForPage).mockImplementation(() => new Promise((resolve) => {
      resolveTranslation = resolve
    }))

    const walkId = "inline-replace-walk"
    walkAndLabelElement(document.body, walkId, TRANSLATION_ONLY_CONFIG)
    const translation = translateWalkedElement(paragraph, walkId, TRANSLATION_ONLY_CONFIG, false, true)
    await new Promise(resolve => setTimeout(resolve, 0))
    await Promise.resolve()
    paragraph.replaceChild(document.createTextNode("Original "), paragraph.firstChild!)
    resolveTranslation("stale translation")
    await translation
    flushBatchedOperations()

    expect(paragraph.textContent).toBe("Original body")
    expect(paragraph.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeNull()
  })

  it("keeps concurrent inline units when a sibling unit finishes first", async () => {
    document.body.innerHTML = `<div id="mixed-units">Intro body<p>Child body</p>Outro body</div>`
    const container = document.getElementById("mixed-units")!
    const deferreds = new Map<string, { promise: Promise<string>, resolve: (translation: string) => void }>()
    vi.mocked(translateTextForPage).mockImplementation((text) => {
      let resolveTranslation!: (translation: string) => void
      const promise = new Promise<string>((resolve) => {
        resolveTranslation = resolve
      })
      deferreds.set(text, { promise, resolve: resolveTranslation })
      return promise
    })

    const walkId = "inline-concurrent-walk"
    walkAndLabelElement(document.body, walkId, TRANSLATION_ONLY_CONFIG)
    const translation = translateWalkedElement(container, walkId, TRANSLATION_ONLY_CONFIG, false, true)
    while (deferreds.size < 3)
      await new Promise(resolve => setTimeout(resolve, 0))

    deferreds.get("Child body")!.resolve("Child translation")
    await new Promise(resolve => setTimeout(resolve, 0))
    flushBatchedOperations()
    deferreds.get("Intro body")!.resolve("Intro translation")
    deferreds.get("Outro body")!.resolve("Outro translation")
    await translation
    flushBatchedOperations()

    expect(container.textContent).toBe("Intro translationChild translationOutro translation")
    expect([...container.querySelectorAll(`.${CONTENT_WRAPPER_CLASS}`)].map(node => node.textContent)).toEqual([
      "Intro translation",
      "Child translation",
      "Outro translation",
    ])
    expect(container.querySelector(".read-frog-loading-skeleton")).toBeNull()
  })

  it("drops a late inline result when a new text node joins the mixed unit boundary", async () => {
    document.body.innerHTML = `<div id="mixed-boundary">Intro body<p>Child body</p>Outro body</div>`
    const container = document.getElementById("mixed-boundary")!
    const paragraph = container.querySelector("p")!
    const deferreds = new Map<string, { promise: Promise<string>, resolve: (translation: string) => void }>()
    vi.mocked(translateTextForPage).mockImplementation((text) => {
      let resolveTranslation!: (translation: string) => void
      const promise = new Promise<string>((resolve) => {
        resolveTranslation = resolve
      })
      deferreds.set(text, { promise, resolve: resolveTranslation })
      return promise
    })

    const walkId = "inline-boundary-walk"
    walkAndLabelElement(document.body, walkId, TRANSLATION_ONLY_CONFIG)
    const translation = translateWalkedElement(container, walkId, TRANSLATION_ONLY_CONFIG, false, true)
    while (deferreds.size < 3)
      await new Promise(resolve => setTimeout(resolve, 0))
    flushBatchedOperations()
    expect(container.querySelector(".read-frog-loading-skeleton")).not.toBeNull()

    container.insertBefore(document.createTextNode(" Updated body"), paragraph)
    deferreds.get("Intro body")!.resolve("stale translation")
    deferreds.get("Child body")!.resolve("Child translation")
    deferreds.get("Outro body")!.resolve("Outro translation")
    await translation
    flushBatchedOperations()

    expect(container.textContent).toBe("Intro body Updated bodyChild translationOutro translation")
    expect(container.textContent).not.toContain("stale translation")
    expect(container.querySelector(".read-frog-loading-skeleton")).toBeNull()
  })
})
