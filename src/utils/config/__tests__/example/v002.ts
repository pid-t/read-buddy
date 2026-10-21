import type { TestSeriesObject } from "./types"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

const LEGACY_FREE_PROVIDER_TYPES = new Set(["google-translate", "microsoft-translate"])
const legacyProvidersConfig = DEFAULT_CONFIG.providersConfig.filter(provider => !LEGACY_FREE_PROVIDER_TYPES.has(provider.provider))
const { smartFilter: _smartFilter, ...v002PageConfig } = DEFAULT_CONFIG.translate.page
const v002Config = {
  ...DEFAULT_CONFIG,
  translate: {
    ...DEFAULT_CONFIG.translate,
    page: v002PageConfig,
  },
  providersConfig: legacyProvidersConfig,
}

// Keep the legacy export used by the API-key sanitization tests.
export const configExample = v002Config

export const testSeries: TestSeriesObject = {
  default: {
    description: "Selection translation settings are enabled by default",
    config: v002Config,
  },
}
