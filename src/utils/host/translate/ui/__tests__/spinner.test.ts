// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"

const { ensurePresetStylesMock, translateTextForPageMock } = vi.hoisted(() => ({
  ensurePresetStylesMock: vi.fn(),
  translateTextForPageMock: vi.fn(),
}))

vi.mock("@/utils/host/translate/ui/style-injector", () => ({
  ensurePresetStyles: ensurePresetStylesMock,
}))

vi.mock("@/utils/host/translate/translate-variants", () => ({
  translateTextForPage: translateTextForPageMock,
}))

describe("spinner", () => {
  beforeEach(() => {
    document.head.innerHTML = ""
    document.body.innerHTML = ""
    document.documentElement.style.cssText = ""
    document.body.style.cssText = ""
    Object.defineProperty(window, "matchMedia", {
      value: undefined,
      configurable: true,
      writable: true,
    })
    ensurePresetStylesMock.mockReset()
    translateTextForPageMock.mockReset()
    vi.restoreAllMocks()
  })

  it("ensures preset styles on the document before appending the spinner", async () => {
    const wrapper = document.createElement("span")
    document.body.appendChild(wrapper)

    ensurePresetStylesMock.mockImplementation((root: Document | ShadowRoot) => {
      expect(root).toBe(document)
      expect(wrapper.querySelector(".read-frog-loading-skeleton")).toBeNull()

      const style = document.createElement("style")
      style.id = "read-frog-preset-styles"
      document.head.appendChild(style)
    })

    const { createSpinnerInside } = await import("../spinner")
    const spinner = createSpinnerInside(wrapper)

    expect(ensurePresetStylesMock).toHaveBeenCalledOnce()
    expect(document.head.querySelector("#read-frog-preset-styles")).not.toBeNull()
    expect(wrapper.lastElementChild).toBe(spinner)
    expect(spinner.className).toBe("read-frog-loading-skeleton")
    expect(spinner.querySelectorAll(".read-frog-loading-skeleton-line")).toHaveLength(1)
  })

  it("ensures preset styles on the containing shadow root before appending the spinner", async () => {
    const host = document.createElement("div")
    const shadow = host.attachShadow({ mode: "open" })
    const wrapper = document.createElement("span")
    shadow.appendChild(wrapper)

    ensurePresetStylesMock.mockImplementation((root: Document | ShadowRoot) => {
      expect(root).toBe(shadow)
      expect(wrapper.querySelector(".read-frog-loading-skeleton")).toBeNull()

      const style = document.createElement("style")
      style.id = "read-frog-preset-styles"
      shadow.appendChild(style)
    })

    const { createSpinnerInside } = await import("../spinner")
    const spinner = createSpinnerInside(wrapper)

    expect(ensurePresetStylesMock).toHaveBeenCalledOnce()
    expect(shadow.querySelector("#read-frog-preset-styles")).not.toBeNull()
    expect(wrapper.lastElementChild).toBe(spinner)
    expect(spinner.className).toBe("read-frog-loading-skeleton")
    expect(spinner.querySelectorAll(".read-frog-loading-skeleton-line")).toHaveLength(1)
  })

  it("places loading at the same block position as translated content", async () => {
    const wrapper = document.createElement("span")
    const targetNode = document.createElement("div")
    targetNode.textContent = "source"
    targetNode.setAttribute("data-read-frog-block-node", "")
    document.body.append(targetNode, wrapper)

    const { createSpinnerInside } = await import("../spinner")
    const spinner = createSpinnerInside(wrapper, { targetNode })

    expect(wrapper.firstElementChild?.tagName).toBe("BR")
    expect(wrapper.firstElementChild?.hasAttribute("data-read-frog-loading-separator")).toBe(true)
    expect(wrapper.lastElementChild).toBe(spinner)
    expect(spinner.classList.contains("read-frog-translated-block-content")).toBe(true)
  })

  it("removes the loading separator before translated content is inserted", async () => {
    const wrapper = document.createElement("span")
    const targetNode = document.createElement("div")
    targetNode.textContent = "source"
    targetNode.setAttribute("data-read-frog-block-node", "")
    document.body.append(targetNode, wrapper)

    const { createSpinnerInside, getTranslatedTextAndRemoveSpinner } = await import("../spinner")
    translateTextForPageMock.mockResolvedValueOnce("translated")

    const spinner = createSpinnerInside(wrapper, { targetNode })
    const translatedText = await getTranslatedTextAndRemoveSpinner([], "source", spinner, wrapper, translateTextForPageMock)

    expect(translatedText).toBe("translated")
    expect(wrapper.querySelector(".read-frog-loading-skeleton")).toBeNull()
    expect(wrapper.querySelector("[data-read-frog-loading-separator]")).toBeNull()
    expect(wrapper.childNodes).toHaveLength(0)
  })

  it("uses a single gray working skeleton line with stable dimensions", async () => {
    const { createLightweightSpinner } = await import("../spinner")
    const spinner = createLightweightSpinner(document)
    const lines = [...spinner.querySelectorAll<HTMLElement>(".read-frog-loading-skeleton-line")]

    expect(spinner.style.display).toBe("inline-block")
    expect(lines).toHaveLength(1)
    expect(lines[0]?.style.width).toBe("100%")
    expect(lines[0]?.style.borderRadius).toBe("3px")
    expect(lines[0]?.style.background).toBe("rgb(228, 228, 228)")

    const shine = lines[0]?.querySelector<HTMLElement>(".read-frog-loading-skeleton-shine")
    expect(shine).toBeTruthy()
    expect(shine?.style.width).toBe("45%")
    expect(shine?.style.backgroundImage).toContain("rgba(255, 255, 255, 0.95)")
  })

  it("uses a darker skeleton gradient on dark pages", async () => {
    document.body.style.backgroundColor = "rgb(15, 15, 15)"

    const { createLightweightSpinner } = await import("../spinner")
    const spinner = createLightweightSpinner(document)
    const line = spinner.querySelector<HTMLElement>(".read-frog-loading-skeleton-line")
    const shine = spinner.querySelector<HTMLElement>(".read-frog-loading-skeleton-shine")

    expect(line?.style.background).toBe("rgb(36, 36, 36)")
    expect(shine?.style.backgroundImage).toContain("rgba(95, 95, 95, 0.95)")
  })

  it("uses the nearest light ancestor before the dark system preference", async () => {
    Object.defineProperty(window, "matchMedia", {
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(prefers-color-scheme: dark)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
      configurable: true,
      writable: true,
    })
    document.documentElement.style.backgroundColor = "transparent"
    document.body.style.backgroundColor = "transparent"

    const lightContainer = document.createElement("div")
    lightContainer.style.backgroundColor = "rgb(246, 246, 239)"
    const targetNode = document.createElement("p")
    const wrapper = document.createElement("span")
    lightContainer.appendChild(targetNode)
    document.body.appendChild(lightContainer)

    const { createSpinnerInside } = await import("../spinner")
    const spinner = createSpinnerInside(wrapper, { targetNode })
    const line = spinner.querySelector<HTMLElement>(".read-frog-loading-skeleton-line")

    expect(line?.style.background).toBe("rgb(228, 228, 228)")
  })

  it("uses a local dark container before a light page background", async () => {
    document.body.style.backgroundColor = "rgb(246, 246, 239)"
    const darkContainer = document.createElement("div")
    darkContainer.style.backgroundColor = "rgb(15, 15, 15)"
    const targetNode = document.createElement("p")
    darkContainer.appendChild(targetNode)
    document.body.appendChild(darkContainer)

    const { createLightweightSpinner } = await import("../spinner")
    const spinner = createLightweightSpinner(document, targetNode)
    const line = spinner.querySelector<HTMLElement>(".read-frog-loading-skeleton-line")

    expect(line?.style.background).toBe("rgb(36, 36, 36)")
  })

  it("composites translucent ancestor backgrounds over their canvas", async () => {
    document.body.style.backgroundColor = "rgb(246, 246, 239)"
    const translucentContainer = document.createElement("div")
    translucentContainer.style.backgroundColor = "rgba(0, 0, 0, 0.8)"
    const targetNode = document.createElement("p")
    translucentContainer.appendChild(targetNode)
    document.body.appendChild(translucentContainer)

    const { createLightweightSpinner } = await import("../spinner")
    const spinner = createLightweightSpinner(document, targetNode)
    const line = spinner.querySelector<HTMLElement>(".read-frog-loading-skeleton-line")

    expect(line?.style.background).toBe("rgb(36, 36, 36)")
  })

  it("converts CSS Color 4 backgrounds through a document canvas", async () => {
    const context = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: "",
      getImageData: vi.fn().mockReturnValue({
        data: new Uint8ClampedArray([15, 15, 15, 255]),
      }),
    } as unknown as CanvasRenderingContext2D
    const getContextMock = vi.spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation((_contextId: string) => context)
    const darkColorContainer = document.createElement("div")
    darkColorContainer.style.backgroundColor = "oklch(20% 0 0)"
    const targetNode = document.createElement("p")
    darkColorContainer.appendChild(targetNode)
    document.body.appendChild(darkColorContainer)

    const { createLightweightSpinner } = await import("../spinner")
    const spinner = createLightweightSpinner(document, targetNode)
    const line = spinner.querySelector<HTMLElement>(".read-frog-loading-skeleton-line")

    expect(line?.style.background).toBe("rgb(36, 36, 36)")
    expect(getContextMock).toHaveBeenCalledOnce()
    expect(context.getImageData).toHaveBeenCalledOnce()
  })

  it("follows a directly slotted text node before its light shadow ancestor", async () => {
    const host = document.createElement("div")
    host.style.backgroundColor = "rgb(15, 15, 15)"
    const shadow = host.attachShadow({ mode: "open" })
    const lightShadowContainer = document.createElement("div")
    lightShadowContainer.style.backgroundColor = "rgb(246, 246, 239)"
    const slot = document.createElement("slot")
    lightShadowContainer.appendChild(slot)
    shadow.appendChild(lightShadowContainer)
    const targetNode = document.createTextNode("source")
    host.appendChild(targetNode)
    document.body.appendChild(host)

    const { createLightweightSpinner } = await import("../spinner")
    const spinner = createLightweightSpinner(document, targetNode)
    const line = spinner.querySelector<HTMLElement>(".read-frog-loading-skeleton-line")

    expect(line?.style.background).toBe("rgb(228, 228, 228)")
  })

  it("uses a deterministic light canvas for transparent normal pages", async () => {
    Object.defineProperty(window, "matchMedia", {
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(prefers-color-scheme: dark)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
      configurable: true,
      writable: true,
    })
    document.documentElement.style.backgroundColor = "transparent"
    document.documentElement.style.colorScheme = "normal"
    document.body.style.backgroundColor = "transparent"

    const { createLightweightSpinner } = await import("../spinner")
    const spinner = createLightweightSpinner(document)
    const line = spinner.querySelector<HTMLElement>(".read-frog-loading-skeleton-line")

    expect(line?.style.background).toBe("rgb(228, 228, 228)")
  })

  it("ignores a local dark color scheme when the document canvas is transparent", async () => {
    document.documentElement.style.backgroundColor = "transparent"
    document.documentElement.style.colorScheme = "normal"
    document.body.style.backgroundColor = "transparent"
    const localContainer = document.createElement("div")
    localContainer.style.colorScheme = "dark"
    const targetNode = document.createElement("p")
    localContainer.appendChild(targetNode)
    document.body.appendChild(localContainer)

    const { createLightweightSpinner } = await import("../spinner")
    const spinner = createLightweightSpinner(document, targetNode)
    const line = spinner.querySelector<HTMLElement>(".read-frog-loading-skeleton-line")

    expect(line?.style.background).toBe("rgb(228, 228, 228)")
  })

  it("uses a dark canvas for an explicit dark color scheme", async () => {
    document.documentElement.style.backgroundColor = "transparent"
    document.documentElement.style.colorScheme = "dark"
    document.body.style.backgroundColor = "transparent"

    const { createLightweightSpinner } = await import("../spinner")
    const spinner = createLightweightSpinner(document)
    const line = spinner.querySelector<HTMLElement>(".read-frog-loading-skeleton-line")

    expect(line?.style.background).toBe("rgb(36, 36, 36)")
  })

  it("uses the explicit insertion container for a sibling wrapper", async () => {
    const insertionContainer = document.createElement("div")
    insertionContainer.style.backgroundColor = "rgb(246, 246, 239)"
    const targetNode = document.createElement("p")
    targetNode.style.backgroundColor = "rgb(15, 15, 15)"
    insertionContainer.appendChild(targetNode)
    document.body.appendChild(insertionContainer)
    const wrapper = document.createElement("span")

    const { createSpinnerInside } = await import("../spinner")
    const spinner = createSpinnerInside(wrapper, {
      targetNode,
      backgroundReferenceNode: insertionContainer,
    })
    const line = spinner.querySelector<HTMLElement>(".read-frog-loading-skeleton-line")

    expect(line?.style.background).toBe("rgb(228, 228, 228)")
  })

  it("animates the single skeleton line like a working indicator", async () => {
    const animateMock = vi.fn()
    Object.defineProperty(HTMLElement.prototype, "animate", {
      value: animateMock,
      configurable: true,
      writable: true,
    })

    const { createLightweightSpinner } = await import("../spinner")
    createLightweightSpinner(document)

    expect(animateMock).toHaveBeenCalledOnce()
    expect(animateMock).toHaveBeenCalledWith(
      [
        { transform: "translateX(-130%)" },
        { transform: "translateX(280%)" },
      ],
      {
        duration: 850,
        iterations: Infinity,
        easing: "linear",
      },
    )
  })

  it("keeps the skeleton static when reduced motion is enabled", async () => {
    Object.defineProperty(window, "matchMedia", {
      value: vi.fn().mockReturnValue({
        matches: true,
        media: "(prefers-reduced-motion: reduce)",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
      configurable: true,
      writable: true,
    })

    const animateMock = vi.fn()
    Object.defineProperty(HTMLElement.prototype, "animate", {
      value: animateMock,
      configurable: true,
      writable: true,
    })

    const { createLightweightSpinner } = await import("../spinner")
    const spinner = createLightweightSpinner(document)

    expect(animateMock).not.toHaveBeenCalled()
    expect(spinner.querySelectorAll(".read-frog-loading-skeleton-line")).toHaveLength(1)
  })
})
