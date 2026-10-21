// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { browser } from "#imports"
import { isPageTranslatedAtom } from "../../atoms/auto-translate"
import { isIgnoreTabAtom } from "../../atoms/ignore"
import TranslateButton from "../translate-button"

const { sendMessageMock, toastErrorMock } = vi.hoisted(() => ({
  sendMessageMock: vi.fn(),
  toastErrorMock: vi.fn(),
}))
const tabsQueryMock = vi.fn()

vi.mock("@/utils/message", () => ({
  sendMessage: sendMessageMock,
  onMessage: vi.fn(() => () => {}),
}))
vi.mock("sonner", () => ({ toast: { error: toastErrorMock } }))
vi.mock("@/utils/atoms/storage-adapter", () => ({
  storageAdapter: {
    get: vi.fn(async (_key: string, fallback: unknown) => fallback),
    watch: vi.fn(() => () => {}),
  },
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function renderButton(translated = false, ignored = false) {
  const store = createStore()
  store.set(isPageTranslatedAtom, translated)
  store.set(isIgnoreTabAtom, ignored)
  render(<Provider store={store}><TranslateButton /></Provider>)
  return { store, button: screen.getByRole("button") }
}

describe("popup translate button", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    browser.tabs.query = tabsQueryMock
    tabsQueryMock.mockResolvedValue([{ id: 42 }])
    sendMessageMock.mockResolvedValue(undefined)
  })
  afterEach(cleanup)

  it("acknowledges the click before the tab query finishes", async () => {
    const query = deferred<{ id: number }[]>()
    const command = deferred<void>()
    tabsQueryMock.mockReturnValue(query.promise)
    sendMessageMock.mockReturnValue(command.promise)
    const { store, button } = renderButton()

    fireEvent.click(button)

    expect(button).toHaveAttribute("aria-busy", "true")
    expect(store.get(isPageTranslatedAtom)).toBe(true)
    await act(async () => query.resolve([{ id: 42 }]))
    expect(sendMessageMock).toHaveBeenCalledWith("tryToSetEnablePageTranslationByTabId", {
      tabId: 42,
      enabled: true,
    })
    expect(button).toHaveAttribute("aria-busy", "true")

    await act(async () => command.resolve())
    expect(button).not.toHaveAttribute("aria-busy", "true")
  })

  it("sends one command for repeated clicks while a request is pending", async () => {
    const query = deferred<{ id: number }[]>()
    tabsQueryMock.mockReturnValue(query.promise)
    const { button } = renderButton()

    fireEvent.click(button)
    fireEvent.click(button)
    fireEvent.click(button)

    expect(tabsQueryMock).toHaveBeenCalledTimes(1)
    await act(async () => query.resolve([{ id: 42 }]))
    expect(sendMessageMock).toHaveBeenCalledTimes(1)
  })

  it.each([false, true])("restores the previous state (%s) and reports command failures", async (translated) => {
    sendMessageMock.mockRejectedValue(new Error("Background unavailable"))
    const { store, button } = renderButton(translated)

    fireEvent.click(button)

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("selectionTranslation.errors.generic"))
    expect(store.get(isPageTranslatedAtom)).toBe(translated)
    expect(button).not.toHaveAttribute("aria-busy", "true")
    expect(button).not.toHaveAttribute("aria-disabled", "true")

    sendMessageMock.mockResolvedValue(undefined)
    fireEvent.click(button)
    await waitFor(() => expect(store.get(isPageTranslatedAtom)).toBe(!translated))
    await waitFor(() => expect(button).not.toHaveAttribute("aria-busy", "true"))
  })

  it("recovers when the active tab no longer exists", async () => {
    tabsQueryMock.mockResolvedValue([])
    const { store, button } = renderButton()

    fireEvent.click(button)

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledTimes(1))
    expect(store.get(isPageTranslatedAtom)).toBe(false)
    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(button).not.toHaveAttribute("aria-busy", "true")
  })

  it("keeps ignored pages disabled", () => {
    const { button } = renderButton(false, true)
    fireEvent.click(button)
    expect(button).toBeDisabled()
    expect(tabsQueryMock).not.toHaveBeenCalled()
    expect(sendMessageMock).not.toHaveBeenCalled()
  })
})
