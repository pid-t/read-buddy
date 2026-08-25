import type { Config } from "@/types/config/config"
import { isAPIKeyOptionalProvider, isAPIProviderConfig } from "@/types/config/provider"
import { resolveProviderConfig } from "@/utils/constants/feature-providers"
import { translateTextCore } from "./translate-text"

export async function translateTextForSelection(config: Config, text: string): Promise<string> {
  const providerConfig = resolveProviderConfig(config, "selectionTranslation")

  if (!providerConfig.enabled)
    throw new Error("Selection translation provider is disabled")

  if (
    isAPIProviderConfig(providerConfig)
    && !providerConfig.apiKey?.trim()
    && !isAPIKeyOptionalProvider(providerConfig.provider)
  ) {
    throw new Error("Selection translation provider API key is missing")
  }

  return translateTextCore({
    text,
    langConfig: {
      sourceCode: "auto",
      targetCode: config.selectionTranslation.targetCode,
      level: config.language.level,
    },
    providerConfig,
    enableAIContentAware: false,
    extraHashTags: ["selectionTranslation:v1"],
  })
}
