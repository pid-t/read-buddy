import type { ProviderConfig } from "@/types/config/provider"
import { deepmerge } from "deepmerge-ts"
import { useAtom, useAtomValue } from "jotai"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/base-ui/field"
import { Switch } from "@/components/ui/base-ui/switch"
import { isEnabledLLMProviderConfig } from "@/types/config/provider"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { getProviderConfigById } from "@/utils/config/helpers"
import { i18n } from "@/utils/i18n"

export function AISmartFilter() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const smartFilter = translateConfig.page.smartFilter

  const pageTranslateProvider = getProviderConfigById<ProviderConfig>(providersConfig, translateConfig.providerId)
  const hasLLMProvider = !!pageTranslateProvider && isEnabledLLMProviderConfig(pageTranslateProvider)
  const summary = smartFilter.enableAI && hasLLMProvider
    ? i18n.t(`options.translation.smartFilter.summary.${translateConfig.page.range}`)
    : i18n.t(`options.translation.translateRange.summary.${translateConfig.page.range}`)

  return (
    <FieldGroup id="ai-smart-filter" className="border-t pt-5">
      <Field orientation="horizontal">
        <FieldContent className="min-w-0">
          <FieldLabel htmlFor="ai-smart-filter-toggle">
            {i18n.t("options.translation.smartFilter.enable")}
          </FieldLabel>
          <FieldDescription>
            {i18n.t("options.translation.smartFilter.description")}
          </FieldDescription>
        </FieldContent>
        <Switch
          id="ai-smart-filter-toggle"
          className="mt-0.5 shrink-0"
          aria-label={i18n.t("options.translation.smartFilter.enable")}
          checked={smartFilter.enableAI}
          disabled={!hasLLMProvider}
          onCheckedChange={(checked) => {
            void setTranslateConfig(
              deepmerge(translateConfig, {
                page: {
                  smartFilter: { enableAI: checked },
                },
              }),
            )
          }}
        />
      </Field>

      <p role="status" aria-live="polite" aria-atomic="true" className="rounded-md bg-muted/50 px-3 py-2 text-sm leading-relaxed">
        {summary}
        {!hasLLMProvider && (
          <span className="mt-1 block">{i18n.t("options.translation.smartFilter.status.noProvider")}</span>
        )}
      </p>
    </FieldGroup>
  )
}
