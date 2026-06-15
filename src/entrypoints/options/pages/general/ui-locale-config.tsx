import type { UiLocale } from "@/types/config/ui-locale"
import { useAtom } from "jotai"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/base-ui/select"
import { UI_LOCALES } from "@/types/config/ui-locale"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { applyI18nLocale, getBrowserPreferredUiLocale, i18n } from "@/utils/i18n"
import { ConfigCard } from "../../components/config-card"

type I18nKey = Parameters<typeof i18n.t>[0]

const UI_LOCALE_LABELS: Record<UiLocale, string> = {
  "en": "English",
  "es": "Español",
  "ja": "日本語",
  "ko": "한국어",
  "ru": "Русский",
  "tr": "Türkçe",
  "vi": "Tiếng Việt",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
}

export default function UiLocaleConfig() {
  const [uiLocale, setUiLocale] = useAtom(configFieldsAtomMap.uiLocale)
  const selectedLocale = uiLocale ?? getBrowserPreferredUiLocale()

  return (
    <ConfigCard
      id="ui-locale"
      title={i18n.t("options.general.uiLocale.title" as I18nKey)}
      description={i18n.t("options.general.uiLocale.description" as I18nKey)}
    >
      <Select
        value={selectedLocale}
        onValueChange={(value) => {
          const nextLocale = value as UiLocale
          void setUiLocale(nextLocale).then(async () => {
            await applyI18nLocale(nextLocale)
            window.location.reload()
          })
        }}
      >
        <SelectTrigger className="w-full max-w-xs" aria-label={i18n.t("options.general.uiLocale.label" as I18nKey)}>
          <SelectValue>{UI_LOCALE_LABELS[selectedLocale]}</SelectValue>
        </SelectTrigger>
        <SelectContent align="start">
          {UI_LOCALES.map(locale => (
            <SelectItem key={locale} value={locale}>
              {UI_LOCALE_LABELS[locale]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </ConfigCard>
  )
}
