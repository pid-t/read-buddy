import type { ProviderConfig } from "@/types/config/provider"
import type { FeatureKey } from "@/utils/constants/feature-providers"
import { useAtomValue, useSetAtom } from "jotai"
import { useMemo } from "react"
import ProviderSelector from "@/components/llm-providers/provider-selector"
import { isAPIKeyOptionalProvider, isAPIProviderConfig } from "@/types/config/provider"
import { configFieldsAtomMap, writeConfigAtom } from "@/utils/atoms/config"
import { featureProviderConfigAtom } from "@/utils/atoms/provider"
import { filterEnabledProvidersConfig } from "@/utils/config/helpers"
import { buildFeatureProviderPatch, FEATURE_PROVIDER_DEFS } from "@/utils/constants/feature-providers"
import { i18n } from "@/utils/i18n"
import { ConfigCard } from "./config-card"
import { SetApiKeyWarning } from "./set-api-key-warning"

function needsApiKeyWarning(providerConfig: ProviderConfig | null): boolean {
  return !!providerConfig
    && isAPIProviderConfig(providerConfig)
    && !isAPIKeyOptionalProvider(providerConfig.provider)
    && !providerConfig.apiKey?.trim()
}

export function DefaultProviderConfig({
  featureKey,
  disabled = false,
  title = i18n.t("options.defaultProvider.title"),
  description = i18n.t("options.defaultProvider.description"),
  placeholder = i18n.t("options.defaultProvider.placeholder"),
  noProvidersMessage = i18n.t("options.defaultProvider.noProviders"),
}: {
  featureKey: FeatureKey
  disabled?: boolean
  title?: string
  description?: string
  placeholder?: string
  noProvidersMessage?: string
}) {
  const setConfig = useSetAtom(writeConfigAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const providerConfig = useAtomValue(featureProviderConfigAtom(featureKey))
  const def = FEATURE_PROVIDER_DEFS[featureKey]

  const providers = useMemo(() =>
    filterEnabledProvidersConfig(providersConfig)
      .filter(provider => def.isProvider(provider.provider)),
  [providersConfig, def])

  return (
    <ConfigCard id="default-provider" title={title} description={description}>
      <div className="space-y-3">
        <ProviderSelector
          ariaLabel={title}
          providers={providers}
          value={providerConfig?.id ?? ""}
          onChange={providerId => void setConfig(buildFeatureProviderPatch({ [featureKey]: providerId }))}
          placeholder={placeholder}
          className="w-full max-w-xs"
          disabled={disabled}
        />
        {needsApiKeyWarning(providerConfig) && (
          <div className="flex">
            <SetApiKeyWarning />
          </div>
        )}
        {providers.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {noProvidersMessage}
          </p>
        )}
      </div>
    </ConfigCard>
  )
}
