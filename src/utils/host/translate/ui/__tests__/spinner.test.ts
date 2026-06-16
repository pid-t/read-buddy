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
    const spinner = createSpinnerInside(wrapper, targetNode)

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

    const spinner = createSpinnerInside(wrapper, targetNode)
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
