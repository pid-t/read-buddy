import type { Config } from "@/types/config/config"
import type { UiLocale } from "@/types/config/ui-locale"
import { browser, storage } from "#imports"
import { getLocalConfig } from "@/utils/config/storage"
import { CONFIG_STORAGE_KEY } from "@/utils/constants/config"
import { applyI18nLocale, i18n } from "@/utils/i18n"
import { logger } from "@/utils/logger"
import {
  getPageTranslationState,
} from "./page-translation-state"
import {
  onPageTranslationStateChanged,
  togglePageTranslationByTabId,
} from "./translation-signal"

export const PAGE_TRANSLATION_CONTEXT_MENU_ID = "toggle-page-translation"

const CONTENT_SCRIPT_DOCUMENT_URL_PATTERNS = ["*://*/*", "file:///*"]
let loadedLocale: UiLocale | undefined
let hasLoadedLocale = false
let menuUpdateRevision = 0

async function loadConfiguredLocale(): Promise<void> {
  const config = await getLocalConfig()
  const locale = config?.uiLocale
  if (hasLoadedLocale && loadedLocale === locale)
    return

  await applyI18nLocale(locale)
  loadedLocale = locale
  hasLoadedLocale = true
}

async function getMenuEnabled(tabId: number): Promise<boolean> {
  const state = await getPageTranslationState(tabId)
  return state?.enabled === true
}

async function updateContextMenuForTab(tabId: number, revision: number): Promise<void> {
  await loadConfiguredLocale()
  const enabled = await getMenuEnabled(tabId)
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true })
  if (revision !== menuUpdateRevision || activeTab?.id !== tabId)
    return

  await browser.contextMenus.update(PAGE_TRANSLATION_CONTEXT_MENU_ID, {
    title: i18n.t(enabled ? "contextMenu.showOriginal" : "contextMenu.enableTranslation"),
  })
}

async function updateContextMenuForActiveTab(): Promise<void> {
  const revision = ++menuUpdateRevision
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true })
  if (typeof activeTab?.id !== "number")
    return

  await updateContextMenuForTab(activeTab.id, revision)
}

async function updateContextMenuIfActive(tabId: number): Promise<void> {
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true })
  if (activeTab?.id !== tabId)
    return

  await updateContextMenuForActiveTab()
}

async function registerContextMenu(): Promise<void> {
  await loadConfiguredLocale()
  await browser.contextMenus.remove(PAGE_TRANSLATION_CONTEXT_MENU_ID).catch(() => {})

  browser.contextMenus.create({
    id: PAGE_TRANSLATION_CONTEXT_MENU_ID,
    type: "normal",
    title: i18n.t("contextMenu.enableTranslation"),
    contexts: [
      "page",
      "frame",
      "selection",
      "link",
      "editable",
      "image",
      "video",
      "audio",
    ],
    documentUrlPatterns: CONTENT_SCRIPT_DOCUMENT_URL_PATTERNS,
  })
  await updateContextMenuForActiveTab()
}

export async function handleContextMenuClick(
  info: Parameters<Parameters<typeof browser.contextMenus.onClicked.addListener>[0]>[0],
  tab?: Parameters<Parameters<typeof browser.contextMenus.onClicked.addListener>[0]>[1],
): Promise<void> {
  if (info.menuItemId !== PAGE_TRANSLATION_CONTEXT_MENU_ID || typeof tab?.id !== "number")
    return

  await togglePageTranslationByTabId(tab.id)
}

function runContextMenuTask(task: Promise<void>): void {
  void task.catch(error => logger.warn("Failed to update translation context menu", error))
}

export function setupContextMenu(): void {
  browser.runtime.onInstalled.addListener(() => {
    runContextMenuTask(registerContextMenu())
  })

  browser.contextMenus.onClicked.addListener((info, tab) => {
    runContextMenuTask(handleContextMenuClick(info, tab))
  })

  browser.tabs.onActivated.addListener(() => {
    runContextMenuTask(updateContextMenuForActiveTab())
  })

  browser.windows.onFocusChanged.addListener(() => {
    runContextMenuTask(updateContextMenuForActiveTab())
  })

  browser.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId === 0)
      runContextMenuTask(updateContextMenuIfActive(details.tabId))
  })

  onPageTranslationStateChanged((tabId) => {
    runContextMenuTask(updateContextMenuIfActive(tabId))
  })

  storage.watch<Config>(`local:${CONFIG_STORAGE_KEY}`, (config) => {
    hasLoadedLocale = false
    loadedLocale = config?.uiLocale
    runContextMenuTask(updateContextMenuForActiveTab())
  })
}
