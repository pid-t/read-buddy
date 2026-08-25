import type { TestSeriesObject } from "./types"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

const LEGACY_FREE_PROVIDER_TYPES = new Set(["google-translate", "microsoft-translate"])
const legacyProvidersConfig = DEFAULT_CONFIG.providersConfig.filter(provider => !LEGACY_FREE_PROVIDER_TYPES.has(provider.provider))
const v002Config = {
  ...DEFAULT_CONFIG,
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
