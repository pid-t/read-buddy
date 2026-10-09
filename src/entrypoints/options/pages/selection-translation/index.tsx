import { useAtom } from "jotai"
import { TargetLanguageCombobox } from "@/components/target-language-combobox"
import { Field, FieldContent, FieldLabel } from "@/components/ui/base-ui/field"
import { Switch } from "@/components/ui/base-ui/switch"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigCard } from "../../components/config-card"
import { DefaultProviderConfig } from "../../components/default-provider-config"
import { PageLayout } from "../../components/page-layout"

export function SelectionTranslationPage() {
  const [selectionConfig, setSelectionConfig] = useAtom(configFieldsAtomMap.selectionTranslation)

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

      <DefaultProviderConfig
        featureKey="selectionTranslation"
        disabled={!selectionConfig.enabled}
        title={i18n.t("options.selectionTranslation.provider.title")}
        description={i18n.t("options.selectionTranslation.provider.description")}
        placeholder={i18n.t("options.selectionTranslation.provider.placeholder")}
        noProvidersMessage={i18n.t("options.selectionTranslation.provider.noProviders")}
      />
    </PageLayout>
  )
}

export default SelectionTranslationPage
