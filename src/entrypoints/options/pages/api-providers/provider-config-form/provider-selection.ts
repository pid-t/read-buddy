import type { APIProviderConfig, ProvidersConfig } from "@/types/config/provider"
import { isAPIProviderConfig } from "@/types/config/provider"

export function chooseNextProviderConfig(providersConfig: ProvidersConfig): APIProviderConfig | undefined {
  return providersConfig.find(isAPIProviderConfig)
}
