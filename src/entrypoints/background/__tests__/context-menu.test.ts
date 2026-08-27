import { beforeEach, describe, expect, it, vi } from "vitest"
import { browser, storage } from "#imports"

const togglePageTranslationByTabIdMock = vi.fn()
const getLocalConfigMock = vi.fn()
const applyI18nLocaleMock = vi.fn()
const contextMenusCreateMock = vi.fn()
const contextMenusRemoveMock = vi.fn()
const contextMenusUpdateMock = vi.fn()
const onPageTranslationStateChangedMock = vi.fn()
const runtimeOnInstalledAddListenerMock = vi.fn()
const contextMenusOnClickedAddListenerMock = vi.fn()
const tabsOnActivatedAddListenerMock = vi.fn()
const tabsQueryMock = vi.fn()
const windowsOnFocusChangedAddListenerMock = vi.fn()
const webNavigationOnCommittedAddListenerMock = vi.fn()
const storageWatchMock = vi.fn()

vi.mock("../translation-signal", () => ({
  onPageTranslationStateChanged: onPageTranslationStateChangedMock,
  togglePageTranslationByTabId: togglePageTranslationByTabIdMock,
}))

vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: getLocalConfigMock,
}))

vi.mock("@/utils/i18n", () => ({
  applyI18nLocale: applyI18nLocaleMock,
  i18n: { t: (key: string) => key },
}))

describe("context menu", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    browser.contextMenus.create = contextMenusCreateMock
    browser.contextMenus.remove = contextMenusRemoveMock
    browser.contextMenus.update = contextMenusUpdateMock
    browser.runtime.onInstalled.addListener = runtimeOnInstalledAddListenerMock
    browser.contextMenus.onClicked.addListener = contextMenusOnClickedAddListenerMock
    browser.tabs.onActivated.addListener = tabsOnActivatedAddListenerMock
    browser.tabs.query = tabsQueryMock
    browser.windows.onFocusChanged.addListener = windowsOnFocusChangedAddListenerMock
    browser.webNavigation.onCommitted.addListener = webNavigationOnCommittedAddListenerMock
    storage.watch = storageWatchMock

    getLocalConfigMock.mockResolvedValue(null)
    applyI18nLocaleMock.mockResolvedValue(undefined)
    contextMenusRemoveMock.mockResolvedValue(undefined)
    contextMenusUpdateMock.mockResolvedValue(undefined)
    tabsQueryMock.mockResolvedValue([])
    storageWatchMock.mockReturnValue(vi.fn())
  })

  it("uses the clicked tab id for off-to-on and on-to-off toggles", async () => {
    const { handleContextMenuClick, PAGE_TRANSLATION_CONTEXT_MENU_ID } = await import("../context-menu")
    togglePageTranslationByTabIdMock
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)

    const info = { menuItemId: PAGE_TRANSLATION_CONTEXT_MENU_ID } as any
    const tab = { id: 42, url: "https://example.com/article" } as any

    await handleContextMenuClick(info, tab)
    await handleContextMenuClick(info, tab)

    expect(togglePageTranslationByTabIdMock).toHaveBeenNthCalledWith(1, 42)
    expect(togglePageTranslationByTabIdMock).toHaveBeenNthCalledWith(2, 42)
  })

  it("registers a top-level normal item for supported page contexts", async () => {
    const { PAGE_TRANSLATION_CONTEXT_MENU_ID, setupContextMenu } = await import("../context-menu")
    setupContextMenu()

    const onInstalled = runtimeOnInstalledAddListenerMock.mock.calls[0][0] as () => Promise<void>
    void onInstalled()
    await vi.waitFor(() => expect(contextMenusCreateMock).toHaveBeenCalled())

    expect(contextMenusCreateMock).toHaveBeenCalledWith({
      id: PAGE_TRANSLATION_CONTEXT_MENU_ID,
      type: "normal",
      title: "contextMenu.enableTranslation",
      contexts: ["page", "frame", "selection", "link", "editable", "image", "video", "audio"],
      documentUrlPatterns: ["*://*/*", "file:///*"],
    })
    expect(contextMenusCreateMock.mock.calls[0][0]).not.toHaveProperty("icons")
  })

  it("keeps the active tab update when an inactive tab changes state", async () => {
    const { setupContextMenu } = await import("../context-menu")
    setupContextMenu()

    let releaseActiveConfirmation!: () => void
    tabsQueryMock
      .mockResolvedValueOnce([{ id: 2, url: "https://example.com" }])
      .mockImplementationOnce(() => new Promise((resolve) => {
        releaseActiveConfirmation = () => resolve([{ id: 2, url: "https://example.com" }])
      }))
      .mockResolvedValue([{ id: 2, url: "https://example.com" }])

    const onActivated = tabsOnActivatedAddListenerMock.mock.calls.at(-1)?.[0] as () => void
    const onStateChanged = onPageTranslationStateChangedMock.mock.calls.at(-1)?.[0] as (tabId: number, enabled: boolean) => void
    onActivated()
    await vi.waitFor(() => expect(tabsQueryMock).toHaveBeenCalledTimes(2))

    onStateChanged(1, false)
    await vi.waitFor(() => expect(tabsQueryMock).toHaveBeenCalledTimes(3))
    releaseActiveConfirmation()
    await vi.waitFor(() => expect(contextMenusUpdateMock).toHaveBeenCalledTimes(1))
  })
})
