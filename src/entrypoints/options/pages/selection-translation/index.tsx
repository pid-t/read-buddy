import type { ProviderConfig } from "@/types/config/provider"
import { useAtom } from "jotai"
import ProviderSelector from "@/components/llm-providers/provider-selector"
import { TargetLanguageCombobox } from "@/components/target-language-combobox"
import { Field, FieldContent, FieldLabel } from "@/components/ui/base-ui/field"
import { Switch } from "@/components/ui/base-ui/switch"
import { isAPIKeyOptionalProvider, isAPIProviderConfig, isTranslateProviderConfig } from "@/types/config/provider"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { filterEnabledProvidersConfig } from "@/utils/config/helpers"
import { i18n } from "@/utils/i18n"
import { ConfigCard } from "../../components/config-card"
import { PageLayout } from "../../components/page-layout"
import { SetApiKeyWarning } from "../../components/set-api-key-warning"

function needsApiKeyWarning(provider: ProviderConfig | undefined): boolean {
  return !!provider
    && isAPIProviderConfig(provider)
    && !isAPIKeyOptionalProvider(provider.provider)
    && !provider.apiKey?.trim()
}

export function SelectionTranslationPage() {
  const [selectionConfig, setSelectionConfig] = useAtom(configFieldsAtomMap.selectionTranslation)
  const [providersConfig] = useAtom(configFieldsAtomMap.providersConfig)
  const providers = filterEnabledProvidersConfig(providersConfig).filter(isTranslateProviderConfig)
  const provider = providersConfig.find(item => item.id === selectionConfig.providerId)

  return (
    <PageLayout title={i18n.t("options.selectionTranslation.title")}>
      <ConfigCard
        title={i18n.t("options.selectionTranslation.enable.title")}
        description={i18n.t("options.selectionTranslation.enable.description")}
      >
        <Field orientation="horizontal">
          <FieldContent className="self-center">
            <FieldLabel htmlFor="selection-translation-toggle">
              {i18n.t("options.selectionTranslation.enable.title")}
            </FieldLabel>
          </FieldContent>
          <Switch
            id="selection-translation-toggle"
            checked={selectionConfig.enabled}
            onCheckedChange={checked => void setSelectionConfig({ enabled: checked })}
          />
        </Field>
      </ConfigCard>

      <ConfigCard
        title={i18n.t("options.selectionTranslation.targetLanguage.title")}
        description={i18n.t("options.selectionTranslation.targetLanguage.description")}
      >
        <TargetLanguageCombobox
          value={selectionConfig.targetCode}
          onValueChange={targetCode => void setSelectionConfig({ targetCode })}
          disabled={!selectionConfig.enabled}
          aria-label={i18n.t("options.selectionTranslation.targetLanguage.title")}
        />
      </ConfigCard>

      <ConfigCard
        title={i18n.t("options.selectionTranslation.provider.title")}
        description={i18n.t("options.selectionTranslation.provider.description")}
      >
        <div className="space-y-2">
          <Field>
            <FieldLabel nativeLabel={false} render={<div className="flex flex-wrap" />}>
              {i18n.t("options.selectionTranslation.provider.title")}
              {needsApiKeyWarning(provider) && <SetApiKeyWarning />}
            </FieldLabel>
            <ProviderSelector
              providers={providers}
              value={selectionConfig.providerId}
              onChange={providerId => void setSelectionConfig({ providerId })}
              placeholder={i18n.t("options.selectionTranslation.provider.placeholder")}
              className="w-full max-w-xs"
              disabled={!selectionConfig.enabled}
            />
            {providers.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {i18n.t("options.selectionTranslation.provider.noProviders")}
              </p>
            )}
          </Field>
        </div>
      </ConfigCard>
    </PageLayout>
  )
}

export default SelectionTranslationPage
