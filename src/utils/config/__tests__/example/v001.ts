import type { TestSeriesObject } from "./types"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

const LEGACY_FREE_PROVIDER_TYPES = new Set(["google-translate", "microsoft-translate"])
const legacyProvidersConfig = DEFAULT_CONFIG.providersConfig.filter(provider => !LEGACY_FREE_PROVIDER_TYPES.has(provider.provider))
const { selectionTranslation: _selectionTranslation, ...v001ConfigWithProviders } = DEFAULT_CONFIG
const { smartFilter: _smartFilter, ...v001PageConfig } = DEFAULT_CONFIG.translate.page
const v001Config = {
  ...v001ConfigWithProviders,
  translate: {
    ...DEFAULT_CONFIG.translate,
    page: v001PageConfig,
  },
  providersConfig: legacyProvidersConfig,
}

// Keep the legacy export used by the API-key sanitization tests.
export const configExample = v001Config

/**
 * v001 is the legacy configuration before selection translation was added.
 * Keep this snapshot aligned with DEFAULT_CONFIG while omitting the v2 field
 * so the migration harness exercises the real v1-to-v2 upgrade.
 */
export const testSeries: TestSeriesObject = {
  default: {
    description: "Initial shipped schema without selection translation or free provider additions",
    config: v001Config,
  },
}
