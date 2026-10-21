import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { LanguageItem } from "@/components/language-combobox-options"
import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import { Icon } from "@iconify/react"
import { langCodeISO6393Schema } from "@read-frog/definitions"
import { IconChevronDown } from "@tabler/icons-react"
import { useAtom, useAtomValue } from "jotai"
import { useMemo } from "react"
import { filterLanguage } from "@/components/language-combobox-options"
import { Button } from "@/components/ui/base-ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/base-ui/combobox"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { detectedCodeAtom } from "@/utils/atoms/detected-code"
import { i18n } from "@/utils/i18n"
import { getLanguageLabel, getLanguageName } from "@/utils/language-labels"

function createLanguageItem(code: LangCodeISO6393): LanguageItem<LangCodeISO6393> {
  return {
    value: code,
    label: getLanguageLabel(code),
    name: getLanguageName(code),
  }
}

const langSelectorTriggerClasses = "!h-10 min-w-0 cursor-pointer rounded-lg shadow-none px-2.5 gap-2 justify-between bg-muted/20 text-[13px] font-medium motion-reduce:transition-none"

const langSelectorContentClasses = "flex items-center min-w-0 flex-1"

const langSelectorOptionClasses = "min-h-9 py-2 pr-8 pl-2.5"

function LanguageComboboxTrigger({
  label,
  title,
  ariaLabel,
}: {
  label: string
  title: string
  ariaLabel: string
}) {
  return (
    <ComboboxPrimitive.Trigger
      render={(
        <Button
          type="button"
          variant="outline"
          className={langSelectorTriggerClasses}
          aria-label={`${ariaLabel}: ${label}`}
          title={title}
        />
      )}
    >
      <div className={langSelectorContentClasses}>
        <span className="min-w-0 truncate text-left leading-5">{label}</span>
      </div>
      <IconChevronDown className="size-3.5 text-foreground/60" />
    </ComboboxPrimitive.Trigger>
  )
}

export default function LanguageOptionsSelector() {
  const [language, setLanguage] = useAtom(configFieldsAtomMap.language)
  const detectedCode = useAtomValue(detectedCodeAtom)
  const targetLanguageItems = useMemo(
    () => langCodeISO6393Schema.options.map(createLanguageItem),
    [],
  )
  const sourceLanguageItems = useMemo<LanguageItem[]>(
    () => [
      {
        value: "auto",
        label: getLanguageLabel(detectedCode),
        name: getLanguageName(detectedCode),
      },
      ...targetLanguageItems,
    ],
    [detectedCode, targetLanguageItems],
  )
  const currentSourceItem = useMemo(
    () => sourceLanguageItems.find(item => item.value === language.sourceCode) ?? sourceLanguageItems[0] ?? null,
    [language.sourceCode, sourceLanguageItems],
  )
  const currentTargetItem = useMemo(
    () => targetLanguageItems.find(item => item.value === language.targetCode) ?? null,
    [language.targetCode, targetLanguageItems],
  )

  const handleSourceLangChange = (item: LanguageItem | null) => {
    if (!item || item.value === language.sourceCode)
      return
    void setLanguage({ sourceCode: item.value })
  }

  const handleTargetLangChange = (item: LanguageItem | null) => {
    if (!item || item.value === "auto" || item.value === language.targetCode)
      return
    void setLanguage({ targetCode: item.value })
  }

  const sourceLangName = currentSourceItem?.name ?? getLanguageName(detectedCode)
  const sourceLangLabel = language.sourceCode === "auto"
    ? i18n.t("popup.autoLang")
    : sourceLangName
  const sourceLangTitle = language.sourceCode === "auto"
    ? `${currentSourceItem?.label ?? getLanguageLabel(detectedCode)} · ${i18n.t("popup.autoLang")}`
    : `${currentSourceItem?.label ?? getLanguageLabel(language.sourceCode)} · ${i18n.t("popup.sourceLang")}`

  const targetLangLabel = currentTargetItem?.name ?? getLanguageName(language.targetCode)
  const targetLangSubtitle = i18n.t("popup.targetLang")
  const targetLangTitle = `${currentTargetItem?.label ?? getLanguageLabel(language.targetCode)} · ${targetLangSubtitle}`

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_16px_minmax(0,1fr)] items-center gap-2">
      <Combobox
        value={currentSourceItem}
        onValueChange={handleSourceLangChange}
        items={sourceLanguageItems}
        filter={filterLanguage}
        autoHighlight
      >
        <LanguageComboboxTrigger
          label={sourceLangLabel}
          title={sourceLangTitle}
          ariaLabel={i18n.t("popup.sourceLang")}
        />
        <ComboboxContent className="rounded-lg shadow-md w-88">
          <ComboboxInput
            showTrigger={false}
            placeholder={i18n.t("translationHub.searchLanguages")}
          />
          <ComboboxList>
            {(item: LanguageItem) => (
              <ComboboxItem key={item.value} value={item} className={langSelectorOptionClasses}>
                {item.label}
                {item.value === "auto" && <AutoLangCell />}
              </ComboboxItem>
            )}
          </ComboboxList>
          <ComboboxEmpty>{i18n.t("translationHub.noLanguagesFound")}</ComboboxEmpty>
        </ComboboxContent>
      </Combobox>
      <div className="flex justify-center">
        <Icon icon="tabler:arrow-right" className="size-3.5 text-foreground/50" aria-hidden="true" />
      </div>
      <Combobox
        value={currentTargetItem}
        onValueChange={handleTargetLangChange}
        items={targetLanguageItems}
        filter={filterLanguage}
        autoHighlight
      >
        <LanguageComboboxTrigger
          label={targetLangLabel}
          title={targetLangTitle}
          ariaLabel={i18n.t("popup.targetLang")}
        />
        <ComboboxContent className="rounded-lg shadow-md w-88">
          <ComboboxInput
            showTrigger={false}
            placeholder={i18n.t("translationHub.searchLanguages")}
          />
          <ComboboxList>
            {(item: LanguageItem<LangCodeISO6393>) => (
              <ComboboxItem key={item.value} value={item} className={langSelectorOptionClasses}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
          <ComboboxEmpty>{i18n.t("translationHub.noLanguagesFound")}</ComboboxEmpty>
        </ComboboxContent>
      </Combobox>
    </div>
  )
}

function AutoLangCell() {
  return <span className="rounded-full bg-neutral-200 px-1 text-xs dark:bg-neutral-800 flex items-center">auto</span>
}
