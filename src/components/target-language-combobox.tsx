import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { LanguageItem } from "./language-combobox-options"
import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import { Icon } from "@iconify/react"
import { useMemo } from "react"
import { Button } from "@/components/ui/base-ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/base-ui/combobox"
import { i18n } from "@/utils/i18n"
import { filterLanguage, getTargetLanguageItems } from "./language-combobox-options"

interface TargetLanguageComboboxProps {
  "value": LangCodeISO6393
  "onValueChange": (value: LangCodeISO6393) => void
  "disabled"?: boolean
  "aria-label"?: string
}

export function TargetLanguageCombobox({
  value,
  onValueChange,
  disabled = false,
  "aria-label": ariaLabel,
}: TargetLanguageComboboxProps) {
  const items = useMemo(() => getTargetLanguageItems(), [])
  const selectedItem = items.find(item => item.value === value) ?? null

  return (
    <Combobox<LanguageItem<LangCodeISO6393>>
      items={items}
      value={selectedItem}
      onValueChange={(item) => {
        if (item)
          onValueChange(item.value)
      }}
      filter={filterLanguage}
      disabled={disabled}
    >
      <ComboboxPrimitive.Trigger
        render={<Button variant="outline" className="w-full max-w-xs justify-between" />}
        aria-label={ariaLabel}
        disabled={disabled}
      >
        <span className="truncate">{selectedItem?.label ?? value}</span>
        <Icon icon="tabler:chevron-down" className="text-muted-foreground" />
      </ComboboxPrimitive.Trigger>
      <ComboboxContent className="w-64" align="start">
        <ComboboxInput
          showTrigger={false}
          placeholder={i18n.t("translationHub.searchLanguages")}
          aria-label={i18n.t("translationHub.searchLanguages")}
        />
        <ComboboxList>
          {(item: LanguageItem<LangCodeISO6393>) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
        <ComboboxEmpty>{i18n.t("translationHub.noLanguagesFound")}</ComboboxEmpty>
      </ComboboxContent>
    </Combobox>
  )
}
