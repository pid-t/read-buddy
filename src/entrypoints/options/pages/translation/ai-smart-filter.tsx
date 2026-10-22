import { deepmerge } from "deepmerge-ts"
import { useAtom, useAtomValue } from "jotai"
import { useMemo, useState } from "react"
import { HelpTooltip } from "@/components/help-tooltip"
import ProviderSelector from "@/components/llm-providers/provider-selector"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/base-ui/field"
import { Input } from "@/components/ui/base-ui/input"
import { Switch } from "@/components/ui/base-ui/switch"
import { isEnabledLLMProviderConfig } from "@/types/config/provider"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { getEnabledLLMProvidersConfig, getProviderConfigById } from "@/utils/config/helpers"
import { MAX_SMART_FILTER_TIMEOUT_SECONDS, MIN_SMART_FILTER_TIMEOUT_SECONDS } from "@/utils/constants/translate"
import { i18n } from "@/utils/i18n"

export function AISmartFilter() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const smartFilter = translateConfig.page.smartFilter
  const [timeoutDraft, setTimeoutDraft] = useState<string | null>(null)

  const enabledLLMProviders = useMemo(
    () => getEnabledLLMProvidersConfig(providersConfig),
    [providersConfig],
  )

  const followsPageProvider = smartFilter.providerId === null
  const effectiveProviderId = smartFilter.providerId ?? translateConfig.providerId
  const effectiveProvider = getProviderConfigById(providersConfig, effectiveProviderId)
  const hasLLMProvider = !!effectiveProvider && isEnabledLLMProviderConfig(effectiveProvider)
  const summary = smartFilter.enableAI && hasLLMProvider
    ? i18n.t(`options.translation.smartFilter.summary.${translateConfig.page.range}`)
    : i18n.t(`options.translation.translateRange.summary.${translateConfig.page.range}`)

  const updateSmartFilter = (patch: Partial<typeof smartFilter>) => {
    void setTranslateConfig(
      deepmerge(translateConfig, {
        page: {
          smartFilter: patch,
        },
      }),
    )
  }

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
          onCheckedChange={checked => updateSmartFilter({ enableAI: checked })}
        />
      </Field>

      {smartFilter.enableAI && (
        <FieldGroup>
          <Field orientation="responsive">
            <FieldContent>
              <FieldLabel htmlFor="ai-smart-filter-timeout">
                {i18n.t("options.translation.smartFilter.timeoutSeconds")}
              </FieldLabel>
              <FieldDescription>
                {i18n.t("options.translation.smartFilter.timeoutDescription")}
              </FieldDescription>
            </FieldContent>
            <Input
              id="ai-smart-filter-timeout"
              className="w-24 shrink-0"
              type="number"
              min={MIN_SMART_FILTER_TIMEOUT_SECONDS}
              max={MAX_SMART_FILTER_TIMEOUT_SECONDS}
              step={1}
              value={timeoutDraft ?? String(smartFilter.timeoutSeconds)}
              onChange={event => setTimeoutDraft(event.target.value)}
              onBlur={() => {
                const valueDraft = timeoutDraft ?? String(smartFilter.timeoutSeconds)
                const value = Number(valueDraft)
                if (/^\d+$/.test(valueDraft) && Number.isInteger(value) && value >= MIN_SMART_FILTER_TIMEOUT_SECONDS && value <= MAX_SMART_FILTER_TIMEOUT_SECONDS) {
                  if (value !== smartFilter.timeoutSeconds)
                    updateSmartFilter({ timeoutSeconds: value })
                }
                setTimeoutDraft(null)
              }}
            />
          </Field>

          <Field orientation="horizontal">
            <FieldContent className="min-w-0 self-center">
              <FieldLabel htmlFor="ai-smart-filter-follow-provider">
                {i18n.t("options.translation.smartFilter.followProvider")}
                <HelpTooltip>{i18n.t("options.translation.smartFilter.followProviderDescription")}</HelpTooltip>
              </FieldLabel>
            </FieldContent>
            <Switch
              id="ai-smart-filter-follow-provider"
              className="shrink-0"
              aria-label={i18n.t("options.translation.smartFilter.followProvider")}
              checked={followsPageProvider}
              disabled={enabledLLMProviders.length === 0 && followsPageProvider}
              onCheckedChange={(checked) => {
                updateSmartFilter({
                  providerId: checked ? null : enabledLLMProviders[0]?.id ?? null,
                })
              }}
            />
          </Field>

          {followsPageProvider
            ? (
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                  <span className="text-muted-foreground">{i18n.t("options.translation.smartFilter.provider")}</span>
                  <span className="min-w-0 break-words">
                    {hasLLMProvider ? effectiveProvider.name : i18n.t("options.translation.smartFilter.providerPlaceholder")}
                  </span>
                </div>
              )
            : (
                <Field>
                  <FieldLabel nativeLabel={false} render={<div />}>
                    {i18n.t("options.translation.smartFilter.provider")}
                  </FieldLabel>
                  <ProviderSelector
                    providers={enabledLLMProviders}
                    value={effectiveProviderId}
                    onChange={providerId => updateSmartFilter({ providerId })}
                    ariaLabel={i18n.t("options.translation.smartFilter.provider")}
                    placeholder={i18n.t("options.translation.smartFilter.providerPlaceholder")}
                    className="w-full"
                  />
                </Field>
              )}

          <p className="text-sm leading-relaxed text-muted-foreground">
            {i18n.t("options.translation.smartFilter.costDescription")}
          </p>
          <details className="text-sm text-muted-foreground">
            <summary className="w-fit cursor-pointer rounded-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2">
              {i18n.t("options.translation.smartFilter.behaviorTitle")}
            </summary>
            <p className="mt-2 leading-relaxed">
              {i18n.t("options.translation.smartFilter.behaviorDescription")}
            </p>
          </details>
        </FieldGroup>
      )}

      <p role="status" aria-live="polite" aria-atomic="true" className="rounded-md bg-muted/50 px-3 py-2 text-sm leading-relaxed">
        {summary}
        {smartFilter.enableAI && !hasLLMProvider && (
          <span className="mt-1 block">{i18n.t("options.translation.smartFilter.status.noProvider")}</span>
        )}
      </p>
    </FieldGroup>
  )
}
