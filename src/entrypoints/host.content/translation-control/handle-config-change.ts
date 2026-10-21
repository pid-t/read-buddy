import type { PageTranslationManager } from "./page-translation"
import type { Config } from "@/types/config/config"
import { storage } from "#imports"
import { isEnabledLLMProviderConfig } from "@/types/config/provider"
import { CONFIG_STORAGE_KEY } from "@/utils/constants/config"

/**
 * Include the complete effective provider config so availability, model and
 * request settings such as base URL or API key changes refresh an active page.
 */
function getSmartFilterSignature(config: Config): string {
  const smartFilter = config.translate.page?.smartFilter
  const providerId = smartFilter?.providerId ?? config.translate.providerId
  const provider = config.providersConfig?.find(p => p.id === providerId)
  const llmProvider = provider && isEnabledLLMProviderConfig(provider) ? provider : null

  return JSON.stringify({
    enableAI: smartFilter?.enableAI ?? false,
    selectedProviderId: smartFilter?.providerId ?? null,
    providerId,
    providerEnabled: provider?.enabled ?? false,
    provider: llmProvider,
  })
}

/**
 * Re-translate an active page when translation mode, provider or smart filter
 * settings change.
 */
export function handleTranslationModeChange(
  newConfig: Config | null,
  oldConfig: Config | null,
  manager: PageTranslationManager,
): void {
  if (!newConfig || !oldConfig)
    return

  const modeChanged = newConfig.translate.mode !== oldConfig.translate.mode
  const providerChanged = newConfig.translate.providerId !== oldConfig.translate.providerId
  const smartFilterSettingsChanged = newConfig.translate.page?.smartFilter?.enableAI !== oldConfig.translate.page?.smartFilter?.enableAI
    || newConfig.translate.page?.smartFilter?.providerId !== oldConfig.translate.page?.smartFilter?.providerId
  // Only provider availability matters while the feature is enabled; changing
  // providers on an inactive feature should not restart normal translation.
  const smartFilterProviderChanged = (newConfig.translate.page?.smartFilter?.enableAI || oldConfig.translate.page?.smartFilter?.enableAI)
    && getSmartFilterSignature(newConfig) !== getSmartFilterSignature(oldConfig)
  const smartFilterChanged = smartFilterSettingsChanged || smartFilterProviderChanged

  if ((modeChanged || providerChanged || smartFilterChanged) && manager.isActive) {
    manager.stop()
    void manager.start()
  }
}

/**
 * Keep the current page manager in sync with config changes made from Options.
 * The returned function removes the storage listener with the content script.
 */
export function watchTranslationConfigChanges(manager: PageTranslationManager): () => void {
  return storage.watch<Config>(`local:${CONFIG_STORAGE_KEY}`, (newConfig, oldConfig) => {
    handleTranslationModeChange(newConfig, oldConfig, manager)
  })
}
