import type { TestSeriesObject } from "./types"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"

const LEGACY_FREE_PROVIDER_TYPES = new Set(["google-translate", "microsoft-translate"])
const legacyProvidersConfig = DEFAULT_CONFIG.providersConfig.filter(provider => !LEGACY_FREE_PROVIDER_TYPES.has(provider.provider))
const migratedProvidersConfig = [
  ...legacyProvidersConfig,
  DEFAULT_PROVIDER_CONFIG["microsoft-translate"],
  DEFAULT_PROVIDER_CONFIG["google-translate"],
]

const { smartFilter: _smartFilter, ...v003PageConfig } = DEFAULT_CONFIG.translate.page
const migratedConfig = {
  ...DEFAULT_CONFIG,
  translate: {
    ...DEFAULT_CONFIG.translate,
    page: v003PageConfig,
  },
  providersConfig: migratedProvidersConfig,
}

// Keep the legacy export used by the API-key sanitization tests.
export const configExample = migratedConfig

export const testSeries: TestSeriesObject = {
  default: {
    description: "Built-in free translation providers are appended to existing providers",
    config: migratedConfig,
  },
}
