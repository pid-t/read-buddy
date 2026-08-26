import { deepmerge } from "deepmerge-ts"
import { useAtom } from "jotai"
import { useMemo } from "react"
import { HelpTooltip } from "@/components/help-tooltip"
import { Field, FieldContent, FieldLabel } from "@/components/ui/base-ui/field"
import { Switch } from "@/components/ui/base-ui/switch"
import { isEnabledLLMProviderConfig } from "@/types/config/provider"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { getProviderConfigById } from "@/utils/config/helpers"
import { i18n } from "@/utils/i18n"
import { LLMStatusIndicator } from "../../../../components/llm-status-indicator"
import { ConfigCard } from "../../components/config-card"

export function AIContentAware() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const [providersConfig] = useAtom(configFieldsAtomMap.providersConfig)

  const hasLLMProvider = useMemo(() => {
    const providerConfig = getProviderConfigById(providersConfig, translateConfig.providerId)
    return providerConfig ? isEnabledLLMProviderConfig(providerConfig) : false
  }, [providersConfig, translateConfig.providerId])

  return (
    <ConfigCard
      id="ai-content-aware"
      title={i18n.t("options.translation.aiContentAware.title")}
      description={(
        <>
          {i18n.t("options.translation.aiContentAware.description")}
          <LLMStatusIndicator
            enabled={translateConfig.enableAIContentAware}
            hasLLMProvider={hasLLMProvider}
            disabledText={i18n.t("options.translation.aiContentAware.status.disabled")}
            enabledText={i18n.t("options.translation.aiContentAware.status.enabled")}
            noProviderText={i18n.t("options.translation.aiContentAware.status.noProvider")}
          />
        </>
      )}
    >
      <Field orientation="horizontal">
        <FieldContent className="self-center">
          <FieldLabel htmlFor="ai-content-aware-toggle">
            {i18n.t("options.translation.aiContentAware.enable")}
            <HelpTooltip>{i18n.t("options.translation.aiContentAware.enableDescription")}</HelpTooltip>
          </FieldLabel>
        </FieldContent>
        <Switch
          id="ai-content-aware-toggle"
          aria-label={i18n.t("options.translation.aiContentAware.enable")}
          checked={translateConfig.enableAIContentAware}
          onCheckedChange={(checked) => {
            void setTranslateConfig(
              deepmerge(translateConfig, {
                enableAIContentAware: checked,
              }),
            )
          }}
        />
      </Field>
    </ConfigCard>
  )
}
