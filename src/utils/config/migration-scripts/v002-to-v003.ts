import type { MigrationFunction } from "./types"
import type { NonAPIProviderConfig } from "@/types/config/provider"

const FREE_TRANSLATE_PROVIDERS = [
  {
    id: "microsoft-translate-default",
    name: "Microsoft Translator",
    enabled: true,
    provider: "microsoft-translate",
  },
  {
    id: "google-translate-default",
    name: "Google Translate",
    enabled: true,
    provider: "google-translate",
  },
] as const satisfies readonly NonAPIProviderConfig[]

/** Add the built-in free translation providers while preserving user entries and order. */
export const migrate: MigrationFunction = (input) => {
  const config = (input && typeof input === "object" ? input : {}) as Record<string, any>
  const providersConfig = Array.isArray(config.providersConfig) ? config.providersConfig : []
  const providers = [...providersConfig]

  for (const provider of FREE_TRANSLATE_PROVIDERS) {
    const alreadyConfigured = providers.some(existing =>
      existing?.id === provider.id || existing?.provider === provider.provider,
    )

    if (!alreadyConfigured)
      providers.push({ ...provider })
  }

  return {
    ...config,
    providersConfig: providers,
  }
}
